import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  RefreshCw,
  Search,
  ExternalLink,
  Layers,
  FileCheck,
  PackageCheck,
  FolderSearch,
} from 'lucide-react';
import type { DependencyReport, TextureDependency, TextureMapType } from '../types';
import { formatBytes } from '../utils/formatters';

interface TextureInspectorProps {
  modelPath: string;
  modelName: string;
  format: string;
  isOpen: boolean;
  onClose: () => void;
  onRelinkSuccess?: () => void;
  onRevealInFolder: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
}

export const TextureInspector: React.FC<TextureInspectorProps> = ({
  modelPath,
  modelName,
  format,
  isOpen,
  onClose,
  onRelinkSuccess,
  onRevealInFolder,
  onOpenInDefaultApp,
}) => {
  const [report, setReport] = useState<DependencyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRelinking, setIsRelinking] = useState(false);
  const [relinkMessage, setRelinkMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing' | 'found'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const loadReport = async () => {
    setIsLoading(true);
    setRelinkMessage(null);
    try {
      const res = await window.electronAPI.inspectDependencies(modelPath);
      setReport(res);
    } catch (err) {
      console.error('Failed to inspect model dependencies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && modelPath) {
      loadReport();
    }
  }, [isOpen, modelPath]);

  const handlePickRelinkFolder = async () => {
    try {
      const selectedFolder = await window.electronAPI.pickFolder();
      if (!selectedFolder) return;

      setIsRelinking(true);
      setRelinkMessage({ type: 'info', text: `Scanning folder "${selectedFolder}" for matching textures...` });

      const result = await window.electronAPI.relinkDependencies(modelPath, selectedFolder, true);

      setReport(result.report);
      if (result.relinkedCount > 0) {
        setRelinkMessage({
          type: 'success',
          text: `Successfully resolved & relinked ${result.relinkedCount} texture(s)!`,
        });
        if (onRelinkSuccess) {
          onRelinkSuccess();
        }
      } else {
        setRelinkMessage({
          type: 'info',
          text: 'No additional matching texture files found in the selected folder.',
        });
      }
    } catch (err) {
      console.error('Relink failed:', err);
      setRelinkMessage({
        type: 'error',
        text: 'An error occurred during texture relinking.',
      });
    } finally {
      setIsRelinking(false);
    }
  };

  if (!isOpen) return null;

  const getMapTypeStyle = (type: TextureMapType) => {
    switch (type) {
      case 'albedo':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'normal':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'roughness':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'metallic':
        return { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.3)' };
      case 'specular':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'ambient_occlusion':
        return { bg: 'rgba(100, 116, 139, 0.2)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' };
      case 'displacement':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: 'rgba(249, 115, 22, 0.3)' };
      case 'geometry_bin':
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const filteredDependencies = (report?.dependencies || []).filter((dep) => {
    if (filter === 'missing' && dep.status !== 'missing') return false;
    if (filter === 'found' && dep.status !== 'found') return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        dep.name.toLowerCase().includes(q) ||
        dep.referencedPath.toLowerCase().includes(q) ||
        dep.mapType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="texture-inspector-drawer">
      {/* Header */}
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="inspector-icon-wrap">
            <Layers size={18} color="var(--accent-primary)" />
          </div>
          <div>
            <div className="inspector-title">Textures & Material Maps</div>
            <div className="inspector-subtitle">
              {modelName} • .{format.toUpperCase()}
            </div>
          </div>
        </div>

        <button className="btn btn-ghost" onClick={onClose} title="Close Inspector">
          <X size={18} />
        </button>
      </div>

      {/* Summary Banner */}
      <div className="inspector-summary-box">
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', fontSize: '13px' }}>
            <RefreshCw size={16} className="spin-icon" />
            <span>Analyzing material dependencies and checking disk paths...</span>
          </div>
        ) : report && report.totalDependencies > 0 ? (
          <div className="inspector-status-grid">
            <div className="status-stat-card">
              <span className="stat-label">Total Dependencies</span>
              <span className="stat-value">{report.totalDependencies}</span>
            </div>
            <div className="status-stat-card success">
              <span className="stat-label">Linked & Ready</span>
              <span className="stat-value">{report.foundCount}</span>
            </div>
            <div className={`status-stat-card ${report.missingCount > 0 ? 'danger' : 'neutral'}`}>
              <span className="stat-label">Missing on Disk</span>
              <span className="stat-value">{report.missingCount}</span>
            </div>
          </div>
        ) : (
          <div className="inspector-embedded-notice">
            <PackageCheck size={28} color="#10b981" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#10b981' }}>
                Self-Contained Model
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                This file has no missing external texture dependencies. All geometry and materials are bundled or embedded.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Relink Action Bar if missing textures exist */}
      {report && report.missingCount > 0 && (
        <div className="relink-action-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={18} color="var(--accent-danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {report.missingCount} Missing Texture File{report.missingCount > 1 ? 's' : ''} Detected
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Moved or downloaded this model from another PC? Select the folder where your texture maps are stored to automatically reconnect them.
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handlePickRelinkFolder}
            disabled={isRelinking}
            style={{ width: '100%', marginTop: '10px' }}
          >
            {isRelinking ? (
              <>
                <RefreshCw size={14} className="spin-icon" />
                <span>Searching & Relinking...</span>
              </>
            ) : (
              <>
                <FolderSearch size={14} />
                <span>Relink Textures Folder...</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Relink Message Feedback */}
      {relinkMessage && (
        <div className={`relink-feedback-alert ${relinkMessage.type}`}>
          {relinkMessage.type === 'success' && <CheckCircle2 size={15} color="#10b981" />}
          {relinkMessage.type === 'error' && <AlertCircle size={15} color="#ef4444" />}
          {relinkMessage.type === 'info' && <RefreshCw size={15} className="spin-icon" color="#38bdf8" />}
          <span>{relinkMessage.text}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      {report && report.totalDependencies > 0 && (
        <div className="inspector-toolbar">
          <div className="filter-buttons-group">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({report.totalDependencies})
            </button>
            <button
              className={`filter-btn ${filter === 'missing' ? 'active' : ''}`}
              onClick={() => setFilter('missing')}
            >
              Missing ({report.missingCount})
            </button>
            <button
              className={`filter-btn ${filter === 'found' ? 'active' : ''}`}
              onClick={() => setFilter('found')}
            >
              Found ({report.foundCount})
            </button>
          </div>

          <div className="search-input-wrap" style={{ flex: 1, minWidth: '120px' }}>
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Search texture..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="search-input"
              style={{ height: '28px', fontSize: '11px', paddingLeft: '28px' }}
            />
          </div>
        </div>
      )}

      {/* Dependencies List */}
      <div className="inspector-list-scroll">
        {filteredDependencies.map((dep) => {
          const mapStyle = getMapTypeStyle(dep.mapType);
          const isFound = dep.status === 'found';

          return (
            <div key={dep.id} className={`dep-card ${isFound ? 'found' : 'missing'}`}>
              <div className="dep-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {isFound ? (
                    <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                  )}
                  <span className="dep-name" title={dep.name}>
                    {dep.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className="dep-type-pill"
                    style={{
                      backgroundColor: mapStyle.bg,
                      color: mapStyle.text,
                      borderColor: mapStyle.border,
                    }}
                  >
                    {dep.mapType.toUpperCase().replace('_', ' ')}
                  </span>
                  {dep.fileSizeBytes !== undefined && (
                    <span className="dep-size-pill">{formatBytes(dep.fileSizeBytes)}</span>
                  )}
                </div>
              </div>

              {/* Path Details */}
              <div className="dep-path-details">
                <div className="dep-path-row">
                  <span className="dep-path-label">Referenced:</span>
                  <span className="dep-path-val" title={dep.referencedPath}>
                    {dep.referencedPath}
                  </span>
                </div>
                {isFound && dep.resolvedPath && (
                  <div className="dep-path-row">
                    <span className="dep-path-label">Resolved:</span>
                    <span className="dep-path-val resolved" title={dep.resolvedPath}>
                      {dep.resolvedPath}
                    </span>
                  </div>
                )}
                {!isFound && (
                  <div className="dep-missing-warning">
                    File not found in model folder or standard textures subdirectory.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isFound && dep.resolvedPath && (
                <div className="dep-actions-row">
                  <button
                    className="btn btn-ghost dep-action-btn"
                    onClick={() => onOpenInDefaultApp(dep.resolvedPath!)}
                    title="Open image in default viewer"
                  >
                    <ExternalLink size={12} />
                    <span>View Image</span>
                  </button>
                  <button
                    className="btn btn-ghost dep-action-btn"
                    onClick={() => onRevealInFolder(dep.resolvedPath!)}
                    title="Reveal texture file in Windows Explorer"
                  >
                    <FolderOpen size={12} />
                    <span>Reveal in Explorer</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredDependencies.length === 0 && report && report.totalDependencies > 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px' }}>
            No texture dependencies match the active filter.
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="inspector-footer">
        <button className="btn btn-secondary" onClick={loadReport} style={{ width: '100%', fontSize: '12px' }}>
          <RefreshCw size={13} />
          <span>Re-inspect Model Dependencies</span>
        </button>
      </div>
    </div>
  );
};
