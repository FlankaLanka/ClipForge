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

const SimpleRecordingInterface: React.FC = () => {
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
  const [draggedSource, setDraggedSource] = useState<CaptureSource | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Load existing capture sources
  const loadCaptureSources = async () => {
    try {
      const sources = await invoke('get_capture_sources');
      setCaptureSources(sources as CaptureSource[]);
    } catch (error) {
      console.error('Failed to load capture sources:', error);
    }
  };

  // Start screen capture
  const startScreenCapture = async () => {
    try {
      console.log('Starting screen capture...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      console.log('Screen capture stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      
      setScreenStream(stream);
      
      // Handle stream end (when user stops sharing)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen capture stream ended');
        setScreenStream(null);
        // Remove screen sources when sharing stops
        setCaptureSources(prev => prev.filter(s => s.source_type !== 'monitor'));
      });
      
    } catch (error) {
      console.error('Failed to start screen capture:', error);
      alert('Failed to access screen. Please check permissions and try again.');
    }
  };

  // Add monitor as capture source
  const addMonitorSource = async (monitor: MonitorInfo) => {
    try {
      // Start screen capture if not already active
      if (!screenStream) {
        await startScreenCapture();
      }
      
      const sourceId = await invoke('add_capture_source', {
        sourceType: 'monitor',
        deviceId: monitor.id,
        name: monitor.name,
        x: 50,
        y: 50,
        width: Math.min(monitor.width, 800),
        height: Math.min(monitor.height, 600)
      });
      
      const newSource: CaptureSource = {
        id: sourceId as string,
        name: monitor.name,
        source_type: 'monitor',
        device_id: monitor.id,
        x: 50,
        y: 50,
        width: Math.min(monitor.width, 800),
        height: Math.min(monitor.height, 600),
        is_active: true
      };
      
      setCaptureSources(prev => [...prev, newSource]);
    } catch (error) {
      console.error('Failed to add monitor source:', error);
    }
  };

  // Add webcam as capture source
  const addWebcamSource = async () => {
    try {
      const sourceId = await invoke('add_capture_source', {
        sourceType: 'webcam',
        deviceId: selectedWebcam,
        name: 'Webcam',
        x: 50,
        y: 50,
        width: 320,
        height: 240
      });
      
      const newSource: CaptureSource = {
        id: sourceId as string,
        name: 'Webcam',
        source_type: 'webcam',
        device_id: selectedWebcam,
        x: 50,
        y: 50,
        width: 320,
        height: 240,
        is_active: true
      };
      
      setCaptureSources(prev => [...prev, newSource]);
      
      // Start webcam stream
      await startWebcamStream();
    } catch (error) {
      console.error('Failed to add webcam source:', error);
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

  // Remove capture source
  const removeCaptureSource = async (sourceId: string) => {
    try {
      await invoke('remove_capture_source', { sourceId });
      setCaptureSources(prev => prev.filter(s => s.id !== sourceId));
      
      // Stop webcam stream if this was the last webcam source
      const remainingWebcamSources = captureSources.filter(s => s.source_type === 'webcam' && s.id !== sourceId);
      if (remainingWebcamSources.length === 0 && webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        setWebcamStream(null);
      }
    } catch (error) {
      console.error('Failed to remove capture source:', error);
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent, source: CaptureSource) => {
    e.preventDefault();
    setDraggedSource(source);
    setIsDragging(true);
  };

  // Handle drag over
  const handleDragOver = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Handle drop
  const handleDrop = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!draggedSource || !previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    try {
      await invoke('update_capture_source_position', {
        sourceId: draggedSource.id,
        x: Math.max(0, x - draggedSource.width / 2),
        y: Math.max(0, y - draggedSource.height / 2),
        width: draggedSource.width,
        height: draggedSource.height
      });
      
      setCaptureSources(prev => prev.map(s => 
        s.id === draggedSource.id 
          ? { ...s, x: Math.max(0, x - s.width / 2), y: Math.max(0, y - s.height / 2) }
          : s
      ));
    } catch (error) {
      console.error('Failed to update source position:', error);
    }
    
    setDraggedSource(null);
    setIsDragging(false);
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Create a user-friendly filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const outputPath = `~/Desktop/ClipForge_Recording_${timestamp}.mp4`;
      
      // For now, we'll record the entire preview area
      // In a real implementation, you'd capture the specific sources
      await invoke('start_screen_recording', { 
        windowIds: captureSources.map(s => s.id) 
      });
      
      setRecordingState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        outputPath
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

      alert(`Recording saved to: ${recordingState.outputPath}\n\nYour video is saved on your Desktop as "ClipForge_Recording_[timestamp].mp4"`);

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

  // Handle screen stream video element
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      console.log('Setting screen stream to video element:', screenStream);
      screenVideoRef.current.srcObject = screenStream;
      
      // Add event listeners for debugging
      screenVideoRef.current.addEventListener('loadedmetadata', () => {
        console.log('Screen video metadata loaded');
      });
      
      screenVideoRef.current.addEventListener('canplay', () => {
        console.log('Screen video can play');
      });
      
      screenVideoRef.current.addEventListener('error', (e) => {
        console.error('Screen video error:', e);
      });
    }
  }, [screenStream]);

  // Handle webcam stream video element
  useEffect(() => {
    if (webcamStream && webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStream;
    }
  }, [webcamStream]);

  useEffect(() => {
    loadMonitors();
    loadWebcamDevices();
    loadCaptureSources();
    
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
    <div className="h-screen bg-gray-900 text-white flex flex-col">
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
                <button
                  onClick={startRecording}
                  disabled={captureSources.length === 0}
                  className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Record
                </button>
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
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Panel - Sources */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Capture Sources</h3>
          
          {/* Monitors */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-300">Monitors</h4>
              <button
                onClick={loadMonitors}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {monitors.map((monitor) => (
                <div
                  key={monitor.id}
                  className="p-2 rounded bg-gray-700 hover:bg-gray-600 cursor-pointer text-sm flex items-center justify-between"
                  onClick={() => addMonitorSource(monitor)}
                >
                  <div>
                    <div className="font-medium">{monitor.name}</div>
                    <div className="text-xs text-gray-400">
                      {monitor.width}x{monitor.height}
                      {monitor.is_primary && ' (Primary)'}
                    </div>
                  </div>
                  <div className="text-blue-400">+</div>
                </div>
              ))}
            </div>
          </div>

          {/* Webcam */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-300">Webcam</h4>
              <button
                onClick={addWebcamSource}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500"
              >
                Add
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

          {/* Active Sources */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Active Sources</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {captureSources.map((source) => (
                <div
                  key={source.id}
                  className="p-2 rounded bg-gray-700 text-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{source.name}</div>
                    <div className="text-xs text-gray-400">
                      {source.width}x{source.height}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCaptureSource(source.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center - Preview */}
        <div className="flex-1 bg-black relative">
          <div
            ref={previewRef}
            className="w-full h-full relative overflow-hidden border-2 border-gray-600"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Screen Stream Preview - Show directly if available */}
            {screenStream && (
              <div className="absolute inset-0">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ background: 'black' }}
                />
                <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                  Screen Capture Active
                </div>
              </div>
            )}

            {/* Capture Source Previews */}
            {captureSources.map((source) => (
              <div
                key={source.id}
                className="absolute border-2 border-blue-500 bg-gray-800 bg-opacity-50 cursor-move"
                style={{
                  left: source.x,
                  top: source.y,
                  width: source.width,
                  height: source.height,
                  zIndex: isDragging && draggedSource?.id === source.id ? 1000 : 1
                }}
                onMouseDown={(e) => handleDragStart(e, source)}
              >
                <div className="bg-blue-500 text-white text-xs px-2 py-1 flex items-center justify-between">
                  <span className="truncate">{source.name}</span>
                  <button
                    onClick={() => removeCaptureSource(source.id)}
                    className="ml-2 text-red-300 hover:text-red-100"
                  >
                    ×
                  </button>
                </div>
                <div className="p-2 text-white text-sm">
                  {source.source_type === 'monitor' ? (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl mb-1">🖥️</div>
                        <div className="text-xs">Monitor Source</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-black">
                      {webcamStream && (
                        <video
                          ref={webcamVideoRef}
                          autoPlay
                          muted
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Empty State */}
            {!screenStream && captureSources.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📺</div>
                  <div className="text-lg">Add capture sources to start</div>
                  <div className="text-sm">Click on monitors or add webcam from the left panel</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Settings */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Output Format
              </label>
              <select className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm">
                <option>MP4 (H.264)</option>
                <option>MOV (H.264)</option>
                <option>WebM (VP9)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quality
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

            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Preview Info</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Sources: {captureSources.length}</div>
                <div>Status: {recordingState.isRecording ? 'Recording' : 'Idle'}</div>
                {recordingState.outputPath && (
                  <div className="text-green-400">Output: {recordingState.outputPath}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleRecordingInterface;
