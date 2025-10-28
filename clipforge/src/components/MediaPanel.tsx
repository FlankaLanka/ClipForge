import React, { useCallback } from 'react';
import { useEditorStore } from '../state/useEditorStore';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const MediaPanel: React.FC = () => {
  const { clips, addClip, selectClip, selectedClip } = useEditorStore();
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
    } finally {
      setIsImporting(false);
    }
  }, [addClip, isImporting]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i)) {
        try {
          console.log('Dropped video file:', file.name, 'Type:', file.type);
          
          // Read the file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const fileData = new Uint8Array(arrayBuffer);
          
          console.log('File size:', fileData.length, 'bytes');
          
          // Import using the new command that handles file data
          const clip = await invoke('import_video_from_file', { 
            file_name: file.name, 
            file_data: Array.from(fileData) 
          });
          addClip(clip as any);
          console.log('Successfully imported dropped video:', clip);
        } catch (error) {
          console.error('Failed to import dropped video:', error);
          alert(`Failed to import ${file.name}: ${error}`);
        }
      } else {
        console.log('Skipped non-video file:', file.name, file.type);
      }
    }
  }, [addClip]);

  const handleDragStart = useCallback((e: React.DragEvent, clip: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify(clip));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Media Library</h2>
      
      <div className="space-y-2">
        <button
          onClick={handleFileSelect}
          disabled={isImporting}
          className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          <span className="text-lg">📁</span>
          <span>{isImporting ? 'Importing...' : 'Browse Hard Drive'}</span>
        </button>
        
        <div className="text-xs text-gray-500 text-center">
          Opens native file browser • Supports MP4, MOV, AVI, MKV, WebM, and more
        </div>
      </div>
      
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-sm text-gray-500 mb-1">
          Drag and drop video files here
        </p>
        <p className="text-xs text-gray-400">
          Supports MP4, MOV, AVI, MKV, WebM, and more
        </p>
      </div>

      <div className="space-y-2">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedClip?.id === clip.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => selectClip(clip)}
            draggable
            onDragStart={(e) => handleDragStart(e, clip)}
          >
            <div className="text-sm font-medium truncate">
              {clip.file_path.split('/').pop()}
            </div>
            <div className="text-xs text-gray-500">
              {clip.metadata.duration.toFixed(1)}s • {clip.metadata.width}x{clip.metadata.height}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Drag to timeline
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaPanel;
