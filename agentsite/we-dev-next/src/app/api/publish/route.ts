import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR, QUALITY_JOBS_DIR, RELEASES_DIR } from '../paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const RELEASE_ID_PATTERN = /^release-[0-9]{13}-[a-f0-9]{8}$/;
const OVERRIDE_ACKNOWLEDGEMENT = 'PUBLISH_WITHOUT_VISION';
const MIN_TECHNICAL_SCORE = 90;

interface QualityJob {
  jobId: string;
  projectId: string;
  idempotencyKey: string;
  status: string;
  updatedAt: string;
  qualityRunId?: string;
  report?: {
    state?: string;
    score?: number;
    technical?: { score?: number; issues?: string[] };
    vision?: { available?: boolean; score?: number; summary?: string };
  };
}

interface OperatorOverride {
  acknowledgement?: string;
  reason?: string;
}

interface ReleaseManifest {
  releaseId: string;
  projectId: string;
  buildVersion: string;
  createdAt: string;
  createdBy: string;
  previousReleaseId?: string;
  quality: {
    jobId: string;
    runId?: string;
    state: string;
    finalScore?: number;
    technicalScore: number;
    visionAvailable: boolean;
    visionScore?: number;
  };
  operatorOverride?: {
    reason: string;
    createdAt: string;
    createdBy: string;
  };
  releaseNotes?: string;
}

const activePublishes = new Set<string>();

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function validateProjectId(projectId: unknown) {
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Valid projectId required');
  }
  return projectId;
}

function resolveProject(projectId: unknown) {
  const validatedProjectId = validateProjectId(projectId);
  const projectDirectory = join(PROJECTS_DIR(), validatedProjectId);
  const distDirectory = join(projectDirectory, 'dist');
  if (!existsSync(projectDirectory)) throw new Error('Project not found');
  if (!existsSync(join(distDirectory, 'index.html'))) {
    throw new Error('Preview build required before publishing');
  }
  return { projectId: validatedProjectId, projectDirectory, distDirectory };
}

async function getBuildVersion(distDirectory: string) {
  return String(Math.trunc((await stat(join(distDirectory, 'index.html'))).mtimeMs));
}

function qualityJobId(projectId: string, buildVersion: string) {
  return createHash('sha256')
    .update(`${projectId}\0build:${buildVersion}`)
    .digest('hex')
    .slice(0, 24);
}

async function readQualityJob(projectId: string, buildVersion: string) {
  const jobId = qualityJobId(projectId, buildVersion);
  const path = join(QUALITY_JOBS_DIR(), projectId, `${jobId}.json`);
  const directory = join(QUALITY_JOBS_DIR(), projectId);
  if (!existsSync(directory)) return null;
  const matchingJobs = [] as QualityJob[];
  if (existsSync(path)) {
    try {
      const deterministicJob = JSON.parse(await readFile(path, 'utf8')) as QualityJob;
      const reportedBuild = String((deterministicJob.report as any)?.preview?.buildVersion || '');
      if (reportedBuild === buildVersion) matchingJobs.push(deterministicJob);
    } catch {}
  }
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const candidate = JSON.parse(await readFile(join(directory, entry.name), 'utf8')) as QualityJob;
      const reportedBuild = String((candidate.report as any)?.preview?.buildVersion || '');
      if (reportedBuild === buildVersion) {
        matchingJobs.push({ ...candidate, idempotencyKey: `build:${buildVersion}` });
      }
    } catch {
      continue;
    }
  }
  return matchingJobs.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] || null;
}

