import * as fs from 'fs';
import * as path from 'path';
import type { DependencyReport, TextureDependency, TextureMapType } from '../src/types';

const COMMON_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.tga',
  '.dds',
  '.exr',
  '.tif',
  '.tiff',
  '.bmp',
  '.webp',
  '.hdr',
]);

const TEXTURE_DIR_CANDIDATES = [
  'textures',
  'Textures',
  'texture',
  'Texture',
  'maps',
  'Maps',
  'map',
  'Map',
  'images',
  'Images',
  'assets',
  'Assets',
  '',
];

/**
 * Identify texture map type from property name or filename hints
 */
export function inferMapType(propKey: string, filename: string): TextureMapType {
  const p = propKey.toLowerCase();
  const f = filename.toLowerCase();

  if (p.includes('kd') || p.includes('basecolor') || p.includes('diffuse') || p.includes('albedo') || f.includes('albedo') || f.includes('diff') || f.includes('basecolor')) {
    return 'albedo';
  }
  if (p.includes('bump') || p.includes('normal') || f.includes('norm') || f.includes('normal') || f.includes('nrm') || f.includes('bump')) {
    return 'normal';
  }
  if (p.includes('rough') || p.includes('ns') || f.includes('rough') || f.includes('rgh')) {
    return 'roughness';
  }
  if (p.includes('pm') || p.includes('metal') || f.includes('metal') || f.includes('met')) {
    return 'metallic';
  }
  if (p.includes('ks') || p.includes('spec') || f.includes('spec') || f.includes('specular')) {
    return 'specular';
  }
  if (p.includes('map_d') || p.includes('opacity') || p.includes('alpha') || f.includes('opacity') || f.includes('alpha') || f.includes('trans')) {
    return 'opacity';
  }
  if (p.includes('ka') || p.includes('ao') || p.includes('occlusion') || f.includes('ambient') || f.includes('ao') || f.includes('occlusion')) {
    return 'ambient_occlusion';
  }
  if (p.includes('disp') || p.includes('height') || f.includes('disp') || f.includes('height')) {
    return 'displacement';
  }
  if (f.endsWith('.bin')) {
    return 'geometry_bin';
  }

  return 'other';
}

/**
 * Attempt to resolve a referenced path against the model directory
 * and common companion texture folders.
 */
