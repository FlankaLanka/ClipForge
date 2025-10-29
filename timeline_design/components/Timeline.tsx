import { useState } from 'react';
import { VideoClip } from './VideoClip';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from './ui/button';

export interface VideoClipData {
  id: string;
  name: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  track: number; // vertical position (0 = top)
  color: string;
  trimStart: number; // how much trimmed from start
  trimEnd: number; // how much trimmed from end
  originalDuration: number; // original duration before trimming
}

export function Timeline() {
  const [clips, setClips] = useState<VideoClipData[]>([
    {
      id: '1',
      name: 'Intro.mp4',
      startTime: 0,
      duration: 5,
      track: 0,
      color: '#3b82f6',
      trimStart: 0,
      trimEnd: 0,
      originalDuration: 5,
    },
    {
      id: '2',
      name: 'Main_Scene.mp4',
      startTime: 4,
      duration: 8,
      track: 1,
      color: '#10b981',
      trimStart: 0,
      trimEnd: 0,
      originalDuration: 8,
    },
    {
      id: '3',
      name: 'Overlay.mp4',
      startTime: 6,
      duration: 4,
      track: 0,
      color: '#f59e0b',
      trimStart: 0,
      trimEnd: 0,
      originalDuration: 4,
    },
  ]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [scale, setScale] = useState(40); // pixels per second

  const maxTime = Math.max(
    ...clips.map((clip) => clip.startTime + clip.duration),
    20
  );
  const trackCount = Math.max(...clips.map((clip) => clip.track)) + 1;

  const checkCollision = (
    clipId: string,
    startTime: number,
    duration: number,
    track: number
  ): boolean => {
    const clipEnd = startTime + duration;
    return clips.some((clip) => {
      if (clip.id === clipId || clip.track !== track) return false;
      const otherEnd = clip.startTime + clip.duration;
      return !(clipEnd <= clip.startTime || startTime >= otherEnd);
    });
  };

  const updateClipPosition = (id: string, newStartTime: number, newTrack: number) => {
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;

    const clampedStartTime = Math.max(0, newStartTime);
    const clampedTrack = Math.max(0, newTrack);

    // Check for collision
    if (checkCollision(id, clampedStartTime, clip.duration, clampedTrack)) {
      return; // Don't update if there's a collision
    }

    setClips((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, startTime: clampedStartTime, track: clampedTrack }
          : c
      )
    );
  };

  const updateClipTrim = (id: string, trimStart: number, trimEnd: number) => {
    setClips((prev) =>
      prev.map((clip) => {
        if (clip.id === id) {
          const newTrimStart = Math.max(0, Math.min(trimStart, clip.originalDuration - 0.1));
          const newTrimEnd = Math.max(0, Math.min(trimEnd, clip.originalDuration - 0.1));
          const newDuration = clip.originalDuration - newTrimStart - newTrimEnd;
          const calculatedDuration = Math.max(0.1, newDuration);
          
          // Check for collision when trimming from the start (which changes position)
          if (trimStart !== clip.trimStart) {
            const newStartTime = clip.startTime + (newTrimStart - clip.trimStart);
            if (checkCollision(id, newStartTime, calculatedDuration, clip.track)) {
              return clip; // Don't update if there's a collision
            }
            return {
              ...clip,
              startTime: newStartTime,
              trimStart: newTrimStart,
              trimEnd: newTrimEnd,
              duration: calculatedDuration,
            };
          }
          
          // Trimming from the end - check collision
          if (checkCollision(id, clip.startTime, calculatedDuration, clip.track)) {
            return clip;
          }
          
          return {
            ...clip,
            trimStart: newTrimStart,
            trimEnd: newTrimEnd,
            duration: calculatedDuration,
          };
        }
        return clip;
      })
    );
  };

  const splitClip = (id: string) => {
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;

    const splitPoint = clip.duration / 2;
    const newClip1 = {
      ...clip,
      id: `${clip.id}-1`,
      duration: splitPoint,
      trimEnd: clip.trimEnd + (clip.duration - splitPoint),
    };
    const newClip2 = {
      ...clip,
      id: `${clip.id}-2`,
      startTime: clip.startTime + splitPoint,
      duration: clip.duration - splitPoint,
      trimStart: clip.trimStart + splitPoint,
    };

    setClips((prev) => prev.filter((c) => c.id !== id).concat([newClip1, newClip2]));
    setSelectedClipId(null);
  };

  const deleteClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (selectedClipId === id) {
      setSelectedClipId(null);
    }
  };

  return (
    <div className="h-80 bg-white border-t border-gray-300 flex flex-col">
      {/* Controls */}
      <div className="h-12 bg-gray-50 border-b border-gray-300 flex items-center px-4 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={() => setCurrentTime(0)}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 hover:text-gray-900"
          onClick={() => setCurrentTime(maxTime)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Zoom:</span>
          <input
            type="range"
            min="20"
            max="80"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="relative" style={{ minWidth: maxTime * scale }}>
          {/* Time ruler */}
          <div className="h-8 bg-gray-50 border-b border-gray-300 relative">
            {Array.from({ length: Math.ceil(maxTime) + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 h-full border-l border-gray-300"
                style={{ left: i * scale }}
              >
                <span className="text-xs text-gray-600 ml-1">{i}s</span>
              </div>
            ))}
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
              style={{ left: currentTime * scale }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-sm" />
            </div>
          </div>

          {/* Tracks */}
          <div className="relative">
            {Array.from({ length: Math.max(trackCount, 3) }).map((_, trackIndex) => (
              <div
                key={trackIndex}
                className="h-16 border-b border-gray-200 relative"
                style={{
                  background:
                    trackIndex % 2 === 0 ? 'rgb(249, 250, 251)' : 'rgb(255, 255, 255)',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-600">T{trackIndex + 1}</span>
                </div>
              </div>
            ))}

            {/* Video clips */}
            {clips.map((clip) => (
              <VideoClip
                key={clip.id}
                clip={clip}
                scale={scale}
                isSelected={selectedClipId === clip.id}
                onSelect={() => setSelectedClipId(clip.id)}
                onUpdatePosition={updateClipPosition}
                onUpdateTrim={updateClipTrim}
                onSplit={splitClip}
                onDelete={deleteClip}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
