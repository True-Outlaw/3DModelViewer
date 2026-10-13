import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { BlenderInfo } from '../src/types';

const execFileAsync = promisify(execFile);

let cachedBlenderInfo: BlenderInfo | null = null;

const COMMON_BLENDER_PATHS = [
  'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
];

/**
 * Discovers Blender executable on the user's system.
 */
export async function detectBlender(): Promise<BlenderInfo> {
  if (cachedBlenderInfo) return cachedBlenderInfo;

  // 1. Check known Windows installation paths
  for (const candidate of COMMON_BLENDER_PATHS) {
    if (fs.existsSync(candidate)) {
      try {
        const { stdout } = await execFileAsync(candidate, ['--version'], { timeout: 10000 });
        const versionMatch = stdout.match(/Blender\s+([0-9\.]+)/i);
        const version = versionMatch ? versionMatch[1] : 'Unknown';
        cachedBlenderInfo = {
          isAvailable: true,
          executablePath: candidate,
          version,
        };
        return cachedBlenderInfo;
      } catch (err) {
        console.warn(`[BlenderCLI] Executing ${candidate} failed:`, err);
      }
    }
  }

  // 2. Scan Blender Foundation directory dynamically
  const baseDir = 'C:\\Program Files\\Blender Foundation';
  if (fs.existsSync(baseDir)) {
    try {
      const entries = fs.readdirSync(baseDir);
      for (const entry of entries) {
        const candidate = path.join(baseDir, entry, 'blender.exe');
        if (fs.existsSync(candidate)) {
          const { stdout } = await execFileAsync(candidate, ['--version'], { timeout: 10000 });
          const versionMatch = stdout.match(/Blender\s+([0-9\.]+)/i);
          const version = versionMatch ? versionMatch[1] : entry;
          cachedBlenderInfo = {
            isAvailable: true,
            executablePath: candidate,
            version,
          };
          return cachedBlenderInfo;
        }
      }
    } catch {}
  }

  // 3. Check PATH
  try {
    const { stdout } = await execFileAsync('blender', ['--version'], { timeout: 8000 });
    const versionMatch = stdout.match(/Blender\s+([0-9\.]+)/i);
    cachedBlenderInfo = {
      isAvailable: true,
      executablePath: 'blender',
      version: versionMatch ? versionMatch[1] : 'Detected',
    };
    return cachedBlenderInfo;
  } catch {}

  cachedBlenderInfo = { isAvailable: false };
  return cachedBlenderInfo;
}

/**
 * Headlessly exports a .blend file to a temporary .glb for 3D interactive viewing.
 */
export async function exportBlendToGlb(blendPath: string): Promise<{ success: boolean; glbPath?: string; error?: string }> {
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
}
