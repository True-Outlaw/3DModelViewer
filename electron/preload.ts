import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, ModelAsset, ScanOptions, ScanProgress, BlenderInfo } from '../src/types';

const api: ElectronAPI = {
  getAvailableDrives: () => ipcRenderer.invoke('vault:get-drives'),
  pickFolder: () => ipcRenderer.invoke('vault:pick-folder'),
  startScan: (options: ScanOptions) => ipcRenderer.invoke('vault:start-scan', options),
  cancelScan: () => ipcRenderer.invoke('vault:cancel-scan'),

  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const subscription = (_event: any, progress: ScanProgress) => callback(progress);
    ipcRenderer.on('vault:scan-progress', subscription);
    return () => {
      ipcRenderer.removeListener('vault:scan-progress', subscription);
    };
  },

  onScanAssetFound: (callback: (asset: ModelAsset) => void) => {
    const subscription = (_event: any, asset: ModelAsset) => callback(asset);
    ipcRenderer.on('vault:scan-asset-found', subscription);
    return () => {
      ipcRenderer.removeListener('vault:scan-asset-found', subscription);
    };
  },

  onScanComplete: (callback: (assets: ModelAsset[]) => void) => {
    const subscription = (_event: any, assets: ModelAsset[]) => callback(assets);
    ipcRenderer.on('vault:scan-complete', subscription);
    return () => {
      ipcRenderer.removeListener('vault:scan-complete', subscription);
    };
  },

  getAssets: () => ipcRenderer.invoke('vault:get-assets'),
  toggleFavorite: (id: string) => ipcRenderer.invoke('vault:toggle-favorite', id),
  revealInFolder: (path: string) => ipcRenderer.invoke('vault:reveal-in-folder', path),
  openInDefaultApp: (path: string) => ipcRenderer.invoke('vault:open-in-default-app', path),
  openInBlender: (path: string) => ipcRenderer.invoke('vault:open-in-blender', path),
  exportBlendToGlb: (blendPath: string) => ipcRenderer.invoke('vault:export-blend-glb', blendPath),
  getBlenderInfo: () => ipcRenderer.invoke('vault:get-blender-info'),
  saveCustomThumbnail: (assetId: string, dataUrl: string) =>
    ipcRenderer.invoke('vault:save-custom-thumbnail', assetId, dataUrl),
  clearCache: () => ipcRenderer.invoke('vault:clear-cache'),
  readLocalFileUrl: (filePath: string) => ipcRenderer.invoke('vault:read-local-file-url', filePath),
  readModelBuffer: (filePath: string) => ipcRenderer.invoke('vault:read-model-buffer', filePath),
  updateAssetTags: (assetId: string, tags: string[]) => ipcRenderer.invoke('vault:update-tags', assetId, tags),
  getCollections: () => ipcRenderer.invoke('vault:get-collections'),
  createCollection: (name: string, color?: string) => ipcRenderer.invoke('vault:create-collection', name, color),
  deleteCollection: (id: string) => ipcRenderer.invoke('vault:delete-collection', id),
  toggleAssetCollection: (assetId: string, collectionId: string) =>
    ipcRenderer.invoke('vault:toggle-asset-collection', assetId, collectionId),
  startDrag: (filePath: string, iconDataUrl?: string) =>
    ipcRenderer.send('vault:start-drag', filePath, iconDataUrl),
  inspectDependencies: (filePath: string) =>
    ipcRenderer.invoke('vault:inspect-dependencies', filePath),
  relinkDependencies: (modelPath: string, searchDir: string, copyFiles?: boolean) =>
    ipcRenderer.invoke('vault:relink-dependencies', modelPath, searchDir, copyFiles),
  copyToClipboard: (text: string) =>
    ipcRenderer.invoke('vault:copy-to-clipboard', text),
};

contextBridge.exposeInMainWorld('electronAPI', api);
