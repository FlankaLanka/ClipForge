import { create } from 'zustand';

export interface TimelineClip {
  id: string;
  src: string;         // path to source video
  name: string;
  startTime: number;   // when it appears in timeline (seconds)
  endTime: number;     // when it ends in timeline (seconds)
  trimIn: number;      // start position (seconds) inside source file
  trimOut: number;     // end position (seconds) inside source file
  duration: number;    // actual duration of trimmed clip (trimOut - trimIn)
  originalDuration: number; // total length of source video
  width: number;       // video width
  height: number;      // video height
  fps: number;         // video fps
  color: string;       // clip color
}

export interface TimelineState {
  // Core timeline data
  clips: TimelineClip[];
  playheadTime: number;
  zoomLevel: number;
  panOffset: number;
  selectedClipIds: string[];
  isPlaying: boolean;
  
  // Timeline settings
  pixelsPerSecond: number;
  trackHeight: number;
  snapThreshold: number;
  
  // Actions
  addClip: (clip: Omit<TimelineClip, 'id'>) => void;
  moveClip: (id: string, newStartTime: number) => void;
  
  // CapCut-style trimming
  setClipTrim: (id: string, handle: 'start' | 'end', deltaSeconds: number) => void;
  trimClip: (id: string, newTrimIn: number, newTrimOut: number) => void; // Legacy
  checkCollision: (clips: TimelineClip[], clipId: string, newStartTime: number, newEndTime: number) => boolean;
  checkTrimCollision: (clips: TimelineClip[], clipId: string, handle: 'start' | 'end', newStartTime: number, newEndTime: number) => boolean;
  
  // Splitting
  splitClip: (id: string, splitTime: number) => void;
  
  // Other actions
  deleteClip: (id: string) => void;
  duplicateClip: (id: string) => void;
  
  // Playhead and playback
  setPlayheadTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  stepPlayhead: (direction: 'forward' | 'backward') => void;
  
  // Timeline navigation
  setZoomLevel: (zoom: number) => void;
  setPanOffset: (offset: number) => void;
  zoomToFit: () => void;
  zoomToSelection: () => void;
  
  // Selection
  selectClip: (id: string) => void;
  selectClips: (ids: string[]) => void;
  clearSelection: () => void;
  toggleClipSelection: (id: string) => void;
  
  // Snapping
  getSnapPosition: (time: number) => number;
  
  // Timeline bounds
  getTimelineDuration: () => number;
  getVisibleTimeRange: () => { start: number; end: number };
  
  // Clip operations
  getClipAtTime: (time: number) => TimelineClip | null;
  getClipsInRange: (startTime: number, endTime: number) => TimelineClip[];
  canPlaceClip: (startTime: number, endTime: number, excludeId?: string) => boolean;
}

// Track colors for visual distinction
const TRACK_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
];

