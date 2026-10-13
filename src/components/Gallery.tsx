import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 700 });
  const [scrollTop, setScrollTop] = useState(0);

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    ro.observe(el);
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setContainerSize({ width: el.clientWidth - 48, height: el.clientHeight });
    }

    return () => ro.disconnect();
  }, []);

  // Reset scroll position on sort order changes
  const prevSortRef = useRef(sortOrder);
  useEffect(() => {
    if (prevSortRef.current !== sortOrder) {
      prevSortRef.current = sortOrder;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        setScrollTop(0);
      }
    }
  }, [sortOrder]);

  // Compute grid geometry based on cardSize and container width
  const gap = 18;
  const minWidth = useMemo(() => {
    switch (cardSize) {
      case 'small':
        return 180;
      case 'medium':
        return 240;
      case 'large':
        return 320;
      case 'cinema':
        return 440;
      default:
        return 240;
    }
  }, [cardSize]);

  const availableWidth = Math.max(minWidth, containerSize.width);
  const numCols = Math.max(1, Math.floor((availableWidth + gap) / (minWidth + gap)));
  const cardWidth = (availableWidth - (numCols - 1) * gap) / numCols;
  const previewHeight = cardWidth * 0.75;
  const metaHeight = cardSize === 'small' ? 70 : cardSize === 'cinema' ? 96 : 84;
  const cardHeight = Math.round(previewHeight + metaHeight);
  const rowHeight = cardHeight + gap;

  const totalRows = Math.ceil(assets.length / numCols);
  const totalHeight = totalRows > 0 ? totalRows * rowHeight - gap : 0;

  // Windowed virtual rows
  const overscan = 2; // Render 2 buffer rows above and below viewport for instant scrolling
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(
    totalRows - 1,
    Math.floor((scrollTop + containerSize.height) / rowHeight) + overscan
  );

  const visibleRows = useMemo(() => {
    if (totalRows === 0 || assets.length === 0) return [];
    const rows = [];
    for (let r = startRow; r <= endRow; r++) {
      const startIndex = r * numCols;
      const rowAssets = assets.slice(startIndex, startIndex + numCols);
      if (rowAssets.length > 0) {
        rows.push({
          rowIndex: r,
          rowAssets,
          top: r * rowHeight,
        });
      }
    }
    return rows;
  }, [startRow, endRow, numCols, rowHeight, assets, totalRows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

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

      {/* Grid Content with Windowed Virtualization */}
      <div
        className="gallery-scrollable"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {assets.length > 0 ? (
          <div
            className="virtual-grid-container"
            style={{
              position: 'relative',
              height: `${totalHeight}px`,
              width: '100%',
              minHeight: '100%',
            }}
          >
            {visibleRows.map(({ rowIndex, rowAssets, top }) => (
              <div
                key={rowIndex}
                className={`virtual-grid-row grid-${cardSize}`}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: 0,
                  right: 0,
                  height: `${cardHeight}px`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${numCols}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowAssets.map((asset) => (
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
export default Gallery;
