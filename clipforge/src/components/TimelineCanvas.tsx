import React, { useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Line } from 'react-konva';
import { useEditorStore } from '../state/useEditorStore';

const TimelineCanvas: React.FC = () => {
  const stageRef = useRef<any>(null);
  const { timelineClips, playheadPosition, zoom, addToTimeline, clips, setZoom } = useEditorStore();
  const [dragOver, setDragOver] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    try {
      const clipData = e.dataTransfer.getData('application/json');
      const clip = JSON.parse(clipData);
      
      // Calculate position based on drop coordinates
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timePosition = x / (zoom * 10); // Convert pixels to time
      
      // Add to timeline
      addToTimeline(clip, 0, timePosition);
      console.log('Added clip to timeline:', clip.id, 'at position:', timePosition);
    } catch (error) {
      console.error('Failed to add clip to timeline:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Timeline</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
          >
            -
          </button>
          <span className="text-sm text-gray-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(10, zoom + 0.1))}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
          >
            +
          </button>
        </div>
      </div>

      <div
        className={`h-32 rounded-lg overflow-hidden transition-colors ${
          dragOver 
            ? 'bg-blue-100 border-2 border-blue-400 border-dashed' 
            : 'bg-gray-100'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Stage width={800} height={128}>
          <Layer>
            {/* Timeline background */}
            <Rect
              x={0}
              y={0}
              width={800}
              height={128}
              fill="#f3f4f6"
            />
            
            {/* Time ruler */}
            <Line
              points={[0, 20, 800, 20]}
              stroke="#d1d5db"
              strokeWidth={1}
            />
            
            {/* Time markers */}
            {Array.from({ length: 10 }, (_, i) => (
              <Line
                key={i}
                points={[i * 80, 20, i * 80, 30]}
                stroke="#9ca3af"
                strokeWidth={1}
              />
            ))}
            
            {/* Playhead */}
            <Line
              points={[playheadPosition * zoom * 10, 0, playheadPosition * zoom * 10, 128]}
              stroke="#ef4444"
              strokeWidth={2}
            />
            
            {/* Timeline clips */}
            {timelineClips.map((clip, index) => (
              <Rect
                key={clip.id}
                x={clip.position * zoom * 10}
                y={30 + (clip.track * 40)}
                width={Math.max(20, (clip.end_time - clip.start_time) * zoom * 10)}
                height={30}
                fill="#3b82f6"
                cornerRadius={4}
                draggable
                onDragEnd={(e) => {
                  // Update clip position
                  const newPosition = e.target.x() / (zoom * 10);
                  // This would update the clip position in the store
                }}
              />
            ))}
            
            {/* Empty state */}
            {timelineClips.length === 0 && (
              <Text
                x={400}
                y={64}
                text="Drag clips here to add to timeline"
                fontSize={14}
                fill="#9ca3af"
                align="center"
                offsetX={100}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default TimelineCanvas;
