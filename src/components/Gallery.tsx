import React from 'react';
import { Box, HardDrive } from 'lucide-react';
import type { ModelAsset } from '../types';
import { ModelCard } from './ModelCard';
import type { CardSize } from './Sidebar';

export type SortOrder = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

interface GalleryProps {
  assets: ModelAsset[];
  totalAssetsCount: number;
  cardSize: CardSize;
  sortOrder: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  onSelectAsset: (asset: ModelAsset) => void;
  onToggleFavorite: (id: string) => void;
  onRevealInFolder: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
  onContextMenu: (asset: ModelAsset, x: number, y: number) => void;
  onOpenScanModal: () => void;
}

export const Gallery: React.FC<GalleryProps> = ({
  assets,
  totalAssetsCount,
  cardSize,
  sortOrder,
  onSortChange,
  onSelectAsset,
  onToggleFavorite,
  onRevealInFolder,
  onOpenInDefaultApp,
  onContextMenu,
  onOpenScanModal,
}) => {
  return (
    <div className="gallery-container">
      {/* Toolbar */}
      <div className="gallery-toolbar">
        <div className="gallery-stats">
          Showing <strong style={{ color: 'var(--text-main)' }}>{assets.length}</strong> of{' '}
          {totalAssetsCount} models
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Sort by:</span>
          <select
            className="gallery-sort-select"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
          >
            <option value="date-desc">Modified: Newest First</option>
            <option value="date-asc">Modified: Oldest First</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
            <option value="size-desc">Size: Largest First</option>
            <option value="size-asc">Size: Smallest First</option>
          </select>
        </div>
      </div>

      {/* Grid Content */}
      <div className="gallery-scrollable">
        {assets.length > 0 ? (
          <div className={`models-grid grid-${cardSize}`}>
            {assets.map((asset) => (
              <ModelCard
                key={asset.id}
                asset={asset}
                onSelect={onSelectAsset}
                onToggleFavorite={onToggleFavorite}
                onRevealInFolder={onRevealInFolder}
                onOpenInDefaultApp={onOpenInDefaultApp}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <Box size={36} strokeWidth={1.8} />
            </div>
            <div className="empty-title">
              {totalAssetsCount === 0 ? 'No 3D Models Indexed Yet' : 'No Matching Models'}
            </div>
            <div className="empty-desc">
              {totalAssetsCount === 0
                ? 'Scan your local storage, project directories, or downloads folder to collect and preview your 3D models.'
                : 'Try adjusting your search keywords, clear the active format filters, or scan another folder.'}
            </div>
            {totalAssetsCount === 0 && (
              <button className="btn btn-primary" onClick={onOpenScanModal} style={{ marginTop: '8px' }}>
                <HardDrive size={16} />
                <span>Scan Hard Drive</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
