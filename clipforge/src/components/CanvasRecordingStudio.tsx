import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import CanvasPreview from './CanvasPreview';
import WebcamSpriteDialog from './WebcamSpriteDialog';
import VoiceSpriteDialog from './VoiceSpriteDialog';
import VoiceMeter from './VoiceMeter';
import { CanvasRecorder } from '../services/CanvasRecorder';

interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_primary: boolean;
}

interface Sprite {
  id: string;
  name: string;
  type: 'monitor' | 'webcam' | 'voice';
  x: number; // Center-relative position
  y: number; // Center-relative position
  width: number;
  height: number;
  rotation: number; // In radians
  videoStream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  audioStream: MediaStream | null; // For voice sources
  isSelected: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  outputPath: string;
}

const CanvasRecordingStudio: React.FC = () => {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    outputPath: ''
  });
  const [canvasRecorder, setCanvasRecorder] = useState<CanvasRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [outputFolder, setOutputFolder] = useState<string>('');
  
  // Dialog states
  const [webcamDialogOpen, setWebcamDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoElementsRef = useRef<{ [key: string]: HTMLVideoElement }>({});

  // Create video element for sprite
  const createVideoElement = (spriteId: string, stream: MediaStream): HTMLVideoElement => {
    console.log(`Creating video element for sprite ${spriteId} with stream:`, stream);
    console.log(`Stream tracks:`, stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
    
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none'; // Hide the video element
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    
    // Add event listeners for debugging
    video.addEventListener('loadedmetadata', () => {
      console.log(`Video metadata loaded for sprite ${spriteId}, videoSize: ${video.videoWidth}x${video.videoHeight}`);
    });
    
    video.addEventListener('canplay', () => {
      console.log(`Video can play for sprite ${spriteId}, readyState: ${video.readyState}`);
    });
    
    video.addEventListener('playing', () => {
      console.log(`Video playing for sprite ${spriteId}`);
    });
    
    video.addEventListener('error', (e) => {
      console.error(`Video error for sprite ${spriteId}:`, e);
    });
    
    video.addEventListener('loadstart', () => {
      console.log(`Video load started for sprite ${spriteId}`);
    });
    
    // Add to DOM so it can be rendered
    document.body.appendChild(video);
    
    videoElementsRef.current[spriteId] = video;
    
    // Force play to ensure the video starts
    video.play().catch(e => {
      console.error(`Failed to play video for sprite ${spriteId}:`, e);
    });
    
    return video;
  };

  // Clean up video element
  const cleanupVideoElement = (spriteId: string) => {
    const video = videoElementsRef.current[spriteId];
    if (video) {
      video.srcObject = null;
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      delete videoElementsRef.current[spriteId];
    }
  };

  // Load available monitors
  const loadMonitors = async () => {
    try {
      const monitorList = await invoke('get_available_monitors');
      setMonitors(monitorList as MonitorInfo[]);
    } catch (error) {
      console.error('Failed to load monitors:', error);
    }
  };

  // Load webcam devices
  const loadWebcamDevices = async () => {
    setIsLoadingDevices(true);
    try {
      // Request camera permission first to get device labels
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permError) {
        console.log('Camera permission not granted, but continuing with device enumeration');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('Found webcam devices:', videoDevices);
      setWebcamDevices(videoDevices);
    } catch (error) {
      console.error('Failed to load webcam devices:', error);
      alert('Failed to load webcam devices. Please check permissions and try again.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // Load available audio devices
  const loadAudioDevices = async () => {
    setIsLoadingDevices(true);
    try {
      // Request microphone permission first to get device labels
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permError) {
        console.log('Microphone permission not granted, but continuing with device enumeration');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      console.log('Found audio devices:', audioDevices);
      setAudioDevices(audioDevices);
    } catch (error) {
      console.error('Failed to load audio devices:', error);
      alert('Failed to load audio devices. Please check permissions and try again.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // Start screen capture
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      setScreenStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
        setSprites(prev => prev.filter(s => s.type !== 'monitor'));
      });
      
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      alert('Failed to access screen. Please check permissions and try again.');
    }
  };

  // Start screen capture and return stream directly (for immediate use)
  const startScreenCaptureAndGetStream = async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      // Also set the state for other components
      setScreenStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
        setSprites(prev => prev.filter(s => s.type !== 'monitor'));
      });
      
      return stream;
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      alert('Failed to access screen. Please check permissions and try again.');
      throw error;
    }
  };

  // Start webcam
  const startWebcam = async () => {
    try {
      console.log('Starting webcam with device:', selectedWebcam);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedWebcam ? { exact: selectedWebcam } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      console.log('Webcam stream created:', stream);
      setWebcamStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Webcam stream ended');
        setWebcamStream(null);
        setSprites(prev => prev.filter(s => s.type !== 'webcam'));
      });
      
    } catch (error) {
      console.error('Failed to start webcam:', error);
      alert('Failed to access webcam. Please check permissions.');
    }
  };

  // Start webcam and return stream directly (for immediate use)
  const startWebcamAndGetStream = async (deviceId?: string): Promise<MediaStream> => {
    try {
      const targetDeviceId = deviceId || (webcamDevices.length > 0 ? webcamDevices[0].deviceId : undefined);
      console.log('Starting webcam with device:', targetDeviceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      console.log('Webcam stream created:', stream);
      
      // Also set the state for other components
      setWebcamStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Webcam stream ended');
        setWebcamStream(null);
        setSprites(prev => prev.filter(s => s.type !== 'webcam'));
      });
      
      return stream;
    } catch (error) {
      console.error('Failed to start webcam:', error);
      alert('Failed to access webcam. Please check permissions.');
      throw error;
    }
  };

  // Add screen recording sprite
  const addScreenSprite = async () => {
    try {
      console.log('Adding screen sprite - triggering macOS screen sharing');
      
      // Directly trigger macOS screen sharing dialog
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // Disable audio capture for screen recording
      });
      
      // Get the actual dimensions of the selected screen/window
      const videoTrack = screenStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const actualWidth = settings.width || 1920;
      const actualHeight = settings.height || 1080;
      
      // Calculate scaled dimensions to fit within canvas while maintaining aspect ratio
      const maxWidth = 800; // Maximum width for sprites on canvas
      const maxHeight = 600; // Maximum height for sprites on canvas
      
      let spriteWidth = actualWidth;
      let spriteHeight = actualHeight;
      
      // Scale down if too large, but maintain aspect ratio
      if (spriteWidth > maxWidth || spriteHeight > maxHeight) {
        const scaleX = maxWidth / spriteWidth;
        const scaleY = maxHeight / spriteHeight;
        const scale = Math.min(scaleX, scaleY);
        
        spriteWidth = Math.round(spriteWidth * scale);
        spriteHeight = Math.round(spriteHeight * scale);
      }
      
      const sourceId = await invoke('add_capture_source', {
        sourceType: 'monitor',
        deviceId: 'selected_screen',
        name: `Screen: ${actualWidth}x${actualHeight}`,
        x: 0, // Center position
        y: 0, // Center position
        width: spriteWidth,
        height: spriteHeight
      });
      
      const videoElement = createVideoElement(sourceId as string, screenStream);
      
      const newSprite: Sprite = {
        id: sourceId as string,
        name: `Screen: ${actualWidth}x${actualHeight}`,
        type: 'monitor',
        x: 0, // Start at center
        y: 0,
        width: spriteWidth,
        height: spriteHeight,
        rotation: 0,
        videoStream: screenStream,
        videoElement: videoElement,
        audioStream: null, // No audio for screen recordings
        isSelected: false
      };
      
      console.log('Creating screen sprite:', newSprite);
      setSprites(prev => [...prev, newSprite]);
    } catch (error) {
      console.error('Failed to add screen sprite:', error);
      alert('Failed to add screen sprite. Please check permissions and try again.');
    }
  };


  // Add webcam sprite
  const addWebcamSprite = async () => {
    console.log('Adding webcam sprite, current webcamStream:', webcamStream);
    let currentWebcamStream = webcamStream;
    
    if (!currentWebcamStream) {
      console.log('No webcam stream, starting webcam...');
      // Get the stream directly from startWebcam instead of relying on state
      currentWebcamStream = await startWebcamAndGetStream();
      console.log('Got webcam stream directly:', currentWebcamStream);
    }
    
    const sourceId = await invoke('add_capture_source', {
      sourceType: 'webcam',
      deviceId: webcamDevices.length > 0 ? webcamDevices[0].deviceId : 'default',
      name: `Webcam ${sprites.filter(s => s.type === 'webcam').length + 1}`,
      x: 200, // Offset from center
      y: 200,
      width: 320,
      height: 240
    });
    
    console.log('Created source with ID:', sourceId);
    console.log('Creating video element with stream:', currentWebcamStream);
    
    const videoElement = currentWebcamStream ? createVideoElement(sourceId as string, currentWebcamStream) : null;
    
    const newSprite: Sprite = {
      id: sourceId as string,
      name: `Webcam ${sprites.filter(s => s.type === 'webcam').length + 1}`,
      type: 'webcam',
      x: 200, // Offset from center
      y: 200,
      width: 320,
      height: 240,
      rotation: 0,
      videoStream: currentWebcamStream,
      videoElement: videoElement,
      audioStream: null,
      isSelected: false
    };
    
    console.log('Creating webcam sprite:', newSprite);
    setSprites(prev => [...prev, newSprite]);
  };

  // Add webcam sprite with specific device
  const addWebcamSpriteWithDevice = async (deviceId: string, deviceName: string) => {
    try {
      console.log('Adding webcam sprite with device:', deviceId, deviceName);
      
      // Get webcam stream with specific device (video only)
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false // Disable audio capture for webcam
      });
      
      // Get the actual dimensions of the webcam stream
      const videoTrack = webcamStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      const actualWidth = settings.width || 640;
      const actualHeight = settings.height || 480;
      
      // Calculate scaled dimensions to fit within canvas while maintaining aspect ratio
      const maxWidth = 400; // Maximum width for webcam sprites on canvas
      const maxHeight = 300; // Maximum height for webcam sprites on canvas
      
      let spriteWidth = actualWidth;
      let spriteHeight = actualHeight;
      
      // Scale down if too large, but maintain aspect ratio
      if (spriteWidth > maxWidth || spriteHeight > maxHeight) {
        const scaleX = maxWidth / spriteWidth;
        const scaleY = maxHeight / spriteHeight;
        const scale = Math.min(scaleX, scaleY);
        
        spriteWidth = Math.round(spriteWidth * scale);
        spriteHeight = Math.round(spriteHeight * scale);
      }
      
      const sourceId = await invoke('add_capture_source', {
        sourceType: 'webcam',
        deviceId: deviceId,
        name: deviceName,
        x: 200, // Offset from center
        y: 200,
        width: spriteWidth,
        height: spriteHeight
      });
      
      const videoElement = createVideoElement(sourceId as string, webcamStream);
      
      const newSprite: Sprite = {
        id: sourceId as string,
        name: deviceName,
        type: 'webcam',
        x: 200,
        y: 200,
        width: spriteWidth,
        height: spriteHeight,
        rotation: 0,
        videoStream: webcamStream,
        videoElement: videoElement,
        audioStream: null, // No audio for webcam recordings
        isSelected: false
      };
      
      setSprites(prev => [...prev, newSprite]);
      console.log('Created webcam sprite:', newSprite);
    } catch (error) {
      console.error('Failed to add webcam sprite:', error);
      alert('Failed to add webcam sprite. Please check permissions and try again.');
    }
  };

  // Add voice source with specific device
  const addVoiceSourceWithDevice = async (deviceId: string, deviceName: string) => {
    try {
      console.log('Adding voice source with device:', deviceId, deviceName);
      
      // Get audio stream with specific device
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });
      
      const sourceId = await invoke('add_capture_source', {
        sourceType: 'voice',
        deviceId: deviceId,
        name: deviceName,
        x: 0, // Voice sources don't have position
        y: 0,
        width: 0, // Voice sources don't have size
        height: 0
      });
      
      const newSprite: Sprite = {
        id: sourceId as string,
        name: deviceName,
        type: 'voice',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        videoStream: null,
        videoElement: null,
        audioStream: audioStream,
        isSelected: false
      };
      
      setSprites(prev => [...prev, newSprite]);
      console.log('Created voice source:', newSprite);
    } catch (error) {
      console.error('Failed to add voice source:', error);
      alert('Failed to add voice source. Please check permissions and try again.');
    }
  };

  // Remove sprite
  const removeSprite = async (spriteId: string) => {
    cleanupVideoElement(spriteId);
    await invoke('remove_capture_source', { sourceId: spriteId });
    setSprites(prev => prev.filter(s => s.id !== spriteId));
  };

  // Handle sprite movement
  const handleSpriteMove = async (spriteId: string, x: number, y: number) => {
    setSprites(prev => prev.map(s => 
      s.id === spriteId ? { ...s, x, y } : s
    ));
    
    // Update in backend
    try {
      await invoke('update_capture_source_position', {
        sourceId: spriteId,
        x: Math.round(x),
        y: Math.round(y),
        width: sprites.find(s => s.id === spriteId)?.width || 0,
        height: sprites.find(s => s.id === spriteId)?.height || 0
      });
    } catch (error) {
      console.error('Failed to update position:', error);
    }
  };

  // Handle sprite resize
  const handleSpriteResize = async (spriteId: string, width: number, height: number) => {
    setSprites(prev => prev.map(s => 
      s.id === spriteId ? { ...s, width, height } : s
    ));
    
    // Update in backend
    try {
      await invoke('update_capture_source_position', {
        sourceId: spriteId,
        x: sprites.find(s => s.id === spriteId)?.x || 0,
        y: sprites.find(s => s.id === spriteId)?.y || 0,
        width: Math.round(width),
        height: Math.round(height)
      });
    } catch (error) {
      console.error('Failed to update size:', error);
    }
  };

  // Handle sprite rotation
  const handleSpriteRotate = async (spriteId: string, rotation: number) => {
    setSprites(prev => prev.map(s => 
      s.id === spriteId ? { ...s, rotation } : s
    ));
    
    // Update in backend (if rotation is supported)
    console.log(`Rotated sprite ${spriteId} to ${rotation} radians`);
  };

  // Handle sprite selection
  const handleSpriteSelect = (spriteId: string) => {
    setSprites(prev => prev.map(s => ({
      ...s,
      isSelected: s.id === spriteId
    })));
  };

  // Handle sprite move to front
  const handleSpriteMoveToFront = (spriteId: string) => {
    setSprites(prev => {
      const sprite = prev.find(s => s.id === spriteId);
      if (!sprite) return prev;
      
      const otherSprites = prev.filter(s => s.id !== spriteId);
      return [...otherSprites, sprite];
    });
  };

  // Handle sprite move to back
  const handleSpriteMoveToBack = (spriteId: string) => {
    setSprites(prev => {
      const sprite = prev.find(s => s.id === spriteId);
      if (!sprite) return prev;
      
      const otherSprites = prev.filter(s => s.id !== spriteId);
      return [sprite, ...otherSprites];
    });
  };

  // Handle sprite change source
  const handleSpriteChangeSource = async (spriteId: string) => {
    const sprite = sprites.find(s => s.id === spriteId);
    if (!sprite) return;

    if (sprite.type === 'webcam') {
      // Show webcam selection dialog
      const availableWebcams = webcamDevices.map(device => ({
        id: device.deviceId,
        name: device.label || `Camera ${device.deviceId.slice(0, 8)}`
      }));

      if (availableWebcams.length === 0) {
        alert('No webcams available');
        return;
      }

      // For now, just cycle through available webcams
      const currentIndex = availableWebcams.findIndex(w => w.id === sprite.id);
      const nextIndex = (currentIndex + 1) % availableWebcams.length;
      const selectedWebcam = availableWebcams[nextIndex];

      try {
        // Stop current stream
        if (sprite.videoStream) {
          sprite.videoStream.getTracks().forEach(track => track.stop());
        }

        // Clean up current video element
        cleanupVideoElement(spriteId);

        // Get new webcam stream
        const newStream = await startWebcamAndGetStream(selectedWebcam.id);
        const newVideoElement = createVideoElement(spriteId, newStream);

        // Update sprite with new stream
        setSprites(prev => prev.map(s => 
          s.id === spriteId 
            ? { ...s, videoStream: newStream, videoElement: newVideoElement, name: selectedWebcam.name }
            : s
        ));

        console.log(`Changed webcam source for sprite ${spriteId} to ${selectedWebcam.name}`);
      } catch (error) {
        console.error('Failed to change webcam source:', error);
        alert('Failed to change webcam source');
      }
    } else if (sprite.type === 'monitor') {
      // For screen capture, we can't easily change the source
      alert('Screen capture source cannot be changed. Please delete and add a new screen sprite.');
    }
  };

  // Select output folder
  const selectOutputFolder = async () => {
    try {
      const selectedFolder = await open({
        directory: true,
        title: 'Select Recording Output Folder'
      });
      
      if (selectedFolder) {
        setOutputFolder(selectedFolder as string);
        console.log('Selected output folder:', selectedFolder);
      }
    } catch (error) {
      console.error('Failed to select output folder:', error);
      alert('Failed to select output folder');
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      if (!outputFolder) {
        alert('Please select an output folder first');
        return;
      }

      // Get the canvas element from CanvasPreview
      const canvasElement = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvasElement) {
        alert('Canvas not found. Please ensure the preview is loaded.');
        return;
      }

      // Collect all audio streams from voice sources
      const audioStreams = sprites
        .filter(sprite => sprite.type === 'voice' && sprite.audioStream)
        .map(sprite => sprite.audioStream!)
        .filter(stream => stream.getAudioTracks().length > 0);

      console.log('Found audio streams for recording:', audioStreams.length);

      // Create canvas recorder
      const recorder = new CanvasRecorder(canvasElement);
      setCanvasRecorder(recorder);

      // Start recording with audio streams and sprites
      await recorder.startRecording(audioStreams, sprites);

      setRecordingState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        outputPath: outputFolder
      });

      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('Canvas recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${error}`);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      if (!canvasRecorder) {
        alert('No active recording to stop');
        return;
      }

      // Stop canvas recording
      const { blob: videoBlob, mimeType } = await canvasRecorder.stopRecording();
      
      // Generate filename with timestamp and correct extension
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `ClipForge_Recording_${timestamp}.${extension}`;
      const filePath = `${outputFolder}/${filename}`;

      // Convert blob to array buffer for Tauri
      const arrayBuffer = await videoBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Save file using Tauri
      await invoke('save_video', {
        filePath: filePath,
        data: Array.from(uint8Array)
      });

      // Reset recording state
      setRecordingState({
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        outputPath: ''
      });

      setRecordingTime(0);
      
      // Clean up recorder
      if (canvasRecorder) {
        canvasRecorder.cleanup();
      }
      setCanvasRecorder(null);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      alert(`🎉 Recording Complete!\n\nYour video has been saved to:\n${filePath}\n\nDuration: ${formatTime(recordingTime)}`);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert(`Failed to stop recording: ${error}`);
    }
  };

  // Toggle pause
  const togglePause = async () => {
    try {
      if (recordingState.isPaused) {
        await invoke('resume_recording');
      } else {
        await invoke('pause_recording');
      }

      setRecordingState(prev => ({
        ...prev,
        isPaused: !prev.isPaused
      }));
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update video streams in sprites
  useEffect(() => {
    setSprites(prev => prev.map(sprite => {
      const newStream = sprite.type === 'monitor' ? screenStream : webcamStream;
      
      // Only update if stream actually changed and sprite doesn't already have a video element
      if (newStream && newStream !== sprite.videoStream && !sprite.videoElement) {
        console.log(`Updating stream for sprite ${sprite.id}, type: ${sprite.type}`);
        
        // Create new video element
        const videoElement = createVideoElement(sprite.id, newStream);
        
        return {
          ...sprite,
          videoStream: newStream,
          videoElement: videoElement
        };
      }
      
      return sprite;
    }));
  }, [screenStream, webcamStream]);

  useEffect(() => {
    loadMonitors();
    loadWebcamDevices();
    loadAudioDevices();
    
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      // Clean up all video elements
      Object.keys(videoElementsRef.current).forEach(spriteId => {
        cleanupVideoElement(spriteId);
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎬 Canvas Recording Studio</h1>
              <p className="text-sm text-gray-600 mt-1">Canvas-based sprites with center origin (0,0) • Drag, resize, rotate • Records at 1920x1080</p>
            </div>
            
            {/* Recording Controls */}
            <div className="space-y-4">
              {/* Output Folder Selection */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 min-w-0">
                  Output:
                </label>
                <input
                  type="text"
                  value={outputFolder || 'No folder selected'}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={selectOutputFolder}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Choose Folder
                </button>
              </div>

              <div className="flex items-center space-x-4">
                {recordingState.isRecording && (
                  <div className="flex items-center space-x-3 bg-red-50 px-4 py-2 rounded-lg">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-700">
                      Recording: {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
                
                <div className="flex space-x-2">
                  {!recordingState.isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={!outputFolder}
                      className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg shadow-lg"
                    >
                      🔴 Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium text-lg shadow-lg"
                    >
                      ⏹️ Stop Recording
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Add Sources */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🎮 Add Sprites</h2>
              
              {/* Screen Recording */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Screen Sprite</h3>
                <button
                  onClick={addScreenSprite}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>🖥️</span>
                  <span>Add Screen Sprite</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Select screen or window to capture
                </p>
              </div>

              {/* Webcam */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Webcam Sprite</h3>
                <button
                  onClick={() => setWebcamDialogOpen(true)}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>📹</span>
                  <span>Add Webcam Sprite</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Choose which camera to use
                </p>
              </div>

              {/* Voice */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Voice Source</h3>
                <button
                  onClick={() => setVoiceDialogOpen(true)}
                  className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>🎤</span>
                  <span>Add Voice Source</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Audio-only source for recordings
                </p>
                
                {/* Voice Meters */}
                {sprites.filter(s => s.type === 'voice').length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-xs font-medium text-gray-600">Audio Levels</h4>
                    {sprites
                      .filter(s => s.type === 'voice')
                      .map(sprite => (
                        <div key={sprite.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{sprite.name}</div>
                            <VoiceMeter 
                              audioStream={sprite.audioStream} 
                              size="small" 
                              showLabel={true}
                            />
                          </div>
                          <button
                            onClick={() => removeSprite(sprite.id)}
                            className="ml-2 text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Active Sprites */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Active Sprites ({sprites.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sprites.map((sprite) => (
                    <div
                      key={sprite.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        sprite.isSelected ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {sprite.type === 'monitor' ? '🖥️' : sprite.type === 'webcam' ? '📹' : '🎤'}
                        </span>
                        <span className="text-sm font-medium">
                          {sprite.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round(sprite.width)}x{Math.round(sprite.height)}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({Math.round(sprite.x)}, {Math.round(sprite.y)})
                        </span>
                      </div>
                      <button
                        onClick={() => removeSprite(sprite.id)}
                        className="text-red-500 hover:text-red-700 text-lg"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {sprites.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No sprites added yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Canvas Controls</h3>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Click sprites to select them</li>
                <li>• Drag selected sprites to move</li>
                <li>• Drag blue handles to resize</li>
                <li>• 0,0 is at the center of canvas</li>
                <li>• Yellow = selected, Blue = unselected</li>
              </ul>
            </div>
          </div>

          {/* Center - Canvas Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🎨 Canvas Preview (1920x1080)</h2>
              
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
            <CanvasPreview
              sprites={sprites}
              onSpriteMove={handleSpriteMove}
              onSpriteResize={handleSpriteResize}
              onSpriteRotate={handleSpriteRotate}
              onSpriteSelect={handleSpriteSelect}
              onSpriteRemove={removeSprite}
              onSpriteMoveToFront={handleSpriteMoveToFront}
              onSpriteMoveToBack={handleSpriteMoveToBack}
              onSpriteChangeSource={handleSpriteChangeSource}
            />
              </div>

              {/* Preview Info */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  {screenStream && <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full mr-2">🖥️ Screen</span>}
                  {webcamStream && <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full">📹 Webcam</span>}
                  <span className="text-gray-500">Sprites: {sprites.length}</span>
                </div>
                <div>
                  Canvas • Center Origin • 1920x1080 • Desktop Save
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <WebcamSpriteDialog
        isOpen={webcamDialogOpen}
        onClose={() => setWebcamDialogOpen(false)}
        onConfirm={async (deviceId, deviceName) => {
          await addWebcamSpriteWithDevice(deviceId, deviceName);
        }}
        webcamDevices={webcamDevices}
        onRefreshDevices={loadWebcamDevices}
        isLoadingDevices={isLoadingDevices}
      />

      <VoiceSpriteDialog
        isOpen={voiceDialogOpen}
        onClose={() => setVoiceDialogOpen(false)}
        onConfirm={async (deviceId, deviceName) => {
          await addVoiceSourceWithDevice(deviceId, deviceName);
        }}
        audioDevices={audioDevices}
        onRefreshDevices={loadAudioDevices}
        isLoadingDevices={isLoadingDevices}
      />
    </div>
  );
};

export default CanvasRecordingStudio;