function validateGate(job: QualityJob, override: OperatorOverride | undefined) {
  const report = job.report;
  const technicalScore = Number(report?.technical?.score || 0);
  const technicalIssues = Array.isArray(report?.technical?.issues) ? report.technical.issues : [];
  const visionAvailable = report?.vision?.available === true;

  if (['queued', 'running', 'correction-running'].includes(job.status)) {
    return { ok: false as const, status: 409, code: 'QUALITY_PENDING', error: 'Quality gate is still running' };
  }
  if (job.status === 'needs-correction' || job.status === 'failed' || job.status === 'cancelled') {
    return { ok: false as const, status: 412, code: 'QUALITY_REJECTED', error: 'Quality gate rejected this build' };
  }
  if (technicalScore < MIN_TECHNICAL_SCORE || technicalIssues.length > 0) {
    return {
      ok: false as const,
      status: 412,
      code: 'TECHNICAL_GATE_REJECTED',
      error: `Technical QA must be at least ${MIN_TECHNICAL_SCORE}/100 with no issues`,
    };
  }
  const finalScore = Number(report?.score || 0);
  const visionScore = Number(report?.vision?.score || 0);
  if (job.status === 'passed' && visionAvailable && finalScore >= 85 && visionScore >= 85) {
    return { ok: true as const, technicalScore, visionAvailable, overrideReason: '' };
  }
  if (job.status === 'vision-unavailable') {
    const reason = typeof override?.reason === 'string' ? override.reason.trim() : '';
    if (override?.acknowledgement === OVERRIDE_ACKNOWLEDGEMENT && reason.length >= 12) {
      return {
        ok: true as const,
        technicalScore,
        visionAvailable: false,
        overrideReason: reason.slice(0, 1000),
      };
    }
    return {
      ok: false as const,
      status: 412,
      code: 'VISION_REQUIRED',
      error: 'Visual QA is temporarily unavailable; operator override is required after a clean technical QA',
      requiresOverride: true,
      acknowledgement: OVERRIDE_ACKNOWLEDGEMENT,
      technicalScore,
    };
  }
  return { ok: false as const, status: 412, code: 'QUALITY_GATE_REJECTED', error: 'Quality verdict is not publishable' };
}

function projectReleaseDirectory(projectId: string) {
  return join(RELEASES_DIR(), projectId);
}

async function readCurrent(projectId: string) {
  const path = join(projectReleaseDirectory(projectId), 'current.json');
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf8')) as { releaseId: string; [key: string]: unknown };
}

async function atomicWriteJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

