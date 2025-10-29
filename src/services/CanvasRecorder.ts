export class CanvasRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingCanvas: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private audioSources: MediaStreamAudioSourceNode[] = [];
  private isRecording = false;
  private recordingAnimationId: number | null = null;

  constructor(_canvas: HTMLCanvasElement) {
    // Canvas parameter kept for compatibility but not used in this implementation
  }

  async startRecording(audioStreams: MediaStream[] = [], sprites: any[] = []): Promise<void> {
    try {
      // Create a high-resolution recording canvas (1920x1080)
      this.recordingCanvas = document.createElement('canvas');
      this.recordingCanvas.width = 1920;
      this.recordingCanvas.height = 1080;
      this.recordingCanvas.style.display = 'none';
      this.recordingCanvas.style.position = 'absolute';
      this.recordingCanvas.style.top = '-9999px';
      this.recordingCanvas.style.left = '-9999px';
      document.body.appendChild(this.recordingCanvas);

      // Copy the display canvas content to the recording canvas at full resolution
      this.copyCanvasToRecordingCanvas(sprites);

      // Get canvas stream at 1920x1080 with higher quality
      const videoStream = this.recordingCanvas.captureStream(60); // 60 FPS for smoother recording
      
      // Set up audio mixing if we have audio streams
      let finalStream = videoStream;
      if (audioStreams.length > 0) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audioDestination = this.audioContext.createMediaStreamDestination();
        
        // Connect all audio streams to the destination
        this.audioSources = [];
        for (const audioStream of audioStreams) {
          if (audioStream.getAudioTracks().length > 0) {
            const source = this.audioContext.createMediaStreamSource(audioStream);
            source.connect(this.audioDestination);
            this.audioSources.push(source);
          }
        }
        
        // Combine video and audio streams
        const audioTracks = this.audioDestination.stream.getAudioTracks();
        const videoTracks = videoStream.getVideoTracks();
        
        if (audioTracks.length > 0) {
          finalStream = new MediaStream([...videoTracks, ...audioTracks]);
        }
      }
      
      this.stream = finalStream;
      
      // Create MediaRecorder with high quality settings
      let options: MediaRecorderOptions = {
        videoBitsPerSecond: 20000000, // 20 Mbps for very high quality
        audioBitsPerSecond: 256000, // 256 kbps for high quality audio
      };

      // Try different MIME types in order of preference
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options.mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options.mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options.mimeType = 'video/mp4';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;

      // Prevent MediaStream tracks from being paused when tab becomes hidden
      this.preventStreamPause(finalStream);

      // Start continuous animation to update recording canvas
      this.startRecordingAnimation(sprites);

      console.log('Canvas recording started with audio:', audioStreams.length > 0);
    } catch (error) {
      console.error('Failed to start canvas recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.isRecording = false;
        
        // Clean up visibility handlers
        if ((this as any).visibilityHandler) {
          document.removeEventListener('visibilitychange', (this as any).visibilityHandler);
          (this as any).visibilityHandler = null;
        }
        if ((this as any).streamVisibilityHandler) {
          document.removeEventListener('visibilitychange', (this as any).streamVisibilityHandler);
          (this as any).streamVisibilityHandler = null;
        }
        
        // Clean up animation
        if (this.recordingAnimationId) {
          cancelAnimationFrame(this.recordingAnimationId);
          this.recordingAnimationId = null;
        }
        
        console.log('Canvas recording stopped, blob size:', blob.size, 'mimeType:', mimeType);
        resolve({ blob, mimeType });
      };

      this.mediaRecorder.stop();
    });
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  getRecordingState(): string {
    return this.isRecording ? 'recording' : 'stopped';
  }

  private preventStreamPause(stream: MediaStream): void {
    // Ensure all tracks stay active even when tab is hidden
    stream.getTracks().forEach(track => {
      // Set track to not be affected by page visibility
      if (track.kind === 'video') {
        // For video tracks, we need to keep them active
        const videoTrack = track as MediaStreamTrack;
        if (videoTrack.applyConstraints) {
          videoTrack.applyConstraints({
            // Keep the track active
          }).catch(console.warn);
        }
      }
      
      // Ensure track is enabled and not muted
      track.enabled = true;
      
      // Add event listeners to detect if track gets paused
      track.addEventListener('ended', () => {
        console.warn('Track ended unexpectedly:', track.kind);
      });
      
      track.addEventListener('mute', () => {
        console.warn('Track muted unexpectedly:', track.kind);
        track.enabled = true; // Re-enable if muted
      });
    });

    // Add visibility change listener to keep streams active
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab hidden, ensuring streams stay active...');
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.enabled = true;
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store the handler for cleanup
    (this as any).streamVisibilityHandler = handleVisibilityChange;
  }

  private startRecordingAnimation(sprites: any[]): void {
    const animate = () => {
      if (this.isRecording && this.recordingCanvas) {
        this.copyCanvasToRecordingCanvas(sprites);
        this.recordingAnimationId = requestAnimationFrame(animate);
      }
    };
    animate();

    // Add visibility change listener to ensure recording continues when tab is not visible
    const handleVisibilityChange = () => {
      if (document.hidden && this.isRecording) {
        console.log('Tab became hidden, but recording continues...');
        // Force continue animation even when tab is hidden
        const forceAnimate = () => {
          if (this.isRecording && this.recordingCanvas) {
            this.copyCanvasToRecordingCanvas(sprites);
            setTimeout(() => {
              if (this.isRecording) {
                forceAnimate();
              }
            }, 16); // ~60fps even when tab is hidden
          }
        };
        forceAnimate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store the handler so we can remove it later
    (this as any).visibilityHandler = handleVisibilityChange;
  }

  private copyCanvasToRecordingCanvas(sprites: any[]): void {
    if (!this.recordingCanvas) return;

    const ctx = this.recordingCanvas.getContext('2d');
    if (!ctx) return;

    // Clear the recording canvas
    ctx.clearRect(0, 0, 1920, 1080);

    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1920, 1080);

    // Draw center crosshair
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(960, 0);
    ctx.lineTo(960, 1080);
    ctx.moveTo(0, 540);
    ctx.lineTo(1920, 540);
    ctx.stroke();

    // Draw sprites at full resolution
    sprites.forEach(sprite => {
      this.drawSpriteAtFullResolution(ctx, sprite);
    });
  }

  private drawSpriteAtFullResolution(ctx: CanvasRenderingContext2D, sprite: any): void {
    ctx.save();
    
    // Convert center-relative coordinates to screen coordinates for 1920x1080
    const centerX = 960; // 1920 / 2
    const centerY = 540; // 1080 / 2
    const screenX = centerX + sprite.x;
    const screenY = centerY + sprite.y;
    
    ctx.translate(screenX, screenY);
    ctx.rotate(sprite.rotation);
    
    // Draw background
    ctx.fillStyle = sprite.isSelected ? '#374151' : '#1f2937';
    ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);

    // Draw border
    ctx.strokeStyle = sprite.isSelected ? '#ffd700' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    
    // Draw video if available
    if (sprite.videoElement) {
      if (sprite.videoElement.readyState >= 2 && sprite.videoElement.videoWidth > 0) {
        try {
          ctx.drawImage(
            sprite.videoElement,
            -sprite.width / 2,
            -sprite.height / 2,
            sprite.width,
            sprite.height
          );
        } catch (error) {
          console.error(`Error drawing video for sprite ${sprite.id}:`, error);
          // Fallback
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
        }
      } else {
        // Video not ready
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
      }
    } else {
      // No video stream
      ctx.fillStyle = '#374151';
      ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    }
    
    ctx.restore();
  }

  cleanup(): void {
    // Stop recording animation
    if (this.recordingAnimationId) {
      cancelAnimationFrame(this.recordingAnimationId);
      this.recordingAnimationId = null;
    }

    // Clean up recording canvas
    if (this.recordingCanvas && this.recordingCanvas.parentNode) {
      this.recordingCanvas.parentNode.removeChild(this.recordingCanvas);
      this.recordingCanvas = null;
    }

    // Clean up audio context and sources
    if (this.audioSources.length > 0) {
      this.audioSources.forEach(source => source.disconnect());
      this.audioSources = [];
    }
    
    if (this.audioDestination) {
      this.audioDestination.disconnect();
      this.audioDestination = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
