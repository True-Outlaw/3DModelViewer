import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import {
  X,
  RotateCw,
  Box,
  Columns2,
  ChevronDown,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';
import type { ModelAsset } from '../types';
import { formatBytes, formatNumber, getFormatBadgeStyle } from '../utils/formatters';
import { disposeThreeScene } from '../utils/threeCleanup';

interface ModelComparatorProps {
  primaryAsset: ModelAsset;
  allAssets: ModelAsset[];
  onClose: () => void;
  onRevealInFolder: (path: string) => void;
  onOpenInDefaultApp: (path: string) => void;
}

type ShadingMode = 'textured' | 'wireframe' | 'clay' | 'normals';

export const ModelComparator: React.FC<ModelComparatorProps> = ({
  primaryAsset,
  allAssets,
  onClose,
  onRevealInFolder,
  onOpenInDefaultApp,
}) => {
  // Model selections
  const [assetA, setAssetA] = useState<ModelAsset>(primaryAsset);
  const [assetB, setAssetB] = useState<ModelAsset>(() => {
    return allAssets.find((a) => a.id !== primaryAsset.id) || primaryAsset;
  });

  // Viewport states
  const [shadingA, setShadingA] = useState<ShadingMode>('textured');
  const [shadingB, setShadingB] = useState<ShadingMode>(
    assetA.id === assetB.id ? 'wireframe' : 'textured'
  );
  const [isTurntable, setIsTurntable] = useState(true);

  // Stats
  const [statsA, setStatsA] = useState({ vertices: 0, triangles: 0, size: { x: 0, y: 0, z: 0 } });
  const [statsB, setStatsB] = useState({ vertices: 0, triangles: 0, size: { x: 0, y: 0, z: 0 } });

  // Loading & Error states
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  // DOM Canvas Containers
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);

  // Three.js instances
  const sceneARef = useRef<THREE.Scene | null>(null);
  const sceneBRef = useRef<THREE.Scene | null>(null);
  const cameraARef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraBRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsARef = useRef<OrbitControls | null>(null);
  const controlsBRef = useRef<OrbitControls | null>(null);
  const modelARef = useRef<THREE.Object3D | null>(null);
  const modelBRef = useRef<THREE.Object3D | null>(null);

  // Mutual recursion & interaction locks
  const isSyncingRef = useRef(false);
  const activeControlRef = useRef<'A' | 'B' | null>(null);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Shared Helper: Load and parse model
  const loadModelObject = async (
    asset: ModelAsset
  ): Promise<{ object: THREE.Object3D; tris: number; verts: number; dims: THREE.Vector3 }> => {
    let targetPath = asset.path;
    let format = asset.format;

    if (asset.format === 'blend') {
      const res = await window.electronAPI.exportBlendToGlb(asset.path);
      if (!res.success || !res.glbPath) {
        throw new Error(res.error || 'Blender export failed. Ensure Blender is installed.');
      }
      targetPath = res.glbPath;
      format = 'glb';
    }

    const normalizedTarget = targetPath.replace(/\\/g, '/');
    const lastSlash = normalizedTarget.lastIndexOf('/');
    const dirPath = lastSlash !== -1 ? normalizedTarget.substring(0, lastSlash + 1) : '';
    const baseResourceUrl = `vault-asset://app/${dirPath}`;

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
      console.warn('[ComparatorLoader] Non-fatal missing dependency:', itemUrl);
    };

    const buffer = await window.electronAPI.readModelBuffer(targetPath);
    let loadedObject: THREE.Object3D;

    if (format === 'glb' || format === 'gltf' || format === 'blend') {
      const gltfLoader = new GLTFLoader(loadingManager);
      const gltf = await new Promise<any>((resolve, reject) => {
        gltfLoader.parse(buffer, baseResourceUrl, resolve, reject);
      });
      loadedObject = gltf.scene;
    } else if (format === 'fbx') {
      const fbxLoader = new FBXLoader(loadingManager);
      fbxLoader.setResourcePath(baseResourceUrl);
      loadedObject = fbxLoader.parse(buffer, baseResourceUrl);
    } else if (format === 'obj') {
      const objLoader = new OBJLoader(loadingManager);
      objLoader.setPath(baseResourceUrl);
      objLoader.setResourcePath(baseResourceUrl);
      const text = new TextDecoder('utf-8').decode(buffer);
      try {
        const report = await window.electronAPI.inspectDependencies(targetPath);
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
      } catch {
        // Non-fatal material load
      }
      loadedObject = objLoader.parse(text);
    } else if (format === 'stl') {
      const stlLoader = new STLLoader(loadingManager);
      const geom = stlLoader.parse(buffer);
      geom.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        roughness: 0.35,
        metalness: 0.1,
      });
      loadedObject = new THREE.Mesh(geom, mat);
    } else {
      throw new Error(`Unsupported 3D format: ${format}`);
    }

    // Auto-center on ground plane
    const box = new THREE.Box3().setFromObject(loadedObject);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    loadedObject.position.x -= center.x;
    loadedObject.position.y -= box.min.y;
    loadedObject.position.z -= center.z;

    // Compute triangle and vertex statistics
    let tris = 0;
    let verts = 0;
    loadedObject.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const mesh = c as THREE.Mesh;
        const geom = mesh.geometry;
        if (geom) {
          if (geom.index) {
            tris += geom.index.count / 3;
          } else if (geom.attributes.position) {
            tris += geom.attributes.position.count / 3;
          }
          if (geom.attributes.position) {
            verts += geom.attributes.position.count;
          }
        }
      }
    });

    return { object: loadedObject, tris: Math.round(tris), verts, dims: size };
  };

  // Helper to frame camera around an object
  const frameCamera = (
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    object: THREE.Object3D
  ) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.2);

    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.7;
    cameraZ = Math.max(cameraZ, 2.2);

    camera.position.set(cameraZ * 0.75, cameraZ * 0.65, cameraZ);
    camera.lookAt(0, size.y / 2, 0);
    controls.target.set(0, size.y / 2, 0);
    controls.update();
  };

  // Sync camera helper: copies relative angle, distance, and zoom without recursion
  const syncCameras = (
    sourceCam: THREE.PerspectiveCamera,
    targetCam: THREE.PerspectiveCamera,
    sourceCtrl: OrbitControls,
    targetCtrl: OrbitControls
  ) => {
    const offset = new THREE.Vector3().subVectors(sourceCam.position, sourceCtrl.target);
    targetCam.position.copy(targetCtrl.target).add(offset);
    targetCam.quaternion.copy(sourceCam.quaternion);
    targetCam.zoom = sourceCam.zoom;
    targetCam.updateProjectionMatrix();

    targetCtrl.update();
  };

  // Setup Viewport A
  useEffect(() => {
    if (!containerARef.current) return;
    let disposed = false;
    const container = containerARef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c13);
    sceneARef.current = scene;

    const initialW = Math.max(container.clientWidth, 100);
    const initialH = Math.max(container.clientHeight, 100);
    const camera = new THREE.PerspectiveCamera(45, initialW / initialH, 0.05, 5000);
    camera.position.set(2, 2, 3);
    cameraARef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(initialW, initialH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Turntable runs from controls A and syncs camera B
    controls.autoRotate = isTurntable;
    controls.autoRotateSpeed = 2.0;
    controlsARef.current = controls;

    // Track active user interaction
    controls.addEventListener('start', () => {
      activeControlRef.current = 'A';
    });
    controls.addEventListener('end', () => {
      activeControlRef.current = null;
    });

    // Sync camera A -> camera B safely
    controls.addEventListener('change', () => {
      if (isSyncingRef.current) return;
      if (!cameraBRef.current || !controlsBRef.current) return;
      if (activeControlRef.current === 'B') return;

      isSyncingRef.current = true;
      try {
        syncCameras(camera, cameraBRef.current, controls, controlsBRef.current);
      } finally {
        isSyncingRef.current = false;
      }
    });

    // Lighting & Grid
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(5, 10, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x818cf8, 0.9);
    fill.position.set(-5, 4, -5);
    scene.add(fill);

    const grid = new THREE.GridHelper(20, 40, 0x374151, 0x1f2937);
    scene.add(grid);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver ensures canvas always fills viewport accurately
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    ro.observe(container);

    // Load Model A
    setLoadingA(true);
    setErrorA(null);
    loadModelObject(assetA)
      .then((res) => {
        if (disposed) return;
        modelARef.current = res.object;
        scene.add(res.object);
        setStatsA({
          vertices: res.verts,
          triangles: res.tris,
          size: {
            x: parseFloat(res.dims.x.toFixed(2)),
            y: parseFloat(res.dims.y.toFixed(2)),
            z: parseFloat(res.dims.z.toFixed(2)),
          },
        });
        frameCamera(camera, controls, res.object);
        setLoadingA(false);
      })
      .catch((err) => {
        if (disposed) return;
        console.error('Error loading Model A in comparator:', err);
        setErrorA(err?.message || 'Failed to parse 3D model.');
        setLoadingA(false);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
      disposeThreeScene(scene, renderer, controls);
      sceneARef.current = null;
      cameraARef.current = null;
      controlsARef.current = null;
      modelARef.current = null;
    };
  }, [assetA]);

  // Setup Viewport B
  useEffect(() => {
    if (!containerBRef.current) return;
    let disposed = false;
    const container = containerBRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c13);
    sceneBRef.current = scene;

    const initialW = Math.max(container.clientWidth, 100);
    const initialH = Math.max(container.clientHeight, 100);
    const camera = new THREE.PerspectiveCamera(45, initialW / initialH, 0.05, 5000);
    camera.position.set(2, 2, 3);
    cameraBRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(initialW, initialH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Follower viewport does not autoRotate independently (driven by A's sync)
    controls.autoRotate = false;
    controlsBRef.current = controls;

    // Track active user interaction
    controls.addEventListener('start', () => {
      activeControlRef.current = 'B';
    });
    controls.addEventListener('end', () => {
      activeControlRef.current = null;
    });

    // Sync camera B -> camera A safely
    controls.addEventListener('change', () => {
      if (isSyncingRef.current) return;
      if (!cameraARef.current || !controlsARef.current) return;
      if (activeControlRef.current === 'A') return;

      isSyncingRef.current = true;
      try {
        syncCameras(camera, cameraARef.current, controls, controlsARef.current);
      } finally {
        isSyncingRef.current = false;
      }
    });

    // Lighting & Grid
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(5, 10, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x818cf8, 0.9);
    fill.position.set(-5, 4, -5);
    scene.add(fill);

    const grid = new THREE.GridHelper(20, 40, 0x374151, 0x1f2937);
    scene.add(grid);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver ensures canvas always fills viewport accurately
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    ro.observe(container);

    // Load Model B
    setLoadingB(true);
    setErrorB(null);
    loadModelObject(assetB)
      .then((res) => {
        if (disposed) return;
        modelBRef.current = res.object;
        scene.add(res.object);
        setStatsB({
          vertices: res.verts,
          triangles: res.tris,
          size: {
            x: parseFloat(res.dims.x.toFixed(2)),
            y: parseFloat(res.dims.y.toFixed(2)),
            z: parseFloat(res.dims.z.toFixed(2)),
          },
        });
        frameCamera(camera, controls, res.object);
        setLoadingB(false);
      })
      .catch((err) => {
        if (disposed) return;
        console.error('Error loading Model B in comparator:', err);
        setErrorB(err?.message || 'Failed to parse 3D model.');
        setLoadingB(false);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      ro.disconnect();
      disposeThreeScene(scene, renderer, controls);
      sceneBRef.current = null;
      cameraBRef.current = null;
      controlsBRef.current = null;
      modelBRef.current = null;
    };
  }, [assetB]);

  // Apply Shading A
  useEffect(() => {
    if (!modelARef.current) return;
    modelARef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.userData.originalMaterial) mesh.userData.originalMaterial = mesh.material;
        if (shadingA === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x6366f1 });
        } else if (shadingA === 'clay') {
          mesh.material = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
        } else if (shadingA === 'normals') {
          mesh.material = new THREE.MeshNormalMaterial();
        } else {
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  }, [shadingA, loadingA]);

  // Apply Shading B
  useEffect(() => {
    if (!modelBRef.current) return;
    modelBRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.userData.originalMaterial) mesh.userData.originalMaterial = mesh.material;
        if (shadingB === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x38bdf8 });
        } else if (shadingB === 'clay') {
          mesh.material = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
        } else if (shadingB === 'normals') {
          mesh.material = new THREE.MeshNormalMaterial();
        } else {
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  }, [shadingB, loadingB]);

  // Turntable sync toggle
  useEffect(() => {
    if (controlsARef.current) {
      controlsARef.current.autoRotate = isTurntable;
    }
  }, [isTurntable]);

  // Compute Delta between Triangles
  const triDeltaPercent =
    statsA.triangles > 0 && statsB.triangles > 0
      ? (((statsB.triangles - statsA.triangles) / statsA.triangles) * 100).toFixed(1)
      : null;

  return (
    <div className="viewer-modal comparator-modal">
      {/* Top Comparator Bar */}
      <div className="viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge-compare-pill">
            <Columns2 size={15} />
            <span>Split-Screen Comparator</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
            Synchronized orbit, zoom, and technical mesh inspection
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className={`btn ${isTurntable ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsTurntable(!isTurntable)}
            title="Toggle Synchronized Turntable Rotation"
          >
            <RotateCw size={14} />
            <span>Sync Turntable</span>
          </button>

          <button className="btn btn-ghost" onClick={onClose} title="Exit Comparator (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Split-Screen Canvas Body */}
      <div className="comparator-split-body">
        {/* Left Viewport (A) */}
        <div className="comparator-half left-half">
          {/* Top Panel Controls */}
          <div className="comparator-panel-header">
            {/* Model A Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <select
                className="gallery-sort-select comparator-select"
                value={assetA.id}
                onChange={(e) => {
                  const found = allAssets.find((a) => a.id === e.target.value);
                  if (found) setAssetA(found);
                }}
              >
                {allAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (.{a.format})
                  </option>
                ))}
              </select>
            </div>

            {/* Shading mode selector */}
            <div className="comparator-shading-group">
              {(['textured', 'wireframe', 'clay', 'normals'] as ShadingMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`btn ${shadingA === mode ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '3px 7px', fontSize: '11px', textTransform: 'capitalize' }}
                  onClick={() => setShadingA(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div ref={containerARef} className="comparator-canvas-wrapper" />

          {/* Loading overlay */}
          {loadingA && !errorA && (
            <div className="viewer-loading-overlay">
              <div className="spinner-dual-ring">
                <div className="spinner"></div>
                <div className="spinner-inner"></div>
              </div>
              <div className="loading-status-text">Loading Model A...</div>
              <div className="loading-progress-track">
                <div className="loading-progress-bar"></div>
              </div>
              <div className="loading-status-sub">{assetA.name}</div>
            </div>
          )}

          {/* Error overlay */}
          {errorA && (
            <div className="viewer-loading-overlay" style={{ background: 'rgba(11, 13, 19, 0.95)' }}>
              <AlertTriangle size={36} color="#ef4444" />
              <div className="loading-status-text" style={{ color: '#ef4444', marginTop: '10px' }}>
                Failed to Load Model A
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-subtle)',
                  maxWidth: '320px',
                  textAlign: 'center',
                  marginTop: '6px',
                }}
              >
                {errorA}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setAssetA({ ...assetA })}
                style={{ marginTop: '12px' }}
              >
                Retry Load
              </button>
            </div>
          )}

          {/* Stats Box A */}
          {!loadingA && !errorA && (
            <div className="comparator-hud-card">
              <div className="hud-stat-line">
                <span>Triangles:</span>
                <strong className="hud-stat-val">{formatNumber(statsA.triangles)}</strong>
              </div>
              <div className="hud-stat-line">
                <span>Vertices:</span>
                <span className="hud-stat-val">{formatNumber(statsA.vertices)}</span>
              </div>
              <div className="hud-stat-line">
                <span>Dimensions:</span>
                <span className="hud-stat-val">
                  {statsA.size.x} × {statsA.size.y} × {statsA.size.z} m
                </span>
              </div>
              <div className="hud-stat-line">
                <span>File Size:</span>
                <span className="hud-stat-val">{formatBytes(assetA.sizeBytes)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Comparison Badge */}
        <div className="comparator-center-divider">
          <div className="comparator-vs-badge">
            <ArrowRightLeft size={14} />
            <span>VS</span>
          </div>
          {triDeltaPercent && !loadingA && !loadingB && !errorA && !errorB && (
            <div
              className={`comparator-delta-pill ${
                parseFloat(triDeltaPercent) < 0 ? 'reduced' : 'increased'
              }`}
            >
              {parseFloat(triDeltaPercent) > 0 ? `+${triDeltaPercent}%` : `${triDeltaPercent}%`} tris
            </div>
          )}
        </div>

        {/* Right Viewport (B) */}
        <div className="comparator-half right-half">
          {/* Top Panel Controls */}
          <div className="comparator-panel-header">
            {/* Model B Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <select
                className="gallery-sort-select comparator-select"
                value={assetB.id}
                onChange={(e) => {
                  const found = allAssets.find((a) => a.id === e.target.value);
                  if (found) setAssetB(found);
                }}
              >
                {allAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (.{a.format})
                  </option>
                ))}
              </select>
            </div>

            {/* Shading mode selector */}
            <div className="comparator-shading-group">
              {(['textured', 'wireframe', 'clay', 'normals'] as ShadingMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`btn ${shadingB === mode ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '3px 7px', fontSize: '11px', textTransform: 'capitalize' }}
                  onClick={() => setShadingB(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div ref={containerBRef} className="comparator-canvas-wrapper" />

          {/* Loading overlay */}
          {loadingB && !errorB && (
            <div className="viewer-loading-overlay">
              <div className="spinner-dual-ring">
                <div className="spinner"></div>
                <div className="spinner-inner"></div>
              </div>
              <div className="loading-status-text">Loading Model B...</div>
              <div className="loading-progress-track">
                <div className="loading-progress-bar"></div>
              </div>
              <div className="loading-status-sub">{assetB.name}</div>
            </div>
          )}

          {/* Error overlay */}
          {errorB && (
            <div className="viewer-loading-overlay" style={{ background: 'rgba(11, 13, 19, 0.95)' }}>
              <AlertTriangle size={36} color="#ef4444" />
              <div className="loading-status-text" style={{ color: '#ef4444', marginTop: '10px' }}>
                Failed to Load Model B
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-subtle)',
                  maxWidth: '320px',
                  textAlign: 'center',
                  marginTop: '6px',
                }}
              >
                {errorB}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setAssetB({ ...assetB })}
                style={{ marginTop: '12px' }}
              >
                Retry Load
              </button>
            </div>
          )}

          {/* Stats Box B */}
          {!loadingB && !errorB && (
            <div className="comparator-hud-card">
              <div className="hud-stat-line">
                <span>Triangles:</span>
                <strong className="hud-stat-val">{formatNumber(statsB.triangles)}</strong>
              </div>
              <div className="hud-stat-line">
                <span>Vertices:</span>
                <span className="hud-stat-val">{formatNumber(statsB.vertices)}</span>
              </div>
              <div className="hud-stat-line">
                <span>Dimensions:</span>
                <span className="hud-stat-val">
                  {statsB.size.x} × {statsB.size.y} × {statsB.size.z} m
                </span>
              </div>
              <div className="hud-stat-line">
                <span>File Size:</span>
                <span className="hud-stat-val">{formatBytes(assetB.sizeBytes)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ModelComparator;
