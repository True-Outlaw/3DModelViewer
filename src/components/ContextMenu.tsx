import React, { useEffect, useRef } from 'react';
import {
  ExternalLink,
  FolderOpen,
  Copy,
  Star,
  Layers,
  Check,
  Folder,
  FileCode,
  Share2,
} from 'lucide-react';
import type { ModelAsset, ModelCollection } from '../types';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  asset: ModelAsset | null;
}

interface ContextMenuProps {
  state: ContextMenuState;
  collections: ModelCollection[];
  onClose: () => void;
  onOpenInBlender: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
  onRevealInFolder: (path: string) => void;
  onCopyPath: (path: string) => void;
  onCopyName: (name: string) => void;
  onInspectTextures: (asset: ModelAsset) => void;
  onToggleFavorite: (id: string) => void;
  onToggleCollection: (assetId: string, collectionId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  collections,
  onClose,
  onOpenInBlender,
  onOpenInDefaultApp,
  onRevealInFolder,
  onCopyPath,
  onCopyName,
  onInspectTextures,
  onToggleFavorite,
  onToggleCollection,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or ESC
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen || !state.asset) return null;

  const { asset } = state;

  // Viewport clamping
  const menuWidth = 240;
  const menuHeight = 360;
  const clampedX = Math.min(state.x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(state.y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="context-menu-popover"
      style={{
        left: `${Math.max(10, clampedX)}px`,
        top: `${Math.max(10, clampedY)}px`,
      }}
    >
      {/* Header Info */}
      <div className="context-menu-header">
        <span className="context-menu-asset-name">{asset.name}</span>
        <span className="context-menu-asset-sub">.{asset.format.toUpperCase()}</span>
      </div>

      <div className="context-menu-divider" />

      {/* Primary Actions */}
      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onOpenInBlender(asset.path);
        }}
      >
        <span className="menu-icon-tag blender-tag">B</span>
        <span>Open in Blender</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onOpenInDefaultApp(asset.path);
        }}
      >
        <ExternalLink size={14} />
        <span>Open in Default App</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onRevealInFolder(asset.path);
        }}
      >
        <FolderOpen size={14} />
        <span>Reveal in Explorer</span>
      </button>

      <div className="context-menu-divider" />

      {/* Texture & Material Inspection */}
      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onInspectTextures(asset);
        }}
      >
        <Layers size={14} color="#38bdf8" />
        <span>Inspect Textures & Maps</span>
      </button>

      {/* Favorite Toggle */}
      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onToggleFavorite(asset.id);
        }}
      >
        <Star
          size={14}
          fill={asset.isFavorite ? '#facc15' : 'none'}
          color={asset.isFavorite ? '#facc15' : 'currentColor'}
        />
        <span>{asset.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>

      <div className="context-menu-divider" />

      {/* Copy Actions */}
      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onCopyPath(asset.path);
        }}
      >
        <Copy size={14} />
        <span>Copy File Path</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onCopyName(asset.name);
        }}
      >
        <FileCode size={14} />
        <span>Copy Model Name</span>
      </button>

      {/* Collections Submenu / Section */}
      {collections.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <div className="context-menu-section-label">Add to Collection:</div>
          <div className="context-menu-sublist">
            {collections.map((col) => {
              const isIn = asset.collections?.includes(col.id);
              return (
                <button
                  key={col.id}
                  className={`context-menu-subitem ${isIn ? 'active' : ''}`}
                  onClick={() => onToggleCollection(asset.id, col.id)}
                >
                  <Folder size={12} color={col.color || '#6366f1'} />
                  <span className="subitem-name">{col.name}</span>
                  {isIn && <Check size={12} color="var(--accent-primary)" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
