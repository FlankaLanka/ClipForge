import { useState, useEffect, useRef } from 'react';
import { VideoClip, VideoClipData } from './VideoClip';
import { TimeRuler } from './TimeRuler';
import { ScrubbablePlayhead } from './ScrubbablePlayhead';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';
import { useTimelineStore, TimelineClip } from '../state/timelineStore';
import { invoke } from '@tauri-apps/api/core';

export function Timeline() {
  const {
    clips: timelineClips,
    playheadTime,
    setPlayheadTime,
    setZoomLevel,
    moveClip,
    trimClip,
    splitClip,
    deleteClip,
    selectClip,
    clearSelection,
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

  // Optimized display time update (20fps for better performance)
  useEffect(() => {
    const now = performance.now();
    if (now - lastDisplayUpdate.current > 50) { // Update at 20fps
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
      const fileData = await invoke('read_file_bytes', { filePath }) as number[];
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
      
      // Optimize video loading for better performance
      const video = videoRef.current;
      if (video) {
        video.load();
        video.preload = 'metadata'; // Only load metadata, not full video
        
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
        
        // Optimize video settings for performance
        video.defaultPlaybackRate = 1.0;
        video.playbackRate = 1.0;
      }
      
      return blobUrl;
    } catch (error) {
      console.error('Failed to load video file:', error);
      return null;
    }
  };

  // Find current clip at playhead position - properly handle timeline parsing
  useEffect(() => {
    const clip = timelineClips.find(
      (clip) => {
        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration; // Use duration, not endTime
        return currentTime >= clipStartTime && currentTime < clipEndTime;
      }
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



  // Video sync - only when not playing (for scrubbing) or when clip changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentClip) return;

    // Calculate the correct video position based on timeline
    const timelinePosition = currentTime;
    const clipStartTime = currentClip.startTime;
    const clipEndTime = currentClip.startTime + currentClip.duration;
    
    // Check if we're within this clip's timeline range
    if (timelinePosition >= clipStartTime && timelinePosition <= clipEndTime) {
      // Calculate position within the trimmed video
      const positionInClip = timelinePosition - clipStartTime;
      const videoTime = currentClip.trimIn + positionInClip;
      const clampedVideoTime = Math.min(videoTime, currentClip.trimOut);
      
      // Only seek when not playing (for scrubbing) or when clip changes
      if (!isPlaying) {
        video.currentTime = Math.max(0, clampedVideoTime);
      }
      
      // Handle play/pause state
      if (isPlaying && video.paused) {
        // When starting playback, seek to correct position first
        video.currentTime = Math.max(0, clampedVideoTime);
        video.play().catch(console.error);
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    } else {
      // If we're outside this clip's range, pause the video
      if (!video.paused) {
        video.pause();
      }
    }
  }, [currentTime, currentClip, isPlaying]);

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
    10 // Minimum 10 seconds instead of 60
  );
  // Single track timeline - no need to calculate track count

  // Calculate minimum zoom based on video length (5x more zoomed out)
  const calculateMinZoom = () => {
    const longestVideo = Math.max(...clips.map(clip => clip.originalDuration), 0);
    const minTimeSeconds = Math.max(60, longestVideo * 2);
    const timelineWidth = 800; // Approximate timeline width
    return Math.max(1, timelineWidth / minTimeSeconds); // Reduced from 4 to 1 (4x more zoom out)
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

  const handleDeselectClip = () => {
    setSelectedClipId(null);
    clearSelection();
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

  // Simple auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    let animationId: number;
    let startTime = performance.now();
    let startTimelineTime = currentTime;
    
    const updateTime = () => {
      const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
      const newTime = startTimelineTime + elapsed;
      
      if (newTime >= maxTime) {
        setIsPlaying(false);
        setCurrentTime(maxTime);
        setPlayheadTime(maxTime);
        return;
      }
      
      setCurrentTime(newTime);
      setPlayheadTime(newTime);
      
      animationId = requestAnimationFrame(updateTime);
    };

    animationId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, maxTime, setPlayheadTime]);

  return (
    <div className="bg-white flex flex-col w-full">
      {/* Video Preview */}
      <div className="relative bg-gray-900 flex items-center justify-center m-4 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '400px' }}>
        {videoBlobUrl && currentClip ? (
          <div className="w-full h-full relative" style={{ minWidth: '100%', minHeight: '100%' }}>
                    <video
                      ref={videoRef}
                      src={videoBlobUrl}
                      className="w-full h-full rounded-lg"
                      controls={false}
                      muted
                      preload="metadata"
                      playsInline
                      disablePictureInPicture
                      crossOrigin="anonymous"
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        objectPosition: 'center'
                      }}
                    />
                    
                    {/* Video Info Overlay */}
                    <div className="absolute top-2 left-2 text-white text-xs bg-black/60 px-2 py-1 rounded font-mono">
                      {currentClip.name} - {displayTime.toFixed(1)}s
                    </div>
                    <div className="absolute top-2 right-2 text-white text-xs bg-black/60 px-2 py-1 rounded font-mono">
                      {Math.floor(displayTime / 60)}:{(displayTime % 60).toFixed(1).padStart(4, '0')}
                    </div>
                    {/* Timeline Position Info */}
                    <div className="absolute bottom-2 left-2 text-white text-xs bg-black/60 px-2 py-1 rounded font-mono">
                      Timeline: {currentTime.toFixed(1)}s
                    </div>
                    <div className="absolute bottom-2 right-2 text-white text-xs bg-black/60 px-2 py-1 rounded font-mono">
                      Clip: {currentClip.startTime.toFixed(1)}s - {(currentClip.startTime + currentClip.duration).toFixed(1)}s
                    </div>
          </div>
        ) : (
          <div className="text-white text-center">
            <div className="text-4xl mb-3">🎬</div>
            <div className="text-lg font-medium mb-2">No video selected</div>
            {clips.length > 0 && (
              <div className="text-sm text-white/80 bg-black/40 px-3 py-1 rounded">
                {clips.length} clips available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-4 gap-4">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-lg"
            onClick={handleSkipToStart}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg ${
              isPlaying 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-lg"
            onClick={handleSkipToEnd}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Timeline Info */}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white px-3 py-1 rounded border">
            <span className="text-sm font-mono text-gray-700">
              {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')} / {Math.floor(maxTime / 60)}:{(maxTime % 60).toFixed(1).padStart(4, '0')}
            </span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Zoom</span>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            value={Math.max(minZoom, Math.min(maxZoom, scale))}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="h-80 overflow-auto">
        <div 
          className="relative w-full" 
          style={{ minWidth: Math.max(800, 48 + Math.max(maxTime * 2, 120) * scale) }}
          onClick={handleDeselectClip}
        >
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
          <div className="relative w-full" style={{ minWidth: Math.max(800, 48 + Math.max(maxTime * 2, 120) * scale) }}>
                    <div className="h-16 border-b border-gray-200 relative bg-gray-50 w-full">
                      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r border-gray-300 flex items-center justify-center">
                        <span className="text-xs text-gray-600 font-medium">Tracks</span>
                      </div>
                      {/* Extend the track background to fill the full width */}
                      <div className="absolute left-12 top-0 bottom-0 right-0 bg-gray-50"></div>
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
