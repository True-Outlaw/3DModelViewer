import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  X,
  Play,
  Pause,
  RotateCw,
  Camera,
  FolderOpen,
  ExternalLink,
  Layers,
  Sun,
  Maximize2,
  Tag,
  Folder,
  Check,
  User,
  Ruler,
  Grid,
  Columns2,
  Palette,
} from 'lucide-react';
import type { ModelAsset, ModelCollection } from '../types';
import { formatBytes, formatNumber, getFormatBadgeStyle } from '../utils/formatters';
import { TextureInspector } from './TextureInspector';
import { ModelComparator } from './ModelComparator';
import { disposeThreeScene } from '../utils/threeCleanup';
import {
  LightingPreset,
  BackgroundTheme,
  MeasurementUnit,
  applyLightingPreset,
  applyBackgroundTheme,
  createHumanoidSilhouette,
  createBoundingBoxGuide,
} from '../utils/viewportProTools';

interface Viewer3DProps {
  asset: ModelAsset;
  allAssets: ModelAsset[];
  initialOpenTextureInspector?: boolean;
  onClose: () => void;
  onRevealInFolder: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
  onThumbnailUpdated: (assetId: string, newUrl: string) => void;
  collections: ModelCollection[];
  onAssetTagsUpdated: (assetId: string, tags: string[]) => void;
  onAssetCollectionToggled: (assetId: string, collectionId: string) => void;
}

type ShadingMode = 'textured' | 'wireframe' | 'clay' | 'normals';

