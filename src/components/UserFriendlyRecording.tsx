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

const UserFriendlyRecording: React.FC = () => {
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
      name: 'Screen Recording',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    });
    
    const newSource: CaptureSource = {
      id: sourceId as string,
      name: 'Screen Recording',
      source_type: 'monitor',
      device_id: 'screen',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
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
      name: 'Webcam',
      x: 1400,
      y: 800,
      width: 320,
      height: 240
    });
    
    const newSource: CaptureSource = {
      id: sourceId as string,
      name: 'Webcam',
      source_type: 'webcam',
      device_id: selectedWebcam,
      x: 1400,
      y: 800,
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

  // Handle screen stream video element
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
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
              <h1 className="text-2xl font-bold text-gray-900">🎬 Recording Studio</h1>
              <p className="text-sm text-gray-600 mt-1">Record your screen and webcam with ease</p>
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
                  Record your entire screen or specific windows
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
                  Add your webcam for picture-in-picture
                </p>
              </div>

              {/* Active Sources */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Active Sources</h3>
                <div className="space-y-2">
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

            {/* Recording Info */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ℹ️ Recording Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Resolution:</span>
                  <span className="font-medium">1920x1080 (Full HD)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Format:</span>
                  <span className="font-medium">MP4 (H.264)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Frame Rate:</span>
                  <span className="font-medium">30 FPS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Save Location:</span>
                  <span className="font-medium">Desktop</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">👀 Preview</h2>
              
              <div
                ref={previewRef}
                className="relative bg-black rounded-lg overflow-hidden"
                style={{ aspectRatio: '16/9', minHeight: '400px' }}
              >
                {/* Screen Stream Preview */}
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
                    <div className="absolute top-4 left-4 bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
                      Screen Recording Active
                    </div>
                  </div>
                )}

                {/* Webcam Overlay */}
                {webcamStream && (
                  <div className="absolute bottom-4 right-4 w-48 h-36 border-2 border-green-500 rounded-lg overflow-hidden">
                    <video
                      ref={webcamVideoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      Webcam
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!screenStream && !webcamStream && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📺</div>
                      <div className="text-xl font-medium mb-2">Ready to Record</div>
                      <div className="text-sm">Add screen recording or webcam to get started</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Controls */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  {screenStream && <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full mr-2">🖥️ Screen</span>}
                  {webcamStream && <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full">📹 Webcam</span>}
                </div>
                <div>
                  Resolution: 1920x1080 • 30 FPS
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserFriendlyRecording;
