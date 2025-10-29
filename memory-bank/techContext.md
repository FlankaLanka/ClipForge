# ClipForge - Technical Context

## Technology Stack

### Frontend
- **React 19.1.0**: UI framework
- **TypeScript**: Type safety and developer experience
- **TailwindCSS**: Utility-first CSS framework
- **ShadCN UI**: Component library with Radix UI primitives
- **Zustand**: Lightweight state management
- **React-Konva**: Canvas-based timeline rendering
- **Vite**: Build tool and dev server
- **Web Audio API**: Real-time audio processing and mixing
- **HTML5 Canvas**: High-resolution recording and rendering
- **MediaRecorder API**: High-quality video recording

### Backend
- **Tauri 2.0**: Desktop app framework
- **Rust**: System programming language
- **FFmpeg**: Video processing engine
- **Tokio**: Async runtime for non-blocking operations
- **Serde**: Serialization/deserialization
- **UUID**: Unique identifier generation
- **Anyhow**: Error handling

### Recording System
- **Canvas Recording**: 1920x1080 high-resolution recording
- **MediaStream API**: Screen and webcam capture
- **Web Audio API**: Real-time audio mixing
- **VP9/VP8 Codecs**: High-quality video compression
- **WebM/MP4 Formats**: Cross-platform video output

## Dependencies

### Frontend Dependencies
```json
{
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-dialog": "^2",
  "@tauri-apps/plugin-opener": "^2",
  "typescript": "latest",
  "tailwindcss": "^3.4.0",
  "zustand": "latest",
  "react-konva": "^18.2.14",
  "konva": "latest",
  "@radix-ui/react-slot": "latest",
  "@radix-ui/react-icons": "latest",
  "class-variance-authority": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest",
  "tailwindcss-animate": "latest"
}
```

### Backend Dependencies
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
uuid = { version = "1", features = ["v4"] }
urlencoding = "2"
lazy_static = "1"
```

## Advanced Recording Features

### Canvas System
- **Dual Canvas**: Display canvas (1920x1080) + Recording canvas (1920x1080)
- **Real-time Sync**: Continuous animation loop for live updates
- **Coordinate Mapping**: Proper scaling between display and recording
- **High DPI Support**: Device pixel ratio handling

### Audio Processing
- **Web Audio API**: Real-time audio analysis and mixing
- **Audio Context**: Manages audio streams and processing
- **Voice Sources**: Dedicated audio-only microphone sources
- **Audio Visualization**: Real-time level meters and indicators

### Video Quality
- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 60 FPS for smooth recording
- **Video Bitrate**: 20 Mbps for high quality
- **Audio Bitrate**: 256 kbps for professional audio
- **Codec Support**: VP9, VP8, MP4 with automatic detection

## Development Setup
1. **Node.js**: Required for frontend development
2. **Rust**: Required for backend compilation
3. **FFmpeg**: Required for video processing (system dependency)
4. **Tauri CLI**: `npm install -g @tauri-apps/cli`
5. **macOS**: Screen recording permissions required
6. **Webcam**: Camera permissions required for webcam recording

## Technical Constraints
- **FFmpeg**: Must be installed on target system
- **Memory**: Canvas recording requires significant memory
- **CPU**: Real-time video processing is CPU intensive
- **Permissions**: Screen recording and camera access required
- **Browser Support**: MediaRecorder API compatibility
- **File Size**: High-quality recordings produce large files

## Performance Considerations
- **Canvas Rendering**: 60 FPS animation loop for smooth recording
- **Audio Processing**: Real-time analysis for voice meters
- **Memory Management**: Proper cleanup of audio contexts and streams
- **File I/O**: Efficient video file writing and management
- **Cross-platform**: MIME type detection with fallbacks

## Build Process
1. Frontend: `npm run build` (Vite)
2. Backend: `cargo build` (Rust)
3. Package: `npm run tauri build` (Tauri)
4. Output: Platform-specific executable with native permissions
