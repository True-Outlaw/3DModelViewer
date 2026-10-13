import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import type { BlenderInfo } from '../src/types';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

let cachedBlenderInfo: BlenderInfo | null = null;

export function resetBlenderCache(): void {
  cachedBlenderInfo = null;
}

export async function setCustomBlenderPath(customPath: string): Promise<BlenderInfo> {
  cachedBlenderInfo = null;
  return detectBlender(customPath);
}

/**
 * Validates whether an executable path is a genuine Blender installation by running --version
 */
async function testBlenderExecutable(executablePath: string): Promise<BlenderInfo | null> {
  try {
    if (!fs.existsSync(executablePath)) return null;
    const { stdout } = await execFileAsync(executablePath, ['--version'], { timeout: 10000 });
    const versionMatch = stdout.match(/Blender\s+([0-9\.]+)/i);
    const version = versionMatch ? versionMatch[1] : 'Detected';
    return {
      isAvailable: true,
      executablePath,
      version,
    };
  } catch (err: any) {
    console.warn(`[BlenderCLI] Executing candidate ${executablePath} failed:`, err?.message || err);
    return null;
  }
}

/**
 * Generates candidate directories and executable paths across Windows, macOS, and Linux
 */
function getSystemCandidatePaths(): string[] {
  const candidates: string[] = [];
  const platform = process.platform;

  if (platform === 'win32') {
    // 1. Common Windows Program Files locations (ordered latest to oldest)
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');

    const knownVersions = [
      'Blender 5.2', 'Blender 5.1', 'Blender 5.0',
      'Blender 4.5', 'Blender 4.4', 'Blender 4.3', 'Blender 4.2', 'Blender 4.1', 'Blender 4.0',
      'Blender 3.6', 'Blender 3.5', 'Blender 3.4', 'Blender 3.3', 'Blender 3.0',
      'Blender 2.93', 'Blender 2.83', 'Blender',
    ];

    for (const v of knownVersions) {
      candidates.push(path.join(progFiles, 'Blender Foundation', v, 'blender.exe'));
      candidates.push(path.join(progFilesX86, 'Blender Foundation', v, 'blender.exe'));
      candidates.push(path.join(localAppData, 'Programs', 'Blender Foundation', v, 'blender.exe'));
    }

    // 2. Dynamically scan Blender Foundation directory if it exists
    for (const root of [path.join(progFiles, 'Blender Foundation'), path.join(progFilesX86, 'Blender Foundation')]) {
      if (fs.existsSync(root)) {
        try {
          const entries = fs.readdirSync(root);
          for (const entry of entries) {
            candidates.push(path.join(root, entry, 'blender.exe'));
          }
        } catch {}
      }
    }

    // 3. Steam installation across C: and common secondary drive letters
    candidates.push(path.join(progFilesX86, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));
    candidates.push(path.join(progFiles, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));

    const drives = ['C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M'];
    for (const d of drives) {
      candidates.push(`${d}:\\SteamLibrary\\steamapps\\common\\Blender\\blender.exe`);
      candidates.push(`${d}:\\Steam\\steamapps\\common\\Blender\\blender.exe`);
      candidates.push(`${d}:\\Games\\Steam\\steamapps\\common\\Blender\\blender.exe`);
    }

    // 4. Scoop / Chocolatey paths
    candidates.push(path.join(os.homedir(), 'scoop', 'apps', 'blender', 'current', 'blender.exe'));
    candidates.push('C:\\ProgramData\\chocolatey\\bin\\blender.exe');
  } else if (platform === 'darwin') {
    // macOS
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
    candidates.push(path.join(os.homedir(), 'Applications', 'Blender.app', 'Contents', 'MacOS', 'Blender'));
  } else {
    // Linux
    candidates.push('/usr/bin/blender');
    candidates.push('/usr/local/bin/blender');
    candidates.push('/snap/bin/blender');
    candidates.push('/var/lib/flatpak/exports/bin/org.blender.Blender');
    candidates.push(path.join(os.homedir(), '.local', 'share', 'flatpak', 'exports', 'bin', 'org.blender.Blender'));
  }

  return Array.from(new Set(candidates));
}

/**
 * Discovers Blender executable on the user's system.
 * If a custom path is specified, it checks that first.
 */
