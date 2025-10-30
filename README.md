# ClipForge - AI-Powered Video Editor

ClipForge is a cross-platform desktop video editor built with Tauri + React + TypeScript + Rust + FFmpeg. It features AI-powered tools for text-to-video generation, style transfer, and professional video editing capabilities.

## Features

- **Timeline Editor**: Professional timeline-based video editing with drag-and-drop functionality
- **Recording Studio**: High-quality screen and webcam recording
- **AI Video Tools**: 
  - DALL-E Image Generator: Create AI-generated images from text prompts
  - AI Video Upscaler: Upscale videos using AI models (Real-ESRGAN, ESRGAN, Waifu2x)
  - AI Style Transfer: Apply artistic styles to videos
- **Media Management**: Import, organize, and manage your video clips
- **Export**: High-quality video export with customizable resolution

## Local Development Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **FFmpeg** - Required for video processing
  - **macOS**: `brew install ffmpeg`
  - **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian)
  - **Windows**: [Download from ffmpeg.org](https://ffmpeg.org/download.html)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd clipforge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional for development):**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key if you want to test AI features
   ```

### Running in Development Mode

Start the development server:

```bash
npm run tauri dev
```

This will:
- Start the Vite development server for the React frontend
- Compile and run the Rust backend
- Launch the application in development mode with hot-reload

### Building for Production

Create a distributable build:

```bash
npm run tauri build
```

The built application will be available in:
- **macOS**: `src-tauri/target/release/bundle/dmg/` (DMG installer) and `src-tauri/target/release/bundle/macos/` (.app bundle)
- **Linux**: `src-tauri/target/release/bundle/appimage/` or `src-tauri/target/release/bundle/deb/`
- **Windows**: `src-tauri\target\release\bundle\msi\`

## Using AI Features

### For End Users (Production Build)

When using the built application:

1. Open ClipForge
2. Navigate to **AI Tools** → **DALL-E Image Generator**
3. Enter your OpenAI API key in the provided field (starts with `sk-proj-...`)
4. The key is automatically saved in your browser's local storage
5. Start generating AI images!

### For Developers (Development Mode)

**Option 1: In-App API Key (Recommended)**
- Simply enter your API key in the DALL-E Image Generator interface
- Key is saved in localStorage for future use

**Option 2: Environment Variable**
1. Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
4. Restart the dev server

## Project Structure

```
clipforge/
├── src/                    # React frontend source
│   ├── components/         # React components
│   ├── state/             # Zustand state management
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── commands/      # Tauri commands (Rust API)
│   │   ├── main.rs        # Application entry point
│   │   └── lib.rs         # Library configuration
│   ├── binaries/          # Bundled FFmpeg/FFprobe
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
└── dist/                  # Built frontend (generated)
```

## Technologies

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Rust, Tauri 2.0
- **Video Processing**: FFmpeg (bundled with production builds)
- **State Management**: Zustand
- **UI Components**: Radix UI, Lucide Icons
- **Canvas**: Konva.js for timeline visualization

## Development Notes

- The app bundles FFmpeg and FFprobe binaries in production builds
- In development, it falls back to system-installed FFmpeg
- API keys are stored in browser localStorage (not in the repository)
- `.env` files are git-ignored for security

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- Extensions:
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub.
