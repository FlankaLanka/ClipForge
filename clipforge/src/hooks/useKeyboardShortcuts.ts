import { useEffect } from 'react';
import { useEditorStore } from '../state/useEditorStore';

export const useKeyboardShortcuts = () => {
  const { isPlaying, setPlaying, currentTime, setCurrentTime, selectedClip } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setPlaying(!isPlaying);
          break;
        
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedClip) {
            const newTime = Math.max(0, currentTime - 0.1);
            setCurrentTime(newTime);
          }
          break;
        
        case 'ArrowRight':
          e.preventDefault();
          if (selectedClip) {
            const newTime = Math.min(selectedClip.metadata.duration, currentTime + 0.1);
            setCurrentTime(newTime);
          }
          break;
        
        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;
        
        case 'End':
          e.preventDefault();
          if (selectedClip) {
            setCurrentTime(selectedClip.metadata.duration);
          }
          break;
        
        case 'Escape':
          e.preventDefault();
          // Could add escape functionality here
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setPlaying, currentTime, setCurrentTime, selectedClip]);
};
