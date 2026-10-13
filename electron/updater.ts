import { app, BrowserWindow, ipcMain, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState, UpdateInfo, UpdateProgress } from '../src/types';

let currentState: UpdateState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
};

let targetWindow: BrowserWindow | null = null;

function broadcastStatus() {
  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('vault:update-status', currentState);
  }
}

/**
 * Initializes autoUpdater event listeners and IPC handlers.
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  targetWindow = mainWindow;

  // Don't auto-download without user consent/action
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Configure logger if available
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    currentState = {
      status: 'checking',
      info: null,
      progress: null,
      error: null,
    };
    broadcastStatus();
  });

  autoUpdater.on('update-available', (info) => {
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releaseDate: info.releaseDate,
    };

    currentState = {
      status: 'available',
      info: updateInfo,
      progress: null,
      error: null,
    };
    broadcastStatus();
  });

  autoUpdater.on('update-not-available', (_info) => {
    currentState = {
      status: 'not-available',
      info: null,
      progress: null,
      error: null,
    };
    broadcastStatus();
  });

  autoUpdater.on('download-progress', (prog) => {
    const progress: UpdateProgress = {
      percent: Math.round(prog.percent * 10) / 10,
      bytesPerSecond: prog.bytesPerSecond,
      transferred: prog.transferred,
      total: prog.total,
    };

    currentState = {
      status: 'downloading',
      info: currentState.info,
      progress,
      error: null,
    };
    broadcastStatus();
  });

  autoUpdater.on('update-downloaded', (info) => {
    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      releaseDate: info.releaseDate,
    };

    currentState = {
      status: 'downloaded',
      info: updateInfo,
      progress: {
        percent: 100,
        bytesPerSecond: 0,
        transferred: currentState.progress?.total || 0,
        total: currentState.progress?.total || 0,
      },
      error: null,
    };
    broadcastStatus();
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error encountered:', err);
    currentState = {
      status: 'error',
      info: currentState.info,
      progress: null,
      error: err?.message || 'An error occurred while checking for updates.',
    };
    broadcastStatus();
  });

  // Setup IPC Handlers
  ipcMain.handle('vault:check-for-updates', async () => {
    return triggerUpdateCheck();
  });

  ipcMain.handle('vault:download-update', async () => {
    if (app.isPackaged) {
      await autoUpdater.downloadUpdate();
    } else {
      // Simulate download in development mode
      simulateDevDownload();
    }
  });

  ipcMain.on('vault:install-update', () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall(false, true);
    } else {
      console.log('[AutoUpdater] Dev mode: quitAndInstall requested.');
      app.relaunch();
      app.quit();
    }
  });

  // Automatically check for updates on startup (after a slight 3.5s delay to keep launch fast)
  setTimeout(() => {
    triggerUpdateCheck().catch((err) => {
      console.warn('[AutoUpdater] Initial launch check error:', err);
    });
  }, 3500);
}

/**
 * Triggers an update check either via electron-updater (packaged) or GitHub API (dev).
 */
export async function triggerUpdateCheck(): Promise<UpdateState> {
  currentState = {
    status: 'checking',
    info: null,
    progress: null,
    error: null,
  };
  broadcastStatus();

  if (app.isPackaged) {
    try {
      await autoUpdater.checkForUpdates();
      return currentState;
    } catch (err: any) {
      currentState = {
        status: 'error',
        info: null,
        progress: null,
        error: err?.message || 'Failed to check for updates',
      };
      broadcastStatus();
      return currentState;
    }
  } else {
    // Development mode fallback: query GitHub Releases API directly
    return checkGitHubReleasesDev();
  }
}

/**
 * Fallback update check for development mode using GitHub Releases API
 */
async function checkGitHubReleasesDev(): Promise<UpdateState> {
  try {
    const currentVersion = app.getVersion();
    const response = await net.fetch('https://api.github.com/repos/True-Outlaw/3DModelViewer/releases/latest', {
      headers: {
        'User-Agent': 'ModelVault3D-App',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      currentState = {
        status: 'not-available',
        info: null,
        progress: null,
        error: null,
      };
      broadcastStatus();
      return currentState;
    }

    const data: any = await response.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');

    if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
      currentState = {
        status: 'available',
        info: {
          version: latestVersion,
          releaseNotes: data.body || 'New features and improvements available.',
          releaseDate: data.published_at,
        },
        progress: null,
        error: null,
      };
    } else {
      currentState = {
        status: 'not-available',
        info: null,
        progress: null,
        error: null,
      };
    }
    broadcastStatus();
    return currentState;
  } catch (err: any) {
    currentState = {
      status: 'error',
      info: null,
      progress: null,
      error: err?.message || 'Could not connect to GitHub',
    };
    broadcastStatus();
    return currentState;
  }
}

function simulateDevDownload() {
  currentState = {
    status: 'downloading',
    info: currentState.info,
    progress: { percent: 0, bytesPerSecond: 1048576, transferred: 0, total: 100 },
    error: null,
  };
  broadcastStatus();

  let p = 0;
  const interval = setInterval(() => {
    p += 25;
    if (p >= 100) {
      clearInterval(interval);
      currentState = {
        status: 'downloaded',
        info: currentState.info,
        progress: { percent: 100, bytesPerSecond: 0, transferred: 100, total: 100 },
        error: null,
      };
      broadcastStatus();
    } else {
      currentState = {
        status: 'downloading',
        info: currentState.info,
        progress: { percent: p, bytesPerSecond: 1048576, transferred: p, total: 100 },
        error: null,
      };
      broadcastStatus();
    }
  }, 400);
}

function isNewerVersion(remote: string, current: string): boolean {
  const rParts = remote.split('.').map((n) => parseInt(n, 10) || 0);
  const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}
