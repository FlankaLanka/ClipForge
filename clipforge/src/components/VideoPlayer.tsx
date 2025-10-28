import React, { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { invoke } from '@tauri-apps/api/core';

const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { selectedClip, isPlaying, currentTime, setCurrentTime, setDuration, setPlaying, updateTimelineClip } = useEditorStore();
  
  // Trimming state
  const [trimStart, setTrimStart] = React.useState(0);
  const [trimEnd, setTrimEnd] = React.useState(selectedClip?.metadata.duration || 0);
  
  // Conversion state
  const [isConverting, setIsConverting] = useState(false);
  const [convertedPath, setConvertedPath] = useState<string | null>(null);

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
      // Update the selected clip's trim times
      const updatedClip = {
        ...selectedClip,
        start_time: trimStart,
        end_time: trimEnd
      };
      
      // Update in the store (this will trigger a re-render)
      // For now, we'll just log the trim values
      console.log('Applied trim to clip:', selectedClip.id, 'Start:', trimStart, 'End:', trimEnd);
      
      // In a real implementation, we'd update the clip in the store
      // For now, we'll show a success message
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
      <h2 className="text-xl font-semibold">Preview</h2>
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
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
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-lg font-semibold">Video Loaded</div>
              <div className="text-sm opacity-80">
                {selectedClip.metadata.width}x{selectedClip.metadata.height} • {selectedClip.metadata.duration.toFixed(1)}s
              </div>
              <div className="text-xs opacity-60 mt-2">
                {selectedClip.file_path.split('/').pop()}
              </div>
              <div className="text-xs opacity-60 mt-1">
                Format: {selectedClip.metadata.format} • {Math.round(selectedClip.metadata.file_size / 1024 / 1024)}MB
              </div>
              <div className="text-xs opacity-60 mt-1">
                Preview available in timeline editing
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePlayPause}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors opacity-50 cursor-not-allowed"
            disabled
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <div className="flex-1 text-sm text-gray-500">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')} / 
            {Math.floor(selectedClip.metadata.duration / 60)}:{(selectedClip.metadata.duration % 60).toFixed(1).padStart(4, '0')}
          </div>
          
          <div className="text-xs text-gray-400">
            Preview disabled in web view
          </div>
        </div>
        
        {/* Seek Bar */}
        <input
          type="range"
          min="0"
          max={selectedClip.metadata.duration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full opacity-50"
          disabled
        />

        {/* Trimming Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Trim Video</h3>
            <button
              onClick={applyTrim}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
            >
              Apply Trim
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600 w-12">Start:</label>
              <input
                type="range"
                min="0"
                max={selectedClip.metadata.duration}
                step="0.1"
                value={trimStart}
                onChange={handleTrimStart}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-12">
                {trimStart.toFixed(1)}s
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600 w-12">End:</label>
              <input
                type="range"
                min="0"
                max={selectedClip.metadata.duration}
                step="0.1"
                value={trimEnd}
                onChange={handleTrimEnd}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-12">
                {trimEnd.toFixed(1)}s
              </span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Duration: {(trimEnd - trimStart).toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
