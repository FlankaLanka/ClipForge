import { useState, useEffect, useRef } from 'react';
import { VideoClip, VideoClipData } from './VideoClip';
import { TimeRuler } from './TimeRuler';
import { ScrubbablePlayhead } from './ScrubbablePlayhead';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { useTimelineStore } from '../state/timelineStore';
import { invoke } from '@tauri-apps/api/core';

export function Timeline() {
  const {
    clips: timelineClips,
    playheadTime,
    setPlayheadTime,
    zoomLevel,
    setZoomLevel,
    addClip,
    moveClip,
    trimClip,
    splitClip,
    deleteClip,
    selectClip,
    clearSelection,
    selectedClipIds,
    getTimelineDuration,
  } = useTimelineStore();

  // Convert timeline clips to VideoClipData format
  const clips: VideoClipData[] = timelineClips.map(clip => ({
    id: clip.id,
    name: clip.name,
    startTime: clip.startTime,
    duration: clip.duration, // Use duration from store (already calculated)
    color: clip.color,
    trimStart: clip.trimIn,
    trimEnd: clip.trimOut, // This should be the absolute trim end, not relative
    originalDuration: clip.originalDuration,
  }));

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(playheadTime);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [scale, setScale] = useState(40); // pixels per second
  const [currentClip, setCurrentClip] = useState<TimelineClip | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastDisplayUpdate = useRef(0);

  // Sync currentTime with playheadTime from store
  useEffect(() => {
    setCurrentTime(playheadTime);
  }, [playheadTime]);

  // High-performance display time update (60fps)
  useEffect(() => {
    const now = performance.now();
    if (now - lastDisplayUpdate.current > 16.67) { // Update at 60fps
      setDisplayTime(currentTime);
      lastDisplayUpdate.current = now;
    }
  }, [currentTime]);

  // Ensure scale is within bounds when clips change
  useEffect(() => {
    const currentMinZoom = calculateMinZoom();
    if (scale < currentMinZoom) {
      setScale(currentMinZoom);
    }
  }, [clips, scale]);

  // Load video file and create blob URL
  const loadVideoFile = async (filePath: string) => {
    if (filePath.startsWith('blob:')) {
      setVideoBlobUrl(filePath);
      return filePath;
    }
    try {
      // Clean up previous blob URL
      if (videoBlobUrl && videoBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoBlobUrl);
      }
      
      console.log('Loading video file:', filePath);
      const fileData = await invoke('read_file_bytes', { filePath });
      console.log('File data length:', fileData.length, 'bytes');
      
      // Detect video format from file extension
      const extension = filePath.toLowerCase().split('.').pop();
      let mimeType = 'video/mp4'; // default
      
      switch (extension) {
        case 'mp4':
          mimeType = 'video/mp4';
          break;
        case 'webm':
          mimeType = 'video/webm';
          break;
        case 'mov':
          mimeType = 'video/quicktime';
          break;
        case 'avi':
          mimeType = 'video/x-msvideo';
          break;
        case 'mkv':
          mimeType = 'video/x-matroska';
          break;
        default:
          mimeType = 'video/mp4';
      }
      
      // Create blob with proper MIME type
      // Ensure we have proper binary data
      const binaryData = new Uint8Array(fileData);
      const blob = new Blob([binaryData], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl, 'with MIME type:', mimeType, 'blob size:', blob.size);
      setVideoBlobUrl(blobUrl);
      
      // Preload video for smooth playback
      const video = videoRef.current;
      if (video) {
        video.load();
        video.preload = 'auto';
        
        // Add event listeners for debugging
        video.addEventListener('loadedmetadata', () => {
          console.log('Video metadata loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });
        });
        
        video.addEventListener('error', (e) => {
          console.error('Video error:', e);
        });
        
        video.addEventListener('canplay', () => {
          console.log('Video can play');
        });
      }
      
      return blobUrl;
    } catch (error) {
      console.error('Failed to load video file:', error);
      return null;
    }
  };

  // Find current clip at playhead position - optimized to reduce unnecessary updates
  useEffect(() => {
    const clip = timelineClips.find(
      (clip) => currentTime >= clip.startTime && currentTime < clip.endTime
    );
    
    // Only update if the clip actually changed
    if (clip?.id !== currentClip?.id) {
      setCurrentClip(clip || null);
    }
  }, [currentTime, timelineClips, currentClip]);

  // Load video when clip changes
  useEffect(() => {
    if (currentClip) {
      loadVideoFile(currentClip.src);
    } else {
      setVideoBlobUrl(null);
    }
  }, [currentClip]);

  // Optimized video sync with high-performance playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    const relativeTime = currentTime - currentClip.startTime + currentClip.trimIn;
    
    // Only seek if the difference is significant (reduces constant seeking)
    if (Math.abs(video.currentTime - relativeTime) > 0.2) {
      video.currentTime = Math.max(0, relativeTime);
    }

    // Handle play/pause state
    if (isPlaying && video.paused) {
      video.play().catch(console.error);
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [currentTime, currentClip, isPlaying]);

  // High-performance video sync using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !currentClip) return;

    let animationId: number;
    let lastSyncTime = 0;
    
    const syncVideo = () => {
      const video = videoRef.current;
      if (!video || video.paused) return;

      const now = performance.now();
      // Throttle sync to 60fps max
      if (now - lastSyncTime < 16.67) {
        animationId = requestAnimationFrame(syncVideo);
        return;
      }
      lastSyncTime = now;

      const relativeTime = currentTime - currentClip.startTime + currentClip.trimIn;
      const timeDiff = Math.abs(video.currentTime - relativeTime);
      
      // Only seek if significantly out of sync (reduces micro-seeks)
      if (timeDiff > 0.05) { // Reduced threshold for better sync
        video.currentTime = Math.max(0, relativeTime);
      }
      
      animationId = requestAnimationFrame(syncVideo);
    };

    animationId = requestAnimationFrame(syncVideo);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentClip, currentTime]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (videoBlobUrl && videoBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);

  const maxTime = Math.max(
    ...clips.map((clip) => clip.startTime + clip.duration),
    getTimelineDuration(),
    20
  );
  // Single track timeline - no need to calculate track count

  // Calculate minimum zoom based on video length (5x more zoomed out)
  const calculateMinZoom = () => {
    const longestVideo = Math.max(...clips.map(clip => clip.originalDuration), 0);
    const minTimeSeconds = Math.max(60, longestVideo * 2);
    const timelineWidth = 800; // Approximate timeline width
    return Math.max(4, timelineWidth / minTimeSeconds); // Reduced from 20 to 4 (5x lower)
  };

  const minZoom = calculateMinZoom();
  const maxZoom = 80;

  const checkCollision = (
    clipId: string,
    startTime: number,
    duration: number
  ): boolean => {
    const clipEnd = startTime + duration;
    return clips.some((clip) => {
      if (clip.id === clipId) return false;
      const otherEnd = clip.startTime + clip.duration;
      return !(clipEnd <= clip.startTime || startTime >= otherEnd);
    });
  };

  const updateClipPosition = (id: string, newStartTime: number) => {
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;

    const clampedStartTime = Math.max(0, newStartTime);

    // Check for collision
    if (checkCollision(id, clampedStartTime, clip.duration)) {
      return; // Don't update if there's a collision
    }

    // Update in timeline store
    moveClip(id, clampedStartTime);
  };

  // Legacy trim function - kept for compatibility
  const updateClipTrim = (id: string, trimStart: number, trimEnd: number) => {
    trimClip(id, trimStart, trimEnd);
  };

  const handleSplitClip = (id: string) => {
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;

    const splitPoint = clip.duration / 2;
    splitClip(id, clip.startTime + splitPoint);
    setSelectedClipId(null);
  };

  const handleDeleteClip = (id: string) => {
    deleteClip(id);
    if (selectedClipId === id) {
      setSelectedClipId(null);
    }
  };

  const handleSelectClip = (id: string) => {
    setSelectedClipId(id);
    selectClip(id);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSkipToStart = () => {
    setCurrentTime(0);
    setPlayheadTime(0);
  };

  const handleSkipToEnd = () => {
    setCurrentTime(maxTime);
    setPlayheadTime(maxTime);
  };

  const handleTimeChange = (newTime: number) => {
    setCurrentTime(newTime);
    setPlayheadTime(newTime);
  };

  const handleZoomChange = (newScale: number) => {
    const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));
    setScale(clampedScale);
    // Convert scale to zoom level (scale minZoom-maxZoom maps to zoom 0.1-2.0)
    const zoomLevel = (clampedScale - minZoom) / (maxZoom - minZoom) * 1.9 + 0.1;
    setZoomLevel(zoomLevel);
  };

  // Auto-play functionality - optimized for smooth 60fps
  useEffect(() => {
    if (!isPlaying) return;

    let animationId: number;
    let lastTime = performance.now();
    
    const updateTime = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      setCurrentTime(prev => {
        const newTime = prev + deltaTime;
        if (newTime >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        setPlayheadTime(newTime);
        return newTime;
      });
      
      animationId = requestAnimationFrame(updateTime);
    };

    animationId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, maxTime, setPlayheadTime]);

  return (
    <div className="bg-white border-t border-gray-300 flex flex-col">
      {/* Video Preview - 1920x1080 Aspect Ratio */}
      <div className="relative bg-black flex items-center justify-center" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
        {videoBlobUrl && currentClip ? (
          <div className="w-full h-full relative" style={{ minWidth: '100%', minHeight: '100%' }}>
            <video
              ref={videoRef}
              src={videoBlobUrl}
              className="w-full h-full"
              controls={false}
              muted
              preload="auto"
              playsInline
              disablePictureInPicture
              crossOrigin="anonymous"
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                willChange: 'transform',
                transform: 'translateZ(0)', // Force hardware acceleration
                backfaceVisibility: 'hidden',
                perspective: '1000px',
                  // High quality rendering
                  imageRendering: 'high-quality'
              }}
            />
            <div className="absolute top-4 left-4 text-white text-sm bg-black/70 px-3 py-2 rounded-lg font-medium">
              {currentClip.name} - {displayTime.toFixed(1)}s
            </div>
            <div className="absolute top-4 right-4 text-white text-sm bg-black/70 px-3 py-2 rounded-lg font-medium">
              {Math.floor(displayTime / 60)}:{(displayTime % 60).toFixed(1).padStart(4, '0')}
            </div>
          </div>
        ) : (
          <div className="text-white text-center">
            <div className="text-6xl mb-4">🎬</div>
            <div className="text-xl font-semibold mb-2">No video selected</div>
            <div className="text-lg text-gray-300 mb-4">Import videos to see preview</div>
            {clips.length > 0 && (
              <div className="text-sm text-gray-400 bg-black/30 px-4 py-2 rounded-lg inline-block">
                {clips.length} clips available - click play to start
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-12 bg-gray-50 border-b border-gray-300 flex items-center px-4 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={handleSkipToStart}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={handlePlayPause}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={handleSkipToEnd}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Zoom:</span>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            value={Math.max(minZoom, Math.min(maxZoom, scale))}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="h-80 overflow-auto">
        <div className="relative" style={{ minWidth: 48 + maxTime * scale }}>
          {/* Time ruler with dynamic scales */}
          <TimeRuler
            duration={maxTime}
            scale={scale}
            currentTime={currentTime}
            onTimeChange={handleTimeChange}
            trackLabelWidth={48}
          />
          
          {/* Scrubbable playhead */}
          <ScrubbablePlayhead
            currentTime={currentTime}
            duration={maxTime}
            scale={scale}
            trackLabelWidth={48}
            onTimeChange={handleTimeChange}
            isPlaying={isPlaying}
          />

          {/* Single Timeline Track */}
          <div className="relative">
            <div className="h-16 border-b border-gray-200 relative bg-gray-50">
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r border-gray-300 flex items-center justify-center">
                <span className="text-xs text-gray-600">Timeline</span>
              </div>
            </div>

            {/* Video clips */}
            {clips.map((clip) => (
              <VideoClip
                key={clip.id}
                clip={clip}
                scale={scale}
                isSelected={selectedClipId === clip.id}
                onSelect={() => handleSelectClip(clip.id)}
                onUpdatePosition={updateClipPosition}
                onUpdateTrim={updateClipTrim}
                onSplit={handleSplitClip}
                onDelete={handleDeleteClip}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
