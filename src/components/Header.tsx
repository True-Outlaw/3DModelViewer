import React from 'react';
import { Box, Search, X, HardDrive, RefreshCw, Sparkles, Download, CheckCircle2 } from 'lucide-react';
import type { BlenderInfo, AppTheme, UpdateState } from '../types';
import { formatBytes, formatNumber } from '../utils/formatters';
import { ThemeSelector } from './ThemeSelector';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalModels: number;
  totalBytes: number;
  blenderInfo: BlenderInfo | null;
  updateState: UpdateState;
  onOpenScanModal: () => void;
  onOpenBlenderModal: () => void;
  onCheckForUpdates: () => void;
  onOpenUpdateNotification: () => void;
  onClearCache: () => void;
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  totalModels,
  totalBytes,
  blenderInfo,
  updateState,
  onOpenScanModal,
  onOpenBlenderModal,
  onCheckForUpdates,
  onOpenUpdateNotification,
  onClearCache,
  currentTheme,
  onThemeChange,
}) => {
  return (
    <header className="app-header">
      {/* Brand */}
      <div className="brand-section">
        <div className="brand-icon-box">
          <Box size={22} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-title">MODEL VAULT 3D</div>
          <div className="brand-subtitle">Asset Studio & Viewport</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="search-section">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search models by name, path, or extension (e.g. character, .blend)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => onSearchChange('')} title="Clear search">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Status & Actions */}
      <div className="header-actions">
        {/* Auto-Update Badge (when update is available, downloading, or ready) */}
        {updateState.status === 'available' && (
          <button
            className="btn btn-secondary"
            onClick={onOpenUpdateNotification}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: '#a5b4fc',
              gap: '6px',
            }}
            title="Click to view and install update"
          >
            <Sparkles size={13} className="spin-slow" />
            <span>Update v{updateState.info?.version}</span>
          </button>
        )}

        {updateState.status === 'downloading' && (
          <button
            className="btn btn-secondary"
            onClick={onOpenUpdateNotification}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              borderColor: 'rgba(99, 102, 241, 0.4)',
              color: '#a5b4fc',
              gap: '6px',
            }}
          >
            <Download size={13} className="spin" />
            <span>Downloading {updateState.progress?.percent || 0}%</span>
          </button>
        )}

        {updateState.status === 'downloaded' && (
          <button
            className="btn btn-primary"
            onClick={onOpenUpdateNotification}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#22c55e',
              borderColor: '#16a34a',
              gap: '6px',
            }}
            title="Restart app to apply update"
          >
            <CheckCircle2 size={13} />
            <span>Install Update</span>
          </button>
        )}

        {/* Blender status badge / button */}
        {blenderInfo?.isAvailable ? (
          <button
            className="blender-badge"
            onClick={onOpenBlenderModal}
            title={`Blender executable: ${blenderInfo.executablePath} (Click to configure or change version)`}
            style={{
              cursor: 'pointer',
              background: 'rgba(234, 88, 12, 0.1)',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="status-dot"></span>
            <span>Blender {blenderInfo.version || 'Active'}</span>
          </button>
        ) : (
          <button
            className="blender-badge blender-badge-warning"
            onClick={onOpenBlenderModal}
            title="Blender not detected! Click to locate or download Blender for .blend viewing"
            style={{
              cursor: 'pointer',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
              transition: 'all 0.15s ease',
            }}
          >
            <span className="status-dot" style={{ background: '#f59e0b' }}></span>
            <span>Locate Blender</span>
          </button>
        )}

        {/* Total stats */}
        <div style={{ fontSize: '12px', color: 'var(--text-subtle)', textAlign: 'right' }}>
          <div><strong style={{ color: 'var(--text-main)' }}>{formatNumber(totalModels)}</strong> Models</div>
          <div>{formatBytes(totalBytes)} Indexed</div>
        </div>

        {/* Theme Selector */}
        <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />

        {/* Check for updates manually button */}
        <button
          className="btn btn-secondary"
          onClick={onCheckForUpdates}
          title={updateState.status === 'checking' ? 'Checking for updates...' : 'Check for new releases'}
          disabled={updateState.status === 'checking'}
        >
          <Sparkles size={14} className={updateState.status === 'checking' ? 'spin' : ''} />
          <span>{updateState.status === 'checking' ? 'Checking...' : 'Updates'}</span>
        </button>

        <button className="btn btn-secondary" onClick={onClearCache} title="Clear index cache">
          <RefreshCw size={14} />
          <span>Reset</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenScanModal}>
          <HardDrive size={15} />
          <span>Scan Storage</span>
        </button>
      </div>
    </header>
  );
};
