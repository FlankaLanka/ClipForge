import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { 
  Wand2, 
  Download, 
  Loader2, 
  Image as ImageIcon,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface GenerationResult {
  output_path: string;
  success: boolean;
  message: string;
}

const DALLEImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<string>('1024x1024');
  const [imageQuality, setImageQuality] = useState<string>('standard');

  const imageSizes = [
    { value: '1024x1024', label: '1024×1024', description: 'Square' },
    { value: '1792x1024', label: '1792×1024', description: 'Landscape' },
    { value: '1024x1792', label: '1024×1792', description: 'Portrait' }
  ];

  const qualityOptions = [
    { value: 'standard', label: 'Standard', description: 'Faster generation' },
    { value: 'hd', label: 'HD', description: 'Higher quality' }
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    console.log('Starting DALL-E image generation...');
    console.log('Prompt:', prompt.trim());
    console.log('Size:', imageSize);
    console.log('Quality:', imageQuality);

    setIsGenerating(true);
    setError(null);
    setGeneratedImageUrl(null);

    try {
      console.log('Calling generate_image_with_dalle command...');
      
      // Test if we can call a known command first
      try {
        console.log('Testing with known command...');
        await invoke('get_openai_api_key');
        console.log('Known command works, proceeding with DALL-E...');
      } catch (testErr) {
        console.log('Test command failed, but continuing...', testErr);
      }
      
      const result = await invoke<GenerationResult>('generate_image_with_dalle', {
        prompt: prompt.trim(),
        size: imageSize,
        quality: imageQuality
      });

      console.log('DALL-E generation result:', result);

      if (result.success) {
        console.log('Generation successful, creating image URL...');
        const imageUrl = convertFileSrc(result.output_path) + `?t=${Date.now()}`;
        console.log('Image URL:', imageUrl);
        setGeneratedImageUrl(imageUrl);
      } else {
        console.error('Generation failed:', result.message);
        setError(result.message);
      }
    } catch (err) {
      console.error('DALL-E generation error:', err);
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImageUrl) return;

    try {
      const selectedPath = await save({
        defaultPath: `dalle_generated_${Date.now()}.png`,
        filters: [
          {
            name: 'PNG Images',
            extensions: ['png']
          }
        ]
      });

      if (selectedPath) {
        // Extract the actual file path from the URL
        const url = new URL(generatedImageUrl);
        const filePath = url.pathname.replace('/api/fs/', '');
        
        await invoke('copy_file_to_location', {
          sourcePath: filePath,
          destinationPath: selectedPath
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">DALL-E Image Generator</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate... (e.g., 'A futuristic cityscape at sunset with flying cars')"
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* Image Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Size
            </label>
            <div className="grid grid-cols-1 gap-2">
              {imageSizes.map(size => (
                <button
                  key={size.value}
                  onClick={() => setImageSize(size.value)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg text-left transition-all ${
                    imageSize === size.value
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <div className="font-medium">{size.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{size.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Quality
            </label>
            <div className="grid grid-cols-2 gap-3">
              {qualityOptions.map(quality => (
                <button
                  key={quality.value}
                  onClick={() => setImageQuality(quality.value)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg text-center transition-all ${
                    imageQuality === quality.value
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  <div className="font-medium">{quality.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{quality.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Processing Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-blue-700">
                DALL-E generation takes 10-30 seconds
              </p>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Image
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">Error</h4>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Generated Image */}
        <div className="space-y-4">
          {generatedImageUrl && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated Image
              </label>
              <div className="relative">
                <img
                  src={generatedImageUrl}
                  alt="Generated by DALL-E"
                  className="w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                  onError={() => setError('Failed to load generated image')}
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={handleDownload}
                    className="bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-sm transition-colors"
                    title="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!generatedImageUrl && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-center">
                Enter a prompt and click "Generate Image" to create an AI-generated image
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DALLEImageGenerator;