function resolveTexturePath(modelDir: string, refPath: string): string | null {
  // Normalize slashes
  const cleanRef = refPath.replace(/\\/g, '/').trim();
  const baseName = path.basename(cleanRef);

  // 1. Direct path check (relative to modelDir)
  const directPath = path.resolve(modelDir, cleanRef);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // 2. Absolute path check (if user machine had absolute path)
  if (path.isAbsolute(cleanRef) && fs.existsSync(cleanRef)) {
    return cleanRef;
  }

  // 3. Search common companion subfolders by basename
  for (const sub of TEXTURE_DIR_CANDIDATES) {
    const candidatePath = sub ? path.join(modelDir, sub, baseName) : path.join(modelDir, baseName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

/**
 * Inspect OBJ files and companion MTL material files
 */
async function inspectObjDependencies(modelPath: string): Promise<TextureDependency[]> {
  const modelDir = path.dirname(modelPath);
  const baseNameNoExt = path.basename(modelPath, path.extname(modelPath));
  const deps: TextureDependency[] = [];

  try {
    const objContent = await fs.promises.readFile(modelPath, 'utf-8');
    const mtlFiles = new Set<string>();

    // Parse mtllib lines from OBJ
    const lines = objContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('mtllib ')) {
        const parts = trimmed.substring(7).trim();
        if (parts) {
          mtlFiles.add(parts);
        }
      }
    }

    // If no mtllib specified, check if companion <name>.mtl exists
    if (mtlFiles.size === 0) {
      const defaultMtl = path.join(modelDir, `${baseNameNoExt}.mtl`);
      if (fs.existsSync(defaultMtl)) {
        mtlFiles.add(`${baseNameNoExt}.mtl`);
      }
    }

    // Process each MTL file
    for (const mtlName of mtlFiles) {
      const resolvedMtl = resolveTexturePath(modelDir, mtlName);
      if (!resolvedMtl || !fs.existsSync(resolvedMtl)) {
        deps.push({
          id: `mtl-${mtlName}`,
          name: mtlName,
          referencedPath: mtlName,
          resolvedPath: null,
          status: 'missing',
          mapType: 'other',
        });
        continue;
      }

      // Read MTL
      const mtlContent = await fs.promises.readFile(resolvedMtl, 'utf-8');
      const mtlLines = mtlContent.split(/\r?\n/);

      for (const mLine of mtlLines) {
        const trimmed = mLine.trim();
        if (trimmed.startsWith('#') || !trimmed) continue;

        // Match map_* keywords
        const match = trimmed.match(/^(map_[A-Za-z0-9_]+|bump|disp)\s+(.*)$/i);
        if (match) {
          const propKey = match[1];
          let textureRef = match[2].trim();

          // Handle optional arguments like "-bm 1.0 textures/normal.png"
          const tokens = textureRef.split(/\s+/);
          let actualFile = tokens[tokens.length - 1];
          // Strip quotes
          actualFile = actualFile.replace(/^["']|["']$/g, '');

          if (actualFile && !deps.some((d) => d.referencedPath === actualFile)) {
            const resolved = resolveTexturePath(modelDir, actualFile);
            let sizeBytes: number | undefined;
            if (resolved && fs.existsSync(resolved)) {
              try {
                sizeBytes = fs.statSync(resolved).size;
              } catch {
                // ignore
              }
            }

            deps.push({
              id: `obj-tex-${deps.length}-${path.basename(actualFile)}`,
              name: path.basename(actualFile),
              referencedPath: actualFile,
              resolvedPath: resolved,
              status: resolved ? 'found' : 'missing',
              mapType: inferMapType(propKey, actualFile),
              fileSizeBytes: sizeBytes,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error(`[textureInspector] Error inspecting OBJ dependencies for ${modelPath}:`, err);
  }

  return deps;
}

/**
 * Inspect GLTF JSON files for images and external binary buffers
 */
async function inspectGltfDependencies(modelPath: string): Promise<TextureDependency[]> {
  const modelDir = path.dirname(modelPath);
  const deps: TextureDependency[] = [];

  try {
    const raw = await fs.promises.readFile(modelPath, 'utf-8');
    const gltf = JSON.parse(raw);

    // Buffers (.bin files)
    if (Array.isArray(gltf.buffers)) {
      for (let i = 0; i < gltf.buffers.length; i++) {
        const buf = gltf.buffers[i];
        if (buf.uri && !buf.uri.startsWith('data:')) {
          const resolved = resolveTexturePath(modelDir, buf.uri);
          deps.push({
            id: `gltf-buf-${i}`,
            name: path.basename(buf.uri),
            referencedPath: buf.uri,
            resolvedPath: resolved,
            status: resolved ? 'found' : 'missing',
            mapType: 'geometry_bin',
            fileSizeBytes: buf.byteLength,
          });
        }
      }
    }

    // Images
    if (Array.isArray(gltf.images)) {
      for (let i = 0; i < gltf.images.length; i++) {
        const img = gltf.images[i];
        if (img.uri && !img.uri.startsWith('data:')) {
          const resolved = resolveTexturePath(modelDir, img.uri);
          let sizeBytes: number | undefined;
          if (resolved && fs.existsSync(resolved)) {
            try {
              sizeBytes = fs.statSync(resolved).size;
            } catch {
              // ignore
            }
          }

          deps.push({
            id: `gltf-img-${i}`,
            name: img.name || path.basename(img.uri),
            referencedPath: img.uri,
            resolvedPath: resolved,
            status: resolved ? 'found' : 'missing',
            mapType: inferMapType('', img.uri),
            fileSizeBytes: sizeBytes,
          });
        }
      }
    }
  } catch (err) {
    console.error(`[textureInspector] Error parsing GLTF for ${modelPath}:`, err);
  }

  return deps;
}

/**
 * Inspect FBX files (handles ASCII FBX and scans Binary FBX strings)
 */
async function inspectFbxDependencies(modelPath: string): Promise<TextureDependency[]> {
  const modelDir = path.dirname(modelPath);
  const deps: TextureDependency[] = [];
  const foundRefs = new Set<string>();

  try {
    const buffer = await fs.promises.readFile(modelPath);
    const isBinary = buffer.slice(0, 18).toString('utf-8').includes('Kaydara FBX Binary');

    if (!isBinary) {
      // ASCII FBX
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('RelativeFilename:') || trimmed.startsWith('FileName:')) {
          const match = trimmed.match(/["'](.*?)["']/);
          if (match && match[1]) {
            const ref = match[1];
            const ext = path.extname(ref).toLowerCase();
            if (COMMON_IMAGE_EXTENSIONS.has(ext)) {
              foundRefs.add(ref);
            }
          }
        }
      }
    } else {
      // Binary FBX string scan
      // Look for strings containing common texture extensions
      const text = buffer.toString('latin1');
      const regex = /([a-zA-Z0-9_\-\\\/\.\s]+\.(png|jpg|jpeg|tga|dds|exr|tif|tiff|bmp))/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const candidate = match[1].trim();
        // Clean out garbage binary characters
        const cleanPath = candidate.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        if (cleanPath.length > 4 && cleanPath.length < 250) {
          foundRefs.add(cleanPath);
        }
      }
    }

    let idx = 0;
    for (const ref of foundRefs) {
      const resolved = resolveTexturePath(modelDir, ref);
      let sizeBytes: number | undefined;
      if (resolved && fs.existsSync(resolved)) {
        try {
          sizeBytes = fs.statSync(resolved).size;
        } catch {
          // ignore
        }
      }

      deps.push({
        id: `fbx-tex-${idx++}`,
        name: path.basename(ref),
        referencedPath: ref,
        resolvedPath: resolved,
        status: resolved ? 'found' : 'missing',
        mapType: inferMapType('', ref),
        fileSizeBytes: sizeBytes,
      });
    }
  } catch (err) {
    console.error(`[textureInspector] Error reading FBX for ${modelPath}:`, err);
  }

  return deps;
}

/**
 * Main dependency inspection dispatcher
 */
export async function inspectModelDependencies(modelPath: string): Promise<DependencyReport> {
  const ext = path.extname(modelPath).toLowerCase();
  let dependencies: TextureDependency[] = [];

  if (ext === '.obj') {
    dependencies = await inspectObjDependencies(modelPath);
  } else if (ext === '.gltf') {
    dependencies = await inspectGltfDependencies(modelPath);
  } else if (ext === '.fbx') {
    dependencies = await inspectFbxDependencies(modelPath);
  }

  // Also check if there are orphan textures in a companion textures folder
  // when 0 dependencies were found (e.g. for .glb or .blend or unnamed .obj)
  if (dependencies.length === 0) {
    const modelDir = path.dirname(modelPath);
    for (const sub of ['textures', 'Textures']) {
      const subDir = path.join(modelDir, sub);
      if (fs.existsSync(subDir)) {
        try {
          const files = fs.readdirSync(subDir);
          for (const f of files) {
            const fExt = path.extname(f).toLowerCase();
            if (COMMON_IMAGE_EXTENSIONS.has(fExt)) {
              const fullPath = path.join(subDir, f);
              dependencies.push({
                id: `dir-tex-${dependencies.length}`,
                name: f,
                referencedPath: path.join(sub, f),
                resolvedPath: fullPath,
                status: 'found',
                mapType: inferMapType('', f),
                fileSizeBytes: fs.statSync(fullPath).size,
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const missingCount = dependencies.filter((d) => d.status === 'missing').length;
  const foundCount = dependencies.filter((d) => d.status === 'found').length;

  return {
    modelPath,
    format: ext.replace('.', ''),
    hasExternalDependencies: dependencies.length > 0,
    totalDependencies: dependencies.length,
    missingCount,
    foundCount,
    dependencies,
  };
}

/**
 * Recursively find all image files in a directory up to maxDepth
 */
function findImagesRecursively(dir: string, maxDepth = 4, currentDepth = 0): Map<string, string> {
  const results = new Map<string, string>();
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subMap = findImagesRecursively(fullPath, maxDepth, currentDepth + 1);
        for (const [name, p] of subMap.entries()) {
          if (!results.has(name)) results.set(name, p);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (COMMON_IMAGE_EXTENSIONS.has(ext)) {
          // Key by lower-cased filename
          const lowerName = entry.name.toLowerCase();
          if (!results.has(lowerName)) {
            results.set(lowerName, fullPath);
          }
        }
      }
    }
  } catch {
    // Permission or I/O error
  }

  return results;
}

/**
 * Relink missing textures from a user-specified search directory
 */
export async function relinkModelTextures(
  modelPath: string,
  searchDir: string,
  copyToModelDir = true
): Promise<{ success: boolean; report: DependencyReport; relinkedCount: number }> {
  const initialReport = await inspectModelDependencies(modelPath);
  const missingDeps = initialReport.dependencies.filter((d) => d.status === 'missing');

  if (missingDeps.length === 0) {
    return { success: true, report: initialReport, relinkedCount: 0 };
  }

  const modelDir = path.dirname(modelPath);
  const targetTexturesDir = path.join(modelDir, 'textures');

  if (copyToModelDir && !fs.existsSync(targetTexturesDir)) {
    try {
      fs.mkdirSync(targetTexturesDir, { recursive: true });
    } catch (err) {
      console.error('[relinkModelTextures] Failed to create textures directory:', err);
    }
  }

  // Scan user searchDir
  const candidateImages = findImagesRecursively(searchDir);
  let relinkedCount = 0;

  for (const dep of missingDeps) {
    const baseName = path.basename(dep.referencedPath).toLowerCase();
    const matchedPath = candidateImages.get(baseName);

    if (matchedPath && fs.existsSync(matchedPath)) {
      if (copyToModelDir) {
        try {
          const destFile = path.join(targetTexturesDir, path.basename(matchedPath));
          fs.copyFileSync(matchedPath, destFile);
          dep.resolvedPath = destFile;
          dep.status = 'found';
          dep.fileSizeBytes = fs.statSync(destFile).size;
          relinkedCount++;
        } catch (err) {
          console.error(`Failed to copy relinked texture ${matchedPath}:`, err);
        }
      } else {
        dep.resolvedPath = matchedPath;
        dep.status = 'found';
        try {
          dep.fileSizeBytes = fs.statSync(matchedPath).size;
        } catch {
          // ignore
        }
        relinkedCount++;
      }
    }
  }

  // Recompute report
  const updatedReport: DependencyReport = {
    ...initialReport,
    missingCount: initialReport.dependencies.filter((d) => d.status === 'missing').length,
    foundCount: initialReport.dependencies.filter((d) => d.status === 'found').length,
  };

  return {
    success: true,
    report: updatedReport,
    relinkedCount,
  };
}
