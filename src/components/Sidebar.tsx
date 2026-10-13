import React, { useState } from 'react';
import { Layers, Star, Clock, Grid, Folder, Plus, Trash2, Tag, X, Palette } from 'lucide-react';
import type { ModelFormat, ModelCollection, AppTheme } from '../types';
import { getFormatBadgeStyle } from '../utils/formatters';
import { THEME_OPTIONS } from './ThemeSelector';

export type ViewFilter = 'all' | 'favorites' | 'recent' | 'collection' | 'tag';
export type CardSize = 'small' | 'medium' | 'large' | 'cinema';

interface SidebarProps {
  currentView: ViewFilter;
  onViewChange: (view: ViewFilter) => void;
  selectedFormat: ModelFormat | 'all';
  onFormatChange: (format: ModelFormat | 'all') => void;
  formatCounts: Record<string, number>;
  totalCount: number;
  favoritesCount: number;
  cardSize: CardSize;
  onCardSizeChange: (size: CardSize) => void;

  // Collections
  collections: ModelCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  collectionCounts: Record<string, number>;

  // Tags
  tagCounts: Record<string, number>;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;

  // Theme
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

const SUPPORTED_FORMATS: { format: ModelFormat; label: string }[] = [
  { format: 'blend', label: 'Blender (.blend)' },
  { format: 'fbx', label: 'FBX (.fbx)' },
  { format: 'glb', label: 'glTF Binary (.glb)' },
  { format: 'gltf', label: 'glTF (.gltf)' },
  { format: 'obj', label: 'Wavefront (.obj)' },
  { format: 'stl', label: 'STL (.stl)' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  selectedFormat,
  onFormatChange,
  formatCounts,
  totalCount,
  favoritesCount,
  cardSize,
  onCardSizeChange,
  collections,
  selectedCollectionId,
  onSelectCollection,
  onCreateCollection,
  onDeleteCollection,
  collectionCounts,
  tagCounts,
  selectedTag,
  onSelectTag,
  currentTheme,
  onThemeChange,
}) => {
  const cardSizes: CardSize[] = ['small', 'medium', 'large', 'cinema'];
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName('');
      setIsCreatingCollection(false);
    }
  };

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return (
    <aside className="app-sidebar">
      {/* Views */}
      <div>
        <div className="sidebar-group-title">Library</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <button
            className={`sidebar-nav-item ${
              currentView === 'all' && selectedFormat === 'all' && !selectedCollectionId && !selectedTag
                ? 'active'
                : ''
            }`}
            onClick={() => {
              onViewChange('all');
              onFormatChange('all');
              onSelectCollection(null);
              onSelectTag(null);
            }}
          >
            <div className="nav-item-left">
              <Layers size={16} />
              <span>All 3D Models</span>
            </div>
            <span className="nav-item-badge">{totalCount}</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentView === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              onViewChange('favorites');
              onSelectCollection(null);
              onSelectTag(null);
            }}
          >
            <div className="nav-item-left">
              <Star size={16} />
              <span>Favorites</span>
            </div>
            <span className="nav-item-badge">{favoritesCount}</span>
          </button>

          <button
            className={`sidebar-nav-item ${currentView === 'recent' ? 'active' : ''}`}
            onClick={() => {
              onViewChange('recent');
              onSelectCollection(null);
              onSelectTag(null);
            }}
          >
            <div className="nav-item-left">
              <Clock size={16} />
              <span>Recent Additions</span>
            </div>
          </button>
        </div>
      </div>

      {/* Collections */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '4px' }}>
          <div className="sidebar-group-title" style={{ marginBottom: 0 }}>Collections</div>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', fontSize: '11px', color: 'var(--accent-primary)' }}
            onClick={() => setIsCreatingCollection(true)}
            title="Create new collection"
          >
            <Plus size={13} />
          </button>
        </div>

        {isCreatingCollection && (
          <form onSubmit={handleCreateSubmit} style={{ marginTop: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                autoFocus
                placeholder="Collection name..."
                className="search-input"
                style={{ height: '30px', fontSize: '12px', padding: '0 8px' }}
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0 8px', height: '30px', fontSize: '11px' }}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0 6px', height: '30px' }}
                onClick={() => setIsCreatingCollection(false)}
              >
                <X size={13} />
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
          {collections.map((col) => {
            const count = collectionCounts[col.id] || 0;
            const isSelected = selectedCollectionId === col.id;

            return (
              <div
                key={col.id}
                className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                style={{ display: 'flex', justifyContent: 'space-between' }}
                onClick={() => {
                  onSelectCollection(isSelected ? null : col.id);
                  onViewChange(isSelected ? 'all' : 'collection');
                }}
              >
                <div className="nav-item-left" style={{ overflow: 'hidden' }}>
                  <Folder size={15} color={col.color || '#6366f1'} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {col.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="nav-item-badge">{count}</span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '2px', opacity: 0.6 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete collection "${col.name}"?`)) {
                        onDeleteCollection(col.id);
                      }
                    }}
                    title="Delete collection"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {collections.length === 0 && !isCreatingCollection && (
            <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', padding: '6px 10px' }}>
              No custom collections yet.
            </div>
          )}
        </div>
      </div>

      {/* Formats Filter */}
      <div>
        <div className="sidebar-group-title">3D Formats</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {SUPPORTED_FORMATS.map(({ format, label }) => {
            const count = formatCounts[format] || 0;
            const isSelected = selectedFormat === format;
            const badgeStyle = getFormatBadgeStyle(format);

            return (
              <button
                key={format}
                className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  onFormatChange(isSelected ? 'all' : format);
                }}
              >
                <div className="nav-item-left">
                  <span
                    className="format-dot"
                    style={{ backgroundColor: badgeStyle.text }}
                  />
                  <span>{label}</span>
                </div>
                <span className="nav-item-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Popular Tags */}
      {topTags.length > 0 && (
        <div>
          <div className="sidebar-group-title">Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 4px' }}>
            {topTags.map(([tag, count]) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  className={`tag-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    onSelectTag(isSelected ? null : tag);
                    onViewChange(isSelected ? 'all' : 'tag');
                  }}
                  title={`Filter by #${tag}`}
                >
                  <Tag size={10} />
                  <span>#{tag}</span>
                  <span style={{ opacity: 0.6, fontSize: '10px' }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Viewport Card Sizing */}
      <div>
        <div className="sidebar-group-title">Grid Density</div>
        <div className="card-size-control">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Grid size={14} /> Card Size
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
              {cardSize}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            className="size-slider"
            value={cardSizes.indexOf(cardSize)}
            onChange={(e) => onCardSizeChange(cardSizes[parseInt(e.target.value)])}
          />
        </div>
      </div>

      {/* Theme Options */}
      <div>
        <div className="sidebar-group-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={13} /> Theme
          </span>
        </div>
        <div className="sidebar-theme-grid">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={`sidebar-theme-pill ${isSelected ? 'active' : ''}`}
                onClick={() => onThemeChange(theme.id)}
                title={`${theme.name}: ${theme.description}`}
              >
                <span
                  className="sidebar-theme-dot"
                  style={{ backgroundColor: theme.accentColor }}
                />
                <span>{theme.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
