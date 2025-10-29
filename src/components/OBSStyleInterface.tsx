import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface WindowInfo {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  recordingType: 'screen' | 'webcam' | 'both' | null;
}

interface ViewportWindow {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isResizing: boolean;
  isDragging: boolean;
  dragStart: { x: number; y: number };
}

const OBSStyleInterface: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    recordingType: null
  });

  const [availableWindows, setAvailableWindows] = useState<WindowInfo[]>([]);
  const [viewportWindows, setViewportWindows] = useState<ViewportWindow[]>([]);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedWebcam, setSelectedWebcam] = useState<string>('');
  const [showWebcam, setShowWebcam] = useState(false);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load available windows
  const loadAvailableWindows = async () => {
    try {
      const windows = await invoke('get_available_windows');
      setAvailableWindows(windows as WindowInfo[]);
    } catch (error) {
      console.error('Failed to load windows:', error);
    }
  };

  // Load webcam devices
  const loadWebcamDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setWebcamDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedWebcam(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to load webcam devices:', error);
    }
  };

  // Start webcam stream
  const startWebcamStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedWebcam ? { exact: selectedWebcam } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      setWebcamStream(stream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to start webcam:', error);
      alert('Failed to access webcam. Please check permissions.');
    }
  };

  // Stop webcam stream
  const stopWebcamStream = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
  };

  // Add window to viewport
  const addWindowToViewport = (window: WindowInfo) => {
    const viewportWindow: ViewportWindow = {
      id: window.id,
      title: window.title,
      x: 50 + viewportWindows.length * 20,
      y: 50 + viewportWindows.length * 20,
      width: Math.min(window.width, 300),
      height: Math.min(window.height, 200),
      isResizing: false,
      isDragging: false,
      dragStart: { x: 0, y: 0 }
    };
    
    setViewportWindows(prev => [...prev, viewportWindow]);
  };

  // Remove window from viewport
  const removeWindowFromViewport = (windowId: string) => {
    setViewportWindows(prev => prev.filter(w => w.id !== windowId));
  };

  // Handle window drag start
  const handleDragStart = (e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    setViewportWindows(prev => prev.map(w => 
      w.id === windowId 
        ? { ...w, isDragging: true, dragStart: { x: e.clientX - w.x, y: e.clientY - w.y } }
        : w
    ));
  };

  // Handle window drag
  const handleDrag = (e: React.MouseEvent) => {
    if (!viewportRef.current) return;
    
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setViewportWindows(prev => prev.map(w => 
      w.isDragging 
        ? { 
            ...w, 
            x: Math.max(0, Math.min(x - w.dragStart.x, rect.width - w.width)),
            y: Math.max(0, Math.min(y - w.dragStart.y, rect.height - w.height))
          }
        : w
    ));
  };

  // Handle window drag end
  const handleDragEnd = (windowId: string) => {
    setViewportWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, isDragging: false } : w
    ));
  };

  // Handle window resize
  const handleResize = (e: React.MouseEvent, windowId: string) => {
    if (!viewportRef.current) return;
    
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setViewportWindows(prev => prev.map(w => 
      w.id === windowId 
        ? { 
            ...w, 
            width: Math.max(100, x - w.x),
            height: Math.max(100, y - w.y)
          }
        : w
    ));
  };

  // Start recording
  const startRecording = async (type: 'screen' | 'webcam' | 'both') => {
    try {
      if (type === 'screen' || type === 'both') {
        if (viewportWindows.length === 0) {
          alert('Please add at least one window to the viewport');
          return;
        }
        const windowIds = viewportWindows.map(w => w.id);
        await invoke('start_screen_recording', { windowIds });
      }

      if (type === 'webcam' || type === 'both') {
        if (!webcamStream) {
          await startWebcamStream();
        }
        await invoke('start_webcam_recording', { deviceId: selectedWebcam });
      }

      setRecordingState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        recordingType: type
      });

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          recordingTime: prev.recordingTime + 1
        }));
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${error}`);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      if (recordingState.recordingType === 'screen' || recordingState.recordingType === 'both') {
        await invoke('stop_recording', { recordingType: 'screen' });
      }
      if (recordingState.recordingType === 'webcam' || recordingState.recordingType === 'both') {
        await invoke('stop_recording', { recordingType: 'webcam' });
        stopWebcamStream();
      }

      setRecordingState({
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        recordingType: null
      });

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert(`Failed to stop recording: ${error}`);
    }
  };

  // Toggle pause
  const togglePause = async () => {
    try {
      if (recordingState.isPaused) {
        await invoke('resume_recording');
      } else {
        await invoke('pause_recording');
      }

      setRecordingState(prev => ({
        ...prev,
        isPaused: !prev.isPaused
      }));
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    loadAvailableWindows();
    loadWebcamDevices();
    
    return () => {
      stopWebcamStream();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Recording Studio</h2>
          <div className="flex items-center space-x-4">
            {recordingState.isRecording && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-400">
                  {formatTime(recordingState.recordingTime)}
                </span>
              </div>
            )}
            <div className="flex space-x-2">
              {!recordingState.isRecording ? (
                <>
                  <button
                    onClick={() => startRecording('screen')}
                    disabled={viewportWindows.length === 0}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    Record Screen
                  </button>
                  <button
                    onClick={() => startRecording('webcam')}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Record Webcam
                  </button>
                  <button
                    onClick={() => startRecording('both')}
                    disabled={viewportWindows.length === 0}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    Record Both
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={togglePause}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    {recordingState.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopRecording}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                  >
                    Stop Recording
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Sources */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Sources</h3>
          
          {/* Screen Sources */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-300">Screen Sources</h4>
              <button
                onClick={loadAvailableWindows}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableWindows.map((window) => (
                <div
                  key={window.id}
                  className="p-2 rounded bg-gray-700 hover:bg-gray-600 cursor-pointer text-sm"
                  onClick={() => addWindowToViewport(window)}
                >
                  <div className="font-medium truncate">{window.title}</div>
                  <div className="text-xs text-gray-400">
                    {window.width}x{window.height}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Webcam Source */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-300">Webcam</h4>
              <button
                onClick={showWebcam ? stopWebcamStream : startWebcamStream}
                className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-500"
              >
                {showWebcam ? 'Hide' : 'Show'}
              </button>
            </div>
            <select
              value={selectedWebcam}
              onChange={(e) => setSelectedWebcam(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm"
            >
              {webcamDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center - Viewport */}
        <div className="flex-1 bg-black relative">
          <div
            ref={viewportRef}
            className="w-full h-full relative overflow-hidden"
            onMouseMove={handleDrag}
            onMouseUp={() => setViewportWindows(prev => prev.map(w => ({ ...w, isDragging: false })))}
          >
            {/* Viewport Windows */}
            {viewportWindows.map((window) => (
              <div
                key={window.id}
                className="absolute border-2 border-blue-500 bg-gray-800 bg-opacity-50 cursor-move"
                style={{
                  left: window.x,
                  top: window.y,
                  width: window.width,
                  height: window.height,
                  zIndex: window.isDragging ? 1000 : 1
                }}
                onMouseDown={(e) => handleDragStart(e, window.id)}
                onMouseUp={() => handleDragEnd(window.id)}
              >
                <div className="bg-blue-500 text-white text-xs px-2 py-1 flex items-center justify-between">
                  <span className="truncate">{window.title}</span>
                  <button
                    onClick={() => removeWindowFromViewport(window.id)}
                    className="ml-2 text-red-300 hover:text-red-100"
                  >
                    ×
                  </button>
                </div>
                <div className="p-2 text-white text-sm">
                  {window.width}x{window.height}
                </div>
                {/* Resize handle */}
                <div
                  className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // Handle resize logic here
                  }}
                />
              </div>
            ))}

            {/* Webcam Preview */}
            {showWebcam && webcamStream && (
              <div className="absolute bottom-4 right-4 w-48 h-36 border-2 border-green-500 bg-black">
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0 left-0 bg-green-500 text-white text-xs px-2 py-1">
                  Webcam
                </div>
              </div>
            )}

            {/* Empty State */}
            {viewportWindows.length === 0 && !showWebcam && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📺</div>
                  <div className="text-lg">Add sources to start recording</div>
                  <div className="text-sm">Drag windows from the left panel</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Properties</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recording Quality
              </label>
              <select className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm">
                <option>High (1080p)</option>
                <option>Medium (720p)</option>
                <option>Low (480p)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Frame Rate
              </label>
              <select className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm">
                <option>60 FPS</option>
                <option>30 FPS</option>
                <option>24 FPS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Audio Source
              </label>
              <select className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm">
                <option>System Audio</option>
                <option>Microphone</option>
                <option>Both</option>
                <option>None</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Viewport Info</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Sources: {viewportWindows.length}</div>
                <div>Webcam: {showWebcam ? 'On' : 'Off'}</div>
                <div>Status: {recordingState.isRecording ? 'Recording' : 'Idle'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OBSStyleInterface;
