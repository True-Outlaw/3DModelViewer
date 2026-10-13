import * as THREE from 'three';

export type LightingPreset = 'studio' | 'cyberpunk' | 'sunset' | 'daylight';
export type BackgroundTheme = 'dark' | 'neutral' | 'white' | 'black';
export type MeasurementUnit = 'm' | 'cm' | 'mm' | 'ft';

/**
 * Configure lights in the Three.js scene based on the chosen lighting preset
 */
export function applyLightingPreset(scene: THREE.Scene, preset: LightingPreset) {
  // Remove existing dynamic lights (tagged with userData.isPresetLight)
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj.userData?.isPresetLight) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => scene.remove(obj));

  const lightGroup = new THREE.Group();
  lightGroup.userData.isPresetLight = true;

  switch (preset) {
    case 'studio': {
      // Clean, soft multi-angle lighting for neutral PBR material inspection
      const ambient = new THREE.AmbientLight(0xffffff, 0.85);
      lightGroup.add(ambient);

      // Key light
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
      keyLight.position.set(5, 10, 7);
      lightGroup.add(keyLight);

      // Fill light (cooler tone)
      const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.8);
      fillLight.position.set(-6, 5, -4);
      lightGroup.add(fillLight);

      // Soft ground bounce light
      const bounceLight = new THREE.DirectionalLight(0x94a3b8, 0.5);
      bounceLight.position.set(0, -5, 3);
      lightGroup.add(bounceLight);
      break;
    }

    case 'cyberpunk': {
      // Stylized high-contrast dual-tone neon key and rim lights
      const ambient = new THREE.AmbientLight(0x0f172a, 0.5);
      lightGroup.add(ambient);

      // Neon Cyan Key Light
      const cyanKey = new THREE.DirectionalLight(0x06b6d4, 2.6);
      cyanKey.position.set(6, 6, 6);
      lightGroup.add(cyanKey);

      // Neon Magenta Rim / Back Light
      const magentaRim = new THREE.DirectionalLight(0xec4899, 2.4);
      magentaRim.position.set(-6, 8, -6);
      lightGroup.add(magentaRim);

      // Violet Under-Glow
      const violetGlow = new THREE.DirectionalLight(0x8b5cf6, 1.4);
      violetGlow.position.set(0, -4, 2);
      lightGroup.add(violetGlow);
      break;
    }

    case 'sunset': {
      // Golden hour warm low-angle sun with sky blue fill
      const ambient = new THREE.AmbientLight(0x38bdf8, 0.6);
      lightGroup.add(ambient);

      // Warm Golden Sun
      const sunLight = new THREE.DirectionalLight(0xf97316, 3.0);
      sunLight.position.set(10, 4, 6);
      lightGroup.add(sunLight);

      // Violet / Dusk Fill
      const duskFill = new THREE.DirectionalLight(0xa855f7, 0.9);
      duskFill.position.set(-8, 6, -6);
      lightGroup.add(duskFill);
      break;
    }

    case 'daylight': {
      // High-noon outdoor sunlight with sky hemisphere
      const hemi = new THREE.HemisphereLight(0xbae6fd, 0x475569, 1.2);
      lightGroup.add(hemi);

      const sun = new THREE.DirectionalLight(0xfffbeb, 2.8);
      sun.position.set(4, 14, 5);
      lightGroup.add(sun);

      const bounce = new THREE.DirectionalLight(0x64748b, 0.6);
      bounce.position.set(-4, 2, -4);
      lightGroup.add(bounce);
      break;
    }
  }

  scene.add(lightGroup);
}

/**
 * Update scene background color and tone mapping exposure
 */
export function applyBackgroundTheme(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  theme: BackgroundTheme
) {
  switch (theme) {
    case 'dark':
      scene.background = new THREE.Color(0x0c0f17);
      renderer.toneMappingExposure = 1.0;
      break;
    case 'neutral':
      // 18% gray industry calibration standard
      scene.background = new THREE.Color(0x2d3748);
      renderer.toneMappingExposure = 1.05;
      break;
    case 'white':
      // High-key white for silhouette & catalog inspection
      scene.background = new THREE.Color(0xf1f5f9);
      renderer.toneMappingExposure = 0.95;
      break;
    case 'black':
      scene.background = new THREE.Color(0x000000);
      renderer.toneMappingExposure = 1.1;
      break;
  }
}

/**
 * Universal cross-browser rounded rectangle path helper
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Creates a high-contrast text label billboard sprite using HTML Canvas.
 * Always renders on top with depthTest: false and toneMapped: false so it is crisp & visible.
 */
