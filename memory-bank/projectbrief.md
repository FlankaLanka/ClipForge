# ClipForge - Project Brief

## Project Overview
ClipForge is a cross-platform desktop video editor built with Tauri + React + TypeScript + Rust + FFmpeg. The project aims to make desktop video editing accessible, fast, and intuitive with a focus on the core editing loop: Record → Import → Arrange → Export.

## Core Requirements
- **Platform**: Cross-platform desktop app (Windows, macOS, Linux)
- **Framework**: Tauri (Rust backend + WebView frontend)
- **Frontend**: React + TypeScript + TailwindCSS + ShadCN UI
- **Media Engine**: FFmpeg for video processing
- **Timeline**: React-Konva for canvas-based timeline editing
- **State Management**: Zustand

## MVP Goals (72-hour sprint)
1. Launch as native Tauri app
2. Import video clips (MP4, MOV, WebM)
3. Display timeline view of imported clips
4. Play video previews
5. Trim video (set in/out points)
6. Export trimmed clip to MP4
7. Package into distributable binary

## Final Build Goals
- Screen and webcam recording
- Multi-track timeline editor
- Drag and drop functionality
- Export with resolution options
- Media library with thumbnails
- Performance targets: 30+ fps preview, handle 10+ clips

## Success Criteria
- App launches in under 5 seconds
- Import, trim, and export flow works without crashes
- Exported video retains original quality
- Smooth preview playback
- Memory usage under 1 GB
