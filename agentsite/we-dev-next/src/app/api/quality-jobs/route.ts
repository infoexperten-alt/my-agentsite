import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR, QUALITY_JOBS_DIR } from '../paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QUALITY_API = 'http://127.0.0.1:3000/api/quality';
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const JOB_ID_PATTERN = /^[a-f0-9]{24}$/;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9:._-]{4,180}$/;
const MAX_CORRECTIONS = 1;
const CORRECTION_LEASE_MS = 15 * 60 * 1000;
const RUN_STALE_MS = 15 * 60 * 1000;
const activeJobRuns = new Set<string>();

type QualityJobStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'needs-correction'
  | 'correction-running'
  | 'vision-unavailable'
  | 'failed'
  | 'cancelled';

interface QualityReport {
  runId: string;
  projectId: string;
  state: 'passed' | 'needs-correction' | 'vision-unavailable';
  correctionPrompt?: string;
  [key: string]: unknown;
}

interface QualityJob {
  jobId: string;
  projectId: string;
  idempotencyKey: string;
  status: QualityJobStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxCorrections: number;
  runFailures?: number;
  qualityRunId?: string;
  report?: QualityReport;
  error?: string;
  correctionLease?: {
    token: string;
    expiresAt: string;
  };
}

function resolveProject(projectId: unknown) {
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Valid projectId required');
  }
  const directory = join(PROJECTS_DIR(), projectId);
  if (!existsSync(directory)) throw new Error('Project not found');
  return { projectId, directory };
}

function jobDirectory(projectId: string) {
  return join(QUALITY_JOBS_DIR(), projectId);
}

function jobPath(projectId: string, jobId: string) {
  if (!JOB_ID_PATTERN.test(jobId)) throw new Error('Invalid jobId');
  return join(jobDirectory(projectId), `${jobId}.json`);
}

async function readJob(projectId: string, jobId: string) {
  return JSON.parse(await readFile(jobPath(projectId, jobId), 'utf8')) as QualityJob;
}

async function persistJob(job: QualityJob) {
  const directory = jobDirectory(job.projectId);
  await mkdir(directory, { recursive: true });
  const destination = jobPath(job.projectId, job.jobId);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  await rename(temporary, destination);
}

async function latestJob(projectId: string) {
  const directory = jobDirectory(projectId);
  if (!existsSync(directory)) return null;
  const entries = await readdir(directory, { withFileTypes: true });
  const jobs = await Promise.all(entries
    .filter((entry) => entry.isFile() && JOB_ID_PATTERN.test(entry.name.replace(/\.json$/, '')))
    .map(async (entry) => readJob(projectId, entry.name.replace(/\.json$/, ''))));
  return jobs.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] || null;
}

async function fallbackIdempotencyKey(projectDirectory: string) {
  const indexPath = join(projectDirectory, 'dist', 'index.html');
  const modified = existsSync(indexPath) ? Math.trunc((await stat(indexPath)).mtimeMs) : 0;
  return `build:${modified}`;
}

function deterministicJobId(projectId: string, idempotencyKey: string) {
  return createHash('sha256').update(`${projectId}\0${idempotencyKey}`).digest('hex').slice(0, 24);
}

function isCorrectionLeaseExpired(job: QualityJob) {
  return Boolean(job.correctionLease && Date.parse(job.correctionLease.expiresAt) <= Date.now());
}

async function normalizeJob(job: QualityJob) {
  let changed = false;
  if (job.status === 'correction-running' && isCorrectionLeaseExpired(job)) {
    job.status = 'queued';
    job.error = 'Correction lease expired; quality check scheduled to verify project state';
    delete job.correctionLease;
    changed = true;
  }
  const runKey = `${job.projectId}:${job.jobId}`;
  if (
    job.status === 'running' &&
    (!activeJobRuns.has(runKey) || Date.now() - Date.parse(job.updatedAt) > RUN_STALE_MS)
  ) {
    job.status = 'queued';
    job.error = 'Recovered after interrupted quality run';
    changed = true;
  }
  if (changed) {
    job.updatedAt = new Date().toISOString();
    await persistJob(job);
  }
  return job;
}

function mapReportStatus(report: QualityReport): QualityJobStatus {
  const technicalIssues = Array.isArray((report as any).technical?.issues)
    ? (report as any).technical.issues
    : [];
  if (technicalIssues.length > 0) return 'needs-correction';
  if (report.state === 'passed') return 'passed';
  if (report.state === 'vision-unavailable') return 'vision-unavailable';
  return 'needs-correction';
}