export const useTimelineStore = create<TimelineState>((set, get) => ({
  // Initial state
  clips: [],
  playheadTime: 0,
  zoomLevel: 1,
  panOffset: 0,
  selectedClipIds: [],
  isPlaying: false,
  
  // Timeline settings
  pixelsPerSecond: 100, // 100 pixels per second at zoom level 1
  trackHeight: 60,
  snapThreshold: 0.25, // 0.25 seconds
  
  // Add clip to timeline
  addClip: (clipData) => {
    const id = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const color = '#3b82f6'; // Default blue color
    
    const clip: TimelineClip = {
      ...clipData,
      id,
      color,
      duration: clipData.trimOut - clipData.trimIn,
    };
    
    set((state) => ({
      clips: [...state.clips, clip].sort((a, b) => a.startTime - b.startTime)
    }));
  },
  
  // Move clip to new start time
  moveClip: (id, newStartTime) => {
    set((state) => {
      const clip = state.clips.find(c => c.id === id);
      if (!clip) return state;
      
      const newEndTime = newStartTime + clip.duration;
      
      // Check for collision with other clips
      if (state.checkCollision(state.clips, id, newStartTime, newEndTime)) {
        console.log('🎬 Collision detected when moving clip, preventing update');
        return state; // Don't update if there's a collision
      }
      
      return {
        clips: state.clips.map(clip => 
          clip.id === id 
            ? { 
                ...clip, 
                startTime: newStartTime,
                endTime: newEndTime
              }
            : clip
        ).sort((a, b) => a.startTime - b.startTime)
      };
    });
  },
  
  // Trim clip (change in/out points)
  trimClip: (id, newTrimIn, newTrimOut) => {
    set((state) => ({
      clips: state.clips.map(clip => 
        clip.id === id 
          ? { 
              ...clip, 
              trimIn: newTrimIn,
              trimOut: newTrimOut,
              endTime: clip.startTime + (newTrimOut - newTrimIn) // Update endTime based on new duration
            }
          : clip
      )
    }));
  },

  // Helper function to check for collisions with other clips
  checkCollision: (clips, clipId, newStartTime, newEndTime) => {
    return clips.some((clip) => {
      if (clip.id === clipId) return false;
      const clipEnd = clip.startTime + (clip.trimOut - clip.trimIn);
      
      // Check if the new boundaries would overlap with existing clip
      // Only return true if there's actual overlap (not just touching)
      const hasOverlap = newStartTime < clipEnd && newEndTime > clip.startTime;
      
      return hasOverlap;
    });
  },

  // More precise collision detection for trimming operations
  checkTrimCollision: (clips, clipId, handle, newStartTime, newEndTime) => {
    return clips.some((clip) => {
      if (clip.id === clipId) return false;
      const clipEnd = clip.startTime + (clip.trimOut - clip.trimIn);
      
      // Only block if there's actual overlap (not just touching)
      const hasOverlap = newStartTime < clipEnd && newEndTime > clip.startTime;
      
      // Additional check: only block if we're actually extending into another clip's space
      // Allow touching at the edges
      const isJustTouching = (newStartTime === clipEnd) || (newEndTime === clip.startTime);
      
      return hasOverlap && !isJustTouching;
    });
  },

  // CapCut-style trimming: handles start/end independently
  setClipTrim: (id, handle, deltaSeconds) => {
    set((state) => {
      const clip = state.clips.find(c => c.id === id);
      if (!clip) return state;

      const updatedClip = { ...clip };

      if (handle === 'start') {
        // Trimming start: move trimIn and adjust startTime to maintain end position
        const newTrimIn = Math.min(
          Math.max(0, clip.trimIn + deltaSeconds),
          clip.trimOut - 0.1 // Minimum 0.1s duration
        );
        const trimDelta = newTrimIn - clip.trimIn;
        const newStartTime = clip.startTime + trimDelta;
        const newEndTime = clip.endTime; // End time stays the same when trimming start
        
        // Check for collision with other clips
        if (state.checkCollision(state.clips, id, newStartTime, newEndTime)) {
          console.log('🎬 Collision detected when trimming start, preventing update');
          return state; // Don't update if there's a collision
        }
        
        updatedClip.trimIn = newTrimIn;
        updatedClip.startTime = newStartTime;
      }

      if (handle === 'end') {
        // Trimming end: move trimOut and adjust endTime
        const newTrimOut = Math.max(
          Math.min(clip.originalDuration, clip.trimOut + deltaSeconds),
          clip.trimIn + 0.1 // Minimum 0.1s duration
        );
        const trimDelta = newTrimOut - clip.trimOut;
        const newEndTime = clip.endTime + trimDelta;
        const newStartTime = clip.startTime; // Start time stays the same when trimming end
        
        // Check for collision with other clips
        if (state.checkCollision(state.clips, id, newStartTime, newEndTime)) {
          console.log('🎬 Collision detected when trimming end, preventing update');
          return state; // Don't update if there's a collision
        }
        
        updatedClip.trimOut = newTrimOut;
        updatedClip.endTime = newEndTime;
      }

      // Update duration based on new trim values
      updatedClip.duration = updatedClip.trimOut - updatedClip.trimIn;

      return {
        clips: state.clips.map(c => c.id === id ? updatedClip : c)
      };
    });
  },
  
  // Split clip at specified time (CapCut-style)
  splitClip: (id, splitTime) => {
    set((state) => {
      const clip = state.clips.find(c => c.id === id);
      if (!clip) return state;

      // Calculate midpoint in source video
      const midpoint = splitTime - clip.startTime;
      const midSrcTime = clip.trimIn + midpoint;

      // Create left clip (first half)
      const leftClip: TimelineClip = {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        endTime: splitTime,
        trimOut: midSrcTime
      };

      // Create right clip (second half)
      const rightClip: TimelineClip = {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: splitTime,
        trimIn: midSrcTime
      };

      return {
        clips: state.clips
          .filter(c => c.id !== id)
          .concat([leftClip, rightClip])
          .sort((a, b) => a.startTime - b.startTime),
      };
    });
  },
  
  // Delete clip
  deleteClip: (id) => {
    set((state) => ({
      clips: state.clips.filter(clip => clip.id !== id),
      selectedClipIds: state.selectedClipIds.filter(clipId => clipId !== id)
    }));
  },
  
  // Duplicate clip
  duplicateClip: (id) => {
    const state = get();
    const clip = state.clips.find(c => c.id === id);
    if (!clip) return;
    
    const duplicatedClip: TimelineClip = {
      ...clip,
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: clip.endTime + 0.1, // Place after original with small gap
      endTime: clip.endTime + 0.1 + clip.duration,
    };
    
    set((state) => ({
      clips: [...state.clips, duplicatedClip].sort((a, b) => a.startTime - b.startTime)
    }));
  },
  
  // Playhead and playback
  setPlayheadTime: (time) => set({ playheadTime: Math.max(0, time) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  
  stepPlayhead: (direction) => {
    const state = get();
    const step = 1 / 30; // 1 frame at 30fps
    const newTime = direction === 'forward' 
      ? state.playheadTime + step
      : state.playheadTime - step;
    set({ playheadTime: Math.max(0, newTime) });
  },
  
  // Timeline navigation
  setZoomLevel: (zoom) => {
    const clampedZoom = Math.max(0.1, Math.min(10, zoom));
    set({ zoomLevel: clampedZoom });
  },
  
  setPanOffset: (offset) => set({ panOffset: offset }),
  
  zoomToFit: () => {
    const state = get();
    const duration = state.getTimelineDuration();
    if (duration === 0) return;
    
    const containerWidth = 800; // Timeline container width
    const targetPixelsPerSecond = containerWidth / duration;
    const zoom = targetPixelsPerSecond / state.pixelsPerSecond;
    
    set({ 
      zoomLevel: Math.max(0.1, Math.min(10, zoom)),
      panOffset: 0
    });
  },
  
  zoomToSelection: () => {
    const state = get();
    if (state.selectedClipIds.length === 0) return;
    
    const selectedClips = state.clips.filter(c => state.selectedClipIds.includes(c.id));
    if (selectedClips.length === 0) return;
    
    const minTime = Math.min(...selectedClips.map(c => c.startTime));
    const maxTime = Math.max(...selectedClips.map(c => c.endTime));
    const duration = maxTime - minTime;
    
    const containerWidth = 800;
    const targetPixelsPerSecond = containerWidth / duration;
    const zoom = targetPixelsPerSecond / state.pixelsPerSecond;
    
    set({ 
      zoomLevel: Math.max(0.1, Math.min(10, zoom)),
      panOffset: -minTime * state.pixelsPerSecond * state.zoomLevel
    });
  },
  
  // Selection
  selectClip: (id) => set({ selectedClipIds: [id] }),
  selectClips: (ids) => set({ selectedClipIds: ids }),
  clearSelection: () => set({ selectedClipIds: [] }),
  toggleClipSelection: (id) => {
    set((state) => ({
      selectedClipIds: state.selectedClipIds.includes(id)
        ? state.selectedClipIds.filter(clipId => clipId !== id)
        : [...state.selectedClipIds, id]
    }));
  },
  
  // Snapping
  getSnapPosition: (time) => {
    const state = get();
    const threshold = state.snapThreshold;
    
    // Snap to playhead
    if (Math.abs(time - state.playheadTime) < threshold) {
      return state.playheadTime;
    }
    
    // Snap to other clips
    for (const clip of state.clips) {
      if (Math.abs(time - clip.startTime) < threshold) {
        return clip.startTime;
      }
      if (Math.abs(time - clip.endTime) < threshold) {
        return clip.endTime;
      }
    }
    
    return time;
  },
  
  // Timeline bounds
  getTimelineDuration: () => {
    const state = get();
    if (state.clips.length === 0) return 0;
    return Math.max(...state.clips.map(clip => clip.endTime));
  },
  
  getVisibleTimeRange: () => {
    const state = get();
    const containerWidth = 800;
    const startTime = -state.panOffset / (state.pixelsPerSecond * state.zoomLevel);
    const endTime = startTime + containerWidth / (state.pixelsPerSecond * state.zoomLevel);
    return { start: startTime, end: endTime };
  },
  
  // Clip operations
  getClipAtTime: (time) => {
    const state = get();
    return state.clips.find(clip => 
      clip.startTime <= time && 
      clip.endTime >= time
    ) || null;
  },
  
  getClipsInRange: (startTime, endTime) => {
    const state = get();
    return state.clips.filter(clip => 
      (clip.startTime < endTime && clip.endTime > startTime)
    );
  },
  
  canPlaceClip: (startTime, endTime, excludeId) => {
    const state = get();
    return !state.clips.some(clip => 
      clip.id !== excludeId &&
      clip.startTime < endTime && 
      clip.endTime > startTime
    );
  },
}));
