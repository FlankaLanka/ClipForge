import React, { useState, useEffect } from 'react';

interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_primary: boolean;
}

interface WindowInfo {
  id: string;
  title: string;
  appName: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ScreenSpriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: {
    captureType: 'window' | 'screen';
    monitorId: string;
    windowTitle?: string;
  }) => void;
  monitors: MonitorInfo[];
}

const ScreenSpriteDialog: React.FC<ScreenSpriteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  monitors
}) => {
  const [captureType, setCaptureType] = useState<'window' | 'screen'>('screen');
  const [selectedMonitor, setSelectedMonitor] = useState<string>('');
  const [selectedWindow, setSelectedWindow] = useState<string>('');
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && monitors.length > 0) {
      const primaryMonitor = monitors.find(m => m.is_primary);
      setSelectedMonitor(primaryMonitor ? primaryMonitor.id : monitors[0].id);
    }
  }, [isOpen, monitors]);

  // Load available windows when window capture is selected
  useEffect(() => {
    if (isOpen && captureType === 'window') {
      loadWindows();
    }
  }, [isOpen, captureType]);

  const loadWindows = async () => {
    // For now, we'll create mock window data
    // In a real implementation, this would use a native API to get window information
    const mockWindows: WindowInfo[] = [
      {
        id: 'window_1',
        title: 'Chrome - Google',
        appName: 'Google Chrome',
        bounds: { x: 100, y: 100, width: 1200, height: 800 }
      },
      {
        id: 'window_2',
        title: 'Visual Studio Code',
        appName: 'Code',
        bounds: { x: 200, y: 150, width: 1400, height: 900 }
      },
      {
        id: 'window_3',
        title: 'Terminal',
        appName: 'Terminal',
        bounds: { x: 50, y: 50, width: 800, height: 600 }
      }
    ];
    setWindows(mockWindows);
  };

  const startPreview = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // For screen capture, we need to use getDisplayMedia which will show the system dialog
      // The user will select the window/screen they want to capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 800 },
          height: { ideal: 600 },
          frameRate: { ideal: 15 }
        },
        audio: false
      });
      
      setPreviewStream(stream);
      
      // Store the selected window/screen info for later use
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // Update the selected window info based on what the user actually selected
      const selectedWindowInfo = {
        id: 'selected_window',
        title: 'Selected Window/Screen',
        appName: 'Screen Capture',
        bounds: {
          x: 0,
          y: 0,
          width: settings.width || 800,
          height: settings.height || 600
        }
      };
      
      setWindows([selectedWindowInfo]);
      setSelectedWindow('selected_window');
      
      // Stop preview after 10 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        setPreviewStream(null);
        setIsLoading(false);
      }, 10000);
    } catch (error) {
      console.error('Failed to start preview:', error);
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    const selectedWindowInfo = windows.find(w => w.id === selectedWindow);
    onConfirm({
      captureType,
      monitorId: selectedMonitor,
      windowTitle: captureType === 'window' ? selectedWindowInfo?.title : undefined
    });
    onClose();
  };

  // Clean up preview stream when dialog closes
  useEffect(() => {
    if (!isOpen && previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
  }, [isOpen, previewStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🖥️ Add Screen Sprite</h2>
          
          {/* Capture Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What would you like to capture?
            </label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="captureType"
                  value="screen"
                  checked={captureType === 'screen'}
                  onChange={(e) => setCaptureType(e.target.value as 'screen')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Entire Screen</div>
                  <div className="text-sm text-gray-500">Capture the whole screen</div>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="captureType"
                  value="window"
                  checked={captureType === 'window'}
                  onChange={(e) => setCaptureType(e.target.value as 'window')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Specific Window</div>
                  <div className="text-sm text-gray-500">Capture a specific application window</div>
                </div>
              </label>
            </div>
          </div>

          {/* Monitor Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Monitor
            </label>
            <select
              value={selectedMonitor}
              onChange={(e) => setSelectedMonitor(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name} ({monitor.width}x{monitor.height}) {monitor.is_primary && '(Primary)'}
                </option>
              ))}
            </select>
          </div>

          {/* Window Selection (only for window capture) */}
          {captureType === 'window' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Window
              </label>
              {windows.length === 0 ? (
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-blue-600 mb-2">No window selected</div>
                  <div className="text-sm text-blue-500">
                    Click "Start Preview" to select a window from the system dialog
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {windows.map((window) => (
                    <div key={window.id} className="flex items-center p-3 border border-green-200 bg-green-50 rounded-lg">
                      <div className="mr-3 text-green-600">✓</div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{window.title}</div>
                        <div className="text-sm text-gray-500">{window.appName}</div>
                        <div className="text-xs text-gray-400">
                          {window.bounds.width}x{window.bounds.height} resolution
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

           {/* Preview Section */}
           <div className="mb-6">
             <div className="flex items-center justify-between mb-2">
               <label className="block text-sm font-medium text-gray-700">
                 Preview (Optional)
               </label>
               <button
                 type="button"
                 onClick={startPreview}
                 disabled={isLoading}
                 className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
               >
                 {isLoading ? 'Starting...' : 'Start Preview'}
               </button>
             </div>
             
             {previewStream ? (
               <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                 <video
                   srcObject={previewStream}
                   autoPlay
                   muted
                   playsInline
                   className="w-full h-full object-contain"
                 />
                 <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                   Live Preview (10s)
                 </div>
               </div>
             ) : (
               <div className="bg-gray-100 rounded-lg p-8 text-center" style={{ aspectRatio: '16/9' }}>
                 <div className="text-gray-500 mb-2">No Preview</div>
                 <div className="text-sm text-gray-400">
                   Click "Start Preview" to test your selection
                 </div>
                 <div className="text-xs text-gray-400 mt-2">
                   Or skip preview and click "Add Screen Sprite" to select directly
                 </div>
               </div>
             )}
           </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
             <button
               onClick={handleConfirm}
               disabled={!selectedMonitor || (captureType === 'window' && !selectedWindow)}
               className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
             >
               Select Screen/Window
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenSpriteDialog;