export const Viewer3D: React.FC<Viewer3DProps> = ({
  asset,
  allAssets,
  initialOpenTextureInspector = false,
  onClose,
  onRevealInFolder,
  onOpenInDefaultApp,
  onThumbnailUpdated,
  collections,
  onAssetTagsUpdated,
  onAssetCollectionToggled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading 3D mesh...');
  const [error, setError] = useState<string | null>(null);

  // Milestone 2: Texture Inspector & Relinking state
  const [isTextureInspectorOpen, setIsTextureInspectorOpen] = useState(initialOpenTextureInspector);
  const [depStatus, setDepStatus] = useState<{ total: number; missing: number; found: number } | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  // Milestone 3: Viewport Pro Tools Settings
  const [shadingMode, setShadingMode] = useState<ShadingMode>('textured');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>('dark');
  const [showHumanoidScale, setShowHumanoidScale] = useState(false);
  const [showBoundingBox, setShowBoundingBox] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('m');
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Dynamic Guide References
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const humanoidGuideRef = useRef<THREE.Group | null>(null);
  const boundingGuideRef = useRef<THREE.Group | null>(null);

  const [isTurntable, setIsTurntable] = useState(true);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(true);
  const [animationClips, setAnimationClips] = useState<THREE.AnimationClip[]>([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);

  // Mesh HUD stats
  const [stats, setStats] = useState({
    vertices: 0,
    triangles: 0,
    meshes: 0,
    dimensions: { x: 0, y: 0, z: 0 },
  });

  // Tag & Collection state
  const [tagInput, setTagInput] = useState('');
  const [isCollectionsMenuOpen, setIsCollectionsMenuOpen] = useState(false);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (cleaned && !asset.tags.includes(cleaned)) {
      const nextTags = [...asset.tags, cleaned];
      await window.electronAPI.updateAssetTags(asset.id, nextTags);
      onAssetTagsUpdated(asset.id, nextTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = asset.tags.filter((t) => t !== tagToRemove);
    await window.electronAPI.updateAssetTags(asset.id, nextTags);
    onAssetTagsUpdated(asset.id, nextTags);
  };

  const handleToggleCollection = async (collectionId: string) => {
    await window.electronAPI.toggleAssetCollection(asset.id, collectionId);
    onAssetCollectionToggled(asset.id, collectionId);
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Three.js Scene Setup & Model Loading
  useEffect(() => {
    if (!containerRef.current) return;

    let isDisposed = false;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f17);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 5000);
    camera.position.set(2, 2, 3);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = isTurntable;
    controls.autoRotateSpeed = 1.5;
    controlsRef.current = controls;

    // 5. Lighting & Atmosphere (Milestone 3)
    applyLightingPreset(scene, lightingPreset);
    applyBackgroundTheme(scene, renderer, backgroundTheme);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(20, 40, 0x374151, 0x1f2937);
    gridHelper.position.y = 0;
    gridHelper.visible = showGrid;
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    // Clock & Render Loop
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (mixerRef.current && isPlayingAnimation) {
        mixerRef.current.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 6. Model Loader Dispatcher
    const loadModel = async () => {
      setIsLoading(true);
      setError(null);

      // Yield frame so loading overlay & spinner paint immediately before heavy I/O
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (isDisposed) return;

      const startTime = Date.now();

      try {
        let targetFilePath: string;
        let effectiveFormat = asset.format;

        if (asset.format === 'blend') {
          setLoadingMessage('Loading Blender model (cached or converting)...');
          const result = await window.electronAPI.exportBlendToGlb(asset.path);
          if (isDisposed) return;
          if (!result.success || !result.glbPath) {
            throw new Error(result.error || 'Failed to export .blend file');
          }
          targetFilePath = result.glbPath;
          effectiveFormat = 'glb';
        } else {
          setLoadingMessage(`Loading ${asset.format.toUpperCase()} model...`);
          targetFilePath = asset.path;
        }

        if (isDisposed) return;

        // Base URL for resolving companion buffers (.bin), materials (.mtl), and texture maps
        const normalizedTarget = targetFilePath.replace(/\\/g, '/');
        const lastSlash = normalizedTarget.lastIndexOf('/');
        const dirPath = lastSlash !== -1 ? normalizedTarget.substring(0, lastSlash + 1) : '';
        const baseResourceUrl = `vault-asset://app/${dirPath}`;

        // LoadingManager ensures missing/relative texture URLs don't break the model load
        const loadingManager = new THREE.LoadingManager();
        loadingManager.setURLModifier((url) => {
          if (
            !url.startsWith('http://') &&
            !url.startsWith('https://') &&
            !url.startsWith('vault-asset://') &&
            !url.startsWith('blob:') &&
            !url.startsWith('data:')
          ) {
            const cleanUrl = url.replace(/^\.?\//, '');
            return `${baseResourceUrl}${cleanUrl}`;
          }
          return url;
        });
        loadingManager.onError = (itemUrl) => {
          console.warn('[ThreeLoader] Non-fatal missing dependency:', itemUrl);
        };

        setLoadingMessage(`Reading ${asset.format.toUpperCase()} model data...`);
        const buffer = await window.electronAPI.readModelBuffer(targetFilePath);

        if (isDisposed) return;

        setLoadingMessage('Parsing 3D geometry & materials...');
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (isDisposed) return;

        let loadedObject: THREE.Object3D;
        let clips: THREE.AnimationClip[] = [];

        // Refresh dependency status in background
        window.electronAPI.inspectDependencies(asset.path).then((rep) => {
          if (!isDisposed) {
            setDepStatus({
              total: rep.totalDependencies,
              missing: rep.missingCount,
              found: rep.foundCount,
            });
          }
        }).catch(() => {});

        // Choose Loader and parse with baseResourceUrl
        if (effectiveFormat === 'glb' || effectiveFormat === 'gltf' || effectiveFormat === 'blend') {
          const gltfLoader = new GLTFLoader(loadingManager);
          const gltf = await new Promise<any>((resolve, reject) => {
            gltfLoader.parse(buffer, baseResourceUrl, resolve, reject);
          });
          loadedObject = gltf.scene;
          clips = gltf.animations || [];
        } else if (effectiveFormat === 'fbx') {
          const fbxLoader = new FBXLoader(loadingManager);
          fbxLoader.setResourcePath(baseResourceUrl);
          loadedObject = fbxLoader.parse(buffer, baseResourceUrl);
          clips = (loadedObject as any).animations || [];
        } else if (effectiveFormat === 'obj') {
          const objLoader = new OBJLoader(loadingManager);
          objLoader.setPath(baseResourceUrl);
          objLoader.setResourcePath(baseResourceUrl);
          const text = new TextDecoder('utf-8').decode(buffer);

          // Check if companion MTL material library is available
          try {
            const report = await window.electronAPI.inspectDependencies(targetFilePath);
            const mtlDep = report.dependencies.find(
              (d) => d.name.toLowerCase().endsWith('.mtl') && d.status === 'found'
            );
            if (mtlDep && mtlDep.resolvedPath) {
              const mtlBuf = await window.electronAPI.readModelBuffer(mtlDep.resolvedPath);
              const mtlText = new TextDecoder('utf-8').decode(mtlBuf);
              const mtlLoader = new MTLLoader(loadingManager);
              mtlLoader.setPath(baseResourceUrl);
              mtlLoader.setResourcePath(baseResourceUrl);
              const materials = mtlLoader.parse(mtlText, baseResourceUrl);
              materials.preload();
              objLoader.setMaterials(materials);
            }
          } catch (e) {
            console.warn('Could not preload MTL materials for OBJ:', e);
          }

          loadedObject = objLoader.parse(text);
        } else if (effectiveFormat === 'stl') {
          const stlLoader = new STLLoader(loadingManager);
          const geometry = stlLoader.parse(buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x93c5fd,
            roughness: 0.35,
            metalness: 0.1,
          });
          loadedObject = new THREE.Mesh(geometry, material);
        } else {
          throw new Error(`Unsupported 3D format: ${asset.format}`);
        }

        if (isDisposed) return;

        // Auto-center & Frame Bounding Box
        const box = new THREE.Box3().setFromObject(loadedObject);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.1);

        loadedObject.position.x -= center.x;
        loadedObject.position.y -= box.min.y; // Sit on ground plane
        loadedObject.position.z -= center.z;

        scene.add(loadedObject);
        currentModelRef.current = loadedObject;

        // Pro Tools: Guides if already toggled on
        if (showHumanoidScale) {
          const guide = createHumanoidSilhouette(measurementUnit);
          const separation = Math.max(maxDim * 0.08, 0.5);
          guide.position.set(size.x / 2 + separation, 0, 0);
          humanoidGuideRef.current = guide;
          scene.add(guide);
        }
        if (showBoundingBox) {
          const guide = createBoundingBoxGuide(loadedObject, measurementUnit);
          boundingGuideRef.current = guide;
          scene.add(guide);
        }

        // Position camera nicely
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
        cameraZ = Math.max(cameraZ, 2.5);

        camera.position.set(cameraZ * 0.7, cameraZ * 0.6, cameraZ);
        camera.lookAt(0, size.y / 2, 0);
        controls.target.set(0, size.y / 2, 0);
        controls.update();

        // Adjust ground grid
        gridHelper.position.y = 0;
        gridHelper.scale.set(maxDim * 0.8 || 1, 1, maxDim * 0.8 || 1);

        // Calculate Mesh Stats
        let vertexCount = 0;
        let triangleCount = 0;
        let meshCount = 0;

        loadedObject.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            meshCount++;
            const geom = mesh.geometry;
            if (geom) {
              if (geom.attributes.position) {
                vertexCount += geom.attributes.position.count;
              }
              if (geom.index) {
                triangleCount += geom.index.count / 3;
              } else if (geom.attributes.position) {
                triangleCount += geom.attributes.position.count / 3;
              }
            }
          }
        });

        const initialUnit: MeasurementUnit = maxDim >= 25 && maxDim < 500 ? 'cm' : maxDim >= 500 ? 'mm' : 'm';
        setMeasurementUnit(initialUnit);

        setStats({
          vertices: Math.round(vertexCount),
          triangles: Math.round(triangleCount),
          meshes: meshCount,
          dimensions: {
            x: parseFloat(size.x.toFixed(2)),
            y: parseFloat(size.y.toFixed(2)),
            z: parseFloat(size.z.toFixed(2)),
          },
        });

        // Setup Animations if available
        if (clips.length > 0) {
          setAnimationClips(clips);
          const mixer = new THREE.AnimationMixer(loadedObject);
          mixerRef.current = mixer;
          const action = mixer.clipAction(clips[0]);
          action.play();
        }

        // Ensure the animated loading screen is smoothly visible for at least ~350ms
        // so every format provides consistent visual feedback
        const elapsed = Date.now() - startTime;
        if (elapsed < 350) {
          await new Promise((r) => setTimeout(r, 350 - elapsed));
        }

        if (isDisposed) return;
        setIsLoading(false);
      } catch (err: any) {
        if (!isDisposed) {
          setError(err.message || 'Failed to render 3D model');
          setIsLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      if (humanoidGuideRef.current) {
        scene.remove(humanoidGuideRef.current);
        humanoidGuideRef.current = null;
      }
      if (boundingGuideRef.current) {
        scene.remove(boundingGuideRef.current);
        boundingGuideRef.current = null;
      }

      // Deeply dispose all geometries, materials, textures and force WebGL context release
      disposeThreeScene(scene, rendererRef.current, controlsRef.current);
      sceneRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      currentModelRef.current = null;
      mixerRef.current = null;
    };
  }, [asset, loadVersion]);

  // Update Turntable
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isTurntable;
    }
  }, [isTurntable]);

  // Milestone 3: Dynamic Lighting Preset
  useEffect(() => {
    if (sceneRef.current) {
      applyLightingPreset(sceneRef.current, lightingPreset);
    }
  }, [lightingPreset]);

  // Milestone 3: Dynamic Background Theme
  useEffect(() => {
    if (sceneRef.current && rendererRef.current) {
      applyBackgroundTheme(sceneRef.current, rendererRef.current, backgroundTheme);
    }
  }, [backgroundTheme]);

  // Milestone 3: Ground Grid Toggle
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Milestone 3: 1.8m Humanoid Scale Toggle
  useEffect(() => {
    if (!sceneRef.current) return;
    if (humanoidGuideRef.current) {
      sceneRef.current.remove(humanoidGuideRef.current);
      humanoidGuideRef.current = null;
    }
    if (showHumanoidScale && currentModelRef.current) {
      const box = new THREE.Box3().setFromObject(currentModelRef.current);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.1);
      const guide = createHumanoidSilhouette(measurementUnit);
      const separation = Math.max(maxDim * 0.08, 0.5);
      guide.position.set(box.max.x + separation, 0, 0);
      humanoidGuideRef.current = guide;
      sceneRef.current.add(guide);
    }
  }, [showHumanoidScale, measurementUnit]);

  // Milestone 3: Bounding Box & Dimensions Toggle
  useEffect(() => {
    if (!sceneRef.current) return;
    if (boundingGuideRef.current) {
      sceneRef.current.remove(boundingGuideRef.current);
      boundingGuideRef.current = null;
    }
    if (showBoundingBox && currentModelRef.current) {
      const guide = createBoundingBoxGuide(currentModelRef.current, measurementUnit);
      boundingGuideRef.current = guide;
      sceneRef.current.add(guide);
    }
  }, [showBoundingBox, measurementUnit]);

  // Update Shading Mode
  useEffect(() => {
    if (!currentModelRef.current) return;

    currentModelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.userData.originalMaterial) {
          mesh.userData.originalMaterial = mesh.material;
        }

        if (shadingMode === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({
            wireframe: true,
            color: 0x6366f1,
          });
        } else if (shadingMode === 'clay') {
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.5,
            metalness: 0.05,
          });
        } else if (shadingMode === 'normals') {
          mesh.material = new THREE.MeshNormalMaterial();
        } else {
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  }, [shadingMode]);

  // Update Animation Clip
  const handleClipChange = (index: number) => {
    setActiveClipIndex(index);
    if (mixerRef.current && animationClips[index]) {
      mixerRef.current.stopAllAction();
      const action = mixerRef.current.clipAction(animationClips[index]);
      action.play();
    }
  };

  // Capture Snapshot as Thumbnail
  const handleCaptureSnapshot = async () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/jpeg', 0.92);
      const newUrl = await window.electronAPI.saveCustomThumbnail(asset.id, dataUrl);
      onThumbnailUpdated(asset.id, newUrl);
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    }
  };

  const badgeStyle = getFormatBadgeStyle(asset.format);

  return (
    <div className="viewer-modal">
      {/* Viewport Top Header */}
      <div className="viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
              {asset.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
              {formatBytes(asset.sizeBytes)} • {asset.path}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className={`btn ${depStatus && depStatus.missing > 0 ? 'btn-danger-outline' : 'btn-secondary'}`}
            onClick={() => setIsTextureInspectorOpen(true)}
            title="Inspect textures and material maps"
          >
            <Layers size={14} color={depStatus && depStatus.missing > 0 ? '#ef4444' : 'currentColor'} />
            <span>Textures</span>
            {depStatus && depStatus.total > 0 && (
              <span
                style={{
                  backgroundColor: depStatus.missing > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: depStatus.missing > 0 ? '#ef4444' : '#10b981',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  marginLeft: '2px',
                }}
              >
                {depStatus.missing > 0 ? `${depStatus.missing} Missing` : `${depStatus.found} Linked`}
              </span>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleCaptureSnapshot}
            title="Set current camera view as thumbnail"
          >
            <Camera size={14} />
            <span>Set Thumbnail</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => onOpenInDefaultApp(asset.path)}
            title="Open in Blender or default 3D DCC"
          >
            <ExternalLink size={14} />
            <span>Open in App</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => onRevealInFolder(asset.path)}
            title="Reveal file in Windows Explorer"
          >
            <FolderOpen size={14} />
            <span>Reveal</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setIsCompareOpen(true)}
            title="Side-by-side comparative inspection with synchronized cameras"
          >
            <Columns2 size={14} />
            <span>Compare</span>
          </button>

          <button className="btn btn-ghost" onClick={onClose} title="Close Viewport (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tags & Collections Subheader Bar */}
      <div className="viewer-tags-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Tag size={13} color="var(--text-subtle)" />
          {asset.tags.map((tag) => (
            <span key={tag} className="tag-pill active" style={{ fontSize: '11px' }}>
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                title="Remove tag"
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <form onSubmit={handleAddTag} style={{ display: 'inline-flex' }}>
            <input
              type="text"
              placeholder="+ Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="search-input"
              style={{ height: '24px', fontSize: '11px', padding: '0 8px', width: '100px' }}
            />
          </form>
        </div>

        {/* Collections Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 10px', fontSize: '11.5px' }}
            onClick={() => setIsCollectionsMenuOpen(!isCollectionsMenuOpen)}
          >
            <Folder size={13} />
            <span>Collections ({asset.collections?.length || 0})</span>
          </button>

          {isCollectionsMenuOpen && (
            <div className="collections-dropdown-menu">
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-subtle)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ASSIGN TO COLLECTIONS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {collections.map((col) => {
                  const isIn = asset.collections?.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      className={`dropdown-item ${isIn ? 'active' : ''}`}
                      onClick={() => handleToggleCollection(col.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={13} color={col.color || '#6366f1'} />
                        <span>{col.name}</span>
                      </div>
                      {isIn && <Check size={13} color="var(--accent-primary)" />}
                    </button>
                  );
                })}
                {collections.length === 0 && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', padding: '6px 4px' }}>
                    Create collections in the sidebar first.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Viewport Canvas Body */}
      <div className="viewer-body">
        <div ref={containerRef} className="three-canvas-container" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="viewer-loading-overlay">
            <div className="spinner-dual-ring">
              <div className="spinner"></div>
              <div className="spinner-inner"></div>
            </div>
            <div className="loading-status-text">{loadingMessage}</div>
            <div className="loading-progress-track">
              <div className="loading-progress-bar"></div>
            </div>
            <div className="loading-status-sub">
              {asset.name} &bull; {asset.format.toUpperCase()}
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="viewer-loading-overlay">
            <div style={{ color: 'var(--accent-danger)', fontWeight: 700, fontSize: '16px' }}>
              Failed to Display 3D Preview
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', textAlign: 'center' }}>
              {error}
            </div>
            <button className="btn btn-primary" onClick={() => onOpenInDefaultApp(asset.path)} style={{ marginTop: '10px' }}>
              <ExternalLink size={14} />
              <span>Open in Desktop Application Instead</span>
            </button>
          </div>
        )}

        {/* HUD Info Box */}
        {!isLoading && !error && (
          <div className="viewer-hud-info">
            <div className="hud-stat-line">
              <span>Triangles:</span>
              <span className="hud-stat-val">{formatNumber(stats.triangles)}</span>
            </div>
            <div className="hud-stat-line">
              <span>Vertices:</span>
              <span className="hud-stat-val">{formatNumber(stats.vertices)}</span>
            </div>
            <div className="hud-stat-line">
              <span>Meshes:</span>
              <span className="hud-stat-val">{stats.meshes}</span>
            </div>
            <div className="hud-stat-line">
              <span>Dimensions:</span>
              <span className="hud-stat-val">
                {stats.dimensions.x} × {stats.dimensions.y} × {stats.dimensions.z} {measurementUnit}
              </span>
            </div>
          </div>
        )}

        {/* Floating Viewport Controls */}
        {!isLoading && !error && (
          <div className="viewer-controls-bar">
            {/* Shading mode selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {(['textured', 'wireframe', 'clay', 'normals'] as ShadingMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`btn ${shadingMode === mode ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '5px 10px', fontSize: '11.5px', textTransform: 'capitalize' }}
                  onClick={() => setShadingMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

            {/* Turntable auto-rotate toggle */}
            <button
              className={`btn ${isTurntable ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px', fontSize: '11.5px' }}
              onClick={() => setIsTurntable(!isTurntable)}
              title="Auto-rotate model turntable"
            >
              <RotateCw size={14} />
              <span>Turntable</span>
            </button>

            <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

            {/* Lighting Preset selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sun size={13} color="var(--text-subtle)" />
              <select
                className="gallery-sort-select"
                value={lightingPreset}
                onChange={(e) => setLightingPreset(e.target.value as LightingPreset)}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                title="Viewport Lighting Setup"
              >
                <option value="studio">Studio Neutral</option>
                <option value="cyberpunk">Cyberpunk Neon</option>
                <option value="sunset">Sunset Golden Hour</option>
                <option value="daylight">Outdoor Daylight</option>
              </select>
            </div>

            {/* Background Theme selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Palette size={13} color="var(--text-subtle)" />
              <select
                className="gallery-sort-select"
                value={backgroundTheme}
                onChange={(e) => setBackgroundTheme(e.target.value as BackgroundTheme)}
                style={{ fontSize: '11px', padding: '4px 8px' }}
                title="Background & Backdrop Color"
              >
                <option value="dark">Dark Slate</option>
                <option value="neutral">18% Neutral Gray</option>
                <option value="white">Pure White</option>
                <option value="black">OLED Black</option>
              </select>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

            {/* Ground Grid toggle */}
            <button
              className={`btn ${showGrid ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px', fontSize: '11.5px' }}
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Ground Plane Grid"
            >
              <Grid size={14} />
              <span>Grid</span>
            </button>

            {/* 1.8m Humanoid Silhouette toggle */}
            <button
              className={`btn ${showHumanoidScale ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px', fontSize: '11.5px' }}
              onClick={() => setShowHumanoidScale(!showHumanoidScale)}
              title="Toggle 1.80m Human Scale Reference Silhouette"
            >
              <User size={14} />
              <span>1.8m Human</span>
            </button>

            {/* Bounding Box / Metric Dimensions toggle */}
            <button
              className={`btn ${showBoundingBox ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px', fontSize: '11.5px' }}
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              title="Toggle Metric Bounding Box & Dimension Guides"
            >
              <Ruler size={14} />
              <span>Dimensions</span>
            </button>

            {/* Unit Picker (active for Dimensions and Human Scale) */}
            {(showBoundingBox || showHumanoidScale) && (
              <select
                className="gallery-sort-select"
                value={measurementUnit}
                onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
                style={{ fontSize: '11px', padding: '4px 6px', width: '56px' }}
                title="Measurement Units (m, cm, mm, ft)"
              >
                <option value="m">m</option>
                <option value="cm">cm</option>
                <option value="mm">mm</option>
                <option value="ft">ft</option>
              </select>
            )}

            {/* Animation Player if model has animation tracks */}
            {animationClips.length > 0 && (
              <>
                <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px' }}
                  onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
                  title={isPlayingAnimation ? 'Pause Animation' : 'Play Animation'}
                >
                  {isPlayingAnimation ? <Pause size={14} /> : <Play size={14} />}
                </button>

                {animationClips.length > 1 && (
                  <select
                    className="gallery-sort-select"
                    value={activeClipIndex}
                    onChange={(e) => handleClipChange(parseInt(e.target.value))}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    {animationClips.map((clip, idx) => (
                      <option key={idx} value={idx}>
                        Clip {idx + 1}: {clip.name || `Animation ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Milestone 2: Texture & Material Dependency Inspector Drawer */}
      <TextureInspector
        modelPath={asset.path}
        modelName={asset.name}
        format={asset.format}
        isOpen={isTextureInspectorOpen}
        onClose={() => setIsTextureInspectorOpen(false)}
        onRelinkSuccess={() => setLoadVersion((v) => v + 1)}
        onRevealInFolder={onRevealInFolder}
        onOpenInDefaultApp={onOpenInDefaultApp}
      />

      {/* Milestone 3: Split-Screen Model Comparator Modal */}
      {isCompareOpen && (
        <ModelComparator
          primaryAsset={asset}
          allAssets={allAssets}
          onClose={() => setIsCompareOpen(false)}
          onRevealInFolder={onRevealInFolder}
          onOpenInDefaultApp={onOpenInDefaultApp}
        />
      )}
    </div>
  );
};
