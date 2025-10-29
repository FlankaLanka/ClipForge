# ClipForge - Product Requirements Document (PRD)

## Overview
**ClipForge** is a cross-platform desktop video editor built with **Tauri + React + TypeScript + Rust + FFmpeg**.  
It enables creators to **record, import, edit, and export** professional-quality videos with an intuitive interface and native performance.

This document outlines the **MVP (72-hour)** scope and **Final Submission** scope.

---

## 🎯 Product Vision
Make desktop video editing **accessible, fast, and intuitive**.  
Focus on the core editing loop: **Record → Import → Arrange → Export**.

---

## 🧩 MVP Goals (Day 1–2)
Deliver a working desktop app that can:
- Launch as a native Tauri app
- Import video clips (MP4, MOV, WebM)
- Display a timeline view of imported clips
- Play video previews
- Trim video (set in/out points)
- Export trimmed clip to MP4
- Package into distributable binary (.app/.exe)

### MVP Success Criteria
- App launches in under 5 seconds
- Import, trim, and export flow works without crashes
- Exported video retains original quality and playable in VLC/QuickTime

---

## 🚀 Final Build Goals (Day 3)
Enhance the MVP with recording, multi-track timeline, and export improvements.

### Core Features
#### Recording
- Screen recording (full/window selection)
- Webcam recording (via getUserMedia)
- Microphone audio capture
- Simultaneous screen + webcam (PiP)

#### Timeline Editor
- Two tracks: main video + overlay
- Playhead with scrub control
- Split and delete clips
- Drag and rearrange clips
- Zoom in/out on timeline
- Snap-to-clip or snap-to-grid alignment

#### Export & Sharing
- Export full timeline sequence to MP4
- Select resolution (720p, 1080p, source)
- Display export progress bar
- Save to disk via Tauri file dialog

#### Media Management
- Drag-and-drop import
- Media library with thumbnails
- Basic metadata display (duration, resolution, file size)

#### Performance Targets
- Smooth preview playback (30+ fps)
- Handle 10+ clips in timeline
- Export completes without crash
- Memory usage under 1 GB

---

## 🧠 Stretch Goals
If time allows:
- Text overlays and transitions
- Audio volume control and fade in/out
- Filters and effects
- Undo/redo system
- Auto-save project state
- Export presets (YouTube, TikTok)
- Keyboard shortcuts (space = play/pause, cmd+z = undo)

---

## 🧱 Technical Stack
| Layer | Technology |
|-------|-------------|
| **Desktop Framework** | Tauri (Rust backend + WebView frontend) |
| **Frontend** | React + TypeScript |
| **UI Styling** | TailwindCSS + ShadCN UI |
| **State Management** | Zustand |
| **Media Engine** | FFmpeg (Rust commands) |
| **Timeline Rendering** | React-Konva (Canvas-based) |
| **Video Player** | HTML5 `<video>` |
| **Packaging** | Tauri Builder |
| **Optional Cloud Upload** | Google Drive API or Dropbox SDK |

---

## 🧩 User Flow

### Import Flow
1. Launch app
2. Drag/drop or file-pick video
3. Clip appears in media library
4. Add to timeline → preview → trim → export

### Recording Flow
1. Choose “Record Screen” or “Record Webcam”
2. Record → Stop → Save to timeline
3. Arrange clips → Export

### Export Flow
1. Click “Export”
2. Choose resolution → Save location
3. Show encoding progress → Done → Toast notification

---

## 🎬 UX Layout

```
┌───────────────────────────────────────────────┐
│ [Top Menu] File | Edit | Export | Settings     │
├───────────────────────────────────────────────┤
│ [Left: Media Library]  │ [Right: Preview Player] │
│ - Import button         │ - Play/Pause/Seek      │
│ - Thumbnails            │ - Scrub bar            │
├───────────────────────────────────────────────┤
│ [Bottom: Timeline Panel]                      │
│ - Playhead + Tracks (React-Konva canvas)      │
│ - Zoom controls + time ruler                  │
└───────────────────────────────────────────────┘
```

---

## 🧾 Deliverables
- GitHub repository with source
- Packaged desktop build (.app/.exe)
- Demo video (3–5 mins)
- README with build and run instructions
