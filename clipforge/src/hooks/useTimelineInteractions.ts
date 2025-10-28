import { useState, useCallback } from 'react';
import { useTimelineStore } from '../state/timelineStore';

interface UseTrimmingProps {
  clipId: string;
  pixelsPerSecond: number;
}

export function useTimelineInteractions({ clipId, pixelsPerSecond }: UseTrimmingProps) {
  const { clips, setClipTrim } = useTimelineStore();
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clip = clips.find(c => c.id === clipId);

  const onTrimStart = useCallback((handle: 'start' | 'end') => {
    if (!clip) return;
    
    setActiveHandle(handle);
    setIsDragging(true);
    
    console.log('🎬 Starting trim:', { 
      clipId, 
      handle, 
      currentTrimIn: clip.trimIn, 
      currentTrimOut: clip.trimOut,
      originalDuration: clip.originalDuration
    });
  }, [clip, clipId]);

  const onTrimMove = useCallback((deltaX: number) => {
    if (!activeHandle || !clip) return;
    
    const deltaSeconds = deltaX / pixelsPerSecond;
    setClipTrim(clipId, activeHandle, deltaSeconds);
  }, [activeHandle, clip, clipId, pixelsPerSecond, setClipTrim]);

  const onTrimEnd = useCallback(() => {
    if (!activeHandle) return;
    
    console.log('🎬 Ending trim:', { 
      clipId, 
      handle: activeHandle,
      finalTrimIn: clip?.trimIn,
      finalTrimOut: clip?.trimOut
    });
    
    setActiveHandle(null);
    setIsDragging(false);
  }, [activeHandle, clipId, clip]);

  const onSplit = useCallback((splitTime: number) => {
    if (!clip) return;
    
    console.log('🎬 Splitting clip:', { 
      clipId, 
      splitTime,
      clipStart: clip.startTime,
      clipEnd: clip.endTime
    });
    
    // This would be called from the timeline component
    // The actual split logic is in the store
  }, [clip, clipId]);

  return {
    activeHandle,
    isDragging,
    onTrimStart,
    onTrimMove,
    onTrimEnd,
    onSplit,
    clip
  };
}
