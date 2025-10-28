import React from 'react';
import { useEditorStore } from '../state/useEditorStore';

const TestData: React.FC = () => {
  const { addClip } = useEditorStore();

  const addSampleClips = () => {
    const sampleClips = [
      {
        id: 'sample-1',
        file_path: '/path/to/sample1.mp4',
        metadata: {
          duration: 15.2,
          width: 1920,
          height: 1080,
          fps: 30,
          file_size: 2048000,
          format: 'mp4'
        },
        start_time: 0.0,
        end_time: 15.2
      },
      {
        id: 'sample-2',
        file_path: '/path/to/sample2.mp4',
        metadata: {
          duration: 8.7,
          width: 1280,
          height: 720,
          fps: 24,
          file_size: 1536000,
          format: 'mp4'
        },
        start_time: 0.0,
        end_time: 8.7
      },
      {
        id: 'sample-3',
        file_path: '/path/to/sample3.mp4',
        metadata: {
          duration: 25.1,
          width: 1920,
          height: 1080,
          fps: 60,
          file_size: 5120000,
          format: 'mp4'
        },
        start_time: 0.0,
        end_time: 25.1
      }
    ];

    sampleClips.forEach(clip => addClip(clip));
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Test Data</h3>
      <p className="text-sm text-gray-500 mb-4">
        Add sample video clips for testing the application
      </p>
      <button
        onClick={addSampleClips}
        className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
      >
        Add Sample Clips
      </button>
    </div>
  );
};

export default TestData;
