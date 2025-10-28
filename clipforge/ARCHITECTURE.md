# ClipForge - Architecture Document

## 🧱 Overview
ClipForge uses **Tauri** for the desktop shell (Rust backend + WebView frontend) and **React** for UI logic.  
The backend handles all system-level operations (FFmpeg encoding, file I/O, screen capture), while the frontend manages user interaction, timeline editing, and state.

---

## 🧩 System Architecture

```plaintext
+---------------------------------------------------+
|                 ClipForge (Tauri)                 |
|---------------------------------------------------|
|            Rust Backend (src-tauri)               |
|  - FFmpeg Command Execution                       |
|  - File I/O (Import, Export)                      |
|  - Recording (Screen, Webcam, Audio)              |
|  - Bridge (Tauri Commands)                        |
|---------------------------------------------------|
|              React Frontend (src)                 |
|  - UI Components (MediaPanel, Timeline, Player)   |
|  - State Management (Zustand)                     |
|  - Rendering (React-Konva for Timeline)           |
|  - Player (HTML5 <video>)                         |
|  - TailwindCSS + ShadCN for Styling               |
+---------------------------------------------------+
```

---

## 📂 Folder Structure

```plaintext
clipforge/
├── src-tauri/                     # Rust backend
│   ├── main.rs                    # Tauri app entrypoint
│   ├── commands/
│   │   ├── ffmpeg.rs              # Encode/trim/export
│   │   ├── recording.rs           # Screen & webcam capture
│   │   └── filesystem.rs          # File import/export utils
│   └── Cargo.toml
│
├── src/                           # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── MediaPanel.tsx
│   │   ├── TimelineCanvas.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── ExportModal.tsx
│   │   └── RecordingControls.tsx
│   ├── state/
│   │   └── useEditorStore.ts      # Zustand store
│   ├── utils/
│   │   ├── ffmpeg.ts              # JS helpers for encoding
│   │   └── fileUtils.ts
│   ├── styles/
│   │   └── globals.css
│   ├── main.tsx
│   └── index.html
│
├── public/
│   └── icons/
│
├── package.json
├── tauri.conf.json
└── README.md
```

---

## ⚙️ Key Technologies

| Layer | Tool | Purpose |
|-------|------|----------|
| **Frontend Framework** | React + TypeScript | Main UI and component logic |
| **Desktop Shell** | Tauri (Rust) | Native access, FFmpeg invocation |
| **Styling** | TailwindCSS + ShadCN | Rapid UI design |
| **Canvas Renderer** | React-Konva | Timeline visualization |
| **State Management** | Zustand | Clip and timeline state |
| **Media Engine** | FFmpeg | Encoding, trimming, exporting |
| **Recording** | Rust + getUserMedia | Screen & webcam recording |
| **Packaging** | Tauri Builder | Create distributables |

---

## 🧠 Data Flow

1. **User imports video**
   - React triggers `tauri.invoke('import_video', path)`
   - Rust reads metadata and returns info to React store

2. **Timeline editing**
   - All edits happen in React via Zustand state
   - TimelineCanvas renders current state visually

3. **Export**
   - React sends final clip arrangement → Rust
   - Rust executes FFmpeg concat/export
   - Progress updates streamed back to frontend

4. **Recording**
   - Frontend calls Rust command to start recording
   - Backend handles capture and returns file path
   - File automatically added to media library

---

## 🧠 Performance Notes
- Use async Rust commands for FFmpeg (tokio tasks)
- Avoid blocking UI during encoding
- Lazy-load thumbnails and clips
- Use WebWorkers (if needed) for metadata extraction

---

## 🧩 Future Extensions
- Add GPU-accelerated rendering pipeline
- Cloud project save (JSON + assets)
- Node bindings for AI-assisted clip trimming
- Plugin system for filters and transitions
