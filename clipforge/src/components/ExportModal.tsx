import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTimelineStore } from '../state/timelineStore';
import { save } from '@tauri-apps/plugin-dialog';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { clips: timelineClips } = useTimelineStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [outputPath, setOutputPath] = useState('');
  const [resolution, setResolution] = useState('1080p');

  const handleBrowseFile = async () => {
    try {
      // Generate a timestamped filename
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultName = `clipforge_export_${timestamp}.mp4`;
      
      const result = await save({
        defaultPath: `~/Desktop/${defaultName}`,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Save Video As'
      });
      
      if (result) {
        setOutputPath(result);
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      alert('Failed to open file dialog');
    }
  };

  const handleExport = async () => {
    if (timelineClips.length === 0) {
      alert('No clips in timeline to export');
      return;
    }

    if (!outputPath) {
      alert('Please select an output file path');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Convert TimelineClip to VideoClip format for the backend
      // This includes the actual timeline positioning and trimming
      const videoClips = timelineClips.map(clip => ({
        id: clip.id,
        file_path: clip.src,
        metadata: {
          duration: clip.originalDuration,
          width: clip.width,
          height: clip.height,
          fps: clip.fps,
          file_size: 0, // We don't have this in TimelineClip
          format: 'mp4' // Assume MP4 for now
        },
        // Timeline positioning
        start_time: clip.startTime,
        end_time: clip.endTime,
        // Trimming information
        trim_in: clip.trimIn,
        trim_out: clip.trimOut
      }));

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const result = await invoke('export_timeline', {
        params: {
          clips: videoClips,
          output_path: outputPath,
          resolution: resolution
        }
      });

      clearInterval(progressInterval);
      setExportProgress(100);
      
      setTimeout(() => {
        setIsExporting(false);
        onClose();
        alert(`Video exported successfully to: ${result}`);
      }, 1000);

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error}`);
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Export Video</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Path
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Select output file..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isExporting}
              />
              <button
                type="button"
                onClick={handleBrowseFile}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isExporting}
            >
              <option value="720p">720p (1280x720)</option>
              <option value="1080p">1080p (1920x1080)</option>
              <option value="original">Original Resolution</option>
            </select>
          </div>

          <div>
            <p className="text-sm text-gray-600">
              Clips in timeline: {timelineClips.length}
            </p>
          </div>

          {isExporting && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Exporting...</span>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleExport}
              disabled={isExporting || timelineClips.length === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? 'Exporting...' : 'Export Video'}
            </button>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
