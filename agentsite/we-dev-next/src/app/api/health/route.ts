import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import {
  PROJECTS_DIR,
  QUALITY_DIR,
  QUALITY_JOBS_DIR,
  RELEASES_DIR,
  REVISIONS_DIR,
  STAGING_DIR,
  WORKFLOW_JOBS_DIR,
} from '../paths';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const storageDirectories = {
  projects: PROJECTS_DIR,
  staging: STAGING_DIR,
  revisions: REVISIONS_DIR,
  quality: QUALITY_DIR,
  qualityJobs: QUALITY_JOBS_DIR,
  releases: RELEASES_DIR,
  workflowJobs: WORKFLOW_JOBS_DIR,
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function probeDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
  const probeId = `.health-${process.pid}-${randomUUID()}`;
  const source = `${directory}/${probeId}.tmp`;
  const target = `${directory}/${probeId}.ok`;
  try {
    await writeFile(source, probeId, 'utf8');
    await rename(source, target);
    if (await readFile(target, 'utf8') !== probeId) throw new Error('Storage readback mismatch');
  } finally {
    await rm(source, { force: true }).catch(() => undefined);
    await rm(target, { force: true }).catch(() => undefined);
  }
}

async function checkModelGateway() {
  const apiBase = process.env.THIRD_API_URL?.trim() || 'http://64.188.115.45:3001/v1';
  const healthUrl = new URL(apiBase);
  healthUrl.pathname = '/health';
  healthUrl.search = '';
  const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Model gateway returned ${response.status}`);
}

export async function GET(req: Request) {
  const timestamp = new Date().toISOString();
  const probe = new URL(req.url).searchParams.get('probe');

  if (!probe || probe === 'liveness') {
    return json({
      status: 'ok',
      probe: 'liveness',
      timestamp,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  if (probe !== 'readiness') {
    return json({ error: 'Unsupported probe. Use liveness or readiness.' }, 400);
  }

  const startedAt = performance.now();
  const storageResults = await Promise.all(Object.entries(storageDirectories).map(async ([name, getDirectory]) => {
    try {
      await probeDirectory(getDirectory());
      return [name, 'ok'] as const;
    } catch (error) {
      console.error(`Readiness storage check failed (${name}):`, error);
      return [name, 'unavailable'] as const;
    }
  }));
  let modelGateway: 'ok' | 'degraded' = 'ok';
  try {
    await checkModelGateway();
  } catch (error) {
    modelGateway = 'degraded';
    console.error('Readiness model gateway check failed:', error);
  }

  const storage = Object.fromEntries(storageResults);
  const storageReady = storageResults.every(([, status]) => status === 'ok');
  return json({
    status: storageReady ? (modelGateway === 'ok' ? 'ready' : 'ready-degraded') : 'not-ready',
    probe: 'readiness',
    timestamp,
    checks: { storage, modelGateway },
    durationMs: Math.round(performance.now() - startedAt),
  }, storageReady ? 200 : 503);
}
