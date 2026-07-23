import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { WORKFLOW_JOBS_DIR } from '../paths';
import type { AgentProfileId } from './registry';

const CHAT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const JOB_ID_PATTERN = /^workflow-\d{10,20}-[a-f0-9]{8}$/;
const STALE_JOB_MS = 20 * 60 * 1000;
const writeQueues = new Map<string, Promise<void>>();

export type WorkflowJobStatus = 'running' | 'synthesizing' | 'completed' | 'failed';
export type WorkflowStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type WorkflowAttemptStatus = 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowModelAttempt {
  attempt: number;
  requestedModel: string;
  resolvedModel?: string;
  status: WorkflowAttemptStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowStage {
  role: AgentProfileId;
  label: string;
  status: WorkflowStageStatus;
  summary?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  requestedModel?: string;
  resolvedModel?: string;
  model?: string;
  output?: string;
  attempts?: WorkflowModelAttempt[];
}

export interface WorkflowJob {
  jobId: string;
  chatId: string;
  mode: string;
  goal?: string;
  requestKey?: string;
  status: WorkflowJobStatus;
  createdAt: string;
  updatedAt: string;
  currentRole?: AgentProfileId;
  stages: WorkflowStage[];
  finalSummary?: string;
  error?: string;
  synthesisRequestedModel?: string;
  synthesisResolvedModel?: string;
  synthesisAttempts?: WorkflowModelAttempt[];
}

function normalizeChatId(chatId?: string) {
  if (!chatId) return `chat_`;
  if (CHAT_ID_PATTERN.test(chatId)) return chatId;
  return `h_${createHash('sha1').update(chatId).digest('hex').slice(0, 24)}`;
}

function chatDirectory(chatId: string) {
  return join(WORKFLOW_JOBS_DIR(), chatId);
}

function jobPath(chatId: string, jobId: string) {
  if (!JOB_ID_PATTERN.test(jobId)) {
    throw new Error('Invalid workflow job id');
  }
  return join(chatDirectory(chatId), `${jobId}.json`);
}

async function ensureDirectory(path: string) {
  await mkdir(path, { recursive: true });
}

async function enqueueWrite(path: string, task: () => Promise<void>) {
  const previous = writeQueues.get(path) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  writeQueues.set(path, next);
  try {
    await next;
  } finally {
    if (writeQueues.get(path) === next) writeQueues.delete(path);
  }
}

async function atomicWrite(path: string, value: unknown) {
  await enqueueWrite(path, async () => {
    const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(tempPath, path);
  });
}

async function atomicPersist(job: WorkflowJob) {
  await atomicWrite(jobPath(job.chatId, job.jobId), job);
}

export async function createWorkflowJob(input: {
  chatId?: string;
  mode: string;
  goal?: string;
  requestKey?: string;
  roles: AgentProfileId[];
}) {
  const chatId = normalizeChatId(input.chatId);
  if (input.requestKey) {
    const existing = await latestWorkflowJob(chatId, input.requestKey);
    if (existing && existing.status !== 'failed') return existing;
  }
  const now = new Date().toISOString();
  const job: WorkflowJob = {
    jobId: `workflow-${Date.now()}-${randomUUID().slice(0, 8)}`,
    chatId,
    mode: input.mode,
    goal: input.goal,
    requestKey: input.requestKey,
    status: 'running',
    createdAt: now,
    updatedAt: now,
    stages: input.roles.map((role) => ({
      role,
      label: role,
      status: 'pending',
    })),
  };
  await ensureDirectory(chatDirectory(chatId));
  await atomicPersist(job);
  return job;
}

export async function updateWorkflowStage(
  job: WorkflowJob,
  role: AgentProfileId,
  status: WorkflowStageStatus,
  patch: Partial<Omit<WorkflowStage, 'role' | 'label' | 'status'>> = {},
) {
  const stage = job.stages.find((item) => item.role === role);
  if (!stage) return job;
  Object.assign(stage, patch, { status });
  if (status === 'running') {
    stage.startedAt = stage.startedAt || new Date().toISOString();
    job.currentRole = role;
    job.status = 'running';
  }
  if (status === 'completed' || status === 'failed' || status === 'skipped') {
    stage.completedAt = new Date().toISOString();
    if (job.currentRole === role) delete job.currentRole;
  }
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
  return job;
}

export async function recordWorkflowModelAttempt(
  job: WorkflowJob,
  role: AgentProfileId,
  attempt: WorkflowModelAttempt,
) {
  const stage = job.stages.find((item) => item.role === role);
  if (!stage) return job;
  stage.attempts = stage.attempts || [];
  const existingIndex = stage.attempts.findIndex((item) => item.attempt === attempt.attempt);
  if (existingIndex >= 0) stage.attempts[existingIndex] = attempt;
  else stage.attempts.push(attempt);
  if (!stage.requestedModel || attempt.attempt === 1) {
    stage.requestedModel = attempt.requestedModel;
  }
  if (attempt.resolvedModel) stage.resolvedModel = attempt.resolvedModel;
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
  return job;
}

export async function recordWorkflowSynthesisAttempt(
  job: WorkflowJob,
  attempt: WorkflowModelAttempt,
) {
  job.synthesisAttempts = job.synthesisAttempts || [];
  const existingIndex = job.synthesisAttempts.findIndex((item) => item.attempt === attempt.attempt);
  if (existingIndex >= 0) job.synthesisAttempts[existingIndex] = attempt;
  else job.synthesisAttempts.push(attempt);
  if (!job.synthesisRequestedModel || attempt.attempt === 1) {
    job.synthesisRequestedModel = attempt.requestedModel;
  }
  if (attempt.resolvedModel) job.synthesisResolvedModel = attempt.resolvedModel;
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
}

export async function markWorkflowSynthesizing(job: WorkflowJob) {
  job.status = 'synthesizing';
  delete job.currentRole;
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
}

export async function completeWorkflowJob(
  job: WorkflowJob,
  finalSummary: string,
  resolvedModel?: string,
) {
  job.status = 'completed';
  delete job.currentRole;
  delete job.error;
  job.finalSummary = finalSummary;
  if (resolvedModel) {
    job.synthesisResolvedModel = resolvedModel;
    const completedAttempt = [...(job.synthesisAttempts || [])]
      .reverse()
      .find((attempt) => attempt.status === 'completed');
    if (completedAttempt) completedAttempt.resolvedModel = resolvedModel;
  }
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
}

export async function failWorkflowJob(job: WorkflowJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  job.status = 'failed';
  job.error = message.slice(0, 2000);
  if (job.currentRole) {
    const stage = job.stages.find((item) => item.role === job.currentRole);
    if (stage && stage.status === 'running') {
      stage.status = 'failed';
      stage.error = job.error;
      stage.completedAt = new Date().toISOString();
    }
  }
  delete job.currentRole;
  job.updatedAt = new Date().toISOString();
  await atomicPersist(job);
}

export async function readWorkflowJob(chatId: string, jobId: string) {
  const normalizedChatId = normalizeChatId(chatId);
  return JSON.parse(await readFile(jobPath(normalizedChatId, jobId), 'utf8')) as WorkflowJob;
}

export async function latestWorkflowJob(chatId: string, requestKey?: string) {
  const normalizedChatId = normalizeChatId(chatId);
  const directory = chatDirectory(normalizedChatId);
  if (!existsSync(directory)) return null;
  const entries = await readdir(directory, { withFileTypes: true });
  const jobs = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('workflow-') && entry.name.endsWith('.json'))
    .map(async (entry) => {
      try {
        return JSON.parse(await readFile(join(directory, entry.name), 'utf8')) as WorkflowJob;
      } catch {
        return null;
      }
    }));
  const latest = jobs
    .filter((job): job is WorkflowJob => Boolean(job))
    .filter((job) => !requestKey || job.requestKey === requestKey)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] || null;
  if (
    latest
    && ['running', 'synthesizing'].includes(latest.status)
    && Date.now() - Date.parse(latest.updatedAt) > STALE_JOB_MS
  ) {
    await failWorkflowJob(latest, 'Workflow interrupted before completion');
  }
  return latest;
}





