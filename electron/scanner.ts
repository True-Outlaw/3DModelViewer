import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { ModelAsset, ModelFormat, ScanOptions, ScanProgress } from '../src/types';
import { extractBlendThumbnail } from './blendExtractor';

const SUPPORTED_EXTENSIONS: Record<string, ModelFormat> = {
  '.blend': 'blend',
  '.fbx': 'fbx',
  '.gltf': 'gltf',
  '.glb': 'glb',
  '.obj': 'obj',
  '.stl': 'stl',
  '.dae': 'dae',
  '.ply': 'ply',
};

const IGNORED_DIRECTORY_NAMES = new Set([
  '$recycle.bin',
  'system volume information',
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'appdata',
  'windows',
  'program files',
  'program files (x86)',
  'perflogs',
  '$windows.~bt',
  '$windows.~ws',
]);

export class DiskScanner {
  private isCancelled = false;
  private thumbnailsDir: string | null = null;

  public setThumbnailsDir(dir: string): void {
    this.thumbnailsDir = dir;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public async scan(
    options: ScanOptions,
    onProgress: (progress: ScanProgress) => void,
    onAssetsBatch: (batch: ModelAsset[]) => void,
    onAssetFound?: (asset: ModelAsset) => void
  ): Promise<ModelAsset[]> {
    this.isCancelled = false;
    const foundAssets: ModelAsset[] = [];
    const requestedFormats = new Set(options.formats);

    let scannedDirectories = 0;
    let foundModelsCount = 0;
    let lastProgressTime = Date.now();

    const batchBuffer: ModelAsset[] = [];
    let lastBatchTime = Date.now();

    const flushBatch = (force = false) => {
      if (batchBuffer.length === 0) return;
      const now = Date.now();
      if (force || batchBuffer.length >= 25 || now - lastBatchTime >= 80) {
        const batch = [...batchBuffer];
        batchBuffer.length = 0;
        lastBatchTime = now;
        onAssetsBatch(batch);
      }
    };

    const reportProgress = (currentPath: string, force = false) => {
      const now = Date.now();
      if (force || now - lastProgressTime > 120) {
        lastProgressTime = now;
        onProgress({
          status: 'scanning',
          scannedDirectories,
          foundModels: foundModelsCount,
          processedThumbnails: 0,
          currentPath,
        });
      }
    };

    const processFile = async (filePath: string, fileStats: fs.Stats) => {
      const ext = path.extname(filePath).toLowerCase();
      const format = SUPPORTED_EXTENSIONS[ext];
      if (!format) return;

      if (requestedFormats.size > 0 && !requestedFormats.has(format)) {
        return;
      }

      if (options.minSizeBytes && fileStats.size < options.minSizeBytes) {
        return;
      }

      const id = createHash('md5').update(filePath.toLowerCase()).digest('hex');
      const name = path.basename(filePath, ext);
      const directory = path.dirname(filePath);

      let thumbnailUrl: string | null = null;
      let thumbnailSource: 'embedded' | 'rendered' | 'placeholder' = 'placeholder';

      // If it's a .blend file, immediately extract embedded preview to thumbnail directory
      if (format === 'blend') {
        try {
          const embedded = await extractBlendThumbnail(
            filePath,
            this.thumbnailsDir || undefined,
            id
          );
          if (embedded) {
            thumbnailUrl = embedded;
            thumbnailSource = 'embedded';
          }
        } catch {}
      }

      const asset: ModelAsset = {
        id,
        name,
        path: filePath,
        directory,
        extension: ext,
        format,
        sizeBytes: fileStats.size,
        mtime: fileStats.mtimeMs,
        thumbnailUrl,
        thumbnailSource,
        isFavorite: false,
        tags: [format.toUpperCase()],
      };

      foundAssets.push(asset);
      foundModelsCount++;
      batchBuffer.push(asset);
      if (onAssetFound) {
        onAssetFound(asset);
      }
      flushBatch(false);
    };

    const traverseDirectory = async (currentDir: string, currentDepth: number) => {
      if (this.isCancelled) return;
      if (options.maxDepth && currentDepth > options.maxDepth) return;

      const baseName = path.basename(currentDir).toLowerCase();
      if (IGNORED_DIRECTORY_NAMES.has(baseName)) return;
      if (options.skipHidden && baseName.startsWith('.') && baseName !== '.') return;

      scannedDirectories++;
      reportProgress(currentDir);

      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        // Skip inaccessible folders (permission denied / system protected)
        return;
      }

      const subDirs: string[] = [];

      for (const entry of entries) {
        if (this.isCancelled) return;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (options.includeSubfolders) {
            subDirs.push(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS[ext]) {
            try {
              const stat = await fs.promises.stat(fullPath);
              await processFile(fullPath, stat);
            } catch {}
          }
        }
      }

      for (const subDir of subDirs) {
        if (this.isCancelled) return;
        await traverseDirectory(subDir, currentDepth + 1);
      }
    };

    for (const rootPath of options.rootPaths) {
      if (this.isCancelled) break;
      if (fs.existsSync(rootPath)) {
        try {
          const rootStat = await fs.promises.stat(rootPath);
          if (rootStat.isDirectory()) {
            await traverseDirectory(rootPath, 0);
          } else if (rootStat.isFile()) {
            await processFile(rootPath, rootStat);
          }
        } catch {}
      }
    }

    flushBatch(true);
    reportProgress('Completed', true);
    return foundAssets;
  }
}
