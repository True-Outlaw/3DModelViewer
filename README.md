# Model Vault 3D — Local-First 3D Asset Studio & Viewport

[![Electron](https://img.shields.io/badge/Electron-41.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.182-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Model Vault 3D** is a high-performance, local-first desktop application designed for 3D artists, game developers, and technical directors. It scans local and network drives, catalogs thousands of 3D assets, displays instant thumbnails, and provides an interactive Three.js 3D viewport with studio-grade inspection tools.

---

## ✨ Key Features

### 🚀 Native DCC Drag-and-Drop Export
- **Direct Drag to 3D Tools**: Drag model thumbnails or the grip handle directly from Model Vault 3D into:
  - **Blender**: 3D viewport or header (imports or opens the model immediately).
  - **Unreal Engine 5**: Content Browser (opens the asset import dialog).
  - **Unity**: Project Assets window (imports into the active folder).
  - **Windows Explorer / Desktop**: Copies or moves the physical file.
- Uses Windows `CF_HDROP` native drag-and-drop protocols with custom 3D model cursor icons.

### ⚡ High-Performance Storage Scanner
- **Multi-Drive Enumeration**: Automatically detects all available system drives (`C:\`, `D:\`, etc.) and supports custom folder selection.
- **Fast Recursive Scanning**: Traverses nested folder structures with smart ignore filters (`$Recycle.Bin`, `node_modules`, `AppData`, `.git`).
- **Real-Time Progress**: Live streaming of discovered assets, scanned directories, and thumbnail processing.
- **Embedded Blender Thumbnails**: Direct binary reader extracts embedded preview images (`REND` / `TEST` blocks) from `.blend` headers in ~2–5ms without launching Blender.

### 🎮 Interactive Three.js 3D Viewport
- **Multi-Format Support**: `.blend`, `.fbx`, `.glb`, `.gltf`, `.obj`, `.stl`.
- **Inspection Shading Modes**:
  - **Textured PBR**: Full material and texture rendering.
  - **Wireframe**: Topology and edge-flow inspection.
  - **Clay / MatCap**: Form, volume, and silhouette evaluation.
  - **Normals**: Surface orientation and vertex normal verification.
- **Animation Player**: Play, pause, scrub, and switch animation clips on rigged FBX and glTF meshes.
- **Real-Time Mesh Statistics**: Live triangle count, vertex count, mesh count, and dimensions.
- **Custom Angle Snapshots**: Capture custom camera angles as updated thumbnail cards.

### 📐 Viewport Pro Tools & Scale Comparator
- **1.8m Humanoid Scale Reference**: Toggleable standard human figure overlay for real-world scale reference.
- **HDRI Studio Lighting**: Switch between Studio, Neutral, Warm, and High-Contrast lighting environments.
- **Split-Screen Comparator**: Side-by-side inspection of two models with synchronized orbit controls, topology analysis, and delta metrics (polycount & dimension comparison).

### 🔍 Texture & Material Dependency Inspector
- **Automatic Reference Scanning**: Inspects external texture paths for `.obj` (via `.mtl`), `.gltf` (JSON + buffers), and `.fbx` (binary/ASCII search).
- **Live Status Indicators**: Visual indicators for textures (Found / Missing / Embedded).
- **One-Click Relinking**: Point to a texture directory to automatically resolve missing assets, update paths, and copy textures into the model's directory.

### 🏷️ Virtual Collections & Smart Tagging
- **Virtual Collections**: Group models into custom project albums without altering physical folders or moving files on disk.
- **Tag Cloud**: Filter models with searchable `#tags` and view live counts per tag.
- **Multi-Parameter Search**: Instant search by asset name, folder path, or file extension with sorting by date, size, name, and format.

### 🎨 6 Studio Color Themes
Switch between studio themes tailored for 3D creators:
- **Midnight Slate** *(Default)*: Deep obsidian dark mode with vibrant indigo glow.
- **Blender Studio**: Matches Blender 4.x's signature warm charcoal and orange theme.
- **Unreal Dark**: Deep onyx with Unreal Engine electric cyan highlights.
- **Cyberpunk Neon**: High-contrast pitch black with neon fuchsia and violet accents.
- **Nordic Forest**: Organic deep evergreen twilight with emerald mint accents.
- **Monochrome Titanium**: Minimalist industrial grayscale with crisp silver borders.

---

## 📦 Supported 3D Formats

| Format | Thumbnail Pipeline | 3D Viewport Pipeline | Capabilities |
| :--- | :--- | :--- | :--- |
| **`.blend`** | Direct binary header extractor (~3ms) | Headless conversion via local Blender | Meshes, materials, lighting |
| **`.glb` / `.gltf`** | WebGL canvas snapshot | Three.js `GLTFLoader` + Draco compression | PBR materials, animations, skins |
| **`.fbx`** | WebGL canvas snapshot | Three.js `FBXLoader` | Skeletal rigs, animations, materials |
| **`.obj`** | WebGL canvas snapshot | Three.js `OBJLoader` + `MTLLoader` | Meshes, `.mtl` companion textures |
| **`.stl`** | WebGL canvas snapshot | Three.js `STLLoader` | Auto-calculated vertex normals |

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- `npm` (v10 or higher)
- *(Optional)* [Blender](https://www.blender.org/) (for interactive `.blend` viewport conversion; thumbnail extraction works independently)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/3DModelViewer.git
   cd 3DModelViewer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

---

## 🏗️ Building & Packaging

### Production Build
To compile the TypeScript source and bundle the client and Electron processes:
```bash
npm run build
```

### Packaging Desktop Installers
Model Vault 3D uses `electron-builder` to produce standalone installers and executables:

```bash
# Package for Windows (NSIS Installer .exe + Portable .exe)
npm run dist:win

# Package for macOS (.dmg + .zip)
npm run dist:mac

# Package for Linux (.AppImage + .deb)
npm run dist:linux

# Local unpacked directory test (does not build installer)
npm run pack
```

Packaged installers are placed in the `release/` folder.

---

## 🤖 Automated CI/CD Release Builds (GitHub Actions)

This repository includes a multi-platform GitHub Actions workflow at [`.github/workflows/release.yml`](.github/workflows/release.yml).

### Triggering a Release
Whenever you push a version tag to GitHub, GitHub Actions will automatically compile, package, and publish the installers to GitHub Releases:

```bash
# Tag the current commit with a version
git tag v1.0.0

# Push the tag to GitHub
git push origin v1.0.0
```

GitHub Actions will build across three parallel virtual environments (`windows-latest`, `macos-latest`, `ubuntu-latest`) and attach the resulting binaries directly to the release.

---

## 🏛️ Project Architecture

```
3DModelViewer/
├── .github/workflows/     # CI/CD multi-platform release workflows
├── electron/              # Electron Main & Preload processes
│   ├── main.ts            # IPC handlers, native drag-and-drop, window lifecycle
│   ├── preload.ts         # Secure contextBridge API bridge
│   ├── scanner.ts         # Multi-threaded filesystem scanner
│   ├── store.ts           # SQLite & JSON asset caching engine
│   ├── blendExtractor.ts  # Fast binary header extractor for .blend previews
│   ├── blenderCli.ts      # Headless Blender 3D conversion pipeline
│   └── textureInspector.ts# Material & texture dependency analyzer
├── src/                   # React Frontend (Renderer process)
│   ├── components/        # Viewport, Gallery, ModelCard, TextureInspector, etc.
│   ├── types/             # Shared TypeScript interfaces & types
│   ├── utils/             # Formatters, viewport pro tools, Three.js cleanup
│   ├── index.css          # Design system & 6 studio color themes
│   └── App.tsx            # Root application component
├── electron-builder.json5 # Desktop packaging & installer configuration
└── package.json           # Project manifest & build scripts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
