import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DraggableVideoWindowProps {
  id: string;
  name: string;
  sourceType: 'monitor' | 'webcam';
  x: number;
  y: number;
  width: number;
  height: number;
  videoStream: MediaStream | null;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeChange: (id: string, width: number, height: number) => void;
  onRemove: (id: string) => void;
  isActive?: boolean;
}

const DraggableVideoWindow: React.FC<DraggableVideoWindowProps> = ({
  id,
  name,
  sourceType,
  x,
  y,
  width,
  height,
  videoStream,
  onPositionChange,
  onSizeChange,
  onRemove,
  isActive = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState({ x, y });
  const [currentSize, setCurrentSize] = useState({ width, height });
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update video stream when it changes
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Update position when props change
  useEffect(() => {
    setCurrentPosition({ x, y });
  }, [x, y]);

  // Update size when props change
  useEffect(() => {
    setCurrentSize({ width, height });
  }, [width, height]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    setIsDragging(true);
    setDragStart({
      x: mouseX - currentPosition.x,
      y: mouseY - currentPosition.y
    });
  }, [currentPosition.x, currentPosition.y]);

  // Handle mouse down for resizing
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerX = e.clientX - containerRect.left;
    const containerY = e.clientY - containerRect.top;

    if (isDragging) {
      // Calculate new position directly from mouse position minus the initial offset
      const newX = Math.max(0, Math.min(containerX - dragStart.x, containerRect.width - currentSize.width));
      const newY = Math.max(0, Math.min(containerY - dragStart.y, containerRect.height - currentSize.height));
      
      setCurrentPosition({ x: newX, y: newY });
      
      // Throttle backend updates
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        onPositionChange(id, newX, newY);
      }, 16); // ~60fps
    } else if (isResizing && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newWidth = currentSize.width;
      let newHeight = currentSize.height;
      let newX = currentPosition.x;
      let newY = currentPosition.y;
      
      // Calculate new dimensions based on resize handle
      if (resizeHandle.includes('right')) {
        newWidth = Math.max(100, currentSize.width + deltaX);
      }
      if (resizeHandle.includes('left')) {
        newWidth = Math.max(100, currentSize.width - deltaX);
        newX = currentPosition.x + deltaX;
      }
      if (resizeHandle.includes('bottom')) {
        newHeight = Math.max(100, currentSize.height + deltaY);
      }
      if (resizeHandle.includes('top')) {
        newHeight = Math.max(100, currentSize.height - deltaY);
        newY = currentPosition.y + deltaY;
      }
      
      // Constrain to container bounds
      newX = Math.max(0, Math.min(newX, containerRect.width - newWidth));
      newY = Math.max(0, Math.min(newY, containerRect.height - newHeight));
      
      setCurrentPosition({ x: newX, y: newY });
      setCurrentSize({ width: newWidth, height: newHeight });
      onPositionChange(id, newX, newY);
      onSizeChange(id, newWidth, newHeight);
    }
  }, [isDragging, isResizing, dragStart, currentPosition, currentSize, id, onPositionChange, onSizeChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    
    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  // Add global event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isDragging ? 'grabbing' : 'default';
      
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
    >
      <div
        ref={windowRef}
        className={`absolute border-2 bg-gray-900 rounded-lg shadow-lg pointer-events-auto select-none ${
          isDragging 
            ? 'border-yellow-400 shadow-yellow-400/50 scale-105' 
            : isActive 
              ? 'border-yellow-400 shadow-yellow-400/50' 
              : 'border-blue-500 hover:border-blue-400'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} transition-all duration-100`}
        style={{
          left: currentPosition.x,
          top: currentPosition.y,
          width: currentSize.width,
          height: currentSize.height,
          zIndex: isActive ? 1000 : 1
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div className="bg-blue-500 text-white text-xs px-3 py-2 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm">
              {sourceType === 'monitor' ? '🖥️' : '📹'}
            </span>
            <span className="font-medium truncate">{name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
            className="ml-2 text-red-300 hover:text-red-100 text-lg font-bold"
          >
            ×
          </button>
        </div>
        
        {/* Video Content */}
        <div className="relative bg-black rounded-b-lg overflow-hidden" style={{ height: currentSize.height - 32 }}>
          {videoStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-3xl mb-2">
                  {sourceType === 'monitor' ? '🖥️' : '📹'}
                </div>
                <div className="text-sm">
                  {sourceType === 'monitor' ? 'Screen' : 'Webcam'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resize Handles */}
        {/* Corner Handles */}
        <div 
          className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-nw-resize rounded-sm border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
        />
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-ne-resize rounded-sm border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
        />
        <div 
          className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-sw-resize rounded-sm border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
        />
        <div 
          className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 hover:bg-blue-400 cursor-se-resize rounded-sm border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
        />
        
        {/* Edge Handles */}
        <div 
          className="absolute -top-1 left-3 right-3 h-1 bg-blue-500 hover:bg-blue-400 cursor-n-resize rounded-full border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
        />
        <div 
          className="absolute -bottom-1 left-3 right-3 h-1 bg-blue-500 hover:bg-blue-400 cursor-s-resize rounded-full border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
        />
        <div 
          className="absolute -left-1 top-3 bottom-3 w-1 bg-blue-500 hover:bg-blue-400 cursor-w-resize rounded-full border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
        />
        <div 
          className="absolute -right-1 top-3 bottom-3 w-1 bg-blue-500 hover:bg-blue-400 cursor-e-resize rounded-full border border-white"
          onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
        />
      </div>
    </div>
  );
};

export default DraggableVideoWindow;
