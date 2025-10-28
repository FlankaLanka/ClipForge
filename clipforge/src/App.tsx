import React, { useState } from "react";
import "./App.css";
import { useEditorStore } from "./state/useEditorStore";
import { useTimelineStore } from "./state/timelineStore";
import MediaPanel from "./components/MediaPanel";
import { Timeline } from "./components/Timeline";
import RecordingTab from "./components/RecordingTab";
import ExportModal from "./components/ExportModal";
import HelpModal from "./components/HelpModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

const App: React.FC = () => {
  console.log('App component rendering...');
  const { clips, timelineClips } = useEditorStore();
  const { clips: timelineClipsNew, getTimelineDuration } = useTimelineStore();
  console.log('Current clips count:', clips.length);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'recording'>('editor');
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            ClipForge Video Editor 🎬
          </h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Timeline: {timelineClipsNew.length} clips • {getTimelineDuration().toFixed(1)}s
            </div>
            <button
              onClick={() => setShowHelpModal(true)}
              className="bg-gray-500 text-white px-3 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Help
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={timelineClipsNew.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Export Video
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('editor')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'editor'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Video Editor
              </button>
              <button
                onClick={() => setActiveTab('recording')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'recording'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Recording Studio
              </button>
            </nav>
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'editor' ? (
          <>
            {/* Main Timeline Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Media Library */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <MediaPanel />
                </div>
              </div>

              {/* Main Timeline with 1920x1080 Preview */}
              <div className="lg:col-span-4">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="space-y-4">
                    {/* Timeline Header */}
                    <div className="flex items-center justify-between p-6 pb-0">
                      <h2 className="text-xl font-semibold text-gray-800">Timeline</h2>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-500">
                          Imported videos are automatically added to timeline
                        </div>
                      </div>
                    </div>
                    
                    {/* Timeline Component with 1920x1080 Preview */}
                    <Timeline />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <RecordingTab />
        )}
      </div>
      
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
      />
      
      <HelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
};

export default App;
