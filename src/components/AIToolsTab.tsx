import React, { useState } from 'react';
import { Sparkles, Wand2, Zap, Image, Palette } from 'lucide-react';
import AIStyler from './AIStyler';
import DALLEImageGenerator from './DALLEImageGenerator';

const AIToolsTab: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'ai-styler' | 'image-generator'>('ai-styler');

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Media Tools</h1>
              <p className="text-white/80 mt-1">Style your media and generate AI images with powerful tools</p>
            </div>
          </div>
        </div>

        {/* Tool Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-4">
            <button
              onClick={() => setActiveTool('ai-styler')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTool === 'ai-styler'
                  ? 'bg-purple-100 text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Palette className="w-5 h-5" />
              <span>Media Styler</span>
            </button>
            <button
              onClick={() => setActiveTool('image-generator')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                activeTool === 'image-generator'
                  ? 'bg-purple-100 text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>DALL-E Generator</span>
            </button>
          </div>
        </div>

        {/* Tool Content */}
        <div className="p-6">
          {activeTool === 'ai-styler' ? (
            <AIStyler />
          ) : (
            <DALLEImageGenerator />
          )}
        </div>
      </div>
    </div>
  );
};

export default AIToolsTab;
