import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { ModelAsset, ModelCollection, AppSettings } from '../src/types';

export class AssetStore {
  private dataDir: string;
  private dbPath: string;
  private collectionsPath: string;
  private settingsPath: string;
  private thumbnailsDir: string;
  private assetsMap: Map<string, ModelAsset> = new Map();
  private collectionsMap: Map<string, ModelCollection> = new Map();
  private settings: AppSettings = {};

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'vault_data');
    this.dbPath = path.join(this.dataDir, 'assets_index.json');
    this.collectionsPath = path.join(this.dataDir, 'collections.json');
    this.settingsPath = path.join(this.dataDir, 'settings.json');
    this.thumbnailsDir = path.join(this.dataDir, 'thumbnails');
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const list: ModelAsset[] = JSON.parse(raw);
        for (const item of list) {
          if (!item.tags) item.tags = [];
          if (!item.collections) item.collections = [];
          this.assetsMap.set(item.id, item);
        }
      }

      if (fs.existsSync(this.collectionsPath)) {
        const raw = fs.readFileSync(this.collectionsPath, 'utf-8');
        const list: ModelCollection[] = JSON.parse(raw);
        for (const item of list) {
          this.collectionsMap.set(item.id, item);
        }
      }

      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[AssetStore] Failed to load index from disk:', err);
    }
  }

  public saveToDisk() {
    try {
      const list = Array.from(this.assetsMap.values());
      fs.writeFileSync(this.dbPath, JSON.stringify(list, null, 2), 'utf-8');

      const colList = Array.from(this.collectionsMap.values());
      fs.writeFileSync(this.collectionsPath, JSON.stringify(colList, null, 2), 'utf-8');

      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AssetStore] Failed to save index to disk:', err);
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveToDisk();
    return { ...this.settings };
  }

  public getAllAssets(): ModelAsset[] {
    return Array.from(this.assetsMap.values());
  }

  public getAsset(id: string): ModelAsset | undefined {
    return this.assetsMap.get(id);
  }

  public upsertAsset(asset: ModelAsset): void {
    const existing = this.assetsMap.get(asset.id);
    if (existing) {
      asset.isFavorite = existing.isFavorite;
      asset.tags = existing.tags && existing.tags.length > 0 ? existing.tags : (asset.tags || []);
      asset.collections = existing.collections || [];
      if (!asset.thumbnailUrl && existing.thumbnailUrl) {
        asset.thumbnailUrl = existing.thumbnailUrl;
        asset.thumbnailSource = existing.thumbnailSource;
      }
    } else {
      if (!asset.tags) asset.tags = [];
      if (!asset.collections) asset.collections = [];
    }
    this.assetsMap.set(asset.id, asset);
  }

  public upsertBatch(assets: ModelAsset[]): void {
    for (const a of assets) {
      this.upsertAsset(a);
    }
    this.saveToDisk();
  }

  public toggleFavorite(id: string): boolean {
    const asset = this.assetsMap.get(id);
    if (asset) {
      asset.isFavorite = !asset.isFavorite;
      this.saveToDisk();
      return asset.isFavorite;
    }
    return false;
  }

  public updateAssetTags(assetId: string, tags: string[]): void {
    const asset = this.assetsMap.get(assetId);
    if (asset) {
      // Normalize tags (trim, remove duplicates)
      asset.tags = Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));
      this.saveToDisk();
    }
  }

  public getCollections(): ModelCollection[] {
    return Array.from(this.collectionsMap.values());
  }

  public createCollection(name: string, color?: string): ModelCollection {
    const id = `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const collection: ModelCollection = {
      id,
      name: name.trim(),
      color: color || '#6366f1',
      createdAt: Date.now(),
    };
    this.collectionsMap.set(id, collection);
    this.saveToDisk();
    return collection;
  }

  public deleteCollection(id: string): void {
    this.collectionsMap.delete(id);
    // Remove from assets
    for (const asset of this.assetsMap.values()) {
      if (asset.collections && asset.collections.includes(id)) {
        asset.collections = asset.collections.filter((cid) => cid !== id);
      }
    }
    this.saveToDisk();
  }

  public toggleAssetCollection(assetId: string, collectionId: string): boolean {
    const asset = this.assetsMap.get(assetId);
    if (!asset) return false;
    if (!asset.collections) asset.collections = [];

    const exists = asset.collections.includes(collectionId);
    if (exists) {
      asset.collections = asset.collections.filter((id) => id !== collectionId);
    } else {
      asset.collections.push(collectionId);
    }
    this.saveToDisk();
    return !exists;
  }

  public async saveCustomThumbnail(assetId: string, dataUrl: string): Promise<string> {
    const asset = this.assetsMap.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const thumbFilename = `${assetId}_custom.${ext}`;
    const thumbPath = path.join(this.thumbnailsDir, thumbFilename);

    await fs.promises.writeFile(thumbPath, buffer);

    asset.thumbnailUrl = `file://${thumbPath.replace(/\\/g, '/')}`;
    asset.thumbnailSource = 'rendered';
    this.saveToDisk();

    return asset.thumbnailUrl;
  }

  public clear(): void {
    this.assetsMap.clear();
    this.collectionsMap.clear();
    this.saveToDisk();
  }
}
