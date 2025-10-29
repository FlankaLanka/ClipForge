import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { invoke } from '@tauri-apps/api/core';

const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { selectedClip, isPlaying, currentTime, setCurrentTime, setDuration, setPlaying, updateClip } = useEditorStore();
  
  // Trimming state
  const [trimStart, setTrimStart] = React.useState(0);
  const [trimEnd, setTrimEnd] = React.useState(selectedClip?.metadata.duration || 0);
  
  // Conversion state
  const [isConverting, setIsConverting] = useState(false);
  const [convertedPath, setConvertedPath] = useState<string | null>(null);
  
  // Video blob URL state
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  // Load video file and create blob URL
  const loadVideoFile = async (filePath: string) => {
    try {
      console.log('Loading video file:', filePath);
      
      // Read the file using Tauri's filesystem API
      const fileData = await invoke('read_file_bytes', { filePath });
      const uint8Array = new Uint8Array(fileData as number[]);
      
      // Create blob from file data
      const blob = new Blob([uint8Array], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      
      console.log('Created blob URL:', blobUrl);
      setVideoBlobUrl(blobUrl);
      
      return blobUrl;
    } catch (error) {
      console.error('Failed to load video file:', error);
      return null;
    }
  };

  // Load video when selectedClip changes
  useEffect(() => {
    if (selectedClip) {
      if (selectedClip.file_path.startsWith('/path/to/mock/')) {
        // Mock video - no need to load
        return;
      } else if (selectedClip.file_path.startsWith('blob:')) {
        // Blob URL - use directly
        console.log('Using blob URL directly:', selectedClip.file_path);
        setVideoBlobUrl(selectedClip.file_path);
      } else {
        // Regular file path - load via Tauri
        loadVideoFile(selectedClip.file_path);
      }
    }
  }, [selectedClip]);

  // Cleanup blob URL when component unmounts or videoBlobUrl changes
  useEffect(() => {
    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [setCurrentTime, setDuration, setPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play();
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = currentTime;
  }, [currentTime]);

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
  };

  const handleTrimStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setTrimStart(time);
    if (time >= trimEnd) {
      setTrimEnd(time + 0.1);
    }
  };

  const handleTrimEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setTrimEnd(time);
    if (time <= trimStart) {
      setTrimStart(time - 0.1);
    }
  };

  const applyTrim = () => {
    if (selectedClip) {
      // Update the clip in the store
      updateClip(selectedClip.id, {
        start_time: trimStart,
        end_time: trimEnd
      });
      
      console.log('Applied trim to clip:', selectedClip.id, 'Start:', trimStart, 'End:', trimEnd);
      
      // Show success message
      alert(`Trim applied: ${trimStart.toFixed(1)}s - ${trimEnd.toFixed(1)}s`);
    }
  };

  const convertMovToMp4 = async () => {
    if (!selectedClip || !selectedClip.file_path.toLowerCase().endsWith('.mov')) return;
    
    try {
      setIsConverting(true);
      console.log('Converting .mov to .mp4:', selectedClip.file_path);
      
      const convertedPath = await invoke('convert_mov_to_mp4', { 
        inputPath: selectedClip.file_path 
      });
      
      setConvertedPath(convertedPath as string);
      console.log('Conversion successful:', convertedPath);
      
    } catch (error) {
      console.error('Conversion failed:', error);
      alert(`Conversion failed: ${error}`);
    } finally {
      setIsConverting(false);
    }
  };

  if (!selectedClip) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Preview</h2>
        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-2">No video selected</p>
            <p className="text-sm text-gray-500">
              Select a video from the media library to preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Video Preview</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded">
            {selectedClip.metadata.width}×{selectedClip.metadata.height}
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded">
            {selectedClip.metadata.fps.toFixed(1)} fps
          </span>
          <span className="px-2 py-1 bg-gray-100 rounded">
            {selectedClip.metadata.format.toUpperCase()}
          </span>
        </div>
      </div>
      
      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
        {selectedClip.file_path.startsWith('/path/to/mock/') ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-lg font-semibold">Mock Video</div>
              <div className="text-sm opacity-80">
                {selectedClip.metadata.width}x{selectedClip.metadata.height} • {selectedClip.metadata.duration.toFixed(1)}s
              </div>
            </div>
          </div>
        ) : selectedClip.file_path.toLowerCase().endsWith('.mov') && !convertedPath ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">🎥</div>
              <div className="text-lg font-semibold">QuickTime Movie</div>
              <div className="text-sm opacity-80">
                {selectedClip.metadata.width}x{selectedClip.metadata.height} • {selectedClip.metadata.duration.toFixed(1)}s
              </div>
              <div className="text-xs opacity-60 mt-2 mb-4">
                .mov files require conversion for web playback
              </div>
              <button
                onClick={convertMovToMp4}
                disabled={isConverting}
                className="bg-white text-orange-600 px-4 py-2 rounded-md hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isConverting ? 'Converting...' : 'Convert to MP4'}
              </button>
            </div>
          </div>
        ) : selectedClip.file_path.toLowerCase().endsWith('.mov') && convertedPath ? (
          <video
            ref={videoRef}
            src={`file://${convertedPath}`}
            className="w-full h-full object-contain"
            controls={false}
            onError={(e) => {
              console.error('Converted video load error:', e);
              console.log('Converted video path:', convertedPath);
            }}
            onLoadStart={() => {
              console.log('Converted video loading started:', convertedPath);
            }}
            onLoadedData={() => {
              console.log('Converted video loaded successfully:', convertedPath);
            }}
          />
        ) : videoBlobUrl ? (
          <video
            ref={videoRef}
            src={videoBlobUrl}
            className="w-full h-full object-contain"
            controls={false}
            onError={(e) => {
              console.error('Video load error:', e);
              console.log('Video blob URL:', videoBlobUrl);
            }}
            onLoadStart={() => {
              console.log('Video loading started:', videoBlobUrl);
            }}
            onLoadedData={() => {
              console.log('Video loaded successfully:', videoBlobUrl);
            }}
            onLoadedMetadata={() => {
              console.log('Video metadata loaded:', videoBlobUrl);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-500 to-orange-600">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">⏳</div>
              <div className="text-lg font-semibold">Loading Video...</div>
              <div className="text-sm opacity-80">
                {selectedClip.metadata.width}x{selectedClip.metadata.height} • {selectedClip.metadata.duration.toFixed(1)}s
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Professional Video Controls */}
      <div className="bg-white rounded-lg border shadow-sm">
        {/* Main Controls */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePlayPause}
                className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex items-center space-x-2 text-sm font-mono text-gray-600">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                </span>
                <span className="text-gray-400">/</span>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {Math.floor(selectedClip.metadata.duration / 60)}:{(selectedClip.metadata.duration % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Duration:</span>
              <span className="text-sm font-medium text-gray-700">
                {(selectedClip.metadata.duration - currentTime).toFixed(1)}s remaining
              </span>
            </div>
          </div>
          
          {/* Professional Seek Bar */}
          <div className="relative">
            <input
              type="range"
              min="0"
              max={selectedClip.metadata.duration}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / selectedClip.metadata.duration) * 100}%, #e5e7eb ${(currentTime / selectedClip.metadata.duration) * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0:00</span>
              <span>{Math.floor(selectedClip.metadata.duration / 60)}:{(selectedClip.metadata.duration % 60).toFixed(0).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Professional Trimming Controls */}
        <div className="p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">Trim Controls</h3>
            </div>
            <button
              onClick={applyTrim}
              className="flex items-center space-x-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Apply Trim</span>
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Start Time Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Start Time</label>
                <span className="text-sm font-mono text-gray-600 bg-white px-2 py-1 rounded border">
                  {Math.floor(trimStart / 60)}:{(trimStart % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={selectedClip.metadata.duration}
                  step="0.1"
                  value={trimStart}
                  onChange={handleTrimStart}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${(trimStart / selectedClip.metadata.duration) * 100}%, #e5e7eb ${(trimStart / selectedClip.metadata.duration) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            </div>
            
            {/* End Time Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">End Time</label>
                <span className="text-sm font-mono text-gray-600 bg-white px-2 py-1 rounded border">
                  {Math.floor(trimEnd / 60)}:{(trimEnd % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={selectedClip.metadata.duration}
                  step="0.1"
                  value={trimEnd}
                  onChange={handleTrimEnd}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${(trimEnd / selectedClip.metadata.duration) * 100}%, #e5e7eb ${(trimEnd / selectedClip.metadata.duration) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
            </div>
            
            {/* Trim Summary */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center space-x-4">
                <div className="text-sm">
                  <span className="text-gray-500">Trimmed Duration:</span>
                  <span className="ml-2 font-semibold text-gray-800">
                    {Math.floor((trimEnd - trimStart) / 60)}:{((trimEnd - trimStart) % 60).toFixed(1).padStart(4, '0')}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Removed:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    {Math.floor((selectedClip.metadata.duration - (trimEnd - trimStart)) / 60)}:{((selectedClip.metadata.duration - (trimEnd - trimStart)) % 60).toFixed(1).padStart(4, '0')}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {(((trimEnd - trimStart) / selectedClip.metadata.duration) * 100).toFixed(1)}% of original
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