export function createTextSprite(
  text: string,
  color = '#38bdf8',
  targetWorldHeight?: number
): THREE.Sprite {
  // Measure text dynamically using an offscreen canvas
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  const fontFamily = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  let textWidth = 280;
  if (tempCtx) {
    tempCtx.font = fontFamily;
    textWidth = tempCtx.measureText(text).width;
  }

  // Generous horizontal padding so text never touches or overflows the rounded pill boundary
  const horizontalPadding = 52;
  const canvasWidth = Math.max(Math.ceil(textWidth + horizontalPadding * 2), 260);
  const canvasHeight = 130;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Dark glass pill background perfectly fitted to text
    drawRoundedRect(ctx, 6, 6, canvasWidth - 12, canvasHeight - 12, 28);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.94)';
    ctx.fill();

    // Vibrant border outline
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Inner subtle glow accent
    drawRoundedRect(ctx, 13, 13, canvasWidth - 26, canvasHeight - 26, 21);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Crisp high-contrast centered text
    ctx.font = fontFamily;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,   // Never occluded by ground or model
    depthWrite: false,
    toneMapped: false,  // Preserves crisp bright colors
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.renderOrder = 999;

  const aspect = canvasWidth / canvasHeight;
  sprite.userData.aspect = aspect;

  if (targetWorldHeight !== undefined) {
    sprite.scale.set(targetWorldHeight * aspect, targetWorldHeight, 1);
  }

  return sprite;
}

/**
 * Calculate the human silhouette height for a given measurement unit
 */
export function getHumanHeightForUnit(unit: MeasurementUnit = 'm'): number {
  switch (unit) {
    case 'cm':
      return 180.0;
    case 'mm':
      return 1800.0;
    case 'ft':
      return 5.906;
    case 'm':
    default:
      return 1.80;
  }
}

/**
 * Procedural 1.80m Humanoid Silhouette Guide
 * Creates a clean, highly-visible holographic anatomical mannequin
 * with a ground target pedestal, height ruler line, and billboard scale badge.
 */
