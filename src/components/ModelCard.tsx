import React, { useRef } from 'react';
import { Star, Eye, ExternalLink, FolderOpen, Box, GripVertical, MoreHorizontal } from 'lucide-react';
import type { ModelAsset } from '../types';
import { formatBytes, getFormatBadgeStyle } from '../utils/formatters';

interface ModelCardProps {
  asset: ModelAsset;
  onSelect: (asset: ModelAsset) => void;
  onToggleFavorite: (id: string) => void;
  onRevealInFolder: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
  onContextMenu: (asset: ModelAsset, x: number, y: number) => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  asset,
  onSelect,
  onToggleFavorite,
  onRevealInFolder,
  onOpenInDefaultApp,
  onContextMenu,
}) => {
  const badgeStyle = getFormatBadgeStyle(asset.format);
  const isDraggingRef = useRef(false);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = (e: React.MouseEvent) => {
    // If user just dragged or dropped, do not pop open the 3D preview
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelect(asset);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite(asset.id);
  };

  const handleRevealClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRevealInFolder(asset.path);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenInDefaultApp(asset.path);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(asset, e.clientX, e.clientY);
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onContextMenu(asset, rect.left, rect.bottom + 4);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
    }, 400);

    window.electronAPI.startDrag(asset.path, asset.thumbnailUrl || undefined);
  };

  const handleDragEnd = () => {
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
    }, 400);
  };

  return (
    <div
      className="model-card"
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
    >
      {/* Preview Container */}
      <div
        className="card-preview-wrapper"
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Drag model into Blender, UE5, Unity, or Explorer • Click to view 3D preview"
      >
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="card-img"
            loading="lazy"
            draggable={false}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
            onError={(e) => {
              // Fallback to procedural icon if local image fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="procedural-preview">
            <Box size={38} strokeWidth={1.5} color={badgeStyle.text} />
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em' }}>
              3D {asset.format.toUpperCase()}
            </span>
          </div>
        )}

        {/* DCC Drag Handle (Top Left) */}
        <div
          className="card-drag-grip"
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="Drag model into Blender, Unreal Engine 5, Unity, or Windows Explorer"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </div>

        {/* Top Badges */}
        <div className="card-badges">
          <span
            className="badge-format"
            style={{
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.text,
              borderColor: badgeStyle.border,
            }}
          >
            .{asset.format}
          </span>
          <span className="badge-size">{formatBytes(asset.sizeBytes)}</span>
        </div>

        {/* Favorite Button (Layered on top of hover overlay) */}
        <button
          className={`card-fav-btn ${asset.isFavorite ? 'active' : ''}`}
          onClick={handleFavoriteClick}
          title={asset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          type="button"
        >
          <Star size={16} fill={asset.isFavorite ? '#facc15' : 'none'} color={asset.isFavorite ? '#facc15' : 'currentColor'} />
        </button>

        {/* Hover Quick Actions */}
        <div
          className="card-hover-actions"
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="card-action-btn" onClick={() => onSelect(asset)} title="Open 3D Viewport">
            <Eye size={14} />
            <span>3D View</span>
          </button>
          <button className="card-action-btn" onClick={handleOpenClick} title="Open with Blender or default app">
            <ExternalLink size={14} />
          </button>
          <button className="card-action-btn" onClick={handleRevealClick} title="Reveal in Windows Explorer">
            <FolderOpen size={14} />
          </button>
          <button className="card-action-btn" onClick={handleMoreClick} title="More actions & context menu">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Meta details */}
      <div className="card-meta">
        <div className="card-title" title={asset.name}>
          {asset.name}
        </div>
        <div className="card-folder" title={asset.directory}>
          <FolderOpen size={12} />
          <span>{asset.directory.split('\\').pop() || asset.directory}</span>
        </div>
        {asset.tags && asset.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {asset.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="card-tag-badge">
                #{tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="card-tag-badge" style={{ opacity: 0.6 }}>
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