async function listReleases(projectId: string) {
  const directory = projectReleaseDirectory(projectId);
  if (!existsSync(directory)) return [] as ReleaseManifest[];
  const entries = await readdir(directory, { withFileTypes: true });
  const manifests = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && RELEASE_ID_PATTERN.test(entry.name))
    .map(async (entry) => {
      try {
        return JSON.parse(await readFile(join(directory, entry.name, 'manifest.json'), 'utf8')) as ReleaseManifest;
      } catch {
        return null;
      }
    }));
  return manifests
    .filter((manifest): manifest is ReleaseManifest => Boolean(manifest))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export async function GET(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get('projectId');
    if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
      return json({ error: 'Valid projectId required' }, 400);
    }
    const [current, releases] = await Promise.all([readCurrent(projectId), listReleases(projectId)]);
    return json({ projectId, current, releases: releases.slice(0, 20) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function POST(req: Request) {
  let projectId = '';
  let stagingDirectory = '';
  let publishLockAcquired = false;
  try {
    const body = await req.json();
    const resolved = resolveProject(body.projectId);
    projectId = resolved.projectId;
    if (activePublishes.has(projectId)) {
      return json({ error: 'Publish already in progress', code: 'PUBLISH_IN_PROGRESS' }, 409);
    }
    activePublishes.add(projectId);
    publishLockAcquired = true;

    const buildVersion = await getBuildVersion(resolved.distDirectory);
    const qualityJob = await readQualityJob(projectId, buildVersion);
    if (!qualityJob) {
      return json({ error: 'Run Preview and wait for QA before publishing', code: 'QUALITY_REQUIRED' }, 409);
    }
    if (qualityJob.idempotencyKey !== `build:${buildVersion}`) {
      return json({ error: 'Quality report does not match the current build', code: 'QUALITY_OUTDATED' }, 409);
    }
    const gate = validateGate(qualityJob, body.operatorOverride);
    if (!gate.ok) return json(gate, gate.status);

    const createdAt = new Date().toISOString();
    const releaseHash = createHash('sha256')
      .update(`${projectId}\0${buildVersion}\0${createdAt}`)
      .digest('hex')
      .slice(0, 8);
    const releaseId = `release-${Date.now()}-${releaseHash}`;
    const releasesDirectory = projectReleaseDirectory(projectId);
    const releaseDirectory = join(releasesDirectory, releaseId);
    stagingDirectory = join(releasesDirectory, `.${releaseId}.${randomUUID()}.staging`);
    await mkdir(releasesDirectory, { recursive: true });
    const current = await readCurrent(projectId);
    if (typeof current?.releaseId === 'string' && RELEASE_ID_PATTERN.test(current.releaseId)) {
      const currentManifestPath = join(releasesDirectory, current.releaseId, 'manifest.json');
      if (existsSync(currentManifestPath)) {
        const currentManifest = JSON.parse(await readFile(currentManifestPath, 'utf8')) as ReleaseManifest;
        if (currentManifest.buildVersion === buildVersion && currentManifest.quality.jobId === qualityJob.jobId) {
          return json({
            ok: true,
            reused: true,
            release: currentManifest,
            releaseUrl: `/api/published/${encodeURIComponent(projectId)}`,
            rollbackAvailable: Boolean(currentManifest.previousReleaseId),
          });
        }
      }
    }
    const createdBy = req.headers.get('userId') || 'guest-operator';
    const manifest: ReleaseManifest = {
      releaseId,
      projectId,
      buildVersion,
      createdAt,
      createdBy,
      previousReleaseId: typeof current?.releaseId === 'string' ? current.releaseId : undefined,
      quality: {
        jobId: qualityJob.jobId,
        runId: qualityJob.qualityRunId,
        state: qualityJob.status,
        finalScore: qualityJob.report?.score,
        technicalScore: gate.technicalScore,
        visionAvailable: gate.visionAvailable,
        visionScore: qualityJob.report?.vision?.score,
      },
      releaseNotes: typeof body.releaseNotes === 'string' ? body.releaseNotes.trim().slice(0, 1000) : undefined,
    };
    if (gate.overrideReason) {
      manifest.operatorOverride = { reason: gate.overrideReason, createdAt, createdBy };
    }

    await mkdir(stagingDirectory, { recursive: true });
    await cp(resolved.distDirectory, join(stagingDirectory, 'dist'), { recursive: true, force: false });
    await writeFile(join(stagingDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(stagingDirectory, releaseDirectory);
    stagingDirectory = '';
    await atomicWriteJson(join(releasesDirectory, 'current.json'), {
      releaseId,
      projectId,
      buildVersion,
      activatedAt: createdAt,
      previousReleaseId: manifest.previousReleaseId,
    });

    return json({
      ok: true,
      release: manifest,
      releaseUrl: `/api/published/${encodeURIComponent(projectId)}`,
      rollbackAvailable: Boolean(manifest.previousReleaseId),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Project not found' ? 404 : message.includes('required before publishing') ? 409 : 500;
    return json({ error: message }, status);
  } finally {
    if (stagingDirectory) await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    if (projectId && publishLockAcquired) activePublishes.delete(projectId);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    if (body.action !== 'rollback' || body.confirmation !== 'ROLLBACK_RELEASE') {
      return json({ error: 'Explicit rollback confirmation required' }, 400);
    }
    const projectId = validateProjectId(body.projectId);
    const targetReleaseId = typeof body.targetReleaseId === 'string' ? body.targetReleaseId : '';
    if (!RELEASE_ID_PATTERN.test(targetReleaseId)) {
      return json({ error: 'Valid targetReleaseId required' }, 400);
    }
    const releasesDirectory = projectReleaseDirectory(projectId);
    const manifestPath = join(releasesDirectory, targetReleaseId, 'manifest.json');
    if (!existsSync(manifestPath)) return json({ error: 'Release not found' }, 404);
    const current = await readCurrent(projectId);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ReleaseManifest;
    const rolledBackAt = new Date().toISOString();
    await atomicWriteJson(join(releasesDirectory, 'current.json'), {
      releaseId: targetReleaseId,
      projectId,
      buildVersion: manifest.buildVersion,
      activatedAt: rolledBackAt,
      rollback: {
        fromReleaseId: current?.releaseId,
        performedAt: rolledBackAt,
        performedBy: req.headers.get('userId') || 'guest-operator',
      },
    });
    return json({ ok: true, currentReleaseId: targetReleaseId, releaseUrl: `/api/published/${encodeURIComponent(projectId)}` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
