# Model Vault 3D — Asset Studio & Viewport

A high-performance Windows desktop application built with **Electron**, **React**, **Vite**, **TypeScript**, and **Three.js** to scan hard drives, catalog 3D model assets, and display them with instant thumbnails and interactive 3D viewports.

---

## Features

- 🔍 **Disk & Drive Scanner**:
  - Automatically enumerates Windows drives (`C:\`, `D:\`, etc.) and allows selecting custom folder roots.
  - Multi-threaded recursive scanning with smart ignore filters (`$Recycle.Bin`, `node_modules`, `AppData`, `.git`).
  - Real-time progress bar streaming discovered models and traversed directories.
- 🎨 **Blender (.blend) Pipeline**:
  - **Instant Binary Thumbnail Extractor**: Direct binary parser reads embedded thumbnail blocks (`REND`/`TEST`) from `.blend` headers in ~3ms without opening Blender.
  - **Automated 3D Conversion**: Auto-detects local **Blender 5.2** (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`) and headlessly exports `.blend` models to `.glb` on-demand for full interactive 3D inspection.
- 🎮 **Interactive Three.js 3D Viewport**:
  - Multi-format support: `.blend`, `.fbx`, `.glb`, `.gltf`, `.obj`, `.stl`.
  - Orbit, pan, zoom, auto-rotation turntable mode, and auto-framing bounding box.
  - Shading inspection modes: **Textured PBR**, **Wireframe**, **Clay / MatCap**, and **Normals**.
  - Animation player with clip selection and play/pause for rigged FBX & glTF models.
  - Real-time mesh HUD: Triangle count, vertex count, mesh count, and bounding dimensions.
  - **Camera Snapshot**: Capture any custom angle as the model's new thumbnail card!
- 📂 **Studio Asset Browser**:
  - Dark studio aesthetic inspired by modern 3D DCC tools.
  - Dynamic grid density slider (Small, Medium, Large, Cinema).
  - Search by model name, folder path, or file extension.
  - Format filter chips with distinct brand color coding.
  - Native OS integration: **Reveal in Windows Explorer** and **Open in Blender / Default 3D App**.

---

## How to Run

1. Open a terminal in this directory:
   ```powershell
   cd C:\Users\DillanL\.gemini\antigravity-ide\scratch\model-vault-3d
   ```

2. Run in development mode with hot reload:
   ```powershell
   npm run dev
   ```

3. Or run the production build:
   ```powershell
   npm run build
   npx electron .
   ```

---

## Supported Formats

| Format | Thumbnail Engine | 3D Viewport Engine |
| :--- | :--- | :--- |
| **`.blend`** | Binary header extractor / Blender CLI | Automated headless glTF export via Blender 5.2 |
| **`.glb` / `.gltf`** | Instant WebGL snapshot | Three.js `GLTFLoader` with Draco mesh compression |
| **`.fbx`** | Instant WebGL snapshot | Three.js `FBXLoader` (meshes, bones, animations) |
| **`.obj`** | Instant WebGL snapshot | Three.js `OBJLoader` |
| **`.stl`** | Instant WebGL snapshot | Three.js `STLLoader` with auto-calculated normals |
