import React from 'react';
import { Download, RefreshCw, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { UpdateState } from '../types';
import { formatBytes } from '../utils/formatters';

interface UpdateNotificationProps {
  updateState: UpdateState;
  onDownload: () => void;
  onInstall: () => void;
  onDismiss: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateState,
  onDownload,
  onInstall,
  onDismiss,
}) => {
  const { status, info, progress, error } = updateState;

  if (status === 'idle' || status === 'not-available' || status === 'checking') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        maxWidth: '380px',
        width: 'calc(100% - 48px)',
        background: 'var(--bg-card, #12151e)',
        border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
        borderRadius: '12px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px var(--accent-glow, rgba(99, 102, 241, 0.2))',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'slideUp 0.25s ease-out',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background:
                status === 'downloaded'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : status === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
              color:
                status === 'downloaded'
                  ? '#4ade80'
                  : status === 'error'
                  ? '#f87171'
                  : 'var(--accent-primary, #818cf8)',
            }}
          >
            {status === 'downloaded' ? (
              <CheckCircle2 size={18} />
            ) : status === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <Sparkles size={18} />
            )}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #fff)' }}>
              {status === 'available' && `Update v${info?.version || ''} Available`}
              {status === 'downloading' && 'Downloading Update...'}
              {status === 'downloaded' && 'Update Ready to Install'}
              {status === 'error' && 'Update Failed'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle, #94a3b8)', marginTop: '2px' }}>
              {status === 'available' && 'A new version of Model Vault 3D is available.'}
              {status === 'downloading' &&
                (progress
                  ? `${Math.round(progress.percent)}% (${formatBytes(progress.transferred)} / ${formatBytes(
                      progress.total
                    )})`
                  : 'Fetching installer from GitHub...')}
              {status === 'downloaded' && 'Restart the application to complete the update.'}
              {status === 'error' && (error || 'Unable to download update.')}
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-subtle, #94a3b8)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Bar (When downloading) */}
      {status === 'downloading' && progress && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progress.percent))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                borderRadius: '9999px',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
        {status === 'available' && (
          <>
            <button
              className="btn btn-secondary"
              onClick={onDismiss}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Later
            </button>
            <button
              className="btn btn-primary"
              onClick={onDownload}
              style={{ padding: '6px 14px', fontSize: '12px', gap: '6px' }}
            >
              <Download size={13} />
              <span>Download & Update</span>
            </button>
          </>
        )}

        {status === 'downloaded' && (
          <button
            className="btn btn-primary"
            onClick={onInstall}
            style={{
              padding: '7px 16px',
              fontSize: '12px',
              background: '#22c55e',
              borderColor: '#16a34a',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} />
            <span>Restart & Install Now</span>
          </button>
        )}

        {status === 'error' && (
          <button
            className="btn btn-secondary"
            onClick={onDismiss}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
