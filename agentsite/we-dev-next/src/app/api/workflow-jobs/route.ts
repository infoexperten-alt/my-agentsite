import { latestWorkflowJob, readWorkflowJob } from '../chat/workflow-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const chatId = url.searchParams.get('chatId');
    if (!chatId) return Response.json({ error: 'chatId required' }, { status: 400 });
    const jobId = url.searchParams.get('jobId');
    const job = jobId
      ? await readWorkflowJob(chatId, jobId)
      : await latestWorkflowJob(chatId);
    if (!job) {
      if (jobId) return Response.json({ error: 'Workflow job not found' }, { status: 404 });
      return Response.json(null, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(job, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 404 });
  }
}