# ClipForge - AI-Powered Video Editor

ClipForge is a cross-platform desktop video editor built with Tauri + React + TypeScript + Rust + FFmpeg. It features AI-powered tools for text-to-video generation and style transfer.

## Features

- **Video Editor**: Timeline-based video editing with drag-and-drop functionality
- **Recording Studio**: High-quality screen and webcam recording
- **AI Video Tools**: 
  - AI Video Upscaler: Upscale videos using AI models (Real-ESRGAN, ESRGAN, Waifu2x)
  - AI Style Transfer: Apply artistic styles to videos using AI and FFmpeg

## AI Tools Setup

To use the AI Video Tools features, you need to set up an OpenAI API key:

### Option 1: Using .env file (Recommended)
1. Get your OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
4. Restart ClipForge
5. The AI Tools tab will be available once the key is set

### Option 2: Using environment variable
1. Get your OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Set the environment variable:
   ```bash
   export OPENAI_API_KEY="your-key-here"
   ```
3. Restart ClipForge
4. The AI Tools tab will be available once the key is set

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