export function createHumanoidSilhouette(unit: MeasurementUnit = 'm'): THREE.Group {
  const group = new THREE.Group();
  group.userData.isHumanoidGuide = true;

  const height = getHumanHeightForUnit(unit);
  const scaleRatio = height / 1.80;

  // Luminous holographic cyan body material with double-sided rendering
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.65,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // Glowing white/cyan outline wireframe
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.95,
  });

  function addPart(geom: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geom, bodyMaterial);
    mesh.position.set(x * scaleRatio, y * scaleRatio, z * scaleRatio);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(geom, 25);
    const line = new THREE.LineSegments(edges, wireframeMaterial);
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    group.add(line);
  }

  // 1. Glowing Floor Target Pedestal at y = 0
  const ringGeom = new THREE.RingGeometry(0.24 * scaleRatio, 0.28 * scaleRatio, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.005 * scaleRatio;
  group.add(ringMesh);

  const innerDiscGeom = new THREE.CircleGeometry(0.24 * scaleRatio, 32);
  const innerDiscMat = new THREE.MeshBasicMaterial({ color: 0x0369a1, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
  const innerDisc = new THREE.Mesh(innerDiscGeom, innerDiscMat);
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = 0.002 * scaleRatio;
  group.add(innerDisc);

  // 2. Head & Visor
  addPart(new THREE.SphereGeometry(0.11 * scaleRatio, 18, 14), 0, 1.68, 0);
  // Front-facing eye visor
  addPart(new THREE.BoxGeometry(0.14 * scaleRatio, 0.04 * scaleRatio, 0.08 * scaleRatio), 0, 1.69, 0.07);

  // Neck
  addPart(new THREE.CylinderGeometry(0.045 * scaleRatio, 0.055 * scaleRatio, 0.09 * scaleRatio, 12), 0, 1.54, 0);

  // Upper Torso / Chest
  addPart(new THREE.BoxGeometry(0.38 * scaleRatio, 0.32 * scaleRatio, 0.20 * scaleRatio), 0, 1.34, 0);

  // Lower Torso / Abdomen
  addPart(new THREE.BoxGeometry(0.28 * scaleRatio, 0.20 * scaleRatio, 0.17 * scaleRatio), 0, 1.10, 0);

  // Pelvis / Hips
  addPart(new THREE.BoxGeometry(0.32 * scaleRatio, 0.18 * scaleRatio, 0.19 * scaleRatio), 0, 0.92, 0);

  // Left Arm (Shoulder, Arm, Forearm)
  addPart(new THREE.CylinderGeometry(0.045 * scaleRatio, 0.035 * scaleRatio, 0.58 * scaleRatio, 10), -0.25, 1.20, 0, 0, 0, 0.12);
  // Right Arm
  addPart(new THREE.CylinderGeometry(0.045 * scaleRatio, 0.035 * scaleRatio, 0.58 * scaleRatio, 10), 0.25, 1.20, 0, 0, 0, -0.12);

  // Left Leg
  addPart(new THREE.CylinderGeometry(0.065 * scaleRatio, 0.045 * scaleRatio, 0.82 * scaleRatio, 12), -0.10, 0.44, 0);
  // Right Leg
  addPart(new THREE.CylinderGeometry(0.065 * scaleRatio, 0.045 * scaleRatio, 0.82 * scaleRatio, 12), 0.10, 0.44, 0);

  // Left Foot
  addPart(new THREE.BoxGeometry(0.09 * scaleRatio, 0.06 * scaleRatio, 0.22 * scaleRatio), -0.10, 0.03, 0.04);
  // Right Foot
  addPart(new THREE.BoxGeometry(0.09 * scaleRatio, 0.06 * scaleRatio, 0.22 * scaleRatio), 0.10, 0.03, 0.04);

  // 3. Vertical Measurement Ruler along the side
  const rulerX = 0.36 * scaleRatio;
  const rulerPoints = [
    new THREE.Vector3(rulerX, 0, 0),
    new THREE.Vector3(rulerX, height, 0),
  ];
  // Ticks at 25%, 50%, 75%, and 100%
  [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
    const yVal = height * ratio;
    rulerPoints.push(new THREE.Vector3(rulerX - 0.04 * scaleRatio, yVal, 0));
    rulerPoints.push(new THREE.Vector3(rulerX + 0.06 * scaleRatio, yVal, 0));
  });

  const rulerGeom = new THREE.BufferGeometry().setFromPoints(rulerPoints);
  const rulerMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
  const rulerLine = new THREE.LineSegments(rulerGeom, rulerMat);
  group.add(rulerLine);

  // 4. Overhead Billboard Badge
  const unitLabel = unit === 'm' ? '1.80m Human' : `1.80m (${height.toFixed(0)} ${unit}) Human`;
  const badgeHeight = Math.max(0.12 * scaleRatio, 0.25);
  const labelSprite = createTextSprite(unitLabel, '#38bdf8', badgeHeight);
  labelSprite.position.set(0, height + badgeHeight * 1.8, 0);
  group.add(labelSprite);

  return group;
}

/**
 * Create a bounding box wireframe with prominent, always-visible metric dimension callouts
 */
export function createBoundingBoxGuide(
  model: THREE.Object3D,
  unit: MeasurementUnit = 'm'
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isBoundingBoxGuide = true;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.1);

  // Bounding box wireframe
  const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(boxGeom);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.75,
    depthTest: false,
  });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  wireframe.position.copy(center);
  wireframe.renderOrder = 998;
  group.add(wireframe);

  // 8 Corner Vertices (glowing corner dots)
  const cornerMat = new THREE.MeshBasicMaterial({ color: 0xa5b4fc, depthTest: false });
  const cornerGeom = new THREE.SphereGeometry(Math.max(maxDim * 0.012, 0.04), 8, 8);
  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];
  corners.forEach((c) => {
    const sphere = new THREE.Mesh(cornerGeom, cornerMat);
    sphere.position.copy(c);
    sphere.renderOrder = 998;
    group.add(sphere);
  });

  // Proportional badge height based on model size
  const badgeHeight = Math.max(maxDim * 0.055, 0.16);
  const margin = Math.max(maxDim * 0.06, 0.18);

  // Format dimensions based on unit
  const formatVal = (rawVal: number) => {
    switch (unit) {
      case 'cm':
        return `${rawVal.toFixed(1)} cm`;
      case 'mm':
        return `${rawVal.toFixed(0)} mm`;
      case 'ft':
        return `${(rawVal * 3.28084).toFixed(2)} ft`;
      case 'm':
      default:
        return `${rawVal.toFixed(2)} m`;
    }
  };

  // Width (X) label along bottom front edge
  const labelX = createTextSprite(`W: ${formatVal(size.x)}`, '#818cf8', badgeHeight);
  labelX.position.set(center.x, box.min.y + margin * 0.7, box.max.z + margin);
  group.add(labelX);

  // Height (Y) label along right vertical edge
  const labelY = createTextSprite(`H: ${formatVal(size.y)}`, '#34d399', badgeHeight);
  labelY.position.set(box.max.x + margin, center.y, box.max.z + margin);
  group.add(labelY);

  // Depth (Z) label along right bottom edge
  const labelZ = createTextSprite(`D: ${formatVal(size.z)}`, '#f59e0b', badgeHeight);
  labelZ.position.set(box.max.x + margin, box.min.y + margin * 0.7, center.z);
  group.add(labelZ);

  // Overall Top Summary Badge
  const summaryStr = `${formatVal(size.x)} × ${formatVal(size.y)} × ${formatVal(size.z)}`;
  const summaryBadgeHeight = badgeHeight * 1.05;
  const labelTop = createTextSprite(summaryStr, '#60a5fa', summaryBadgeHeight);
  labelTop.position.set(center.x, box.max.y + margin * 1.5, center.z);
  group.add(labelTop);

  return group;
}
