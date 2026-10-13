import React, { useState, useEffect } from 'react';
import { X, Folder, HardDrive, Check, Loader2, Plus, AlertCircle } from 'lucide-react';
import type { ModelFormat, ScanOptions, ScanProgress } from '../types';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartScan: (options: ScanOptions) => void;
  onCancelScan: () => void;
  scanProgress: ScanProgress;
  isScanning: boolean;
}

const ALL_FORMATS: { format: ModelFormat; label: string }[] = [
  { format: 'blend', label: '.blend (Blender)' },
  { format: 'fbx', label: '.fbx (Autodesk)' },
  { format: 'glb', label: '.glb (glTF Binary)' },
  { format: 'gltf', label: '.gltf (glTF)' },
  { format: 'obj', label: '.obj (Wavefront)' },
  { format: 'stl', label: '.stl (3D Print)' },
];

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onStartScan,
  onCancelScan,
  scanProgress,
  isScanning,
}) => {
  const [availableDrives, setAvailableDrives] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<ModelFormat[]>([
    'blend',
    'fbx',
    'glb',
    'gltf',
    'obj',
    'stl',
  ]);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);

  // Load drives on mount
  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getAvailableDrives().then((drives) => {
        setAvailableDrives(drives);
        if (selectedPaths.length === 0 && drives.length > 0) {
          // Default to first drive or user folder
          setSelectedPaths([drives[0]]);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTogglePath = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleAddCustomFolder = async () => {
    const folder = await window.electronAPI.pickFolder();
    if (folder && !selectedPaths.includes(folder)) {
      setSelectedPaths((prev) => [...prev, folder]);
    }
  };

  const handleToggleFormat = (format: ModelFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const handleLaunchScan = () => {
    if (selectedPaths.length === 0) return;
    onStartScan({
      rootPaths: selectedPaths,
      formats: selectedFormats,
      includeSubfolders,
      skipHidden: true,
    });
  };

  return (
    <div className="modal-overlay" onClick={isScanning ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HardDrive size={20} color="var(--accent-primary)" />
            <div className="modal-title">Scan Hard Drive & Folders</div>
          </div>
          {!isScanning && (
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {isScanning ? (
            /* Live Scanning Status */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Loader2 size={24} className="spinner" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>Scanning Local Storage...</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Found {scanProgress.foundModels} 3D models across {scanProgress.scannedDirectories} directories
                  </div>
                </div>
              </div>

              {/* Progress Tracker Box */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-subtle)',
                  wordBreak: 'break-all',
                }}
              >
                <div style={{ marginBottom: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  CURRENT DIRECTORY:
                </div>
                {scanProgress.currentPath || 'Traversing file system...'}
              </div>

              <button className="btn btn-secondary" onClick={onCancelScan} style={{ alignSelf: 'flex-start' }}>
                Stop Scan
              </button>
            </div>
          ) : (
            /* Configuration Form */
            <>
              {/* Scan Targets */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Target Drives & Folders
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {availableDrives.map((drive) => {
                    const isSelected = selectedPaths.includes(drive);
                    return (
                      <button
                        key={drive}
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '12.5px', padding: '6px 14px' }}
                        onClick={() => handleTogglePath(drive)}
                      >
                        <HardDrive size={14} />
                        <span>Drive {drive}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}

                  <button className="btn btn-secondary" onClick={handleAddCustomFolder}>
                    <Plus size={14} />
                    <span>Choose Folder...</span>
                  </button>
                </div>

                {/* Selected Custom Paths List */}
                {selectedPaths.filter((p) => !availableDrives.includes(p)).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {selectedPaths
                      .filter((p) => !availableDrives.includes(p))
                      .map((p) => (
                        <div
                          key={p}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 12px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <Folder size={14} color="var(--accent-primary)" />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {p}
                            </span>
                          </div>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '2px 6px' }}
                            onClick={() => handleTogglePath(p)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Format selection */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  3D File Formats to Index
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {ALL_FORMATS.map(({ format, label }) => {
                    const isSelected = selectedFormats.includes(format);
                    return (
                      <button
                        key={format}
                        className={`btn ${isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                        style={{
                          justifyContent: 'space-between',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          fontSize: '12.5px',
                        }}
                        onClick={() => handleToggleFormat(format)}
                      >
                        <span>{label}</span>
                        {isSelected && <Check size={14} color="var(--accent-primary)" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="includeSubfolders"
                  checked={includeSubfolders}
                  onChange={(e) => setIncludeSubfolders(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="includeSubfolders" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  Recursively scan subfolders (automatically ignores system/temp caches)
                </label>
              </div>

              {selectedPaths.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-warning)', fontSize: '12px' }}>
                  <AlertCircle size={15} />
                  <span>Please select at least one drive or folder to scan.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!isScanning && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleLaunchScan}
              disabled={selectedPaths.length === 0 || selectedFormats.length === 0}
            >
              <HardDrive size={15} />
              <span>Start Scanning</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
