import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripVerticalIcon } from './Icons';

interface ResizablePanelProps {
  children: React.ReactNode;
  direction: 'horizontal' | 'vertical';
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction,
  initialSize,
  minSize = 100,
  maxSize = 800,
  className,
}) => {
  const [size, setSize] = useState(initialSize);
  const isResizing = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    
    if (direction === 'horizontal') {
        setSize(prevSize => {
            const newSize = prevSize - e.movementX;
            return Math.max(minSize, Math.min(maxSize, newSize));
        });
    } else {
        setSize(prevSize => {
            const newSize = prevSize - e.movementY;
            return Math.max(minSize, Math.min(maxSize, newSize));
        });
    }
  }, [direction, minSize, maxSize]);
  
  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  
  const style = direction === 'horizontal' ? { width: `${size}px` } : { height: `${size}px` };

  return (
    <div className={`flex ${className}`} style={style}>
        {direction === 'horizontal' && (
            <div 
                className="w-2 cursor-col-resize flex items-center justify-center bg-gray-850 hover:bg-gray-750 transition-colors"
                onMouseDown={handleMouseDown}
            >
                <GripVerticalIcon className="w-1.5 h-6 text-gray-600" />
            </div>
        )}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {children}
        </div>
        {direction === 'vertical' && (
            <div 
                className="h-2 cursor-row-resize flex items-center justify-center bg-gray-850 hover:bg-gray-750 transition-colors"
                onMouseDown={handleMouseDown}
            >
                {/* Horizontal Grip Icon could be added here */}
            </div>
        )}
    </div>
  );
};