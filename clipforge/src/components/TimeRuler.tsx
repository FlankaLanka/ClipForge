import React from 'react';

interface TimeRulerProps {
  duration: number;
  scale: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  trackLabelWidth: number;
}

export function TimeRuler({ duration, scale, currentTime, onTimeChange, trackLabelWidth }: TimeRulerProps) {
  // Calculate appropriate time scale based on zoom level
  const getTimeScale = (scale: number) => {
    if (scale >= 200) return 0.1; // 100ms intervals
    if (scale >= 100) return 0.5; // 500ms intervals
    if (scale >= 50) return 1;    // 1s intervals
    if (scale >= 25) return 2;    // 2s intervals
    if (scale >= 10) return 5;    // 5s intervals
    if (scale >= 5) return 10;    // 10s intervals
    return 30; // 30s intervals
  };

  const timeScale = getTimeScale(scale);
  const totalWidth = duration * scale;
  const majorInterval = timeScale >= 1 ? Math.ceil(timeScale) : timeScale;
  const minorInterval = majorInterval / 5;

  // Generate time markers
  const generateMarkers = () => {
    const markers = [];
    const maxTime = Math.ceil(duration / timeScale) * timeScale;
    
    // Use integer-based iteration to avoid floating-point errors
    const steps = Math.ceil(maxTime / minorInterval);
    
    for (let i = 0; i <= steps; i++) {
      const time = i * minorInterval;
      // Round to avoid floating-point precision issues
      const roundedTime = Math.round(time * 1000) / 1000;
      const isMajor = Math.abs(roundedTime % majorInterval) < 0.001;
      const left = trackLabelWidth + time * scale;
      
      markers.push(
        <div
          key={time}
          className={`absolute top-0 border-l ${
            isMajor 
              ? 'h-full border-gray-400' 
              : 'h-3/4 border-gray-300'
          }`}
          style={{ left }}
        >
          {isMajor && (
            <span className="absolute top-1 left-1 text-xs text-gray-600 font-mono">
              {formatTime(roundedTime)}
            </span>
          )}
        </div>
      );
    }
    
    return markers;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(seconds < 1 ? 1 : 0)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - trackLabelWidth;
    const time = Math.max(0, Math.min(duration, x / scale));
    onTimeChange(time);
  };

  return (
    <div 
      className="h-8 bg-gray-50 border-b border-gray-300 relative cursor-pointer select-none"
      onClick={handleRulerClick}
    >
      {/* Time markers */}
      {generateMarkers()}
      
      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
        style={{ left: trackLabelWidth + currentTime * scale }}
      >
        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-sm" />
      </div>
      
    </div>
  );
}
