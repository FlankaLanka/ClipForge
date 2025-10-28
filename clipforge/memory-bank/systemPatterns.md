# ClipForge - System Patterns

## Architecture Overview
ClipForge follows a clear separation between Rust backend (system operations) and React frontend (UI and user interactions), with an advanced canvas-based recording system and a complete timeline-based video editor.

## Key Technical Decisions

### Backend (Rust)
- **Tauri Commands**: All system operations exposed as Tauri commands
- **FFmpeg Integration**: Direct FFmpeg process execution for video processing
- **Async Operations**: Use tokio for non-blocking FFmpeg operations
- **File I/O**: Rust handles all file system operations for security
- **Video Processing**: High-quality video processing with metadata extraction

### Frontend (React)
- **Component Structure**: Modular components for each major UI section
- **State Management**: Zustand for global state (clips, timeline, player state)
- **Canvas Rendering**: Dual canvas system for display and recording
- **Timeline System**: Single-track timeline with video clip management
- **Type Safety**: Full TypeScript coverage for all components
- **Audio Processing**: Web Audio API for real-time audio mixing

## Timeline Video Editor System

### Single Track Timeline
- **Timeline Design**: Simplified single-track timeline for easy video editing
- **Video Clips**: Drag, trim, split, and delete video clips on timeline
- **Real-time Preview**: 60fps video preview synchronized with timeline
- **Timeline Controls**: Playhead, scrub controls, zoom, and pan functionality
- **Video Import**: Drag-and-drop video import with automatic timeline addition

### Timeline Components
- **Timeline**: Main timeline editor with video clip management
- **VideoClip**: Individual video clip component with drag, trim, split, delete
- **TimeRuler**: Dynamic time ruler with zoom-adaptive markers
- **ScrubbablePlayhead**: Draggable playhead for timeline navigation
- **MediaPanel**: Video import panel with automatic timeline addition
- **ExportModal**: FFmpeg-based export with file dialog integration

### Timeline State Management
- **TimelineStore**: Zustand store for timeline state (clips, playhead, zoom, pan)
- **Clip Management**: Add, move, trim, split, and delete video clips
- **Collision Detection**: Prevent overlapping clips on timeline
- **Timeline Navigation**: Playhead control, zoom, and pan functionality

## Advanced Recording System

### Dual Canvas Architecture
- **Display Canvas**: 1920x1080 resolution with responsive scaling for user interaction
- **Recording Canvas**: Hidden 1920x1080 canvas for high-quality recording output
- **Real-time Sync**: Continuous animation loop keeps recording canvas updated
- **Coordinate Mapping**: Proper scaling between display and recording coordinates

### Audio Processing
- **Web Audio API**: Real-time audio mixing from multiple sources
- **Audio Context**: Manages audio streams and mixing
- **Voice Sources**: Dedicated audio-only sources for microphones
- **Quality Settings**: 256 kbps audio encoding for professional quality

### Sprite Management
- **Source Types**: Screen capture, webcam capture, voice-only sources
- **Smart Sizing**: Automatic sizing based on actual source dimensions
- **Layer Management**: Z-index control for sprite ordering
- **Interaction**: Drag, resize, rotate, and context menu operations

## Design Patterns

### Command Pattern
- All backend operations are Tauri commands
- Frontend calls `invoke('command_name', params)`
- Commands return structured data or streams

### State Management Pattern
- Zustand store holds all application state
- Actions are pure functions that update state
- Components subscribe to specific state slices

### Component Composition
- UI components are composed of smaller, reusable pieces
- ShadCN UI provides base components
- Custom components extend base functionality

### Recording Pattern
- **CanvasRecorder Service**: Manages high-quality recording with audio mixing
- **Sprite System**: Manages visual elements on canvas
- **Audio Mixing**: Real-time mixing of multiple audio sources
- **File Output**: User-controlled output with high-quality encoding

## Component Relationships
```
App
├── CanvasRecordingStudio (main recording interface)
│   ├── CanvasPreview (1920x1080 canvas with sprites)
│   ├── CanvasRecorder (high-quality recording service)
│   ├── VoiceMeter (audio level visualization)
│   ├── AudioIndicator (visual audio feedback)
│   └── Source Dialogs (webcam/voice selection)
├── MediaPanel (import, library)
├── VideoPlayer (preview, controls)
├── TimelineCanvas (editing, arrangement)
└── ExportModal (export settings, progress)
```

## Data Flow
1. User action → React component
2. Component → Zustand action
3. State update → UI re-render
4. Backend operation → Tauri command
5. Command result → Zustand state
6. State update → UI update

## Recording Flow
1. User adds source → MediaStream created
2. Source → Sprite created with video element
3. Sprite → Canvas rendering with real-time updates
4. Recording → Dual canvas system captures high-quality output
5. Audio → Web Audio API mixes all voice sources
6. Output → High-quality WebM/MP4 file saved

## Development Workflow
- **Server Control**: Do not start development servers automatically
- **User Initiated**: Only run `npm run tauri dev` when explicitly requested
- **Code Focus**: Concentrate on implementing features and fixes
- **Manual Testing**: User will control when to test the application
