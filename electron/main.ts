import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, clipboard, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import { DiskScanner } from './scanner';
import { AssetStore } from './store';
import { detectBlender, exportBlendToGlb, setCustomBlenderPath } from './blenderCli';
import { inspectModelDependencies, relinkModelTextures } from './textureInspector';
import type { ScanOptions, AppSettings } from '../src/types';

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let scanner: DiskScanner | null = null;
let store: AssetStore | null = null;

// Register custom protocol for local 3D assets to bypass Chromium file:// sandbox restrictions
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0b0d13',
    title: 'Model Vault 3D',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Essential for loading local textures & 3D mesh buffers seamlessly
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  store = new AssetStore();
  scanner = new DiskScanner();

  // Register local file streaming handler with WHATWG authority support
  protocol.handle('vault-asset', (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('[vault-asset protocol error]:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Enumerate Windows drive letters
  ipcMain.handle('vault:get-drives', async () => {
    const drives: string[] = [];
    if (process.platform === 'win32') {
      const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (const letter of letters) {
        const drivePath = `${letter}:\\`;
        if (fs.existsSync(drivePath)) {
          drives.push(drivePath);
        }
      }
    } else {
      drives.push('/');
    }
    return drives;
  });

  // Pick custom folder
  ipcMain.handle('vault:pick-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Folder with 3D Models',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Start scan
  ipcMain.handle('vault:start-scan', async (_event, options: ScanOptions) => {
    if (!scanner || !store) return;

    try {
      const assets = await scanner.scan(
        options,
        (progress) => {
          mainWindow?.webContents.send('vault:scan-progress', progress);
        },
        (asset) => {
          store?.upsertAsset(asset);
          mainWindow?.webContents.send('vault:scan-asset-found', asset);
        }
      );

      store.saveToDisk();
      mainWindow?.webContents.send('vault:scan-complete', assets);
    } catch (err) {
      console.error('[Scanner] Scan execution failed:', err);
    }
  });

  // Cancel scan
  ipcMain.handle('vault:cancel-scan', async () => {
    scanner?.cancel();
  });

  // Get indexed assets
  ipcMain.handle('vault:get-assets', async () => {
    return store?.getAllAssets() || [];
  });

  // Toggle favorite
  ipcMain.handle('vault:toggle-favorite', async (_event, id: string) => {
    return store?.toggleFavorite(id) || false;
  });

  // Reveal file in Explorer
  ipcMain.handle('vault:reveal-in-folder', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  // Open with default app
  ipcMain.handle('vault:open-in-default-app', async (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
    }
  });

  // Open in Blender specifically
  ipcMain.handle('vault:open-in-blender', async (_event, filePath: string) => {
    const settings = store?.getSettings();
    const blenderInfo = await detectBlender(settings?.customBlenderPath);
    if (blenderInfo.isAvailable && blenderInfo.executablePath) {
      const { spawn } = await import('child_process');
      spawn(blenderInfo.executablePath, [filePath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      await shell.openPath(filePath);
    }
  });

  // Export .blend to temporary .glb for 3D viewport
  ipcMain.handle('vault:export-blend-glb', async (_event, blendPath: string) => {
    return exportBlendToGlb(blendPath);
  });

  // Get Blender installation info (honoring custom path if saved)
  ipcMain.handle('vault:get-blender-info', async () => {
    const settings = store?.getSettings();
    return detectBlender(settings?.customBlenderPath);
  });

  // Set / validate custom Blender executable path
  ipcMain.handle('vault:set-blender-path', async (_event, customPath: string) => {
    const info = await setCustomBlenderPath(customPath);
    if (info.isAvailable) {
      store?.updateSettings({ customBlenderPath: customPath });
    }
    return info;
  });

  // Open file picker specifically for Blender executable
  ipcMain.handle('vault:pick-blender-executable', async () => {
    if (!mainWindow) return null;
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Blender Executable',
      properties: ['openFile'],
      filters: isWin
        ? [
            { name: 'Blender Executable (blender.exe)', extensions: ['exe'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : isMac
        ? [
            { name: 'Blender Application / Binary', extensions: ['app', ''] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    let selected = result.filePaths[0];

    // If macOS app bundle was selected, resolve internal executable binary
    if (isMac && selected.endsWith('.app')) {
      const macBinary = path.join(selected, 'Contents', 'MacOS', 'Blender');
      if (fs.existsSync(macBinary)) {
        selected = macBinary;
      }
    }

    return selected;
  });

  // Open external links (e.g. https://www.blender.org/download/)
  ipcMain.handle('vault:open-external', async (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url);
    }
  });

  // App Settings IPC
  ipcMain.handle('vault:get-settings', async () => {
    return store?.getSettings() || {};
  });

  ipcMain.handle('vault:update-settings', async (_event, partial: Partial<AppSettings>) => {
    return store?.updateSettings(partial) || {};
  });

  // Save custom thumbnail
  ipcMain.handle('vault:save-custom-thumbnail', async (_event, assetId: string, dataUrl: string) => {
    if (!store) throw new Error('Store uninitialized');
    return store.saveCustomThumbnail(assetId, dataUrl);
  });

  // Clear cache
  ipcMain.handle('vault:clear-cache', async () => {
    store?.clear();
  });

  // Normalize local file URL
  ipcMain.handle('vault:read-local-file-url', async (_event, filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    return `vault-asset://app/${normalized}`;
  });

  // Read model file directly into raw ArrayBuffer (bypasses all browser network/CORS limits)
  ipcMain.handle('vault:read-model-buffer', async (_event, filePath: string) => {
    const buf = await fs.promises.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });

  // Update asset tags
  ipcMain.handle('vault:update-tags', async (_event, assetId: string, tags: string[]) => {
    store?.updateAssetTags(assetId, tags);
  });

  // Collections
  ipcMain.handle('vault:get-collections', async () => {
    return store?.getCollections() || [];
  });

  ipcMain.handle('vault:create-collection', async (_event, name: string, color?: string) => {
    if (!store) throw new Error('Store uninitialized');
    return store.createCollection(name, color);
  });

  ipcMain.handle('vault:delete-collection', async (_event, id: string) => {
    store?.deleteCollection(id);
  });

  ipcMain.handle('vault:toggle-asset-collection', async (_event, assetId: string, collectionId: string) => {
    return store?.toggleAssetCollection(assetId, collectionId) || false;
  });

  // Milestone 2: Native OS Drag-and-Drop Export to DCCs (Blender, UE5, Unity, Explorer)
  let cachedDefaultDragIcon: Electron.NativeImage | null = null;

  function getDefaultDragIcon(): Electron.NativeImage {
    if (cachedDefaultDragIcon && !cachedDefaultDragIcon.isEmpty()) {
      return cachedDefaultDragIcon;
    }

    try {
      const userData = app.getPath('userData');
      const cachedIconPath = path.join(userData, 'vault_drag_icon.png');
      if (fs.existsSync(cachedIconPath)) {
        const img = nativeImage.createFromPath(cachedIconPath);
        if (!img.isEmpty()) {
          cachedDefaultDragIcon = img;
          return cachedDefaultDragIcon;
        }
      }

      // Generate a crisp, non-empty 64x64 RGBA bitmap preview icon (indigo 3D cube motif)
      const w = 64;
      const h = 64;
      const raw = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const isBorder = x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
          const isCorner =
            (x < 5 && y < 5) ||
            (x >= w - 5 && y < 5) ||
            (x < 5 && y >= h - 5) ||
            (x >= w - 5 && y >= h - 5);

          if (isCorner) {
            raw[idx + 3] = 0; // Transparent rounded corner
          } else {
            raw[idx] = isBorder ? 129 : 99;      // R (#6366f1)
            raw[idx + 1] = isBorder ? 140 : 102; // G
            raw[idx + 2] = isBorder ? 248 : 241; // B
            raw[idx + 3] = isBorder ? 255 : 230; // A
          }
        }
      }

      const img = nativeImage.createFromBitmap(raw, { width: w, height: h });
      try {
        fs.writeFileSync(cachedIconPath, img.toPNG());
      } catch {
        // ignore cache write error
      }
      cachedDefaultDragIcon = img;
      return cachedDefaultDragIcon;
    } catch (err) {
      console.error('[getDefaultDragIcon] Error generating default icon:', err);
      const fallbackRaw = Buffer.alloc(32 * 32 * 4, 180);
      return nativeImage.createFromBitmap(fallbackRaw, { width: 32, height: 32 });
    }
  }

  function resolveDragIcon(iconUrlOrPath?: string): Electron.NativeImage {
    if (iconUrlOrPath) {
      try {
        if (iconUrlOrPath.startsWith('data:image/bmp;base64,')) {
          const b64 = iconUrlOrPath.slice('data:image/bmp;base64,'.length);
          const buf = Buffer.from(b64, 'base64');
          if (buf.length > 54 && buf.toString('ascii', 0, 2) === 'BM') {
            const width = buf.readInt32LE(18);
            const height = Math.abs(buf.readInt32LE(22));
            const offset = buf.readUInt32LE(10);
            const pixelLen = width * height * 4;
            if (width > 0 && height > 0 && offset + pixelLen <= buf.length) {
              const rawPixels = buf.subarray(offset, offset + pixelLen);
              const custom = nativeImage.createFromBitmap(rawPixels, { width, height });
              if (!custom.isEmpty()) {
                return custom.resize({ width: 64, height: 64 });
              }
            }
          }
        } else if (iconUrlOrPath.startsWith('data:image')) {
          const custom = nativeImage.createFromDataURL(iconUrlOrPath);
          if (!custom.isEmpty()) {
            return custom.resize({ width: 64, height: 64 });
          }
        } else if (iconUrlOrPath.startsWith('file://')) {
          const filePath = fileURLToPath(iconUrlOrPath);
          if (fs.existsSync(filePath)) {
            const custom = nativeImage.createFromPath(filePath);
            if (!custom.isEmpty()) {
              return custom.resize({ width: 64, height: 64 });
            }
          }
        } else if (iconUrlOrPath.startsWith('vault-asset://app/')) {
          const localPath = iconUrlOrPath.replace(/^vault-asset:\/\/app\//, '').replace(/\//g, '\\');
          if (fs.existsSync(localPath)) {
            const custom = nativeImage.createFromPath(localPath);
            if (!custom.isEmpty()) {
              return custom.resize({ width: 64, height: 64 });
            }
          }
        } else if (fs.existsSync(iconUrlOrPath)) {
          const custom = nativeImage.createFromPath(iconUrlOrPath);
          if (!custom.isEmpty()) {
            return custom.resize({ width: 64, height: 64 });
          }
        }
      } catch (e) {
        console.warn('[resolveDragIcon] Custom icon parsing failed, using default:', e);
      }
    }

    return getDefaultDragIcon();
  }

  ipcMain.on('vault:start-drag', (event, filePath: string, iconDataUrl?: string) => {
    try {
      const absPath = path.resolve(filePath);
      if (!fs.existsSync(absPath)) {
        console.warn('[vault:start-drag] File does not exist:', absPath);
        return;
      }

      const dragIcon = resolveDragIcon(iconDataUrl);

      event.sender.startDrag({
        file: absPath,
        icon: dragIcon,
      });
      console.log(`[vault:start-drag] Initiated native drag for: ${absPath}`);
    } catch (err) {
      console.error('[vault:start-drag error]:', err);
    }
  });

  // Milestone 2: Texture & Material Dependency Inspector
  ipcMain.handle('vault:inspect-dependencies', async (_event, filePath: string) => {
    return inspectModelDependencies(filePath);
  });

  ipcMain.handle(
    'vault:relink-dependencies',
    async (_event, modelPath: string, searchDir: string, copyFiles = true) => {
      return relinkModelTextures(modelPath, searchDir, copyFiles);
    }
  );

  // Milestone 2: Clipboard Action
  ipcMain.handle('vault:copy-to-clipboard', async (_event, text: string) => {
    clipboard.writeText(text);
  });
}