async function runJob(projectId: string, jobId: string) {
  const key = `${projectId}:${jobId}`;
  if (activeJobRuns.has(key)) return;
  activeJobRuns.add(key);
  try {
    const job = await normalizeJob(await readJob(projectId, jobId));
    if (job.status !== 'queued' && job.status !== 'running') return;

    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    delete job.error;
    await persistJob(job);

    const response = await fetch(QUALITY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Quality API returned ${response.status}`);

    const current = await readJob(projectId, jobId);
    if (current.status === 'cancelled') return;
    current.report = result as QualityReport;
    current.qualityRunId = current.report.runId;
    current.status = mapReportStatus(current.report);
    current.updatedAt = new Date().toISOString();
    current.runFailures = 0;
    delete current.error;
    delete current.correctionLease;
    await persistJob(current);
  } catch (error) {
    const job = await readJob(projectId, jobId).catch(() => null);
    if (job && job.status !== 'cancelled') {
      job.runFailures = (job.runFailures || 0) + 1;
      job.status = job.runFailures < 3 ? 'queued' : 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date().toISOString();
      await persistJob(job);
      if (job.status === 'queued') {
        setTimeout(() => startJob(projectId, jobId), 3000);
      }
    }
  } finally {
    activeJobRuns.delete(key);
  }
}

function startJob(projectId: string, jobId: string) {
  void runJob(projectId, jobId);
}

function json(job: QualityJob, status = 200) {
  return Response.json(job, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, directory } = resolveProject(body.projectId);
    const idempotencyKey = typeof body.idempotencyKey === 'string'
      ? body.idempotencyKey
      : await fallbackIdempotencyKey(directory);
    if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
      return Response.json({ error: 'Invalid idempotencyKey' }, { status: 400 });
    }

    const jobId = deterministicJobId(projectId, idempotencyKey);
    const existing = await readJob(projectId, jobId).catch(() => null);
    if (existing) {
      const normalized = await normalizeJob(existing);
      if (normalized.status === 'queued') startJob(projectId, jobId);
      return json(normalized);
    }

    const previous = await latestJob(projectId);
    if (previous && ['queued', 'running', 'correction-running'].includes(previous.status)) {
      const normalized = await normalizeJob(previous);
      if (normalized.status === 'queued') startJob(projectId, normalized.jobId);
      return json(normalized);
    }

    const now = new Date().toISOString();
    const job: QualityJob = {
      jobId,
      projectId,
      idempotencyKey,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      maxCorrections: MAX_CORRECTIONS,
      runFailures: 0,
    };
    await persistJob(job);
    startJob(projectId, jobId);
    return json(job, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'Project not found' ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { projectId } = resolveProject(url.searchParams.get('projectId'));
    const requestedJobId = url.searchParams.get('jobId');
    const job = requestedJobId
      ? await readJob(projectId, requestedJobId)
      : await latestJob(projectId);
    if (!job) return Response.json({ error: 'Quality job not found' }, { status: 404 });
    const normalized = await normalizeJob(job);
    if (normalized.status === 'queued') startJob(projectId, normalized.jobId);
    return json(normalized);
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 404 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { projectId } = resolveProject(body.projectId);
    const job = await normalizeJob(await readJob(projectId, body.jobId));
    const action = body.action;

    if (action === 'cancel') {
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      delete job.correctionLease;
      await persistJob(job);
      return json(job);
    }

    if (action === 'retry') {
      if (!['failed', 'vision-unavailable'].includes(job.status)) {
        return Response.json({ error: 'Job cannot be retried from current state' }, { status: 409 });
      }
      job.status = 'queued';
      job.updatedAt = new Date().toISOString();
      job.runFailures = 0;
      delete job.error;
      await persistJob(job);
      startJob(projectId, job.jobId);
      return json(job, 202);
    }

    if (action === 'claim-correction') {
      if (job.status !== 'needs-correction' || !job.report?.correctionPrompt) {
        return Response.json({ error: 'Correction is not available' }, { status: 409 });
      }
      if (job.attempts >= job.maxCorrections) {
        return Response.json({ error: 'Correction limit reached' }, { status: 409 });
      }
      const token = randomUUID();
      job.attempts += 1;
      job.status = 'correction-running';
      job.correctionLease = {
        token,
        expiresAt: new Date(Date.now() + CORRECTION_LEASE_MS).toISOString(),
      };
      job.updatedAt = new Date().toISOString();
      delete job.error;
      await persistJob(job);
      return Response.json({
        job,
        correction: {
          projectId,
          jobId: job.jobId,
          runId: job.qualityRunId,
          prompt: job.report.correctionPrompt,
          attempt: job.attempts,
          leaseToken: token,
        },
      });
    }

    if (action === 'complete-correction' || action === 'fail-correction') {
      if (job.status !== 'correction-running' || job.correctionLease?.token !== body.leaseToken) {
        return Response.json({ error: 'Invalid correction lease' }, { status: 409 });
      }
      delete job.correctionLease;
      job.updatedAt = new Date().toISOString();
      if (action === 'complete-correction') {
        job.status = 'queued';
        delete job.error;
        await persistJob(job);
        startJob(projectId, job.jobId);
        return json(job, 202);
      }
      job.status = job.attempts < job.maxCorrections ? 'needs-correction' : 'failed';
      job.error = typeof body.error === 'string' ? body.error.slice(0, 1000) : 'Correction failed';
      await persistJob(job);
      return json(job);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400 });
  }
}
