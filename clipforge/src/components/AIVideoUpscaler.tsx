import React, { useState, useRef } from 'react';
import { Upload, Zap, Download, Loader2, AlertCircle, Play, Pause, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { save } from '@tauri-apps/plugin-dialog';

const AIVideoUpscaler: React.FC = () => {
  const [inputVideo, setInputVideo] = useState<string | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [model, setModel] = useState('realesrgan');
  const [quality, setQuality] = useState('high');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedVideo, setProcessedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addToTimeline, setAddToTimeline] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [originalResolution, setOriginalResolution] = useState<string>('');
  const [targetResolution, setTargetResolution] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const upscaleFactors = [
    { value: 2, label: '2x (HD → 4K)', description: '720p → 1440p, 1080p → 4K' },
    { value: 4, label: '4x (SD → 4K)', description: '480p → 1920p, 720p → 4K' },
    { value: 8, label: '8x (Ultra)', description: '240p → 1920p, 480p → 4K' }
  ];

  // Filter upscale factors based on input resolution
  const getAvailableFactors = () => {
    if (!originalResolution) return upscaleFactors;
    
    const [width, height] = originalResolution.split('x').map(Number);
    return upscaleFactors.filter(factor => {
      const targetWidth = width * factor.value;
      const targetHeight = height * factor.value;
      return targetWidth <= 3840 && targetHeight <= 2160;
    });
  };

  const models = [
    { value: 'realesrgan', label: 'Real-ESRGAN', description: 'Best for photos and graphics' },
    { value: 'esrgan', label: 'ESRGAN', description: 'Good for natural images' },
    { value: 'waifu2x', label: 'Waifu2x', description: 'Optimized for anime/illustrations' },
    { value: 'lanczos', label: 'Lanczos', description: 'Fast, traditional upscaling' }
  ];

  const qualityOptions = [
    { value: 'fast', label: 'Fast', description: 'Lower quality, faster processing' },
    { value: 'balanced', label: 'Balanced', description: 'Good quality and speed' },
    { value: 'high', label: 'High Quality', description: 'Best quality, slower processing' }
  ];

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Select Video to Upscale'
      });

      if (selected) {
        setInputVideo(selected);
        setError(null);
        setProcessedVideo(null);
        
        // Get video metadata to show original resolution
        try {
          const metadata = await invoke('get_video_metadata', { filePath: selected });
          const width = (metadata as any).width;
          const height = (metadata as any).height;
          setOriginalResolution(`${width}x${height}`);
          setTargetResolution(`${width * upscaleFactor}x${height * upscaleFactor}`);
        } catch (err) {
          console.warn('Could not get video metadata:', err);
        }
      }
    } catch (err) {
      setError('Failed to select video file');
    }
  };

  const handleUpscale = async () => {
    if (!inputVideo) {
      setError('Please select a video file first');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // Get output path
      const result = await save({
        defaultPath: `~/Desktop/upscaled_video_${Date.now()}.mp4`,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Save Upscaled Video As'
      });

      if (!result) {
        setIsProcessing(false);
        return;
      }

      // Call the Tauri command
      const response = await invoke('upscale_video', {
        inputPath: inputVideo,
        outputPath: result,
        upscaleFactor: upscaleFactor,
        model: model,
        quality: quality,
        addToTimeline: addToTimeline
      });

      setProcessedVideo(result);
      setProgress(100);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const updateTargetResolution = (factor: number) => {
    if (originalResolution) {
      const [width, height] = originalResolution.split('x').map(Number);
      const targetWidth = width * factor;
      const targetHeight = height * factor;
      setTargetResolution(`${targetWidth}x${targetHeight}`);
      
      // Check if target resolution exceeds 4K
      if (targetWidth > 3840 || targetHeight > 2160) {
        setError(`Warning: Target resolution ${targetWidth}x${targetHeight} exceeds 4K limit. This may cause processing issues.`);
      } else {
        setError(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Video to Upscale
            </label>
            <div
              onClick={handleFileSelect}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
            >
              {inputVideo ? (
                <div className="text-center">
                  <Play className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Video selected</p>
                  <p className="text-xs text-gray-500 truncate max-w-48">{inputVideo.split('/').pop()}</p>
                  {originalResolution && (
                    <p className="text-xs text-gray-400 mt-1">Original: {originalResolution}</p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to select video</p>
                  <p className="text-xs text-gray-500">MP4, MOV, AVI, MKV, WebM</p>
                </div>
              )}
            </div>
          </div>

          {/* Upscale Factor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upscale Factor
            </label>
            <div className="grid grid-cols-3 gap-2">
              {getAvailableFactors().length > 0 ? (
                getAvailableFactors().map((factor) => (
                  <button
                    key={factor.value}
                    onClick={() => {
                      setUpscaleFactor(factor.value);
                      updateTargetResolution(factor.value);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      upscaleFactor === factor.value
                        ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-semibold">{factor.label}</div>
                    <div className="text-xs opacity-75">{factor.description}</div>
                  </button>
                ))
              ) : (
                <div className="col-span-3 p-4 text-center text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm">This video is already at maximum resolution (4K).</p>
                  <p className="text-xs mt-1">No upscaling options available.</p>
                </div>
              )}
            </div>
            {targetResolution && (
              <p className="text-xs text-gray-500 mt-2">
                Target resolution: <span className="font-medium">{targetResolution}</span>
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isProcessing}
            >
              {models.map((modelOption) => (
                <option key={modelOption.value} value={modelOption.value}>
                  {modelOption.label} - {modelOption.description}
                </option>
              ))}
            </select>
          </div>

          {/* Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {qualityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setQuality(option.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    quality === option.value
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                  disabled={isProcessing}
                >
                  <div className="font-semibold">{option.label}</div>
                  <div className="text-xs opacity-75">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="addToTimeline"
              checked={addToTimeline}
              onChange={(e) => setAddToTimeline(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              disabled={isProcessing}
            />
            <label htmlFor="addToTimeline" className="text-sm text-gray-700">
              Add to timeline after processing
            </label>
          </div>

          <button
            onClick={handleUpscale}
            disabled={isProcessing || !inputVideo}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Upscaling Video...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Upscale Video</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="w-full h-64 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative">
              {processedVideo ? (
                <div className="w-full h-full relative">
                  <video
                    ref={videoRef}
                    src={processedVideo}
                    className="w-full h-full rounded-lg object-cover"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  <button
                    onClick={togglePlayback}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-all"
                  >
                    {isPlaying ? (
                      <Pause className="w-12 h-12 text-white" />
                    ) : (
                      <Play className="w-12 h-12 text-white" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Upscaled video will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Upscaling video...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Success Message */}
          {processedVideo && !isProcessing && (
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <Download className="w-5 h-5" />
              <span className="text-sm">Video upscaled successfully!</span>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">AI Video Upscaling:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Real-ESRGAN:</strong> Best for photos, graphics, and real-world content</li>
          <li>• <strong>ESRGAN:</strong> Good balance for natural images and videos</li>
          <li>• <strong>Waifu2x:</strong> Optimized for anime, illustrations, and animated content</li>
          <li>• <strong>Processing time:</strong> Depends on video length, resolution, and quality setting</li>
          <li>• <strong>File size:</strong> Upscaled videos will be significantly larger</li>
        </ul>
      </div>
    </div>
  );
};

export default AIVideoUpscaler;
