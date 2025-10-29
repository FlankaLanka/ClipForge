import React, { useCallback } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { useTimelineStore } from '../state/timelineStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Upload, Video, Plus } from 'lucide-react';

const MediaPanel: React.FC = () => {
  const { clips, addClip, selectClip, selectedClip } = useEditorStore();
  const timelineStore = useTimelineStore();
  const [isImporting, setIsImporting] = React.useState(false);

  const handleFileSelect = useCallback(async () => {
    if (isImporting) return;
    
    setIsImporting(true);
    try {
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
        }]
      });

      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        for (const filePath of files) {
          try {
            const clip = await invoke('import_video', { filePath });
            addClip(clip as any);
            // Note: Videos are no longer automatically added to timeline
            // Users can double-click on imported videos to add them to timeline
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
      
      // Note: Mock clips are no longer automatically added to timeline
      // Users can double-click on imported videos to add them to timeline
    } finally {
      setIsImporting(false);
    }
  }, [addClip, isImporting]);

  const handleDoubleClick = useCallback((clip: any) => {
    // Add video to timeline when double-clicked
    const timelineClip = {
      src: clip.file_path,
      name: clip.file_path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled',
      startTime: timelineStore.getTimelineDuration(),
      endTime: timelineStore.getTimelineDuration() + clip.metadata.duration,
      trimIn: 0,
      trimOut: clip.metadata.duration,
      duration: clip.metadata.duration, // Add duration property
      originalDuration: clip.metadata.duration,
      width: clip.metadata.width,
      height: clip.metadata.height,
      fps: clip.metadata.fps,
      color: '#3b82f6', // Blue color
    };
    
    timelineStore.addClip(timelineClip);
    console.log('Added to timeline via double-click:', timelineClip);
  }, [timelineStore]);

  // Check if a clip is already on the timeline
  const isClipOnTimeline = useCallback((clip: any) => {
    return timelineStore.clips.some(timelineClip => timelineClip.src === clip.file_path);
  }, [timelineStore.clips]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <button
          onClick={handleFileSelect}
          disabled={isImporting}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mx-auto"
        >
          <Upload className="w-4 h-4" />
          {isImporting ? 'Importing...' : 'Import Videos'}
        </button>
      </div>

      {/* Video List - One per row, full width */}
      <div className="space-y-3">
        {clips.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No videos imported yet</p>
            <p className="text-sm">Click "Import Videos" to get started</p>
          </div>
        ) : (
          clips.map((clip) => {
            const isOnTimeline = isClipOnTimeline(clip);
            return (
              <div
                key={clip.id}
                className={`relative group cursor-pointer rounded-xl overflow-hidden shadow-md transition-all duration-200 hover:shadow-lg w-full ${
                  isOnTimeline 
                    ? 'ring-2 ring-green-400 bg-green-50' 
                    : 'hover:ring-2 hover:ring-blue-400 bg-white'
                }`}
                onClick={() => selectClip(clip.id)}
                onDoubleClick={() => handleDoubleClick(clip)}
                title={isOnTimeline ? 'On Timeline - Double-click to add again' : 'Double-click to add to timeline'}
              >
                <div className="p-4 w-full">
                  {/* Top row: Thumbnail and Timeline Status */}
                  <div className="flex items-center justify-between mb-3">
                    {/* Video Thumbnail Placeholder */}
                    <div className={`w-16 h-10 bg-gradient-to-br ${
                      isOnTimeline 
                        ? 'from-green-400 to-green-600' 
                        : 'from-blue-400 to-blue-600'
                    } rounded flex items-center justify-center`}>
                      <Video className="w-6 h-6 text-white" />
                    </div>

                    {/* Timeline Status */}
                    <div className="flex items-center gap-2">
                      {isOnTimeline ? (
                        <>
                          <span className="text-lg text-green-600 font-bold">✓</span>
                          <Plus className="w-4 h-4 text-green-600" />
                        </>
                      ) : (
                        <Plus className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Bottom section: Video Info - Full width for text */}
                  <div className="w-full space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 break-words">
                      {clip.file_path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Untitled'}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium w-16">Duration:</span>
                        <span className="font-mono">{(clip as any).metadata?.duration?.toFixed(1) || 'Unknown'}s</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium w-16">Size:</span>
                        <span className="font-mono">{(clip as any).metadata?.width || 'Unknown'}x{(clip as any).metadata?.height || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium w-16">FPS:</span>
                        <span className="font-mono">{Math.round((clip as any).metadata?.fps) || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {selectedClip?.id === clip.id && (
                    <div className="absolute inset-0 ring-2 ring-blue-500 rounded-xl pointer-events-none" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MediaPanel;
