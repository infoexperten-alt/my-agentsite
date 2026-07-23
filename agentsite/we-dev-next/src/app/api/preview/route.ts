import { execSync } from 'child_process';
import { join } from 'path';
import fs from 'fs';
import { PROJECTS_DIR } from '../paths';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const previewBuildQueues = new Map<string, Promise<void>>();

async function acquirePreviewBuildLock(projectId: string) {
  const previous = previewBuildQueues.get(projectId) || Promise.resolve();
  let releaseCurrent!: () => void;
  const currentGate = new Promise<void>((resolve) => { releaseCurrent = resolve; });
  const current = previous.catch(() => undefined).then(() => currentGate);
  previewBuildQueues.set(projectId, current);
  await previous.catch(() => undefined);
  return () => {
    releaseCurrent();
    if (previewBuildQueues.get(projectId) === current) previewBuildQueues.delete(projectId);
  };
}



const KNOWN_VITE_CONFIG_DEPENDENCIES: Record<string, string> = {
  vite: '^5.4.8',
  '@vitejs/plugin-react': '^4.3.4',
  '@vitejs/plugin-react-swc': '^3.7.2',
};

function hasTailwindDirectives(directory: string): boolean {
  if (!fs.existsSync(directory)) return false;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (hasTailwindDirectives(fullPath)) return true;
      continue;
    }
    if (/\.css$/i.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/@tailwind\s+(base|components|utilities)/.test(content)) return true;
    }
  }
  return false;
}

function ensureStaticRouterCompatibility(projectDir: string): string[] {
  const sourceDir = join(projectDir, 'src');
  const updatedFiles: string[] = [];

  function visit(directory: string) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!/\.(jsx|tsx|js|ts)$/i.test(entry.name)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.includes('react-router-dom') || !content.includes('BrowserRouter')) continue;
      const updated = content.replace(/\bBrowserRouter\b/g, 'HashRouter');
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        updatedFiles.push(fullPath.slice(projectDir.length + 1));
      }
    }
  }

  visit(sourceDir);
  return updatedFiles;
}

function ensureProjectBuildConfiguration(projectDir: string): {
  addedDependencies: string[];
  createdFiles: string[];
  updatedFiles: string[];
  requiredDependencies: string[];
} {
  const packageJsonPath = join(projectDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return { addedDependencies: [], createdFiles: [], updatedFiles: [], requiredDependencies: [] };

  const configFiles = [
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.ts',
    'vite.config.mts',
  ];
  const configSource = configFiles
    .map((fileName) => join(projectDir, fileName))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.dependencies ||= {};
  packageJson.devDependencies ||= {};

  const usesTailwind = hasTailwindDirectives(projectDir);
  const requiredDependencies: Record<string, string> = { ...KNOWN_VITE_CONFIG_DEPENDENCIES };
  if (usesTailwind) {
    requiredDependencies.tailwindcss = '^3.4.13';
    requiredDependencies.postcss = '^8.4.47';
    requiredDependencies.autoprefixer = '^10.4.20';
  }

  const addedDependencies: string[] = [];
  for (const [packageName, version] of Object.entries(requiredDependencies)) {
    const isRequired = packageName === 'vite' || configSource.includes(packageName) || usesTailwind && ['tailwindcss', 'postcss', 'autoprefixer'].includes(packageName);
    const isDeclared = packageJson.dependencies[packageName] || packageJson.devDependencies[packageName];
    if (isRequired && !isDeclared) {
      packageJson.devDependencies[packageName] = version;
      addedDependencies.push(packageName);
    }
  }

  if (addedDependencies.length > 0) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  }

  const createdFiles: string[] = [];
  const hasPostcssConfig = ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs']
    .some((fileName) => fs.existsSync(join(projectDir, fileName)));
  if (usesTailwind && !hasPostcssConfig) {
    const isModule = packageJson.type === 'module';
    const fileName = isModule ? 'postcss.config.js' : 'postcss.config.cjs';
    const content = isModule
      ? "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n"
      : "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }\n";
    fs.writeFileSync(join(projectDir, fileName), content, 'utf8');
    createdFiles.push(fileName);
  }

  const updatedFiles = ensureStaticRouterCompatibility(projectDir);
  return { addedDependencies, createdFiles, updatedFiles, requiredDependencies: Object.keys(requiredDependencies).filter((packageName) => packageName === 'vite' || configSource.includes(packageName) || usesTailwind && ['tailwindcss', 'postcss', 'autoprefixer'].includes(packageName)) };
}

function formatCommandError(error: any): string {
  const output = (error?.stderr || error?.stdout || '').toString() || error?.message || String(error);
  return output.length > 2000 ? output.substring(0, 2000) + '...' : output;
}

