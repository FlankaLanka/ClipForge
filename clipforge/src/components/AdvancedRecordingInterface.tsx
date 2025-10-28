import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MonitorInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_primary: boolean;
}

interface CaptureSource {
  id: string;
  name: string;
  source_type: string; // "monitor" or "webcam"
  device_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_active: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  outputPath: string;
}

const AdvancedRecordingInterface: React.FC = () => {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [captureSources, setCaptureSources] = useState<CaptureSource[]>([]);
  const [webcamDevices, setWebcamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedWebcam, setSelectedWebcam] = useState<string>('');
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    outputPath: ''
  });
  
  const previewRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create refs for each source's video elements
  const sourceVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  // Drag and resize state
  const [draggedSource, setDraggedSource] = useState<CaptureSource | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // Load available monitors
  const loadMonitors = async () => {
    try {
      const monitorList = await invoke('get_available_monitors');
      setMonitors(monitorList as MonitorInfo[]);
    } catch (error) {
      console.error('Failed to load monitors:', error);
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

  // Start screen capture
  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      setScreenStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setScreenStream(null);
        setCaptureSources(prev => prev.filter(s => s.source_type !== 'monitor'));
      });
      
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      alert('Failed to access screen. Please check permissions and try again.');
    }
  };

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedWebcam ? { exact: selectedWebcam } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      setWebcamStream(stream);
    } catch (error) {
      console.error('Failed to start webcam:', error);
      alert('Failed to access webcam. Please check permissions.');
    }
  };

  // Add screen recording
  const addScreenRecording = async () => {
    if (!screenStream) {
      await startScreenCapture();
    }
    
    const sourceId = await invoke('add_capture_source', {
      sourceType: 'monitor',
      deviceId: 'screen',
      name: `Screen Recording ${captureSources.filter(s => s.source_type === 'monitor').length + 1}`,
      x: 50 + (captureSources.length * 30),
      y: 50 + (captureSources.length * 30),
      width: 800,
      height: 600
    });
    
    const newSource: CaptureSource = {
      id: sourceId as string,
      name: `Screen Recording ${captureSources.filter(s => s.source_type === 'monitor').length + 1}`,
      source_type: 'monitor',
      device_id: 'screen',
      x: 50 + (captureSources.length * 30),
      y: 50 + (captureSources.length * 30),
      width: 800,
      height: 600,
      is_active: true
    };
    
    setCaptureSources(prev => [...prev, newSource]);
  };

  // Add webcam
  const addWebcam = async () => {
    if (!webcamStream) {
      await startWebcam();
    }
    
    const sourceId = await invoke('add_capture_source', {
      sourceType: 'webcam',
      deviceId: selectedWebcam,
      name: `Webcam ${captureSources.filter(s => s.source_type === 'webcam').length + 1}`,
      x: 100 + (captureSources.length * 50),
      y: 100 + (captureSources.length * 50),
      width: 320,
      height: 240
    });
    
    const newSource: CaptureSource = {
      id: sourceId as string,
      name: `Webcam ${captureSources.filter(s => s.source_type === 'webcam').length + 1}`,
      source_type: 'webcam',
      device_id: selectedWebcam,
      x: 100 + (captureSources.length * 50),
      y: 100 + (captureSources.length * 50),
      width: 320,
      height: 240,
      is_active: true
    };
    
    setCaptureSources(prev => [...prev, newSource]);
  };

  // Remove source
  const removeSource = async (sourceId: string) => {
    await invoke('remove_capture_source', { sourceId });
    setCaptureSources(prev => prev.filter(s => s.id !== sourceId));
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent, source: CaptureSource) => {
    e.preventDefault();
    setDraggedSource(source);
    setIsDragging(true);
    setDragStart({ x: e.clientX - source.x, y: e.clientY - source.y });
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, source: CaptureSource, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedSource(source);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedSource || !previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDragging) {
      const newX = Math.max(0, Math.min(x - dragStart.x, rect.width - draggedSource.width));
      const newY = Math.max(0, Math.min(y - dragStart.y, rect.height - draggedSource.height));
      
      // Update the dragged source reference immediately
      const updatedSource = { ...draggedSource, x: newX, y: newY };
      setDraggedSource(updatedSource);
      
      setCaptureSources(prev => prev.map(s => 
        s.id === draggedSource.id 
          ? updatedSource
          : s
      ));
    } else if (isResizing && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newWidth = draggedSource.width;
      let newHeight = draggedSource.height;
      let newX = draggedSource.x;
      let newY = draggedSource.y;
      
      if (resizeHandle.includes('right')) {
        newWidth = Math.max(100, draggedSource.width + deltaX);
      }
      if (resizeHandle.includes('left')) {
        newWidth = Math.max(100, draggedSource.width - deltaX);
        newX = draggedSource.x + deltaX;
      }
      if (resizeHandle.includes('bottom')) {
        newHeight = Math.max(100, draggedSource.height + deltaY);
      }
      if (resizeHandle.includes('top')) {
        newHeight = Math.max(100, draggedSource.height - deltaY);
        newY = draggedSource.y + deltaY;
      }
      
      // Update the dragged source reference immediately
      const updatedSource = { ...draggedSource, x: newX, y: newY, width: newWidth, height: newHeight };
      setDraggedSource(updatedSource);
      
      setCaptureSources(prev => prev.map(s => 
        s.id === draggedSource.id 
          ? updatedSource
          : s
      ));
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (draggedSource) {
      // Update position in backend
      invoke('update_capture_source_position', {
        sourceId: draggedSource.id,
        x: draggedSource.x,
        y: draggedSource.y,
        width: draggedSource.width,
        height: draggedSource.height
      }).catch(console.error);
    }
    
    setDraggedSource(null);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Start recording
  const startRecording = async () => {
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outputPath = `~/Desktop/ClipForge_Recording_${timestamp}.mp4`;
      
      await invoke('start_screen_recording', { 
        windowIds: captureSources.map(s => s.id) 
      });
      
      setRecordingState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        outputPath
      });

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
      await invoke('stop_recording', { recordingType: 'screen' });
      
      setRecordingState({
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        outputPath: ''
      });

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      alert(`🎉 Recording Complete!\n\nYour video has been saved to your Desktop as:\n"ClipForge_Recording_[timestamp].mp4"\n\nCheck your Desktop folder to find your recording!`);

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

  // Update video elements when streams change
  useEffect(() => {
    captureSources.forEach(source => {
      const video = sourceVideoRefs.current[source.id];
      if (video) {
        if (source.source_type === 'monitor' && screenStream) {
          video.srcObject = screenStream;
        } else if (source.source_type === 'webcam' && webcamStream) {
          video.srcObject = webcamStream;
        }
      }
    });
  }, [screenStream, webcamStream, captureSources]);

  useEffect(() => {
    loadMonitors();
    loadWebcamDevices();
    
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🎬 Advanced Recording Studio</h1>
              <p className="text-sm text-gray-600 mt-1">Add multiple sources, drag, resize, and record</p>
            </div>
            
            {/* Recording Controls */}
            <div className="flex items-center space-x-4">
              {recordingState.isRecording && (
                <div className="flex items-center space-x-3 bg-red-50 px-4 py-2 rounded-lg">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-red-700">
                    Recording: {formatTime(recordingState.recordingTime)}
                  </span>
                </div>
              )}
              
              <div className="flex space-x-2">
                {!recordingState.isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={captureSources.length === 0}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg shadow-lg"
                  >
                    🔴 Start Recording
                  </button>
                ) : (
                  <>
                    <button
                      onClick={togglePause}
                      className="bg-yellow-500 text-white px-4 py-3 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                    >
                      {recordingState.isPaused ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
                    <button
                      onClick={stopRecording}
                      className="bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                      ⏹️ Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Add Sources */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">📹 Add Sources</h2>
              
              {/* Screen Recording */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Screen Recording</h3>
                <button
                  onClick={addScreenRecording}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>🖥️</span>
                  <span>Add Screen Recording</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Add multiple screen recordings
                </p>
              </div>

              {/* Webcam */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Webcam</h3>
                <select
                  value={selectedWebcam}
                  onChange={(e) => setSelectedWebcam(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
                >
                  {webcamDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addWebcam}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <span>📹</span>
                  <span>Add Webcam</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Add multiple webcams
                </p>
              </div>

              {/* Active Sources */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Active Sources ({captureSources.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {captureSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {source.source_type === 'monitor' ? '🖥️' : '📹'}
                        </span>
                        <span className="text-sm font-medium">{source.name}</span>
                        <span className="text-xs text-gray-500">
                          {source.width}x{source.height}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSource(source.id)}
                        className="text-red-500 hover:text-red-700 text-lg"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {captureSources.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No sources added yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 How to Use</h3>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Click and drag sources to move them</li>
                <li>• Drag corners/edges to resize</li>
                <li>• Add multiple sources for complex layouts</li>
                <li>• Record everything in the preview area</li>
              </ul>
            </div>
          </div>

          {/* Center - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">👀 Preview (1920x1080)</h2>
              
              <div
                ref={previewRef}
                className="relative bg-black rounded-lg overflow-hidden"
                style={{ aspectRatio: '16/9', minHeight: '400px' }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Capture Source Windows */}
                {captureSources.map((source) => (
                  <div
                    key={source.id}
                    className={`absolute border-2 bg-gray-800 bg-opacity-50 cursor-move transition-all duration-150 ${
                      draggedSource?.id === source.id 
                        ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' 
                        : 'border-blue-500 hover:border-blue-400'
                    }`}
                    style={{
                      left: source.x,
                      top: source.y,
                      width: source.width,
                      height: source.height,
                      zIndex: draggedSource?.id === source.id ? 1000 : 1
                    }}
                    onMouseDown={(e) => handleDragStart(e, source)}
                  >
                    {/* Header */}
                    <div className="bg-blue-500 text-white text-xs px-2 py-1 flex items-center justify-between">
                      <span className="truncate">{source.name}</span>
                      <button
                        onClick={() => removeSource(source.id)}
                        className="ml-2 text-red-300 hover:text-red-100"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-2 text-white text-sm h-full">
                      {source.source_type === 'monitor' ? (
                        <div className="w-full h-full bg-black">
                          {screenStream && (
                            <video
                              ref={(el) => { sourceVideoRefs.current[source.id] = el; }}
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          )}
                          {!screenStream && (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl mb-1">🖥️</div>
                                <div className="text-xs">Screen</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-black">
                          {webcamStream && (
                            <video
                              ref={(el) => { sourceVideoRefs.current[source.id] = el; }}
                              autoPlay
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          )}
                          {!webcamStream && (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl mb-1">📹</div>
                                <div className="text-xs">Webcam</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resize Handles */}
                    <div className="absolute top-0 left-0 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-nw-resize rounded-sm"
                         onMouseDown={(e) => handleResizeStart(e, source, 'top-left')} />
                    <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-ne-resize rounded-sm"
                         onMouseDown={(e) => handleResizeStart(e, source, 'top-right')} />
                    <div className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-sw-resize rounded-sm"
                         onMouseDown={(e) => handleResizeStart(e, source, 'bottom-left')} />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-se-resize rounded-sm"
                         onMouseDown={(e) => handleResizeStart(e, source, 'bottom-right')} />
                    
                    {/* Edge Resize Handles */}
                    <div className="absolute top-0 left-3 right-3 h-1 bg-blue-500 hover:bg-blue-400 cursor-n-resize rounded-full"
                         onMouseDown={(e) => handleResizeStart(e, source, 'top')} />
                    <div className="absolute bottom-0 left-3 right-3 h-1 bg-blue-500 hover:bg-blue-400 cursor-s-resize rounded-full"
                         onMouseDown={(e) => handleResizeStart(e, source, 'bottom')} />
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 hover:bg-blue-400 cursor-w-resize rounded-full"
                         onMouseDown={(e) => handleResizeStart(e, source, 'left')} />
                    <div className="absolute right-0 top-3 bottom-3 w-1 bg-blue-500 hover:bg-blue-400 cursor-e-resize rounded-full"
                         onMouseDown={(e) => handleResizeStart(e, source, 'right')} />
                  </div>
                ))}

                {/* Empty State */}
                {captureSources.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📺</div>
                      <div className="text-xl font-medium mb-2">Ready to Record</div>
                      <div className="text-sm">Add sources from the left panel to get started</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Info */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  {screenStream && <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full mr-2">🖥️ Screen</span>}
                  {webcamStream && <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full">📹 Webcam</span>}
                  <span className="text-gray-500">Sources: {captureSources.length}</span>
                </div>
                <div>
                  Resolution: 1920x1080 • 30 FPS • Desktop Save
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedRecordingInterface;
