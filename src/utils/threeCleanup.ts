import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Deeply disposes a Three.js scene, materials, geometries, textures, and renderer
 * to prevent GPU/VRAM memory leaks and WebGL context accumulation lag in Electron.
 */
export function disposeThreeScene(
  scene: THREE.Scene | null,
  renderer: THREE.WebGLRenderer | null,
  controls?: OrbitControls | null
) {
  // 1. Dispose controls and detach DOM listeners
  if (controls) {
    try {
      controls.dispose();
    } catch (e) {
      console.warn('[disposeThreeScene] Controls disposal error:', e);
    }
  }

  // 2. Traverse scene and release all GPU buffers, geometries, materials, and textures
  if (scene) {
    scene.traverse((object: any) => {
      if (!object) return;

      // Geometries
      if (object.geometry) {
        try {
          object.geometry.dispose();
        } catch {}
      }

      // Materials & Textures
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of materials) {
          if (!mat) continue;

          // Dispose any textures attached to material properties (map, normalMap, roughnessMap, etc.)
          for (const key of Object.keys(mat)) {
            const prop = mat[key];
            if (prop && typeof prop === 'object' && prop.isTexture && typeof prop.dispose === 'function') {
              try {
                prop.dispose();
              } catch {}
            }
          }

          try {
            mat.dispose();
          } catch {}
        }
      }
    });

    try {
      scene.clear();
    } catch {}
  }

  // 3. Force WebGL context release and detach canvas
  if (renderer) {
    try {
      const dom = renderer.domElement;
      if (dom && dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
      renderer.dispose();

      // Defer context loss slightly so Chromium's compositor finishes current paint
      setTimeout(() => {
        try {
          renderer.forceContextLoss();
        } catch {}
      }, 50);
    } catch (e) {
      console.warn('[disposeThreeScene] Renderer disposal error:', e);
    }
  }
}
