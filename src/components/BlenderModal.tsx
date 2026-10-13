import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Info,
} from 'lucide-react';
import type { BlenderInfo } from '../types';

interface BlenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  blenderInfo: BlenderInfo | null;
  onBlenderUpdated: (info: BlenderInfo) => void;
  onSkipStartupPrompt?: (skip: boolean) => void;
  initialSkipPreference?: boolean;
}

export const BlenderModal: React.FC<BlenderModalProps> = ({
  isOpen,
  onClose,
  blenderInfo,
  onBlenderUpdated,
  onSkipStartupPrompt,
  initialSkipPreference = false,
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(initialSkipPreference);

  if (!isOpen) return null;

  const handlePickExecutable = async () => {
    setErrorMessage(null);
    try {
      const selectedPath = await window.electronAPI.pickBlenderExecutable();
      if (!selectedPath) return;

      setIsValidating(true);
      const updatedInfo = await window.electronAPI.setBlenderPath(selectedPath);
      setIsValidating(false);

      if (updatedInfo.isAvailable) {
        onBlenderUpdated(updatedInfo);
      } else {
        setErrorMessage(
          updatedInfo.error ||
            'The selected executable could not be verified as a valid Blender installation.'
        );
      }
    } catch (err: any) {
      setIsValidating(false);
      setErrorMessage(err?.message || 'Failed to select executable.');
    }
  };

  const handleRescan = async () => {
    setErrorMessage(null);
    setIsValidating(true);
    try {
      // Clear custom path and re-detect
      await window.electronAPI.updateSettings({ customBlenderPath: undefined });
      const info = await window.electronAPI.getBlenderInfo();
      onBlenderUpdated(info);
      if (!info.isAvailable) {
        setErrorMessage('Auto-detection completed, but Blender was still not found.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error scanning for Blender.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownload = () => {
    window.electronAPI.openExternal('https://www.blender.org/download/');
  };

  const handleCopyPath = () => {
    if (blenderInfo?.executablePath) {
      window.electronAPI.copyToClipboard(blenderInfo.executablePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDismiss = () => {
    if (onSkipStartupPrompt) {
      onSkipStartupPrompt(dontShowAgain);
    }
    window.electronAPI.updateSettings({ skipBlenderPrompt: dontShowAgain });
    onClose();
  };

  const isConnected = !!blenderInfo?.isAvailable;

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
      <div
        className="modal-card"
        style={{ maxWidth: '580px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isConnected ? '#4ade80' : '#fbbf24',
              }}
            >
              {isConnected ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div className="modal-title">
                {isConnected ? 'Blender Integration Active' : 'Blender Setup Required'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                {isConnected
                  ? 'Real-time .blend interactive viewport & thumbnail engine enabled'
                  : 'Locate Blender to unlock interactive .blend scene previews'}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={handleDismiss} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isConnected ? (
            /* Connected State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#4ade80', fontWeight: 600 }}>
                    Detected Engine
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    Blender {blenderInfo.version || 'Active'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#4ade80',
                    background: 'rgba(34, 197, 94, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                  }}
                >
                  <span className="status-dot" style={{ background: '#22c55e' }}></span>
                  <span>Ready</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '6px', display: 'block' }}>
                  Executable Path:
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-subtle, rgba(255, 255, 255, 0.04))',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: 'var(--text-main)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={blenderInfo.executablePath}
                  >
                    {blenderInfo.executablePath}
                  </span>
                  <button
                    onClick={handleCopyPath}
                    title="Copy path"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                    }}
                  >
                    {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-subtle)',
                  lineHeight: '1.5',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '4px' }}>
                  <Sparkles size={14} color="#6366f1" /> Capabilities Enabled:
                </div>
                • Headless instant 3D viewport conversion for complex <code>.blend</code> scenes<br />
                • Automated mesh, texture, and object unpacking<br />
                • Direct "Open in Blender" DCC integration from model cards
              </div>
            </div>
          ) : (
            /* Not Found State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  color: 'var(--text-main)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#fbbf24' }}>
                  Why does Model Vault 3D need Blender?
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-subtle)', lineHeight: '1.5' }}>
                  While formats like GLTF, OBJ, and FBX load natively in Three.js, native <code>.blend</code> binary
                  files require Blender to headlessly convert internal nodes and modifiers into interactive 3D assets.
                </div>
              </div>

              {errorMessage && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handlePickExecutable}
                  disabled={isValidating}
                  style={{
                    padding: '12px 18px',
                    justifyContent: 'center',
                    fontSize: '14px',
                    gap: '10px',
                  }}
                >
                  {isValidating ? (
                    <RefreshCw size={16} className="spin" />
                  ) : (
                    <FolderOpen size={16} />
                  )}
                  <span>{isValidating ? 'Verifying Executable...' : 'Locate Blender Executable'}</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleDownload}
                  style={{
                    padding: '10px 16px',
                    justifyContent: 'center',
                    fontSize: '13px',
                    gap: '8px',
                  }}
                >
                  <ExternalLink size={15} />
                  <span>Download Blender (Free & Open Source)</span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-subtle)',
                  marginTop: '4px',
                }}
              >
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>
                  Already installed in a custom location or via Steam? Click &ldquo;Locate Blender Executable&rdquo; and
                  point to <code>blender.exe</code>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
          }}
        >
          {!isConnected ? (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Don&apos;t ask on startup</span>
            </label>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={handlePickExecutable}
              disabled={isValidating}
              style={{ fontSize: '12px' }}
            >
              <FolderOpen size={13} />
              <span>Change Path</span>
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleRescan}
              disabled={isValidating}
              title="Rescan system paths for Blender"
              style={{ fontSize: '12px' }}
            >
              <RefreshCw size={13} className={isValidating ? 'spin' : ''} />
              <span>Rescan</span>
            </button>

            <button className="btn btn-primary" onClick={handleDismiss} style={{ fontSize: '13px' }}>
              {isConnected ? 'Done' : 'Continue without Blender'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