function missingProjectDependencies(projectDir: string, dependencies: string[]) {
  return dependencies.filter((packageName) =>
    !fs.existsSync(join(projectDir, 'node_modules', ...packageName.split('/'), 'package.json')),
  );
}

function installProjectDependencies(projectDir: string, targetedDependencies: string[] = []) {
  const command = targetedDependencies.length > 0
    ? `npm install --save-dev --legacy-peer-deps --include=dev --no-audit --no-fund ${targetedDependencies.map((name) => JSON.stringify(name)).join(' ')}`
    : 'npm install --legacy-peer-deps --include=dev --no-audit --no-fund';
  execSync(command, {
    cwd: projectDir,
    timeout: 240000,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'pipe',
  });
}

function extractMissingPackageNames(errorText: string) {
  const names = new Set<string>();
  const patterns = [
    /Cannot find package ["']([^"']+)["']/gi,
    /failed to resolve import ["']([^"']+)["']/gi,
    /Cannot resolve dependency ["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of errorText.matchAll(pattern)) {
      const packageName = match[1];
      if (packageName && !packageName.startsWith('.') && !packageName.startsWith('/')) names.add(packageName);
    }
  }
  return [...names].slice(0, 8);
}
function buildProject(projectDir: string): { success: boolean; error: string } {
  try {
    execSync('npx vite build --base=./ --outDir dist', {
      cwd: projectDir,
      timeout: 240000,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe',
    });
    return { success: true, error: '' };
  } catch (error) {
    return { success: false, error: formatCommandError(error) };
  }
}
function showErrorPage(projectDir: string, errorMsg: string) {
  fs.mkdirSync(join(projectDir, 'dist'), { recursive: true });
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Ошибка предпросмотра</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}.card{background:white;padding:2rem;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:700px;width:90%}h1{color:#e53e3e;font-size:1.5rem;margin-top:0}pre{background:#f7f7f7;padding:1rem;border-radius:4px;overflow-x:auto;font-size:0.85rem;white-space:pre-wrap;word-break:break-all}p{color:#666}.hint{margin-top:1rem;padding:0.75rem;background:#fff4e5;border-radius:4px;color:#8a6d3b;font-size:0.9rem}</style></head><body><div class="card"><h1>Предпросмотр не запустился</h1><p>Система не смогла собрать проект. Недостающие зависимости проверены автоматически.</p><pre>${errorMsg.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre><div class="hint">Повторите предпросмотр или отправьте запрос на исправление проекта.</div></div></body></html>`;
  fs.writeFileSync(join(projectDir, 'dist', 'index.html'), html, 'utf8');
}

function latestProjectInputMtime(directory: string): number {
  let latest = 0;
  if (!fs.existsSync(directory)) return latest;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestProjectInputMtime(fullPath));
      continue;
    }
    try {
      latest = Math.max(latest, fs.statSync(fullPath).mtimeMs);
    } catch {}
  }
  return latest;
}

function hasBuildScript(projectDir: string): boolean {
  try {
    const packageJson = JSON.parse(fs.readFileSync(join(projectDir, 'package.json'), 'utf8'));
    return typeof packageJson?.scripts?.build === 'string' && packageJson.scripts.build.trim().length > 0;
  } catch {
    return false;
  }
}

function syncStaticPreview(projectDir: string) {
  if (hasBuildScript(projectDir)) return;
  const sourceIndex = join(projectDir, 'index.html');
  const distDirectory = join(projectDir, 'dist');
  if (!fs.existsSync(sourceIndex)) return;
  fs.mkdirSync(distDirectory, { recursive: true });
  const targetIndex = join(distDirectory, 'index.html');
  const sourceBytes = fs.readFileSync(sourceIndex);
  if (!fs.existsSync(targetIndex) || !sourceBytes.equals(fs.readFileSync(targetIndex))) {
    fs.copyFileSync(sourceIndex, targetIndex);
  }
}

function isBuildFresh(projectDir: string): boolean {
  const indexPath = join(projectDir, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) return false;
  try {
    return fs.statSync(indexPath).mtimeMs >= latestProjectInputMtime(projectDir);
  } catch {
    return false;
  }
}

