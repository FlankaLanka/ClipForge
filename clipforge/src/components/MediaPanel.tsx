import React, { useCallback } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { useTimelineStore } from '../state/timelineStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Media Library</h2>
        <div className="text-sm text-gray-500">
          {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
        </div>
      </div>
      
      <div className="space-y-4">
        <button
          onClick={handleFileSelect}
          disabled={isImporting}
          className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-lg font-semibold">{isImporting ? 'Importing...' : 'Import Video Files'}</span>
        </button>
        
        {/* <div className="text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Click the button above to select video files
          </p>
          <div className="text-xs text-gray-500 bg-gray-50 px-4 py-2 rounded-lg inline-block">
            <span className="font-medium">Supported formats:</span> MP4, MOV, AVI, MKV, WebM, and more
          </div>
        </div> */}
      </div>

      <div className="space-y-3">
        {clips.map((clip) => (
            <div
              key={clip.id}
              className={`group p-4 rounded-lg border cursor-pointer transition-all duration-200 draggable ${
                selectedClip?.id === clip.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
              }`}
              onClick={() => selectClip(clip)}
              draggable
              onDragStart={(e) => handleDragStart(e, clip)}
            >
            <div className="flex items-start space-x-3">
              {/* Video Thumbnail Placeholder */}
              <div className="flex-shrink-0 w-16 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-md flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              
              {/* Clip Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {clip.file_path.split('/').pop()}
                  </h3>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                      {clip.metadata.format.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{Math.floor(clip.metadata.duration / 60)}:{(clip.metadata.duration % 60).toFixed(1).padStart(4, '0')}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span>{clip.metadata.width}×{clip.metadata.height}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 9h6m-6 4h6m-6 4h6" />
                    </svg>
                    <span>{(clip.metadata.file_size / 1024 / 1024).toFixed(1)}MB</span>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-blue-600 font-medium group-hover:text-blue-700">
                    Click to preview • Drag to timeline
                  </div>
                  {selectedClip?.id === clip.id && (
                    <div className="flex items-center space-x-1 text-xs text-blue-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Selected</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaPanel;
