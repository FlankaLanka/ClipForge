# ClipForge - Task Breakdown (72-Hour Sprint)

## 🕒 Timeline Overview

### Day 1 — Core Infrastructure & Import/Preview
**Goals:**
- Set up Tauri + React + TypeScript project
- Implement drag & drop video import
- Add video preview (HTML5 `<video>`)
- Display clip metadata (duration, name)
- Integrate FFmpeg basic trimming
- Package MVP build

**Deliverables:**
- App launches and imports clips
- Preview playback works
- Trimming + export of single clip

---

### Day 2 — Timeline Editor & Export
**Goals:**
- Implement React-Konva timeline canvas
- Enable drag/drop clips onto timeline
- Add playhead with scrub control
- Trim handles and split logic
- Export merged sequence via FFmpeg concat

**Deliverables:**
- Functional timeline editing
- Multi-clip export to MP4
- Timeline zoom in/out

---

### Day 3 — Recording, Polishing, and Packaging
**Goals:**
- Implement screen and webcam recording
- Integrate mic audio capture
- Add PiP overlay for webcam
- Add export progress modal
- Test builds on Windows/macOS
- Polish UI and error handling

**Deliverables:**
- Full Record → Edit → Export workflow
- Final demo video
- GitHub release build

---

## 🧠 Stretch Tasks (Optional)
- Add text overlays and filters
- Undo/redo state stack
- Auto-save project file (JSON)
- Cloud upload integration

---

## 🧑‍💻 Roles / Task Ownership (if team-based)

| Role | Responsibility |
|------|----------------|
| **Frontend Developer** | UI layout, timeline, React-Konva, Zustand state |
| **Backend Developer (Rust)** | FFmpeg invocation, recording commands, file I/O |
| **UI/UX Designer** | Layout polish, styling consistency, transitions |
| **QA / Tester** | Cross-platform testing, performance profiling |
| **DevOps / Packager** | Tauri build setup, CI/CD for GitHub releases |
