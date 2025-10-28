import { create } from 'zustand';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  file_size: number;
  format: string;
}

export interface VideoClip {
  id: string;
  file_path: string;
  metadata: VideoMetadata;
  start_time: number;
  end_time: number;
}

export interface TimelineClip extends VideoClip {
  track: number;
  position: number; // position on timeline in seconds
}

export interface EditorState {
  // Media Library
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  
  // Timeline
  timelineClips: TimelineClip[];
  playheadPosition: number;
  isPlaying: boolean;
  zoom: number;
  
  // Player
  currentTime: number;
  duration: number;
  
  // Actions
  addClip: (clip: VideoClip) => void;
  removeClip: (id: string) => void;
  selectClip: (clip: VideoClip | null) => void;
  
  addToTimeline: (clip: VideoClip, track: number, position: number) => void;
  removeFromTimeline: (id: string) => void;
  updateTimelineClip: (id: string, updates: Partial<TimelineClip>) => void;
  
  setPlayheadPosition: (position: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  
  // Export
  exportTimeline: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  clips: [],
  selectedClip: null,
  timelineClips: [],
  playheadPosition: 0,
  isPlaying: false,
  zoom: 1,
  currentTime: 0,
  duration: 0,

  // Media Library actions
  addClip: (clip) => set((state) => ({
    clips: [...state.clips, clip]
  })),

  removeClip: (id) => set((state) => ({
    clips: state.clips.filter(clip => clip.id !== id),
    selectedClip: state.selectedClip?.id === id ? null : state.selectedClip
  })),

  selectClip: (clip) => set({ selectedClip: clip }),

  // Timeline actions
  addToTimeline: (clip, track, position) => set((state) => ({
    timelineClips: [...state.timelineClips, {
      ...clip,
      track,
      position
    }]
  })),

  removeFromTimeline: (id) => set((state) => ({
    timelineClips: state.timelineClips.filter(clip => clip.id !== id)
  })),

  updateTimelineClip: (id, updates) => set((state) => ({
    timelineClips: state.timelineClips.map(clip =>
      clip.id === id ? { ...clip, ...updates } : clip
    )
  })),

  // Player actions
  setPlayheadPosition: (position) => set({ playheadPosition: position }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),

  // Export action
  exportTimeline: async () => {
    const { timelineClips } = get();
    if (timelineClips.length === 0) return;

    // This would call the Tauri command to export
    // For now, just log the clips
    console.log('Exporting timeline with clips:', timelineClips);
  },
}));
