import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">Space</span>
            <span className="text-gray-600">Play/Pause</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">← →</span>
            <span className="text-gray-600">Seek backward/forward</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Home</span>
            <span className="text-gray-600">Go to beginning</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">End</span>
            <span className="text-gray-600">Go to end</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Esc</span>
            <span className="text-gray-600">Close modals</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <h3 className="font-medium mb-2">Workflow</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. Add sample clips or import videos</li>
            <li>2. Drag clips from library to timeline</li>
            <li>3. Use trim controls to adjust clips</li>
            <li>4. Click Export Video when ready</li>
          </ol>
        </div>

        <div className="mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
