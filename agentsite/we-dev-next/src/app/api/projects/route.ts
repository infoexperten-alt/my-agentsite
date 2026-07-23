import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';
import { NextRequest } from 'next/server';
import { PROJECTS_DIR, REVISIONS_DIR, STAGING_DIR } from '../paths';

type PackageJson = {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function detectFramework(pkg: PackageJson) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return 'Next.js';
  if (deps.react && deps.vite) return 'React + Vite';
  if (deps.vue) return 'Vue';
  if (deps.react) return 'React';
  if (deps.astro) return 'Astro';
  if (deps.nuxt) return 'Nuxt';
  if (deps['@angular/core']) return 'Angular';
  if (deps.express) return 'Express';
  return 'Node.js';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidProjectId(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,80}$/.test(value);
}

function resolveInside(root: string, relativePath: string) {
  const normalized = normalize(relativePath).replace(/^[/\\]+/, '');
  const target = resolve(root, normalized);
  const resolvedRoot = resolve(root);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Unsafe project path: ${relativePath}`);
  }
  return target;
}

async function getProjectInfo(projectId: string) {
  try {
    const projectDirectory = join(PROJECTS_DIR(), projectId);
    const pkg = JSON.parse(await readFile(join(projectDirectory, 'package.json'), 'utf8')) as PackageJson;
    const projectStats = await stat(projectDirectory);
    const files: Array<{ path: string; size: number }> = [];
    async function walk(relativeDirectory: string) {
      const directory = join(projectDirectory, relativeDirectory);
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(relativePath);
        else if (entry.isFile()) files.push({ path: relativePath, size: (await stat(join(directory, entry.name))).size });
      }
    }
    await walk('');
    const name = pkg.name || projectId;
    const timestamp = projectId.match(/(\d{10,13})$/)?.[1];
    return {
      id: projectId,
      name,
      description: pkg.description || '',
      framework: detectFramework(pkg),
      fileCount: files.length,
      hasDist: files.some((file) => file.path.startsWith('dist/')),
      size: formatSize(files.reduce((total, file) => total + file.size, 0)),
      createdAt: projectStats.birthtime || projectStats.ctime || projectStats.mtime,
      modifiedAt: projectStats.mtime,
      packageJson: pkg,
      displayName: timestamp ? new Date(Number(timestamp.length === 10 ? `${timestamp}000` : timestamp)).toLocaleString('ru-RU') : null,
    };
  } catch {
    return { id: projectId, name: projectId, description: '', framework: 'unknown', fileCount: 0, hasDist: false, size: '—', createdAt: null, modifiedAt: null, packageJson: null, displayName: null };
  }
}

export async function GET(req: NextRequest) {
  try {
    await mkdir(PROJECTS_DIR(), { recursive: true });
    const projectId = req.nextUrl.searchParams.get('id');
    if (projectId) return Response.json(await getProjectInfo(projectId));
    const entries = await readdir(PROJECTS_DIR(), { withFileTypes: true });
    const projects = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => getProjectInfo(entry.name)));
    projects.sort((left, right) => Date.parse(String(right.modifiedAt || 0)) - Date.parse(String(left.modifiedAt || 0)));
    return Response.json({ projects });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let stagingDirectory = '';
  try {
    const body = await req.json() as { id?: unknown; files?: unknown };
    if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) {
      return Response.json({ error: 'files required' }, { status: 400 });
    }
    const requestedId = String(body.id || '').trim();
    const projectId = requestedId || `proj-${Date.now()}`;
    if (!isValidProjectId(projectId)) return Response.json({ error: 'invalid project id' }, { status: 400 });

    await Promise.all([PROJECTS_DIR(), STAGING_DIR(), REVISIONS_DIR()].map((directory) => mkdir(directory, { recursive: true })));
    const projectDirectory = join(PROJECTS_DIR(), projectId);
    stagingDirectory = join(STAGING_DIR(), `${projectId}-${randomUUID()}`);
    await mkdir(stagingDirectory, { recursive: true });
    if (existsSync(projectDirectory)) await cp(projectDirectory, stagingDirectory, { recursive: true, force: true });

    let filesWritten = 0;
    for (const [relativePath, content] of Object.entries(body.files as Record<string, unknown>)) {
      if (typeof content !== 'string') continue;
      const target = resolveInside(stagingDirectory, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
      filesWritten += 1;
    }
    if (filesWritten === 0) throw new Error('No valid project files supplied');

    if (!existsSync(projectDirectory)) {
      await rename(stagingDirectory, projectDirectory);
    } else {
      const revisionDirectory = join(REVISIONS_DIR(), `${projectId}-${Date.now()}`);
      await rename(projectDirectory, revisionDirectory);
      try {
        await rename(stagingDirectory, projectDirectory);
      } catch (error) {
        await rename(revisionDirectory, projectDirectory);
        throw error;
      }
    }
    stagingDirectory = '';
    return Response.json({ ok: true, id: projectId, filesWritten, dashboard: '/api/projects/ui' });
  } catch (error) {
    if (stagingDirectory) await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('id') || '';
    if (!isValidProjectId(projectId)) return Response.json({ error: 'valid id required' }, { status: 400 });
    await rm(join(PROJECTS_DIR(), projectId), { recursive: true, force: true });
    return Response.json({ ok: true, id: projectId });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