function copyExtraRuntimeFiles(projectDir: string) {
  const distDirectory = join(projectDir, 'dist');
  if (!fs.existsSync(distDirectory)) return;

  const ignoredFiles = new Set([
    'package.json', 'package-lock.json', 'npm-shrinkwrap.json',
    'vite.config.js', 'vite.config.mjs', 'vite.config.ts', 'vite.config.mts',
    'tsconfig.json', 'postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs',
  ]);
  const runtimeAssetPattern = /\.(?:html?|css|scss|sass|less|js|mjs|cjs|json|txt|xml|svg|ico|png|jpe?g|gif|webp|avif|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf)$/i;

  const copyRuntimeDirectory = (directory: string, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'public') continue;
      const sourcePath = join(directory, entry.name);
      const relativePath = join(relative, entry.name);
      const targetPath = join(distDirectory, relativePath);
      if (entry.isDirectory()) {
        copyRuntimeDirectory(sourcePath, relativePath);
      } else if (entry.isFile() && entry.name !== 'index.html' && runtimeAssetPattern.test(entry.name)) {
        fs.mkdirSync(join(targetPath, '..'), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  };
  copyRuntimeDirectory(projectDir);

  for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'index.html' || ignoredFiles.has(entry.name)) continue;
    if (!runtimeAssetPattern.test(entry.name)) continue;
    fs.copyFileSync(join(projectDir, entry.name), join(distDirectory, entry.name));
  }

  const publicDirectory = join(projectDir, 'public');
  if (!fs.existsSync(publicDirectory)) return;
  const copyPublicFiles = (directory: string, relative = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const sourcePath = join(directory, entry.name);
      const relativePath = join(relative, entry.name);
      const targetPath = join(distDirectory, relativePath);
      if (entry.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        copyPublicFiles(sourcePath, relativePath);
      } else if (entry.isFile()) {
        fs.mkdirSync(join(targetPath, '..'), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  };
  copyPublicFiles(publicDirectory);
}

function previewPath(projectId: string) {
  return `/api/project-preview/${encodeURIComponent(projectId)}`;
}

function buildVersion(projectDir: string) {
  try {
    return String(Math.trunc(fs.statSync(join(projectDir, 'dist', 'index.html')).mtimeMs));
  } catch {
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();
    if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
      return Response.json({ error: 'Valid projectId required' }, { status: 400 });
    }

    const releasePreviewBuildLock = await acquirePreviewBuildLock(projectId);
    try {
      const projectDir = join(PROJECTS_DIR(), projectId);
      if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }

      const repairResult = ensureProjectBuildConfiguration(projectDir);
      syncStaticPreview(projectDir);
      let missingDependencies = missingProjectDependencies(projectDir, repairResult.requiredDependencies);
      if (isBuildFresh(projectDir) && missingDependencies.length === 0) {
        copyExtraRuntimeFiles(projectDir);
        return Response.json({
          ok: true,
          projectId,
          previewPath: previewPath(projectId),
          started: true,
          built: true,
          cached: true,
          buildVersion: buildVersion(projectDir),
          ...repairResult,
        });
      }

      let installError = '';
      try {
        installProjectDependencies(projectDir);
        missingDependencies = missingProjectDependencies(projectDir, repairResult.requiredDependencies);
        if (missingDependencies.length > 0) {
          installProjectDependencies(projectDir, missingDependencies);
          missingDependencies = missingProjectDependencies(projectDir, repairResult.requiredDependencies);
        }
      } catch (error) {
        installError = formatCommandError(error);
      }

      if (missingDependencies.length > 0) {
        const dependencyError = `Missing build dependencies after install: ${missingDependencies.join(', ')}`;
        return Response.json(
          { ok: false, projectId, built: false, error: [installError, dependencyError].filter(Boolean).join('\n\n'), missingDependencies, ...repairResult },
          { status: 422 },
        );
      }

      let buildResult = buildProject(projectDir);
      for (let repairAttempt = 0; !buildResult.success && repairAttempt < 3; repairAttempt += 1) {
        const missingFromBuild = extractMissingPackageNames(buildResult.error);
        if (missingFromBuild.length === 0) break;
        try {
          installProjectDependencies(projectDir, missingFromBuild);
          buildResult = buildProject(projectDir);
        } catch (error) {
          installError = [installError, formatCommandError(error)].filter(Boolean).join('\n\n');
          break;
        }
      }
      if (!buildResult.success) {
        const error = [installError, buildResult.error].filter(Boolean).join('\n\n');
        showErrorPage(projectDir, error);
        return Response.json(
          { ok: false, projectId, built: false, error: 'Предпросмотр не удалось собрать. Повторите попытку или попросите исправить проект.', ...repairResult },
          { status: 422 },
        );
      }

      copyExtraRuntimeFiles(projectDir);
      return Response.json({
        ok: true,
        projectId,
        previewPath: previewPath(projectId),
        started: true,
        built: true,
        cached: false,
        buildVersion: buildVersion(projectDir),
        ...repairResult,
      });
    } finally {
      releasePreviewBuildLock();
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  return Response.json({ ok: true, deprecated: true });
}

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('projectId');
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    return Response.json({ running: false, error: 'Valid projectId required' }, { status: 400 });
  }
  const ready = fs.existsSync(join(PROJECTS_DIR(), projectId, 'dist', 'index.html'));
  return Response.json({
    running: ready,
    projectId,
    previewPath: previewPath(projectId),
    buildVersion: ready ? buildVersion(join(PROJECTS_DIR(), projectId)) : '',
  });
}


