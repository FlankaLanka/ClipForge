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

      // Debug: Log the data being sent to export
      console.log('Exporting timeline with clips:', videoClips);
      console.log('Timeline clips from store:', timelineClips);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl border border-white/20 animate-scale-in">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-success rounded-xl flex items-center justify-center">
            <span className="text-xl">📤</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold gradient-text">Export Video</h2>
            <p className="text-sm text-gray-600">Save your timeline as a video file</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Output Path */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Output Path
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Select output file..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                disabled={isExporting}
              />
              <button
                type="button"
                onClick={handleBrowseFile}
                disabled={isExporting}
                className="btn-gradient px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all duration-300"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              disabled={isExporting}
            >
              <option value="720p">720p (1280x720)</option>
              <option value="1080p">1080p (1920x1080)</option>
              <option value="original">Original Resolution</option>
            </select>
          </div>

          {/* Timeline Info */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200/50">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gradient-primary rounded-full" />
              <span className="text-sm font-semibold text-gray-700">
                Timeline: {timelineClips.length} clips
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {isExporting && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-semibold text-gray-700">
                <span className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>Exporting...</span>
                </span>
                <span>{Math.round(exportProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              onClick={handleExport}
              disabled={isExporting || timelineClips.length === 0}
              className="btn-gradient-success flex-1 px-6 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <span>📤</span>
                  <span>Export Video</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
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
