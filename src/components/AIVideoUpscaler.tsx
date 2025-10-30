import React, { useState } from 'react';
import { Upload, Zap, Download, Loader2, AlertCircle, Image, Video } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

const AIVideoUpscaler: React.FC = () => {
  const [inputFile, setInputFile] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<'upscale' | 'unblur'>('upscale');
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  const [aiMethod, setAiMethod] = useState('lanczos');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  // Removed model management - using OpenAI instead

  const upscaleFactors = [
    { value: 2, label: '2x' },
    { value: 4, label: '4x' },
    { value: 8, label: '8x' }
  ];

  const aiMethods = [
    { 
      value: 'lanczos', 
      label: 'Lanczos', 
      description: 'Fast processing',
      category: 'traditional',
      operations: ['upscale', 'unblur']
    },
    { 
      value: 'dalle', 
      label: 'DALL-E', 
      description: 'AI processing',
      category: 'ai',
      operations: ['upscale', 'unblur']
    }
  ];

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Media Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'png', 'jpg', 'jpeg', 'webp', 'bmp']
          }
        ]
      });

      if (selected) {
        setInputFile(selected as string);
        const extension = (selected as string).split('.').pop()?.toLowerCase();
        if (['mp4', 'mov', 'avi', 'mkv'].includes(extension || '')) {
          setFileType('video');
        } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension || '')) {
          setFileType('image');
        }
        
        // Create preview URL for original file
        const originalUrl = convertFileSrc(selected as string);
        setOriginalPreviewUrl(originalUrl);
        
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Model management removed - using OpenAI API instead

  const handleProcess = async () => {
    if (!inputFile) {
      setError(`Please select a file to ${operationType}`);
      return;
    }

    // No model validation needed - using OpenAI API

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setPreviewUrl(null); // Clear previous preview

    try {
      const result = await invoke<{ output_path: string }>('process_media', {
        inputPath: inputFile,
        operationType: operationType,
        scaleFactor: upscaleFactor,
        fileType: fileType,
        method: aiMethod
      });

      setOutputPath(result.output_path);
      
      // Create preview URL for the upscaled file with cache busting
      const baseUrl = convertFileSrc(result.output_path);
      const previewUrl = `${baseUrl}?t=${Date.now()}`;
      setPreviewUrl(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!outputPath) return;

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      
      // Let user choose save location
      const selectedPath = await save({
        defaultPath: outputPath.split('/').pop() || 'upscaled_file',
        filters: [
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      if (selectedPath) {
        // Copy file to selected location
        await invoke('copy_file_to_location', { 
          sourcePath: outputPath,
          destinationPath: selectedPath as string
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">AI Media Processor</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input and Controls */}
        <div className="space-y-6">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File
            </label>
            <div
              onClick={handleFileSelect}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
            >
              {inputFile ? (
                <div className="text-center">
                  {fileType === 'video' ? (
                    <Video className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  ) : (
                    <Image className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  )}
                  <p className="text-sm text-gray-600">
                    {fileType === 'video' ? 'Video' : 'Image'} selected
                  </p>
                  <p className="text-xs text-gray-500 truncate max-w-48">
                    {inputFile.split('/').pop()}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to select file</p>
                </div>
              )}
            </div>
          </div>

          {/* Operation Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Operation
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOperationType('upscale')}
                className={`p-3 rounded-lg text-center transition-all ${
                  operationType === 'upscale'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
                disabled={isProcessing}
              >
                <div className="font-medium">Upscale</div>
                <div className="text-xs text-gray-500 mt-1">Increase resolution</div>
              </button>
              <button
                onClick={() => setOperationType('unblur')}
                className={`p-3 rounded-lg text-center transition-all ${
                  operationType === 'unblur'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
                disabled={isProcessing}
              >
                <div className="font-medium">Unblur</div>
                <div className="text-xs text-gray-500 mt-1">Remove blur & sharpen</div>
              </button>
            </div>
          </div>

          {/* AI Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Method
            </label>
            <div className="space-y-3">
              {/* Traditional Methods */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">Traditional</h4>
                <div className="grid grid-cols-1 gap-2">
                  {aiMethods.filter(method => method.category === 'traditional').map(method => (
                    <button
                      key={method.value}
                      onClick={() => setAiMethod(method.value)}
                      className={`p-3 rounded-lg text-left transition-all ${
                        aiMethod === method.value
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                          : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                      }`}
                      disabled={isProcessing}
                    >
                      <div className="font-medium">{method.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Methods */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">AI</h4>
                <div className="grid grid-cols-1 gap-2">
                  {aiMethods.filter(method => method.category === 'ai').map(method => (
                    <button
                      key={method.value}
                      onClick={() => setAiMethod(method.value)}
                      className={`p-3 rounded-lg text-left transition-all ${
                        aiMethod === method.value
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                      }`}
                      disabled={isProcessing}
                    >
                      <div className="font-medium">{method.label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  <strong>Note:</strong> AI methods use local PyTorch models. No API keys required, runs on your machine.
                </div>
              </div>
            </div>
          </div>

          {/* AI Processing Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-700">
                DALL-E processing takes 10-30 seconds
              </p>
            </div>
          </div>

          {/* Scale Factor Selection - Only show for upscale operation */}
          {operationType === 'upscale' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Scale
              </label>
              <div className="grid grid-cols-3 gap-3">
                {upscaleFactors.map(factor => (
                  <button
                    key={factor.value}
                    onClick={() => setUpscaleFactor(factor.value)}
                    className={`p-3 rounded-lg text-center transition-all ${
                      upscaleFactor === factor.value
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium text-lg">{factor.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={handleProcess}
            disabled={!inputFile || isProcessing}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {aiMethods.find(m => m.value === aiMethod)?.label} {operationType}...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                {aiMethods.find(m => m.value === aiMethod)?.label} {operationType}
                {operationType === 'upscale' && ` ${upscaleFactor}x`}
              </>
            )}
          </button>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Processing...</span>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Comparison Preview */}
        <div className="space-y-4">
          {originalPreviewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {operationType === 'upscale' ? 'Original vs Upscaled' : 'Original vs Unblurred'}
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Original */}
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-center">Original</div>
                  <div className="bg-gray-100 rounded-lg border-2 border-gray-300 p-2">
                    {fileType === 'video' ? (
                      <video
                        src={originalPreviewUrl}
                        controls
                        className="w-full h-auto rounded"
                        style={{ maxHeight: '200px' }}
                        onError={(e) => {
                          console.error('Failed to load original video preview');
                        }}
                      />
                    ) : (
                      <img
                        src={originalPreviewUrl}
                        alt="Original"
                        className="w-full h-auto rounded"
                        style={{ maxHeight: '200px', objectFit: 'contain' }}
                        onError={(e) => {
                          console.error('Failed to load original image preview');
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Upscaled */}
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-center">
                    {outputPath ? (
                      operationType === 'upscale' 
                        ? `Upscaled ${upscaleFactor}x` 
                        : 'Unblurred'
                    ) : `No ${operationType} applied`}
                  </div>
                  <div className="bg-gray-100 rounded-lg border-2 border-gray-300 p-2">
                    {outputPath && previewUrl ? (
                      fileType === 'video' ? (
                        <video
                          src={previewUrl}
                          controls
                          className="w-full h-auto rounded"
                          style={{ maxHeight: '200px' }}
                          onError={(e) => {
                            console.error('Failed to load upscaled video preview');
                            setPreviewUrl(null);
                          }}
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Upscaled result"
                          className="w-full h-auto rounded"
                          style={{ maxHeight: '200px', objectFit: 'contain' }}
                          onError={(e) => {
                            console.error('Failed to load upscaled image preview');
                            setPreviewUrl(null);
                          }}
                        />
                      )
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
                        Click "Upscale" to see result
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {outputPath && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600 text-center">
                    File: {outputPath.split('/').pop()}
                  </p>
                  <button
                    onClick={handleDownload}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Save As...
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIVideoUpscaler;