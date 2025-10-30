import React, { useState } from "react";
import "./App.css";
import { useEditorStore } from "./state/useEditorStore";
import { useTimelineStore } from "./state/timelineStore";
import MediaPanel from "./components/MediaPanelNew";
import { Timeline } from "./components/Timeline";
import RecordingTab from "./components/RecordingTab";
import AIToolsTab from "./components/AIToolsTab";
import ExportModal from "./components/ExportModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Menu, X, Download, Play, Video, Sparkles } from "lucide-react";

const App: React.FC = () => {
  const { clips, timelineClips } = useEditorStore();
  const { clips: timelineClipsNew, getTimelineDuration } = useTimelineStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'recording' | 'ai-tools'>('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Logo and Title */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Video className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      ClipForge Video Editor
                    </h1>
                  </div>
                </div>

              </div>

          {/* Tab Navigation */}
          <div className="mt-4">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('editor')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'editor'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video Editor</span>
              </button>
              <button
                onClick={() => setActiveTab('recording')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'recording'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Play className="w-4 h-4" />
                <span>Recording Studio</span>
              </button>
              <button
                onClick={() => setActiveTab('ai-tools')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                  activeTab === 'ai-tools'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Image/Video Processing</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Collapsible Media Library Sidebar */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-1'}`}>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                {/* Sidebar Header */}
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <span>📚</span>
                      <span className={sidebarCollapsed ? 'hidden' : 'block'}>Media Library</span>
                    </h2>
                    <button
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-300"
                    >
                      {sidebarCollapsed ? <Menu className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                </div>
                
                {/* Sidebar Content */}
                <div className={`p-6 transition-all duration-300 ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                  <MediaPanel />
                </div>
              </div>
            </div>

                    {/* Main Timeline Area */}
                    <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:col-span-4' : 'lg:col-span-4'}`}>
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                        {/* Timeline Header */}
                        <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-b border-gray-200/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                                <Play className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-gray-800">Timeline</h2>
                                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                  <span>{timelineClipsNew.length} clips</span>
                                  <span>•</span>
                                  <span>{getTimelineDuration().toFixed(1)}s</span>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowExportModal(true)}
                              disabled={timelineClipsNew.length === 0}
                              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                            >
                              <Download className="w-4 h-4" />
                              <span>Export Video</span>
                            </button>
                          </div>
                        </div>
                
                {/* Timeline Component */}
                <Timeline />
              </div>
            </div>
          </div>
        ) : activeTab === 'recording' ? (
          <RecordingTab />
        ) : (
          <AIToolsTab />
        )}
      </div>
      
      {/* Modals */}
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
      />
      
    </div>
  );
};

export default App;
