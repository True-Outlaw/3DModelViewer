import React, { useState, useEffect, useMemo } from 'react';
import type { ModelAsset, ModelFormat, ScanOptions, ScanProgress, BlenderInfo, ModelCollection, AppTheme } from './types';
import { Header } from './components/Header';
import { Sidebar, ViewFilter, CardSize } from './components/Sidebar';
import { Gallery, SortOrder } from './components/Gallery';
import { Viewer3D } from './components/Viewer3D';
import { ScanModal } from './components/ScanModal';
import { ContextMenu, ContextMenuState } from './components/ContextMenu';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('model_vault_theme') as AppTheme) || 'slate');
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [collections, setCollections] = useState<ModelCollection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<ViewFilter>('all');
  const [selectedFormat, setSelectedFormat] = useState<ModelFormat | 'all'>('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');
  const [cardSize, setCardSize] = useState<CardSize>('medium');

  const [activeAssetForViewer, setActiveAssetForViewer] = useState<ModelAsset | null>(null);
  const [openWithTextureInspector, setOpenWithTextureInspector] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('model_vault_theme', theme);
  }, [theme]);

  // Milestone 2: Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    asset: null,
  });
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    status: 'idle',
    scannedDirectories: 0,
    foundModels: 0,
    processedThumbnails: 0,
    currentPath: '',
  });

  const [blenderInfo, setBlenderInfo] = useState<BlenderInfo | null>(null);

  // Initial load
  useEffect(() => {
    // 1. Fetch assets
    window.electronAPI.getAssets().then((list) => {
      setAssets(list);
    });

    // 2. Fetch collections
    window.electronAPI.getCollections().then((cols) => {
      setCollections(cols);
    });

    // 3. Detect Blender
    window.electronAPI.getBlenderInfo().then((info) => {
      setBlenderInfo(info);
    });

    // 4. Listen to live scanner events
    const unsubProgress = window.electronAPI.onScanProgress((prog) => {
      setScanProgress(prog);
      if (prog.status === 'completed') {
        setIsScanning(false);
      }
    });

    const unsubAssetFound = window.electronAPI.onScanAssetFound((asset) => {
      setAssets((prev) => {
        const idx = prev.findIndex((a) => a.id === asset.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = asset;
          return next;
        }
        return [asset, ...prev];
      });
    });

    const unsubComplete = window.electronAPI.onScanComplete((finalAssets) => {
      setIsScanning(false);
      setAssets(finalAssets);
    });

    return () => {
      unsubProgress();
      unsubAssetFound();
      unsubComplete();
    };
  }, []);

  // Compute format counts
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      counts[a.format] = (counts[a.format] || 0) + 1;
    }
    return counts;
  }, [assets]);

  // Compute collection counts
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      if (a.collections) {
        for (const cid of a.collections) {
          counts[cid] = (counts[cid] || 0) + 1;
        }
      }
    }
    return counts;
  }, [assets]);

  // Compute tag counts
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      if (a.tags) {
        for (const tag of a.tags) {
          const lower = tag.toLowerCase();
          counts[lower] = (counts[lower] || 0) + 1;
        }
      }
    }
    return counts;
  }, [assets]);

  const favoritesCount = useMemo(() => {
    return assets.filter((a) => a.isFavorite).length;
  }, [assets]);

  const totalBytes = useMemo(() => {
    return assets.reduce((acc, a) => acc + a.sizeBytes, 0);
  }, [assets]);

  // Filtering & Sorting
  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = asset.name.toLowerCase().includes(q);
          const matchExt = asset.extension.toLowerCase().includes(q);
          const matchPath = asset.path.toLowerCase().includes(q);
          const matchTags = asset.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchExt && !matchPath && !matchTags) return false;
        }

        // View filter
        if (currentView === 'favorites' && !asset.isFavorite) return false;
        if (currentView === 'recent') {
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          if (asset.mtime < sevenDaysAgo) return false;
        }
        if (currentView === 'collection' && selectedCollectionId) {
          if (!asset.collections || !asset.collections.includes(selectedCollectionId)) return false;
        }
        if (currentView === 'tag' && selectedTag) {
          if (!asset.tags || !asset.tags.map((t) => t.toLowerCase()).includes(selectedTag.toLowerCase())) return false;
        }

        // Format filter
        if (selectedFormat !== 'all' && asset.format !== selectedFormat) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortOrder) {
          case 'date-desc':
            return b.mtime - a.mtime;
          case 'date-asc':
            return a.mtime - b.mtime;
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'size-desc':
            return b.sizeBytes - a.sizeBytes;
          case 'size-asc':
            return a.sizeBytes - b.sizeBytes;
          default:
            return 0;
        }
      });
  }, [assets, searchQuery, currentView, selectedFormat, selectedCollectionId, selectedTag, sortOrder]);

  // Handlers
  const handleToggleFavorite = async (id: string) => {
    const nextState = await window.electronAPI.toggleFavorite(id);
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isFavorite: nextState } : a))
    );
  };

  const handleRevealInFolder = (path: string) => {
    window.electronAPI.revealInFolder(path);
  };

  const handleOpenInDefaultApp = (path: string) => {
    window.electronAPI.openInDefaultApp(path);
  };

  const handleStartScan = (options: ScanOptions) => {
    setIsScanning(true);
    window.electronAPI.startScan(options);
  };

  const handleCancelScan = () => {
    window.electronAPI.cancelScan();
    setIsScanning(false);
  };

  const handleClearCache = async () => {
    if (confirm('Clear all indexed 3D models and reset cache?')) {
      await window.electronAPI.clearCache();
      setAssets([]);
      setCollections([]);
    }
  };

  const handleThumbnailUpdated = (assetId: string, newUrl: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, thumbnailUrl: newUrl, thumbnailSource: 'rendered' } : a))
    );
    if (activeAssetForViewer && activeAssetForViewer.id === assetId) {
      setActiveAssetForViewer((prev) => (prev ? { ...prev, thumbnailUrl: newUrl } : null));
    }
  };

  const handleCreateCollection = async (name: string) => {
    const newCol = await window.electronAPI.createCollection(name);
    setCollections((prev) => [...prev, newCol]);
  };

  const handleDeleteCollection = async (id: string) => {
    await window.electronAPI.deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setAssets((prev) =>
      prev.map((a) => ({
        ...a,
        collections: a.collections ? a.collections.filter((cid) => cid !== id) : [],
      }))
    );
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
      setCurrentView('all');
    }
  };

  const handleAssetTagsUpdated = (assetId: string, tags: string[]) => {
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, tags } : a)));
    if (activeAssetForViewer?.id === assetId) {
      setActiveAssetForViewer((prev) => (prev ? { ...prev, tags } : null));
    }
  };

  const handleAssetCollectionToggled = (assetId: string, collectionId: string) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        const cur = a.collections || [];
        const next = cur.includes(collectionId)
          ? cur.filter((id) => id !== collectionId)
          : [...cur, collectionId];
        return { ...a, collections: next };
      })
    );
    if (activeAssetForViewer?.id === assetId) {
      setActiveAssetForViewer((prev) => {
        if (!prev) return null;
        const cur = prev.collections || [];
        const next = cur.includes(collectionId)
          ? cur.filter((id) => id !== collectionId)
          : [...cur, collectionId];
        return { ...prev, collections: next };
      });
    }
  };

  // Milestone 2 Handlers
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleContextMenu = (asset: ModelAsset, x: number, y: number) => {
    setContextMenu({ isOpen: true, x, y, asset });
  };

  const handleCloseContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenInBlender = (path: string) => {
    window.electronAPI.openInBlender(path);
    showToast('Launching Blender with model...');
  };

  const handleCopyPath = (path: string) => {
    window.electronAPI.copyToClipboard(path);
    showToast('Copied full path to clipboard');
  };

  const handleCopyName = (name: string) => {
    window.electronAPI.copyToClipboard(name);
    showToast('Copied model name to clipboard');
  };

  const handleInspectTexturesFromMenu = (asset: ModelAsset) => {
    setOpenWithTextureInspector(true);
    setActiveAssetForViewer(asset);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalModels={assets.length}
        totalBytes={totalBytes}
        blenderInfo={blenderInfo}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onClearCache={handleClearCache}
        currentTheme={theme}
        onThemeChange={setTheme}
      />

      {/* Main Body */}
      <div className="main-content">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
          formatCounts={formatCounts}
          totalCount={assets.length}
          favoritesCount={favoritesCount}
          cardSize={cardSize}
          onCardSizeChange={setCardSize}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={setSelectedCollectionId}
          onCreateCollection={handleCreateCollection}
          onDeleteCollection={handleDeleteCollection}
          collectionCounts={collectionCounts}
          tagCounts={tagCounts}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          currentTheme={theme}
          onThemeChange={setTheme}
        />

        <Gallery
          assets={filteredAssets}
          totalAssetsCount={assets.length}
          cardSize={cardSize}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onSelectAsset={(asset) => {
            setOpenWithTextureInspector(false);
            setActiveAssetForViewer(asset);
          }}
          onToggleFavorite={handleToggleFavorite}
          onRevealInFolder={handleRevealInFolder}
          onOpenInDefaultApp={handleOpenInDefaultApp}
          onContextMenu={handleContextMenu}
          onOpenScanModal={() => setIsScanModalOpen(true)}
        />
      </div>

      {/* 3D Viewport Modal */}
      {activeAssetForViewer && (
        <Viewer3D
          asset={activeAssetForViewer}
          allAssets={assets}
          initialOpenTextureInspector={openWithTextureInspector}
          onClose={() => {
            setActiveAssetForViewer(null);
            setOpenWithTextureInspector(false);
          }}
          onRevealInFolder={handleRevealInFolder}
          onOpenInDefaultApp={handleOpenInDefaultApp}
          onThumbnailUpdated={handleThumbnailUpdated}
          collections={collections}
          onAssetTagsUpdated={handleAssetTagsUpdated}
          onAssetCollectionToggled={handleAssetCollectionToggled}
        />
      )}

      {/* Storage Scan Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onStartScan={handleStartScan}
        onCancelScan={handleCancelScan}
        scanProgress={scanProgress}
        isScanning={isScanning}
      />

      {/* Milestone 2: Context Menu */}
      <ContextMenu
        state={contextMenu}
        collections={collections}
        onClose={handleCloseContextMenu}
        onOpenInBlender={handleOpenInBlender}
        onOpenInDefaultApp={handleOpenInDefaultApp}
        onRevealInFolder={handleRevealInFolder}
        onCopyPath={handleCopyPath}
        onCopyName={handleCopyName}
        onInspectTextures={handleInspectTexturesFromMenu}
        onToggleFavorite={handleToggleFavorite}
        onToggleCollection={handleAssetCollectionToggled}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
export default App;
