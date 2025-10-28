import React, { useCallback } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { useTimelineStore } from '../state/timelineStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, Video } from 'lucide-react';

const MediaPanel: React.FC = () => {
  const { clips, addClip, selectClip, selectedClip } = useEditorStore();
  const { addClip: addTimelineClip, getTimelineDuration } = useTimelineStore();
  const [isImporting, setIsImporting] = React.useState(false);

  const handleFileSelect = useCallback(async () => {
    if (isImporting) return;
    
    try {
      setIsImporting(true);
      // Open file dialog to select video files
      const selected = await open({
        multiple: true,
        title: 'Select Video Files',
        defaultPath: '~/Desktop',
        filters: [{
          name: 'All Video Files',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'flv', 'wmv']
        }, {
          name: 'QuickTime Movies',
          extensions: ['mov']
        }, {
          name: 'MP4 Videos',
          extensions: ['mp4']
        }, {
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        
        for (const filePath of files) {
          try {
            console.log('Importing video:', filePath);
            const clip = await invoke('import_video', { filePath });
            addClip(clip as any);
            console.log('Successfully imported:', clip);
            
            // Automatically add to timeline
            const timelineClip = {
              src: (clip as any).file_path,
              name: filePath.split('/').pop() || 'Untitled',
              startTime: getTimelineDuration(),
              endTime: getTimelineDuration() + (clip as any).metadata.duration,
              trimIn: 0,
              trimOut: (clip as any).metadata.duration,
              originalDuration: (clip as any).metadata.duration,
              width: (clip as any).metadata.width,
              height: (clip as any).metadata.height,
              fps: (clip as any).metadata.fps,
              color: '#3b82f6', // Blue color
            };
            
            addTimelineClip(timelineClip);
            console.log('Automatically added to timeline:', timelineClip);
          } catch (error) {
            console.error('Failed to import video:', filePath, error);
            // Show user-friendly error
            alert(`Failed to import ${filePath}: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      // Fallback to mock clip for testing
      const mockClip = {
        id: 'mock-' + Date.now(),
        file_path: '/path/to/mock/video.mp4',
        metadata: {
          duration: 30.5,
          width: 1920,
          height: 1080,
          fps: 30,
          file_size: 1024000,
          format: 'mp4'
        },
        start_time: 0.0,
        end_time: 30.5
      };
      addClip(mockClip);
      console.log('Added mock clip for testing');
      
      // Also add mock clip to timeline
      const mockTimelineClip = {
        src: mockClip.file_path,
        name: 'Mock Video',
        startTime: getTimelineDuration(),
        endTime: getTimelineDuration() + mockClip.metadata.duration,
        trimIn: 0,
        trimOut: mockClip.metadata.duration,
        originalDuration: mockClip.metadata.duration,
        width: mockClip.metadata.width,
        height: mockClip.metadata.height,
        fps: mockClip.metadata.fps,
        color: '#3b82f6', // Blue color
      };
      
      addTimelineClip(mockTimelineClip);
      console.log('Added mock clip to timeline');
    } finally {
      setIsImporting(false);
    }
  }, [addClip, addTimelineClip, getTimelineDuration, isImporting]);

  const handleDragStart = useCallback((e: React.DragEvent, clip: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(clip));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Media</h2>
        <div className="text-sm text-gray-500">
          {clips.length}
        </div>
      </div>
      
      {/* Import Button */}
      <button
        onClick={handleFileSelect}
        disabled={isImporting}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all duration-300"
      >
        {isImporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Importing...</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            <span>Import Videos</span>
          </>
        )}
      </button>

      {/* Video Clips List */}
      <div className="space-y-2">
        {clips.length === 0 ? (
          <div className="text-center py-6">
            <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No videos yet</p>
          </div>
        ) : (
          clips.map((clip) => (
            <div
              key={clip.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 draggable ${
                selectedClip?.id === clip.id
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 bg-white'
              }`}
              onClick={() => selectClip(clip)}
              draggable
              onDragStart={(e) => handleDragStart(e, clip)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <Video className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {clip.file_path.split('/').pop()?.replace(/\.[^/.]+$/, '')}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {Math.floor(clip.metadata.duration / 60)}:{(clip.metadata.duration % 60).toFixed(1).padStart(4, '0')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MediaPanel;
