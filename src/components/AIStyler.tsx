import React, { useState } from 'react';
import { Image, Video, Download, Upload, Palette, Zap } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface FilterOption {
  id: string;
  name: string;
  description: string;
  ffmpegFilter: string;
  category: 'basic' | 'color' | 'effects';
}

const FILTERS: FilterOption[] = [
  // Basic filters
  { id: 'grayscale', name: 'Grayscale', description: 'Convert to black and white', ffmpegFilter: 'hue=s=0', category: 'basic' },
  { id: 'edge_detect', name: 'Edge Detection', description: 'Highlight edges and outlines', ffmpegFilter: 'edgedetect=low=0.1:high=0.4', category: 'basic' },
  { id: 'blur', name: 'Blur', description: 'Apply blur effect', ffmpegFilter: 'gblur=sigma=2', category: 'basic' },
  { id: 'sharpen', name: 'Sharpen', description: 'Enhance image sharpness', ffmpegFilter: 'unsharp=5:5:1.0:5:5:0.0', category: 'basic' },
  
  // Color filters
  { id: 'sepia', name: 'Sepia', description: 'Vintage sepia tone', ffmpegFilter: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131', category: 'color' },
  { id: 'vintage', name: 'Vintage', description: 'Old film look', ffmpegFilter: 'curves=vintage', category: 'color' },
  { id: 'invert', name: 'Invert', description: 'Invert colors', ffmpegFilter: 'negate', category: 'color' },
  { id: 'saturate', name: 'High Saturation', description: 'Boost color intensity', ffmpegFilter: 'eq=saturation=2.0', category: 'color' },
  
  // Effects
  { id: 'pixelate', name: 'Pixelate', description: 'Create pixel art effect', ffmpegFilter: 'scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor', category: 'effects' },
  { id: 'emboss', name: 'Emboss', description: '3D embossed effect', ffmpegFilter: 'convolution=0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0', category: 'effects' },
  { id: 'oil_paint', name: 'Oil Paint', description: 'Oil painting effect', ffmpegFilter: 'gblur=sigma=1.5,eq=saturation=1.5', category: 'effects' },
];

const AIStyler: React.FC = () => {
  const [inputFile, setInputFile] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

  const handleFileSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
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

  const handleFilterToggle = (filterId: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const handleProcess = async () => {
    if (!inputFile || selectedFilters.length === 0) {
      setError('Please select a file and at least one filter');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setPreviewUrl(null); // Clear previous preview

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      const result = await invoke<{ output_path: string }>('apply_filters', {
        inputPath: inputFile,
        filters: selectedFilters,
        fileType: fileType
      });

      setOutputPath(result.output_path);
      
      // Create preview URL for the processed file with cache busting
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
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Let user choose save location
      const selectedPath = await save({
        defaultPath: outputPath.split('/').pop() || 'processed_file',
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

  const getFiltersByCategory = (category: FilterOption['category']) => 
    FILTERS.filter(filter => filter.category === category);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Media Styler</h2>
        <p className="text-gray-600">Apply filters and effects to images and videos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input and Controls */}
        <div className="space-y-6">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Media File
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
                  <p className="text-xs text-gray-500">Images or videos</p>
                </div>
              )}
            </div>
          </div>

          {/* Filter Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Filters ({selectedFilters.length} selected)
            </label>
            
            {/* Basic Filters */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-1" />
                Basic Filters
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {getFiltersByCategory('basic').map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterToggle(filter.id)}
                    className={`p-3 rounded-lg text-left text-sm transition-all ${
                      selectedFilters.includes(filter.id)
                        ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium">{filter.name}</div>
                    <div className="text-xs text-gray-500">{filter.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Filters */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                <Palette className="w-4 h-4 mr-1" />
                Color Filters
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {getFiltersByCategory('color').map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterToggle(filter.id)}
                    className={`p-3 rounded-lg text-left text-sm transition-all ${
                      selectedFilters.includes(filter.id)
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium">{filter.name}</div>
                    <div className="text-xs text-gray-500">{filter.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Effects */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-1" />
                Effects
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {getFiltersByCategory('effects').map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => handleFilterToggle(filter.id)}
                    className={`p-3 rounded-lg text-left text-sm transition-all ${
                      selectedFilters.includes(filter.id)
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                    disabled={isProcessing}
                  >
                    <div className="font-medium">{filter.name}</div>
                    <div className="text-xs text-gray-500">{filter.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Process Button */}
          <button
            onClick={handleProcess}
            disabled={!inputFile || selectedFilters.length === 0 || isProcessing}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? 'Processing...' : `Apply ${selectedFilters.length} Filter${selectedFilters.length !== 1 ? 's' : ''}`}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Right Column - Comparison Preview */}
        <div className="space-y-4">
          {originalPreviewUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Original vs Processed
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

                {/* Processed */}
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-center">
                    {outputPath ? 'Processed' : 'No filters applied'}
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
                            console.error('Failed to load processed video preview');
                            setPreviewUrl(null);
                          }}
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="Processed result"
                          className="w-full h-auto rounded"
                          style={{ maxHeight: '200px', objectFit: 'contain' }}
                          onError={(e) => {
                            console.error('Failed to load processed image preview');
                            setPreviewUrl(null);
                          }}
                        />
                      )
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm">
                        Apply filters to see result
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

export default AIStyler;
