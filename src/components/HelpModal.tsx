import React from 'react';
import { X, Keyboard, Play, ArrowLeft, ArrowRight, Home, SkipForward, XCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', icon: Play, description: 'Play/Pause' },
    { key: '← →', icon: ArrowLeft, description: 'Seek backward/forward' },
    { key: 'Home', icon: Home, description: 'Go to beginning' },
    { key: 'End', icon: SkipForward, description: 'Go to end' },
    { key: 'Esc', icon: XCircle, description: 'Close modals' },
  ];

  const workflowSteps = [
    { step: 1, text: 'Add sample clips or import videos', icon: '📁' },
    { step: 2, text: 'Drag clips from library to timeline', icon: '🎬' },
    { step: 3, text: 'Use trim controls to adjust clips', icon: '✂️' },
    { step: 4, text: 'Click Export Video when ready', icon: '📤' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto shadow-2xl border border-white/20 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold gradient-text">Help & Shortcuts</h2>
              <p className="text-sm text-gray-600">Keyboard shortcuts and workflow guide</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-300 hover:scale-110"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Keyboard Shortcuts */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <div className="w-2 h-2 bg-gradient-primary rounded-full" />
            <span>Keyboard Shortcuts</span>
          </h3>
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200/50 hover:shadow-md transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <shortcut.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-gray-800 text-lg">{shortcut.key}</span>
                </div>
                <span className="text-gray-600 font-medium">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <div className="w-2 h-2 bg-gradient-secondary rounded-full" />
            <span>Workflow Guide</span>
          </h3>
          <div className="space-y-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step.step}
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200/50 hover:shadow-md transition-all duration-300"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="w-8 h-8 bg-gradient-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {step.step}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-gray-700 font-medium">{step.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
            <div className="w-2 h-2 bg-gradient-success rounded-full" />
            <span>Pro Tips</span>
          </h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200/50">
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span>Hold Shift while dragging to snap to grid</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span>Double-click clips to quickly trim</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span>Use mouse wheel to zoom timeline</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Close Button */}
        <div className="pt-4">
          <button
            onClick={onClose}
            className="btn-gradient-success w-full px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all duration-300 flex items-center justify-center space-x-2"
          >
            <span>✨</span>
            <span>Got it!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
