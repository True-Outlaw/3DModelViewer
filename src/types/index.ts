export type ModelFormat = 'blend' | 'fbx' | 'gltf' | 'glb' | 'obj' | 'stl' | 'dae' | 'ply' | 'other';
export type AppTheme = 'slate' | 'blender' | 'unreal' | 'cyberpunk' | 'forest' | 'monochrome';

export interface ModelAsset {
  id: string;
  name: string;
  path: string;
  directory: string;
  extension: string;
  format: ModelFormat;
  sizeBytes: number;
  mtime: number;
  thumbnailUrl: string | null;
  thumbnailSource: 'embedded' | 'rendered' | 'placeholder';
  isFavorite: boolean;
  tags: string[];
  collections?: string[];
  vertexCount?: number;
  triangleCount?: number;
  dimensions?: { x: number; y: number; z: number };
}

export interface ModelCollection {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface ScanOptions {
  rootPaths: string[];
  includeSubfolders: boolean;
  formats: ModelFormat[];
  minSizeBytes?: number;
  maxDepth?: number;
  skipHidden: boolean;
}

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'extracting_thumbnails' | 'completed' | 'cancelled';
  scannedDirectories: number;
  foundModels: number;
  processedThumbnails: number;
  currentPath: string;
}

export interface BlenderInfo {
  isAvailable: boolean;
  version?: string;
  executablePath?: string;
  error?: string;
}

export interface AppSettings {
  customBlenderPath?: string;
  skipBlenderPrompt?: boolean;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  info?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string | null;
}

export type TextureMapType =
  | 'albedo'
  | 'normal'
  | 'roughness'
  | 'metallic'
  | 'specular'
  | 'opacity'
  | 'displacement'
  | 'ambient_occlusion'
  | 'geometry_bin'
  | 'other';

export interface TextureDependency {
  id: string;
  name: string;
  referencedPath: string;
  resolvedPath: string | null;
  status: 'found' | 'missing' | 'embedded';
  mapType: TextureMapType;
  fileSizeBytes?: number;
}

export interface DependencyReport {
  modelPath: string;
  format: string;
  hasExternalDependencies: boolean;
  totalDependencies: number;
  missingCount: number;
  foundCount: number;
  dependencies: TextureDependency[];
}

export interface ElectronAPI {
  getAvailableDrives: () => Promise<string[]>;
  pickFolder: () => Promise<string | null>;
  startScan: (options: ScanOptions) => Promise<void>;
  cancelScan: () => Promise<void>;
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void;
  onScanAssetFound: (callback: (asset: ModelAsset) => void) => () => void;
  onScanComplete: (callback: (assets: ModelAsset[]) => void) => () => void;
  getAssets: () => Promise<ModelAsset[]>;
  toggleFavorite: (id: string) => Promise<boolean>;
  revealInFolder: (path: string) => Promise<void>;
  openInDefaultApp: (path: string) => Promise<void>;
  openInBlender: (path: string) => Promise<void>;
  exportBlendToGlb: (blendPath: string) => Promise<{ success: boolean; glbPath?: string; error?: string }>;
  getBlenderInfo: () => Promise<BlenderInfo>;
  setBlenderPath: (customPath: string) => Promise<BlenderInfo>;
  pickBlenderExecutable: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  saveCustomThumbnail: (assetId: string, dataUrl: string) => Promise<string>;
  clearCache: () => Promise<void>;
  readLocalFileUrl: (filePath: string) => Promise<string>;
  readModelBuffer: (filePath: string) => Promise<ArrayBuffer>;
  updateAssetTags: (assetId: string, tags: string[]) => Promise<void>;
  getCollections: () => Promise<ModelCollection[]>;
  createCollection: (name: string, color?: string) => Promise<ModelCollection>;
  deleteCollection: (id: string) => Promise<void>;
  toggleAssetCollection: (assetId: string, collectionId: string) => Promise<boolean>;
  // Auto-Update
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  onUpdateStatus: (callback: (state: UpdateState) => void) => () => void;
  // Milestone 2
  startDrag: (filePath: string, iconDataUrl?: string) => void;
  inspectDependencies: (filePath: string) => Promise<DependencyReport>;
  relinkDependencies: (
    modelPath: string,
    searchDir: string,
    copyFiles?: boolean
  ) => Promise<{ success: boolean; report: DependencyReport; relinkedCount: number }>;
  copyToClipboard: (text: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
