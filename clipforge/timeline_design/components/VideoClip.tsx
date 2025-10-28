import { useState, useRef, useEffect } from 'react';
import { VideoClipData } from './Timeline';
import { Scissors, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface VideoClipProps {
  clip: VideoClipData;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (id: string, startTime: number, track: number) => void;
  onUpdateTrim: (id: string, trimStart: number, trimEnd: number) => void;
  onSplit: (id: string) => void;
  onDelete: (id: string) => void;
}

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
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startTime: 0, track: 0 });
  const [trimStart, setTrimStart] = useState({ x: 0, trim: 0 });
  const clipRef = useRef<HTMLDivElement>(null);

  const trackHeight = 64; // 16 * 4 (h-16)
  const trackLabelWidth = 48; // 12 * 4 (w-12)

  useEffect(() => {
    if (!isDragging && !isTrimming) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const newStartTime = dragStart.startTime + deltaX / scale;
        const newTrack = dragStart.track + Math.round(deltaY / trackHeight);
        onUpdatePosition(clip.id, newStartTime, newTrack);
      } else if (isTrimming === 'start') {
        const deltaX = e.clientX - trimStart.x;
        const trimDelta = deltaX / scale;
        const newTrimStart = trimStart.trim + trimDelta;
        onUpdateTrim(clip.id, newTrimStart, clip.trimEnd);
      } else if (isTrimming === 'end') {
        const deltaX = e.clientX - trimStart.x;
        const trimDelta = -deltaX / scale;
        const newTrimEnd = trimStart.trim + trimDelta;
        onUpdateTrim(clip.id, clip.trimStart, newTrimEnd);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsTrimming(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isTrimming, dragStart, trimStart, clip, scale, onUpdatePosition, onUpdateTrim]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.trim-handle, .clip-button')) return;
    
    e.preventDefault();
    onSelect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startTime: clip.startTime,
      track: clip.track,
    });
  };

  const handleTrimStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsTrimming('start');
    setTrimStart({
      x: e.clientX,
      trim: clip.trimStart,
    });
  };

  const handleTrimEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsTrimming('end');
    setTrimStart({
      x: e.clientX,
      trim: clip.trimEnd,
    });
  };

  const width = clip.duration * scale;
  const left = trackLabelWidth + clip.startTime * scale;
  const top = clip.track * trackHeight;

  return (
    <div
      ref={clipRef}
      className={`absolute rounded cursor-move select-none transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''
      }`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: '56px',
        marginTop: '4px',
        backgroundColor: clip.color,
        opacity: isDragging ? 0.7 : 1,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Trim handle - Start */}
      <div
        className="trim-handle absolute left-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize transition-colors"
        onMouseDown={handleTrimStart}
      >
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-full" />
      </div>

      {/* Content */}
      <div className="px-3 py-2 overflow-hidden h-full flex flex-col justify-between">
        <div className="text-white text-xs truncate">{clip.name}</div>
        <div className="text-white/60 text-xs">
          {clip.duration.toFixed(1)}s
        </div>
      </div>

      {/* Trim handle - End */}
      <div
        className="trim-handle absolute right-0 top-0 bottom-0 w-2 bg-white/20 hover:bg-white/40 cursor-ew-resize transition-colors"
        onMouseDown={handleTrimEnd}
      >
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-full" />
      </div>

      {/* Action buttons - appear when selected */}
      {isSelected && (
        <div className="absolute -top-8 left-0 flex gap-1 clip-button">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 bg-gray-200 hover:bg-gray-300 text-gray-700"
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
            className="h-6 w-6 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-700"
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
