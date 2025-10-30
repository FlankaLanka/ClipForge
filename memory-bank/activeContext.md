# ClipForge - Active Context

## Current Work Focus
**Phase 9: AI Features Restart - Character Sprite Extractor** (Completed)
- ✅ **AI Features Restart**: Completely replaced AI style generator with character sprite extractor
- ✅ **Character Sprite Extractor**: New AI-powered tool for extracting 2D character sprites from gameplay footage
- ✅ **OpenAI Vision Integration**: Uses GPT-4o Vision API for character detection and cropping
- ✅ **FFmpeg Frame Extraction**: Extracts frames at configurable FPS (8-12 FPS)
- ✅ **Sprite Sheet Assembly**: Combines detected character frames into organized sprite sheet
- ✅ **Duplicate Detection**: Automatically removes similar/duplicate frames using image comparison
- ✅ **Metadata Generation**: Creates JSON metadata with frame positions and timing information
- ✅ **UI Integration**: Complete React component with progress tracking and preview

## Recent Major Achievements
- ✅ **Split Functionality Fix**: Fixed split clip functionality to properly calculate durations and timeline positions
- ✅ **Zoom Enhancement**: Increased minimum zoom out level to allow 4x more zoom out (1 pixel per second minimum)
- ✅ **Manual Timeline Addition**: Videos no longer automatically added to timeline - users double-click to add
- ✅ **Enhanced MediaPanel**: Visual indicators show which videos are on timeline vs imported only
- ✅ **Improved User Control**: Full user control over timeline addition with clear UI feedback
- ✅ **Code Quality**: Removed old debug logs and fixed syntax errors for cleaner codebase
- ✅ **Import Fixes**: Resolved destructuring issues with timeline store imports
- ✅ **AI Video Tools Tab**: Complete AI-powered video tools with character sprite extraction
- ✅ **AI Video Upscaler**: Upscale videos using multiple AI models with quality options
- ✅ **Character Sprite Extractor**: AI-powered tool for extracting 2D character sprites from gameplay footage
- ✅ **OpenAI Vision Integration**: GPT-4o Vision API for character detection and cropping
- ✅ **Video Performance Fix**: Resolved 1 FPS performance issue with optimized sync logic
- ✅ **Timeline Parsing**: Proper video timeline parsing respecting trim start/end points
- ✅ **Infinite Ruler**: Timeline ruler now extends infinitely beyond current clips
- ✅ **Dynamic Duration**: Timeline duration shows actual end of last video clip
- ✅ **Clip Deselection**: Click outside clips to hide split/delete buttons
- ✅ **Video Sync Optimization**: Eliminated constant video seeking during playback
- ✅ **Timeline Video Editor**: Complete timeline-based video editing system
- ✅ **Single Track Design**: Simplified single-track timeline for easy editing
- ✅ **Real-time Preview**: 60fps video preview synchronized with timeline
- ✅ **Timeline Export**: FFmpeg-based export with proper audio/video handling
- ✅ **Timeline Controls**: Playhead, scrub controls, zoom, and pan functionality
- ✅ **Video Import**: Drag-and-drop video import with manual timeline addition
- ✅ **Clip Editing**: Drag, trim, split, and delete video clips
- ✅ **High-Quality Recording**: 1920x1080 canvas recording at 60 FPS with 20 Mbps video + 256 kbps audio

## Current System Architecture
- **Timeline Editor**: Single-track timeline with video clip management and infinite ruler
- **Video Preview**: 60fps video preview with optimized sync and proper timeline parsing
- **Timeline Controls**: Playhead, scrub controls, zoom, and pan with infinite scrolling
- **Clip Editing**: Drag, trim, split, and delete video clips with click-outside deselection
- **Timeline Export**: FFmpeg-based export with proper audio/video handling
- **Video Import**: Drag-and-drop video import with manual timeline addition (double-click to add)
- **Canvas Recording**: 1920x1080 canvas recording system for screen/webcam capture
- **Audio Mixing**: Web Audio API for real-time voice source mixing
- **Performance**: Optimized video sync eliminating constant seeking during playback

## Key Technical Features
- **Timeline System**: Single-track timeline with video clip management and infinite ruler
- **Real-time Preview**: 60fps video preview with optimized sync and proper timeline parsing
- **Timeline Controls**: Playhead, scrub controls, zoom, and pan with infinite scrolling
- **Clip Editing**: Drag, trim, split, and delete video clips with click-outside deselection
- **Timeline Export**: FFmpeg-based export with proper audio/video handling
- **Video Import**: Drag-and-drop video import with manual timeline addition (double-click to add)
- **Canvas Recording**: 1920x1080 canvas recording system for screen/webcam capture
- **Audio Processing**: Multiple voice sources mixed into single audio track
- **Quality Settings**: 20 Mbps video, 256 kbps audio, 60 FPS recording
- **Performance Optimization**: Eliminated constant video seeking, 60fps smooth playback

## Active Components
- **Timeline**: Main timeline editor with video clip management
- **VideoClip**: Individual video clip component with drag, trim, split, delete
- **TimeRuler**: Dynamic time ruler with zoom-adaptive markers
- **ScrubbablePlayhead**: Draggable playhead for timeline navigation
- **MediaPanel**: Video import panel with manual timeline addition and visual indicators
- **ExportModal**: FFmpeg-based export with file dialog integration
- **CanvasRecordingStudio**: Recording interface with source management
- **CanvasPreview**: 1920x1080 canvas with sprite rendering and interaction
- **CanvasRecorder**: High-quality recording service with audio mixing
- **CharacterSpriteExtractor**: AI-powered character sprite extraction from gameplay footage
- **AIToolsTab**: AI tools interface with character sprite extractor and video upscaler

## Important Instructions
- **DO NOT start development servers unless explicitly told to do so**
- User will control when to run `npm run tauri dev` or similar commands
- Focus on code changes and fixes without automatically starting servers
- All recording functionality is complete and ready for testing

## Current Status
- ✅ Timeline video editor fully functional with infinite ruler
- ✅ Real-time 60fps video preview working with optimized sync
- ✅ Timeline controls (playhead, scrub, zoom, pan) working with infinite scrolling
- ✅ Clip editing (drag, trim, split, delete) working with click-outside deselection
- ✅ Split functionality properly calculates durations and timeline positions
- ✅ Enhanced zoom out capability (4x more zoom out than before)
- ✅ FFmpeg-based export with proper audio/video handling
- ✅ Video import with manual timeline addition (double-click to add)
- ✅ Recording system fully functional
- ✅ High-quality 1920x1080 output
- ✅ Video performance optimized (1 FPS → 60 FPS)
- ✅ Timeline duration shows actual end of video clips
- ✅ Character Sprite Extractor: AI-powered sprite extraction from gameplay footage
- ✅ OpenAI Vision API integration for character detection and cropping
- ✅ Sprite sheet assembly with metadata generation
- 🎯 **Ready for user testing and feedback**
