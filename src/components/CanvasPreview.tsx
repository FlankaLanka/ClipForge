import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AudioIndicator from './AudioIndicator';

interface Sprite {
  id: string;
  name: string;
  type: 'monitor' | 'webcam';
  x: number; // Center-relative position
  y: number; // Center-relative position
  width: number;
  height: number;
  rotation: number; // In radians
  videoStream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  isSelected: boolean;
}

interface CanvasPreviewProps {
  sprites: Sprite[];
  onSpriteMove: (id: string, x: number, y: number) => void;
  onSpriteResize: (id: string, width: number, height: number) => void;
  onSpriteRotate: (id: string, rotation: number) => void;
  onSpriteSelect: (id: string) => void;
  onSpriteRemove: (id: string) => void;
  onSpriteMoveToFront: (id: string) => void;
  onSpriteMoveToBack: (id: string) => void;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  sprites,
  onSpriteMove,
  onSpriteResize,
  onSpriteRotate,
  onSpriteSelect,
  onSpriteRemove,
  onSpriteMoveToFront,
  onSpriteMoveToBack
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedSprite, setSelectedSprite] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [rotationStart, setRotationStart] = useState(0);
  const [cursor, setCursor] = useState<string>('crosshair');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spriteId: string } | null>(null);
  const [debugDot, setDebugDot] = useState<{ x: number; y: number } | null>(null);

  // Convert screen coordinates to center-relative coordinates
  const screenToCenter = useCallback((screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const centerX = 960; // 1920 / 2
    const centerY = 540; // 1080 / 2
    
    const x = (screenX - rect.left) * (1920 / rect.width) - centerX;
    const y = (screenY - rect.top) * (1080 / rect.height) - centerY;
    
    return { x, y };
  }, []);

  // Convert center-relative coordinates to screen coordinates
  const centerToScreen = useCallback((centerX: number, centerY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasCenterX = 960; // 1920 / 2
    const canvasCenterY = 540; // 1080 / 2
    
    const x = (centerX + canvasCenterX) * (rect.width / 1920) + rect.left;
    const y = (centerY + canvasCenterY) * (rect.height / 1080) + rect.top;
    
    return { x, y };
  }, []);

  // Check if point is inside sprite bounds
  const isPointInSprite = useCallback((pointX: number, pointY: number, sprite: Sprite) => {
    const cos = Math.cos(-sprite.rotation);
    const sin = Math.sin(-sprite.rotation);
    
    // Translate point to sprite's local coordinate system
    const localX = (pointX - sprite.x) * cos - (pointY - sprite.y) * sin;
    const localY = (pointX - sprite.x) * sin + (pointY - sprite.y) * cos;
    
    return Math.abs(localX) <= sprite.width / 2 && Math.abs(localY) <= sprite.height / 2;
  }, []);

       // Get resize handle at point
       const getResizeHandle = useCallback((pointX: number, pointY: number, sprite: Sprite) => {
         const cos = Math.cos(-sprite.rotation);
         const sin = Math.sin(-sprite.rotation);
         
         const localX = (pointX - sprite.x) * cos - (pointY - sprite.y) * sin;
         const localY = (pointX - sprite.x) * sin + (pointY - sprite.y) * cos;
         
         const halfWidth = sprite.width / 2;
         const halfHeight = sprite.height / 2;
         const handleSize = 16; // Increased from 8 to 16
         
         // Check corners
         if (Math.abs(localX - halfWidth) < handleSize && Math.abs(localY - halfHeight) < handleSize) return 'se';
         if (Math.abs(localX + halfWidth) < handleSize && Math.abs(localY - halfHeight) < handleSize) return 'sw';
         if (Math.abs(localX - halfWidth) < handleSize && Math.abs(localY + halfHeight) < handleSize) return 'ne';
         if (Math.abs(localX + halfWidth) < handleSize && Math.abs(localY + halfHeight) < handleSize) return 'nw';
         
         // Check edges
         if (Math.abs(localX - halfWidth) < handleSize && Math.abs(localY) < halfHeight) return 'e';
         if (Math.abs(localX + halfWidth) < handleSize && Math.abs(localY) < halfHeight) return 'w';
         if (Math.abs(localY - halfHeight) < handleSize && Math.abs(localX) < halfWidth) return 's';
         if (Math.abs(localY + halfHeight) < handleSize && Math.abs(localX) < halfWidth) return 'n';
         
         return null;
       }, []);

       // Get cursor type based on hover state - check from back to front
       const getCursorType = useCallback((pointX: number, pointY: number) => {
         const hoveredSprite = sprites.slice().reverse().find(sprite => isPointInSprite(pointX, pointY, sprite));
    
    if (!hoveredSprite) return 'crosshair';
    
    if (!hoveredSprite.isSelected) return 'grab';
    
    const handle = getResizeHandle(pointX, pointY, hoveredSprite);
    if (!handle) return 'grab';
    
    // Return appropriate cursor based on handle
    switch (handle) {
      case 'nw': case 'se': return 'nw-resize';
      case 'ne': case 'sw': return 'ne-resize';
      case 'n': case 's': return 'ns-resize';
      case 'e': case 'w': return 'ew-resize';
      default: return 'grab';
    }
  }, [sprites, isPointInSprite, getResizeHandle]);

  // Draw sprite on canvas
  const drawSprite = useCallback((ctx: CanvasRenderingContext2D, sprite: Sprite) => {
    ctx.save();
    
    // Move to sprite center
    ctx.translate(sprite.x + canvasRef.current!.width / 2, sprite.y + canvasRef.current!.height / 2);
    ctx.rotate(sprite.rotation);
    
    // Draw sprite background
    ctx.fillStyle = sprite.isSelected ? 'rgba(255, 255, 0, 0.1)' : 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    
    // Draw border
    ctx.strokeStyle = sprite.isSelected ? '#ffd700' : '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    
    // Draw video if available
    if (sprite.videoElement) {
      console.log(`Sprite ${sprite.id} video element readyState: ${sprite.videoElement.readyState}, videoWidth: ${sprite.videoElement.videoWidth}, videoHeight: ${sprite.videoElement.videoHeight}`);
      
      if (sprite.videoElement.readyState >= 2 && sprite.videoElement.videoWidth > 0) {
        try {
          // Draw the video frame
          ctx.drawImage(
            sprite.videoElement,
            -sprite.width / 2,
            -sprite.height / 2,
            sprite.width,
            sprite.height
          );
          console.log(`Successfully drew video for sprite ${sprite.id}`);
        } catch (error) {
          console.error(`Error drawing video for sprite ${sprite.id}:`, error);
          // Fallback if video drawing fails
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
          
          ctx.fillStyle = '#6b7280';
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Video Error', 0, 0);
        }
      } else {
        // Video element exists but not ready or no video dimensions
        console.log(`Sprite ${sprite.id} video element not ready or no dimensions`);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', 0, 0);
      }
    } else if (sprite.videoStream) {
      // Video stream available but no video element
      console.log(`Sprite ${sprite.id} has stream but no video element`);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No Video Element', 0, 0);
    } else {
      // No video stream - just draw background
      console.log(`Sprite ${sprite.id} has no video stream`);
      ctx.fillStyle = '#374151';
      ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    }
    
         // Draw resize handles if selected
         if (sprite.isSelected) {
           const halfWidth = sprite.width / 2;
           const halfHeight = sprite.height / 2;
           const handleSize = 16; // Increased from 6 to 16
           const handleOffset = handleSize / 2;
           
           // Draw handle background (white circle with blue border)
           ctx.fillStyle = '#ffffff';
           ctx.strokeStyle = '#3b82f6';
           ctx.lineWidth = 2;
           
           // Corner handles
           ctx.beginPath();
           ctx.arc(halfWidth - handleOffset, halfHeight - handleOffset, handleSize / 2, 0, 2 * Math.PI);
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(-halfWidth + handleOffset, halfHeight - handleOffset, handleSize / 2, 0, 2 * Math.PI);
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(halfWidth - handleOffset, -halfHeight + handleOffset, handleSize / 2, 0, 2 * Math.PI);
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(-halfWidth + handleOffset, -halfHeight + handleOffset, handleSize / 2, 0, 2 * Math.PI);
           ctx.fill();
           ctx.stroke();
           
           // Edge handles
           ctx.beginPath();
           ctx.arc(0, halfHeight - handleOffset, handleSize / 2, 0, 2 * Math.PI); // Bottom center
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(0, -halfHeight + handleOffset, handleSize / 2, 0, 2 * Math.PI); // Top center
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(halfWidth - handleOffset, 0, handleSize / 2, 0, 2 * Math.PI); // Right center
           ctx.fill();
           ctx.stroke();
           
           ctx.beginPath();
           ctx.arc(-halfWidth + handleOffset, 0, handleSize / 2, 0, 2 * Math.PI); // Left center
           ctx.fill();
           ctx.stroke();
         }
         
    
    ctx.restore();
  }, []);

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1920, 1080);
    
    // Draw center crosshair (optional)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(960, 0); // 1920 / 2
        ctx.lineTo(960, 1080);
        ctx.moveTo(0, 540); // 1080 / 2
        ctx.lineTo(1920, 540);
        ctx.stroke();
    
    // Draw all sprites
    sprites.forEach(sprite => {
      drawSprite(ctx, sprite);
    });
  }, [sprites, drawSprite]);

       // Handle mouse down
       const handleMouseDown = useCallback((e: React.MouseEvent) => {
         if (!canvasRef.current) return;
         
         const rect = canvasRef.current.getBoundingClientRect();
         const mouseX = e.clientX - rect.left;
         const mouseY = e.clientY - rect.top;
         const centerCoords = screenToCenter(e.clientX, e.clientY);
         
       // Find clicked sprite - check from back to front (reverse order for proper layering)
       const clickedSprite = sprites.slice().reverse().find(sprite => isPointInSprite(centerCoords.x, centerCoords.y, sprite));
         
         // Handle right click
         if (e.button === 2) {
           e.preventDefault(); // Prevent context menu
           console.log('Right click detected on canvas');
           
           if (clickedSprite) {
             console.log('Right click on sprite:', clickedSprite.id);
             setSelectedSprite(clickedSprite.id);
             onSpriteSelect(clickedSprite.id);
             
             // Show context menu for sprite at mouse position
             setContextMenu({
               x: e.clientX,
               y: e.clientY,
               spriteId: clickedSprite.id
             });
             
             // Debug: Show a dot at the exact mouse position
             setDebugDot({ x: e.clientX, y: e.clientY });
             setTimeout(() => setDebugDot(null), 2000); // Remove debug dot after 2 seconds
             
             console.log('Context menu shown for sprite:', clickedSprite.id);
             console.log('Mouse position - clientX:', e.clientX, 'clientY:', e.clientY);
             console.log('Context menu position - x:', e.clientX, 'y:', e.clientY);
             console.log('Context menu will be rendered at:', e.clientX, e.clientY);
           } else {
             console.log('Right click on empty space, closing context menu');
             // Close context menu if clicking on empty space
             setContextMenu(null);
             setSelectedSprite(null);
             onSpriteSelect('');
           }
           return;
         }
         
         // Handle left click
         if (e.button === 0) {
           setContextMenu(null); // Close context menu
           
           if (clickedSprite) {
             setSelectedSprite(clickedSprite.id);
             onSpriteSelect(clickedSprite.id);
             
             // Check for resize handle
             const handle = getResizeHandle(centerCoords.x, centerCoords.y, clickedSprite);
             if (handle) {
               setIsResizing(true);
               setResizeHandle(handle);
               setDragStart({ x: centerCoords.x, y: centerCoords.y });
               setCursor('grabbing');
               return;
             }
             
             // Start dragging
             setIsDragging(true);
             setDragStart({ x: centerCoords.x, y: centerCoords.y });
             setCursor('grabbing');
           } else {
             // Deselect all
             setSelectedSprite(null);
             onSpriteSelect('');
             setCursor('crosshair');
           }
         }
       }, [sprites, screenToCenter, isPointInSprite, getResizeHandle, onSpriteSelect]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!canvasRef.current) return;
    
    const centerCoords = screenToCenter(e.clientX, e.clientY);
    
    // Update cursor based on hover state
    if (!isDragging && !isResizing) {
      const newCursor = getCursorType(centerCoords.x, centerCoords.y);
      setCursor(newCursor);
    }
    
    if (!selectedSprite) return;
    
    const sprite = sprites.find(s => s.id === selectedSprite);
    if (!sprite) return;
    
    if (isDragging) {
      const deltaX = centerCoords.x - dragStart.x;
      const deltaY = centerCoords.y - dragStart.y;
      
      onSpriteMove(selectedSprite, sprite.x + deltaX, sprite.y + deltaY);
      setDragStart(centerCoords);
    } else if (isResizing && resizeHandle) {
      const deltaX = centerCoords.x - dragStart.x;
      const deltaY = centerCoords.y - dragStart.y;
      
      let newWidth = sprite.width;
      let newHeight = sprite.height;
      
      if (resizeHandle.includes('e')) newWidth += deltaX;
      if (resizeHandle.includes('w')) newWidth -= deltaX;
      if (resizeHandle.includes('s')) newHeight += deltaY;
      if (resizeHandle.includes('n')) newHeight -= deltaY;
      
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);
      
      onSpriteResize(selectedSprite, newWidth, newHeight);
      setDragStart(centerCoords);
    }
  }, [selectedSprite, isDragging, isResizing, dragStart, resizeHandle, sprites, screenToCenter, onSpriteMove, onSpriteResize, getCursorType]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setIsRotating(false);
    setResizeHandle(null);
    setCursor('crosshair');
  }, []);

  // Add global event listeners
  useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Render on sprite changes
  useEffect(() => {
    render();
  }, [render]);

  // Continuous rendering loop for video frames
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    
    const animate = () => {
      render();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation loop
    animate();
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [render]);

  // Handle canvas resize - set to 1920x1080 resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const resizeCanvas = () => {
      // Set canvas to 1920x1080 resolution
      canvas.width = 1920;
      canvas.height = 1080;
      
      // Scale the canvas to fit the container while maintaining aspect ratio
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      const aspectRatio = 1920 / 1080;
      const containerAspectRatio = containerWidth / containerHeight;
      
      let displayWidth, displayHeight;
      if (containerAspectRatio > aspectRatio) {
        // Container is wider than 16:9, fit to height
        displayHeight = containerHeight;
        displayWidth = displayHeight * aspectRatio;
      } else {
        // Container is taller than 16:9, fit to width
        displayWidth = containerWidth;
        displayHeight = displayWidth / aspectRatio;
      }
      
      // Set the canvas display size (flexbox will center it)
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      
      render();
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [render]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      
           {/* Context Menu */}
           {contextMenu && createPortal(
             <div
               className="bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-48"
               style={{
                 position: 'fixed',
                 left: `${contextMenu.x}px`,
                 top: `${contextMenu.y}px`,
                 zIndex: 9999,
               }}
             >
               <button
                 className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
                 onClick={() => {
                   console.log('Move to front clicked for sprite:', contextMenu.spriteId);
                   onSpriteMoveToFront(contextMenu.spriteId);
                   setContextMenu(null);
                 }}
               >
                 <span>📤</span>
                 <span>Move to Front</span>
               </button>
               <button
                 className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2"
                 onClick={() => {
                   console.log('Move to back clicked for sprite:', contextMenu.spriteId);
                   onSpriteMoveToBack(contextMenu.spriteId);
                   setContextMenu(null);
                 }}
               >
                 <span>📥</span>
                 <span>Move to Back</span>
               </button>
               <div className="border-t border-gray-200 my-1"></div>
               <button
                 className="w-full px-4 py-2 text-left text-sm hover:bg-red-100 text-red-600 flex items-center space-x-2"
                 onClick={() => {
                   console.log('Delete clicked for sprite:', contextMenu.spriteId);
                   onSpriteRemove(contextMenu.spriteId);
                   setContextMenu(null);
                 }}
               >
                 <span>🗑️</span>
                 <span>Delete</span>
               </button>
             </div>,
             document.body
           )}
      
          {/* Debug dot to show exact mouse position */}
          {debugDot && (
            <div
              className="fixed w-4 h-4 bg-red-500 rounded-full z-50 pointer-events-none"
              style={{
                left: `${debugDot.x - 8}px`,
                top: `${debugDot.y - 8}px`,
              }}
            />
          )}
          
      
          {/* Instructions overlay */}
          {sprites.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
              <div className="text-center">
                <div className="text-6xl mb-4">📺</div>
                <div className="text-xl font-medium mb-2">Canvas Preview (1920x1080)</div>
                <div className="text-sm mb-2">Add sources to see them as sprites on this canvas</div>
                <div className="text-xs mb-1">0,0 is at the center • Drag to move • Right-click for menu • Resize handles when selected</div>
                <div className="text-xs text-blue-300">Recording will capture at full 1920x1080 resolution</div>
              </div>
            </div>
          )}
    </div>
  );
};

export default CanvasPreview;
