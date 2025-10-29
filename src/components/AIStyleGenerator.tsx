import React, { useState, useRef } from 'react';
import { Upload, Wand2, Download, Loader2, AlertCircle, Play, Pause } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { save } from '@tauri-apps/plugin-dialog';

const AIStyleGenerator: React.FC = () => {
  const [inputVideo, setInputVideo] = useState<string | null>(null);
  const [inputVideoFile, setInputVideoFile] = useState<File | null>(null);
  const [style, setStyle] = useState('cartoon');
  const [customStyle, setCustomStyle] = useState('');
  const [quality, setQuality] = useState('fast');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedVideo, setProcessedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addToTimeline, setAddToTimeline] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const ffmpegStyles = [
    { value: 'cartoon', label: 'Cartoon', description: 'FFmpeg filter' },
    { value: 'grayscale', label: 'Grayscale', description: 'FFmpeg filter' },
    { value: 'sepia', label: 'Sepia', description: 'FFmpeg filter' },
    { value: 'sketch', label: 'Sketch', description: 'FFmpeg filter' },
    { value: 'edge', label: 'Edge Detection', description: 'FFmpeg filter' },
    { value: 'vintage', label: 'Vintage', description: 'FFmpeg filter' },
    { value: 'dramatic', label: 'Dramatic', description: 'FFmpeg filter' },
    { value: 'soft', label: 'Soft Focus', description: 'FFmpeg filter' }
  ];

  const aiStyles = [
    { value: 'toon-shade', label: 'Toon Shade', description: 'AI powered' },
    { value: 'oil-painting', label: 'Oil Painting', description: 'AI powered' },
    { value: 'watercolor', label: 'Watercolor', description: 'AI powered' },
    { value: 'cyberpunk', label: 'Cyberpunk', description: 'AI powered' },
    { value: 'retro', label: 'Retro', description: 'AI powered' },
    { value: 'anime', label: 'Anime Style', description: 'AI powered' },
    { value: 'pixel-art', label: 'Pixel Art', description: 'AI powered' },
    { value: 'impressionist', label: 'Impressionist', description: 'AI powered' }
  ];

  const allStyles = [...ffmpegStyles, ...aiStyles];

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Select Video File'
      });

      if (selected) {
        setInputVideo(selected);
        setError(null);
        setProcessedVideo(null);
      }
    } catch (err) {
      setError('Failed to select video file');
    }
  };

  const handleProcess = async () => {
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
        defaultPath: `~/Desktop/styled_video_${Date.now()}.mp4`,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: 'Save Styled Video As'
      });

      if (!result) {
        setIsProcessing(false);
        return;
      }

      const isAi = aiStyles.some(s => s.value === style);
      const finalStyle = style === 'custom' ? customStyle : style;

      // Call the Tauri command
      const response = await invoke('apply_style_to_video', {
        inputPath: inputVideo,
        style: finalStyle,
        isAi: isAi,
        outputPath: result,
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

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Video
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

          {/* Style Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isProcessing}
            >
              {allStyles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.description})
                </option>
              ))}
              <option value="custom">Custom Style</option>
            </select>
          </div>

          {/* Custom Style Input */}
          {style === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Style Prompt
              </label>
              <input
                type="text"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g., 'oil painting style with thick brushstrokes'"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuality('fast')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  quality === 'fast'
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
                disabled={isProcessing}
              >
                Fast Preview
              </button>
              <button
                onClick={() => setQuality('high')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  quality === 'high'
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
                disabled={isProcessing}
              >
                High Quality
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {quality === 'fast' ? 'Uses FFmpeg filters only' : 'Uses AI processing for complex styles'}
            </p>
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
            onClick={handleProcess}
            disabled={isProcessing || !inputVideo}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing Video...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                <span>Apply Style</span>
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
                  <Wand2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Styled video will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Processing video...</span>
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
              <span className="text-sm">Video processed successfully!</span>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Fast Preview:</strong> Uses FFmpeg filters for quick style application</li>
          <li>• <strong>High Quality:</strong> Uses AI to process key frames for complex styles</li>
          <li>• • AI styles require OpenAI API key (set OPENAI_API_KEY environment variable)</li>
          <li>• Processing time depends on video length and quality setting</li>
        </ul>
      </div>
    </div>
  );
};

export default AIStyleGenerator;
