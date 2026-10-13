import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import type { AppTheme } from '../types';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  description: string;
  accentColor: string;
  bgColor: string;
  cardColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'slate',
    name: 'Midnight Slate',
    description: 'Deep obsidian with indigo glow',
    accentColor: '#6366f1',
    bgColor: '#090b10',
    cardColor: '#131722',
  },
  {
    id: 'blender',
    name: 'Blender Studio',
    description: 'Blender 4.x charcoal & signature orange',
    accentColor: '#ea7600',
    bgColor: '#191c20',
    cardColor: '#272c33',
  },
  {
    id: 'unreal',
    name: 'Unreal Dark',
    description: 'Technical deep onyx & electric cyan',
    accentColor: '#0ea5e9',
    bgColor: '#07090e',
    cardColor: '#111622',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Pitch black OLED with neon fuchsia',
    accentColor: '#ec4899',
    bgColor: '#050508',
    cardColor: '#100d1c',
  },
  {
    id: 'forest',
    name: 'Nordic Forest',
    description: 'Deep pine twilight & emerald mint',
    accentColor: '#10b981',
    bgColor: '#080d0b',
    cardColor: '#111c18',
  },
  {
    id: 'monochrome',
    name: 'Monochrome Titanium',
    description: 'Minimalist studio graphite & silver',
    accentColor: '#e2e8f0',
    bgColor: '#101112',
    cardColor: '#1d1e22',
  },
];

interface ThemeSelectorProps {
  currentTheme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="theme-selector-container" ref={dropdownRef}>
      <button
        type="button"
        className={`theme-selector-btn ${compact ? 'compact' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={`Current Theme: ${activeOption.name}. Click to change theme.`}
      >
        <Palette size={15} className="theme-icon" />
        <span
          className="theme-current-dot"
          style={{ backgroundColor: activeOption.accentColor }}
        />
        {!compact && <span className="theme-current-name">{activeOption.name}</span>}
        <ChevronDown size={13} className={`theme-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="theme-dropdown-menu">
          <div className="theme-dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={15} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                Theme Appearance
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>6 Styles</span>
          </div>

          <div className="theme-options-list">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onThemeChange(theme.id);
                    setIsOpen(false);
                  }}
                >
                  {/* Swatch Preview */}
                  <div
                    className="theme-swatch"
                    style={{
                      backgroundColor: theme.bgColor,
                      borderColor: isSelected ? theme.accentColor : 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <div
                      className="theme-swatch-card"
                      style={{ backgroundColor: theme.cardColor }}
                    >
                      <div
                        className="theme-swatch-accent"
                        style={{ backgroundColor: theme.accentColor }}
                      />
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="theme-option-info">
                    <div className="theme-option-name" style={{ color: isSelected ? theme.accentColor : undefined }}>
                      {theme.name}
                    </div>
                    <div className="theme-option-desc">{theme.description}</div>
                  </div>

                  {/* Check Indicator */}
                  {isSelected && (
                    <div className="theme-check-icon" style={{ color: theme.accentColor }}>
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
