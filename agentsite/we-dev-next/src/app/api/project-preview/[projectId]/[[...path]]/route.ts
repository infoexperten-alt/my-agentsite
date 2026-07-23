import { readFile, stat } from 'fs/promises';
import { extname, join } from 'path';
import { PROJECTS_DIR } from '../../../paths';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const SAFE_SEGMENT_PATTERN = /^[^\\/\0]+$/;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

interface RouteContext {
  params: { projectId: string; path?: string[] };
}

function safeSegments(path: string[] | undefined) {
  const segments = path || [];
  if (segments.some((segment) => !SAFE_SEGMENT_PATTERN.test(segment) || segment === '.' || segment === '..')) {
    throw new Error('Invalid preview path');
  }
  return segments;
}

function transformHtml(html: string, projectId: string) {
  const basePath = `/api/project-preview/${encodeURIComponent(projectId)}/`;
  const rewritten = html.replace(/\b(src|href)=(["'])\/(?!\/)/gi, (_match, attribute, quote) => {
    return `${attribute}=${quote}${basePath}`;
  });
  const fallbackIcon = /<link[^>]+rel=["'][^"']*icon/i.test(rewritten)
    ? ''
    : '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%23111827%22/%3E%3Cpath d=%22M9 22V10h5.8c4.8 0 8.2 2.2 8.2 6s-3.4 6-8.2 6H9zm4-3h1.8c2.7 0 4.2-1 4.2-3s-1.5-3-4.2-3H13v6z%22 fill=%22%2360a5fa%22/%3E%3C/svg%3E">';
  const headAssets = `<base href="${basePath}">${fallbackIcon}`;
  return /<head[\s>]/i.test(rewritten)
    ? rewritten.replace(/<head([^>]*)>/i, `<head$1>${headAssets}`)
    : `${headAssets}${rewritten}`;
}

async function existingFile(path: string) {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { projectId } = params;
    if (!PROJECT_ID_PATTERN.test(projectId)) {
      return Response.json({ error: 'Invalid projectId' }, { status: 400 });
    }

    const segments = safeSegments(params.path);
    const projectDirectory = join(PROJECTS_DIR(), projectId);
    const distDirectory = join(projectDirectory, 'dist');
    const relativeSegments = segments.length > 0 ? segments : ['index.html'];
    const assetSegments = relativeSegments[0] === 'assets' ? relativeSegments.slice(1) : relativeSegments;
    const candidates = [
      join(distDirectory, ...relativeSegments),
      join(projectDirectory, ...relativeSegments),
      join(projectDirectory, 'public', ...relativeSegments),
      join(distDirectory, ...assetSegments),
      join(projectDirectory, 'public', ...assetSegments),
    ];
    let filePath = '';
    for (const candidate of candidates) {
      if (await existingFile(candidate)) {
        filePath = candidate;
        break;
      }
    }
    if (!filePath && !extname(relativeSegments[relativeSegments.length - 1])) {
      filePath = join(distDirectory, 'index.html');
    }

    if (!filePath || !await existingFile(filePath)) {
      return new Response('Preview asset not found', { status: 404 });
    }

    const extension = extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';
    const cacheControl = segments[0] === 'assets'
      ? 'public, max-age=31536000, immutable'
      : 'private, no-store, max-age=0';

    if (extension === '.html') {
      const html = transformHtml(await readFile(filePath, 'utf8'), projectId);
      return new Response(html, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "frame-ancestors 'self'",
        },
      });
    }

    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}


