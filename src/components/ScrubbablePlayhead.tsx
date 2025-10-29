import React, { useState, useRef, useEffect } from 'react';

interface ScrubbablePlayheadProps {
  currentTime: number;
  duration: number;
  scale: number;
  trackLabelWidth: number;
  onTimeChange: (time: number) => void;
  isPlaying: boolean;
}

export function ScrubbablePlayhead({ 
  currentTime, 
  duration, 
  scale, 
  trackLabelWidth, 
  onTimeChange, 
  isPlaying 
}: ScrubbablePlayheadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, time: 0 });
  const playheadRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      time: currentTime
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x;
      const deltaTime = deltaX / scale;
      const newTime = Math.max(0, Math.min(duration, dragStart.time + deltaTime));
      onTimeChange(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, scale, duration, onTimeChange]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds}`;
  };

  return (
    <div
      ref={playheadRef}
      className={`absolute top-0 bottom-0 w-0.5 z-30 ${
        isDragging ? 'bg-red-600' : 'bg-red-500'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} hover:bg-red-600 transition-colors`}
      style={{ 
        left: trackLabelWidth + currentTime * scale,
        pointerEvents: isPlaying ? 'none' : 'auto' // Disable scrubbing while playing
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Playhead handle */}
      <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-sm hover:bg-red-600 transition-colors" />
      
      {/* Time tooltip */}
      <div 
        className={`absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap ${
          isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}
      >
        {formatTime(currentTime)}
      </div>
      
      {/* Vertical line extending down through tracks */}
      <div className="absolute top-0 w-full bg-red-500/30 pointer-events-none" />
    </div>
  );
}
