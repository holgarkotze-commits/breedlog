import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
}

export function ZoomableImage({ src, alt = "", className = "", onClick, "data-testid": testId }: ZoomableImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Handle pinch zoom
  const lastDistance = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      lastDistance.current = distance;
    } else if (e.touches.length === 1) {
      setIsDragging(true);
      setStartPos({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      const delta = distance / lastDistance.current;
      lastDistance.current = distance;
      
      setScale(prev => Math.min(Math.max(0.5, prev * delta), 5));
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - startPos.x,
        y: e.touches[0].clientY - startPos.y
      });
    }
  };
  
  const handleTouchEnd = () => {
    lastDistance.current = null;
    setIsDragging(false);
  };
  
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  };
  
  // Handle mouse wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(0.5, prev * delta), 5));
  };
  
  // Handle mouse drag for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPos({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleOpen = () => {
    if (onClick) {
      onClick();
    }
    setIsOpen(true);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };
  
  const zoomIn = () => setScale(prev => Math.min(prev * 1.25, 5));
  const zoomOut = () => setScale(prev => Math.max(prev / 1.25, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <>
      <img 
        src={src} 
        alt={alt} 
        className={`cursor-zoom-in ${className}`}
        onClick={handleOpen}
        data-testid={testId}
      />
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden"
          data-testid="dialog-image-zoom"
        >
          {/* Controls */}
          <div className="absolute top-2 right-2 z-50 flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={zoomIn}
              className="bg-black/50 border-white/20 hover:bg-black/70"
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4 text-white" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={zoomOut}
              className="bg-black/50 border-white/20 hover:bg-black/70"
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4 text-white" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={rotate}
              className="bg-black/50 border-white/20 hover:bg-black/70"
              data-testid="button-rotate"
            >
              <RotateCw className="h-4 w-4 text-white" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              className="bg-black/50 border-white/20 hover:bg-black/70"
              data-testid="button-close-zoom"
            >
              <X className="h-4 w-4 text-white" />
            </Button>
          </div>
          
          {/* Zoom hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white/60 text-xs pointer-events-none">
            Pinch to zoom • Double-tap to reset
          </div>
          
          {/* Image container */}
          <div 
            ref={containerRef}
            className="w-full h-[90vh] flex items-center justify-center overflow-hidden touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={resetView}
          >
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain transition-transform duration-100"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
