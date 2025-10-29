import React, { useEffect, useRef, useState } from 'react';

interface AudioIndicatorProps {
  audioStream: MediaStream | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const AudioIndicator: React.FC<AudioIndicatorProps> = ({
  audioStream,
  size = 'small',
  className = ''
}) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Size configurations
  const sizeConfig = {
    small: { width: 16, height: 16 },
    medium: { width: 24, height: 24 },
    large: { width: 32, height: 32 }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (!audioStream) {
      setIsActive(false);
      setAudioLevel(0);
      return;
    }

    const setupAudioAnalysis = async () => {
      try {
        // Create audio context
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create analyser node
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        // Create data array for frequency data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Connect audio stream to analyser
        const source = audioContextRef.current.createMediaStreamSource(audioStream);
        source.connect(analyser);
        
        // Store references
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
        
        setIsActive(true);
        
        // Start analysis loop
        const analyzeAudio = () => {
          if (!analyserRef.current || !dataArrayRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Calculate average audio level with increased sensitivity
          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
          }
          const average = sum / dataArrayRef.current.length;
          // Increase sensitivity by using a lower threshold and applying a curve
          const normalizedLevel = Math.min(1, Math.pow(average / 128, 0.5)); // More sensitive curve
          
          setAudioLevel(normalizedLevel);
          
          // Continue analysis
          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        };
        
        analyzeAudio();
        
      } catch (error) {
        console.error('Failed to setup audio analysis:', error);
        setIsActive(false);
      }
    };

    setupAudioAnalysis();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioStream]);

  return (
    <div 
      className={`flex items-center justify-center rounded-full transition-all duration-200 ${className}`}
      style={{ width: config.width, height: config.height }}
    >
      {isActive && audioLevel > 0.05 ? (
        <div 
          className={`rounded-full transition-all duration-100 ${
            audioLevel > 0.7 
              ? 'bg-red-500 animate-pulse' 
              : audioLevel > 0.3 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
          }`}
          style={{
            width: Math.max(4, config.width * audioLevel),
            height: Math.max(4, config.height * audioLevel)
          }}
        />
      ) : (
        <div 
          className="rounded-full bg-gray-400"
          style={{ width: 4, height: 4 }}
        />
      )}
    </div>
  );
};

export default AudioIndicator;
