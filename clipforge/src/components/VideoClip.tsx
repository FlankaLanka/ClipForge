import { useState, useRef, useEffect } from 'react';
import { Scissors, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useTimelineStore } from '../state/timelineStore';

export interface VideoClipData {
  id: string;
  name: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  color: string;
  trimStart: number; // how much trimmed from start
  trimEnd: number; // how much trimmed from end
  originalDuration: number; // original duration before trimming
}

interface VideoClipProps {
  clip: VideoClipData;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (id: string, startTime: number) => void;
  onUpdateTrim: (id: string, trimStart: number, trimEnd: number) => void;
  onSplit: (id: string) => void;
  onDelete: (id: string) => void;
}

// Helper function to format time in MM:SS format
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 10); // Show 1 decimal place for precision
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${remainingSeconds}.${milliseconds}`;
  }
};

export function VideoClip({
  clip,
  scale,
  isSelected,
  onSelect,
  onUpdatePosition,
  onUpdateTrim,
  onSplit,
  onDelete,
}: VideoClipProps) {
  const { setClipTrim, checkTrimCollision, clips } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startTime: 0 });
  const [trimStart, setTrimStart] = useState({ x: 0, trim: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [cumulativeDelta, setCumulativeDelta] = useState(0);
  const [collisionDetected, setCollisionDetected] = useState(false);
  const clipRef = useRef<HTMLDivElement>(null);

  const trackHeight = 64; // 16 * 4 (h-16)
  const trackLabelWidth = 48; // 12 * 4 (w-12)

  useEffect(() => {
    if (!isDragging && !isTrimming) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const newStartTime = dragStart.startTime + deltaX / scale;
        onUpdatePosition(clip.id, newStartTime);
      } else if (isTrimming === 'start') {
        const deltaX = e.clientX - trimStart.x;
        const deltaSeconds = deltaX / scale;
        
        // Throttle updates to prevent excessive state changes
        const now = performance.now();
        if (now - lastUpdateTime > 16) { // ~60fps
          setLastUpdateTime(now);
          
          // Only update if there's a meaningful change
          if (Math.abs(deltaSeconds) > 0.01) {
            // Check for collision before attempting to trim
            const newTrimIn = Math.min(
              Math.max(0, clip.trimIn + deltaSeconds),
              clip.trimOut - 0.1
            );
            const trimDelta = newTrimIn - clip.trimIn;
            const newStartTime = clip.startTime + trimDelta;
            const newEndTime = clip.endTime;
            
            const wouldCollide = checkTrimCollision(clips, clip.id, 'start', newStartTime, newEndTime, clip.track);
            setCollisionDetected(wouldCollide);
            
            if (!wouldCollide) {
              console.log('🎬 Trimming start (CapCut):', { 
                clipId: clip.id, 
                deltaX, 
                deltaSeconds, 
                currentTrimStart: clip.trimStart,
                currentTrimEnd: clip.trimEnd
              });
              setClipTrim(clip.id, 'start', deltaSeconds);
              
              // Update the trim start position for next frame
              setTrimStart(prev => ({ ...prev, x: e.clientX }));
            }
          }
        }
      } else if (isTrimming === 'end') {
        const deltaX = e.clientX - trimStart.x;
        const deltaSeconds = deltaX / scale;
        
        // Throttle updates to prevent excessive state changes
        const now = performance.now();
        if (now - lastUpdateTime > 16) { // ~60fps
          setLastUpdateTime(now);
          
          // Only update if there's a meaningful change
          if (Math.abs(deltaSeconds) > 0.01) {
            // Check for collision before attempting to trim
            const newTrimOut = Math.max(
              Math.min(clip.originalDuration, clip.trimOut + deltaSeconds),
              clip.trimIn + 0.1
            );
            const trimDelta = newTrimOut - clip.trimOut;
            const newEndTime = clip.endTime + trimDelta;
            const newStartTime = clip.startTime;
            
            const wouldCollide = checkTrimCollision(clips, clip.id, 'end', newStartTime, newEndTime, clip.track);
            setCollisionDetected(wouldCollide);
            
            if (!wouldCollide) {
              console.log('🎬 Trimming end (CapCut):', { 
                clipId: clip.id, 
                deltaX, 
                deltaSeconds, 
                currentTrimStart: clip.trimStart,
                currentTrimEnd: clip.trimEnd
              });
              setClipTrim(clip.id, 'end', deltaSeconds);
              
              // Update the trim start position for next frame
              setTrimStart(prev => ({ ...prev, x: e.clientX }));
            }
          }
        }
      }
    };

  const handleMouseUp = () => {
    console.log('🎬 Mouse up:', { 
      clipId: clip.id, 
      wasDragging: isDragging, 
      wasTrimming: isTrimming,
      finalTrimStart: clip.trimStart,
      finalTrimEnd: clip.trimEnd
    });
    setIsDragging(false);
    setIsTrimming(null);
    setCumulativeDelta(0);
    setLastUpdateTime(0);
    setCollisionDetected(false);
  };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isTrimming, dragStart, trimStart, clip, scale, onUpdatePosition, onUpdateTrim]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle drag if clicking on the center draggable area
    if (!(e.target as HTMLElement).closest('.clip-draggable-area')) return;
    
    // Don't start dragging if we're already trimming
    if (isTrimming) return;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent timeline deselection
    onSelect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startTime: clip.startTime,
    });
  };

  const handleTrimStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    
    // Clear any existing dragging state
    setIsDragging(false);
    setIsTrimming('start');
    setCumulativeDelta(0);
    setLastUpdateTime(0);
    console.log('🎬 Starting trim from start:', { 
      clipId: clip.id, 
      currentTrimStart: clip.trimStart, 
      currentTrimEnd: clip.trimEnd,
      originalDuration: clip.originalDuration
    });
    setTrimStart({
      x: e.clientX,
      trim: clip.trimStart,
    });
  };

  const handleTrimEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    
    // Clear any existing dragging state
    setIsDragging(false);
    setIsTrimming('end');
    setCumulativeDelta(0);
    setLastUpdateTime(0);
    console.log('🎬 Starting trim from end:', { 
      clipId: clip.id, 
      currentTrimStart: clip.trimStart, 
      currentTrimEnd: clip.trimEnd,
      originalDuration: clip.originalDuration
    });
    setTrimStart({
      x: e.clientX,
      trim: clip.trimEnd,
    });
  };

  const width = clip.duration * scale;
  const left = trackLabelWidth + clip.startTime * scale;
  const top = 4; // Fixed position at top of single track

  return (
    <div
      ref={clipRef}
      className={`absolute rounded select-none ${
        isDragging ? '' : 'transition-all duration-200'
      } ${
        isSelected 
          ? 'ring-2 ring-blue-400 shadow-lg' 
          : 'hover:shadow-md'
      } ${isDragging ? 'opacity-70' : ''}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: '56px',
        marginTop: '4px',
        background: clip.color,
        opacity: isDragging ? 0.7 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent timeline deselection
        onSelect();
      }}
    >
      {/* Trim handle - Start */}
      <div
        className="trim-handle absolute left-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white/60 cursor-ew-resize rounded-l"
        onMouseDown={handleTrimStart}
      />

      {/* Draggable center area - only this area allows moving the clip */}
      <div 
        className="clip-draggable-area absolute left-2 right-2 top-0 bottom-0 cursor-move"
        onMouseDown={handleMouseDown}
      >
        {/* Content */}
        <div className="px-3 py-2 overflow-hidden h-full flex items-center justify-between relative z-10">
          {/* Start Time */}
          <div className="text-white text-xs font-mono">
            {formatTime(clip.trimStart)}
          </div>
          
          {/* Center: Filename and Duration */}
          <div className="flex-1 text-center px-2">
            <div className="text-white text-xs font-medium truncate">
              {clip.name.replace(/\.[^/.]+$/, '')}
            </div>
            <div className="text-white/80 text-xs">
              {clip.duration.toFixed(1)}s
            </div>
          </div>
          
          {/* End Time */}
          <div className="text-white text-xs font-mono">
            {formatTime(clip.trimEnd)}
          </div>
        </div>
      </div>
      
      {/* Collision warning */}
      {collisionDetected && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
          Cannot extend
        </div>
      )}

      {/* Trim handle - End */}
      <div
        className="trim-handle absolute right-0 top-0 bottom-0 w-2 bg-white/40 hover:bg-white/60 cursor-ew-resize rounded-r"
        onMouseDown={handleTrimEnd}
      />

      {/* Action buttons - appear when selected */}
      {isSelected && (
        <div className="absolute -top-8 left-0 flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 bg-blue-500 hover:bg-blue-600 text-white text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSplit(clip.id);
            }}
          >
            <Scissors className="h-3 w-3" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 bg-red-500 hover:bg-red-600 text-white text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(clip.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