export async function detectBlender(customPath?: string): Promise<BlenderInfo> {
  // If we already have a confirmed valid cache and no specific custom path was forced, return it
  if (!customPath && cachedBlenderInfo && cachedBlenderInfo.isAvailable) {
    return cachedBlenderInfo;
  }

  // 1. Check user-configured custom path first if provided
  if (customPath && customPath.trim().length > 0) {
    const trimmed = customPath.trim();
    const verified = await testBlenderExecutable(trimmed);
    if (verified) {
      cachedBlenderInfo = verified;
      return cachedBlenderInfo;
    }
  }

  // 2. Check candidate system file paths
  const candidatePaths = getSystemCandidatePaths();
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const verified = await testBlenderExecutable(candidate);
      if (verified) {
        cachedBlenderInfo = verified;
        return cachedBlenderInfo;
      }
    }
  }

  // 3. Check system PATH via 'blender'
  try {
    const { stdout } = await execFileAsync('blender', ['--version'], { timeout: 8000 });
    const versionMatch = stdout.match(/Blender\s+([0-9\.]+)/i);
    cachedBlenderInfo = {
      isAvailable: true,
      executablePath: 'blender',
      version: versionMatch ? versionMatch[1] : 'System PATH',
    };
    return cachedBlenderInfo;
  } catch {}

  // 4. Windows App Paths Registry query fallback
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\blender.exe" /ve');
      const match = stdout.match(/REG_SZ\s+(.*)/i);
      if (match && match[1]) {
        const regPath = match[1].trim();
        const verified = await testBlenderExecutable(regPath);
        if (verified) {
          cachedBlenderInfo = verified;
          return cachedBlenderInfo;
        }
      }
    } catch {}
  }

  cachedBlenderInfo = {
    isAvailable: false,
    error: 'Blender executable was not found in standard system locations or PATH.',
  };
  return cachedBlenderInfo;
}

/**
 * Headlessly exports a .blend file to a temporary .glb for 3D interactive viewing.
 */
// Ongoing export conversions map to prevent parallel process collisions on the same file
const ongoingConversions = new Map<string, Promise<{ success: boolean; glbPath?: string; error?: string }>>();

export async function exportBlendToGlb(blendPath: string): Promise<{ success: boolean; glbPath?: string; error?: string }> {
  const normPath = path.resolve(blendPath);
  if (ongoingConversions.has(normPath)) {
    return ongoingConversions.get(normPath)!;
  }

  const exportPromise = (async () => {
    const info = await detectBlender();
    if (!info.isAvailable || !info.executablePath) {
      return { success: false, error: 'Blender is not installed or could not be detected.' };
    }

    const tempDir = path.join(os.tmpdir(), 'model_vault_3d_temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate deterministic cache key based on file path, size, and modified time
    let cacheKey = '';
    try {
      const stats = await fs.promises.stat(blendPath);
      cacheKey = crypto
        .createHash('md5')
        .update(`${path.resolve(blendPath)}_${stats.size}_${stats.mtimeMs}`)
        .digest('hex')
        .substring(0, 12);
    } catch {
      cacheKey = String(Date.now());
    }

    const baseName = path.basename(blendPath, path.extname(blendPath)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const glbPath = path.join(tempDir, `${baseName}_${cacheKey}.glb`);

    // Instant cache hit: Return immediately if previously converted!
    if (fs.existsSync(glbPath)) {
      try {
        const glbStat = await fs.promises.stat(glbPath);
        if (glbStat.size > 0) {
          return { success: true, glbPath };
        }
      } catch {}
    }

    const timestamp = Date.now();
    const scriptPath = path.join(tempDir, `export_${cacheKey}_${timestamp}.py`);

    // Python script to export active scene to GLB with all objects unhidden
    const pyCode = `import bpy, sys
try:
    for obj in bpy.data.objects:
        obj.hide_viewport = False
        obj.hide_render = False

    bpy.ops.export_scene.gltf(
        filepath=r"${glbPath}",
        export_format='GLB',
        use_selection=False
    )
    print("GLTF_EXPORT_SUCCESS")
except Exception as e:
    print(f"GLTF_EXPORT_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    try {
      await fs.promises.writeFile(scriptPath, pyCode, 'utf-8');

      const { stdout, stderr } = await execFileAsync(
        info.executablePath,
        ['-b', blendPath, '-P', scriptPath],
        { timeout: 60000 }
      );

      // Clean up temporary script
      try { await fs.promises.unlink(scriptPath); } catch {}

      if (fs.existsSync(glbPath) && (await fs.promises.stat(glbPath)).size > 0) {
        return { success: true, glbPath };
      } else {
        return {
          success: false,
          error: `Blender completed but GLB file was not created. ${stderr || stdout}`,
        };
      }
    } catch (err: any) {
      try { await fs.promises.unlink(scriptPath); } catch {}
      return { success: false, error: err.message || 'Blender conversion failed' };
    }
  })();

  ongoingConversions.set(normPath, exportPromise);
  try {
    return await exportPromise;
  } finally {
    ongoingConversions.delete(normPath);
  }
}
