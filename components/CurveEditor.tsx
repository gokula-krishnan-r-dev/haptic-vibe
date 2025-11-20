
import React, { useRef, useState, useEffect } from 'react';
import { AHAPParameterCurveControlPoint } from '../types';

interface CurveEditorProps {
  points: AHAPParameterCurveControlPoint[];
  duration: number;
  color: string;
  onChange: (points: AHAPParameterCurveControlPoint[]) => void;
  label: string;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({ points, duration, color, onChange, label }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverPoint, setHoverPoint] = useState<number | null>(null);

  // Ensure points are sorted
  const sortedPoints = [...points].sort((a, b) => a.Time - b.Time);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setDraggingIdx(index);
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    // If we were dragging, don't add a point
    if (draggingIdx !== null) return;

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));
      const value = Math.max(0, Math.min(1, 1 - (y / rect.height)));

      const newPoints = [...points, { Time: time, ParameterValue: value }];
      onChange(newPoints);
    }
  };

  const handlePointDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newPoints = points.filter((_, i) => i !== index);
    onChange(newPoints);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIdx === null || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const time = Math.max(0, Math.min(duration, (x / rect.width) * duration));
      const value = Math.max(0, Math.min(1, 1 - (y / rect.height)));

      const newPoints = [...points];
      newPoints[draggingIdx] = { Time: time, ParameterValue: value };
      onChange(newPoints);
    };

    const handleMouseUp = () => {
      setDraggingIdx(null);
    };

    if (draggingIdx !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIdx, points, duration, onChange]);

  // Generate Path Data
  const generatePath = () => {
    if (sortedPoints.length === 0) return `M 0,${100} L 100,${100}`;
    
    const w = 100;
    const h = 100;

    let d = '';
    
    // Start from 0 time if first point > 0
    if (sortedPoints[0].Time > 0) {
       d += `M 0,${h - sortedPoints[0].ParameterValue * h} `;
       d += `L ${(sortedPoints[0].Time / duration) * w},${h - sortedPoints[0].ParameterValue * h} `;
    } else {
       d += `M 0,${h - sortedPoints[0].ParameterValue * h} `;
    }

    for (let i = 0; i < sortedPoints.length; i++) {
      const p = sortedPoints[i];
      const x = (p.Time / duration) * w;
      const y = h - (p.ParameterValue * h);
      d += `L ${x},${y} `;
    }

    // Extend to end
    const last = sortedPoints[sortedPoints.length - 1];
    if (last.Time < duration) {
        d += `L ${w},${h - last.ParameterValue * h}`;
    }

    return d;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-2 select-none">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-mono text-gray-400 uppercase">{label}</span>
        <span className="text-[10px] text-gray-600">Double-click point to remove</span>
      </div>
      <div className="relative h-32 w-full bg-gray-950 rounded overflow-hidden cursor-crosshair">
        {/* Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
           {[...Array(4)].map((_, i) => <div key={`v-${i}`} className="border-r border-gray-800/50 h-full" />)}
           {[...Array(4)].map((_, i) => <div key={`h-${i}`} className="border-b border-gray-800/50 w-full" />)}
        </div>

        <svg 
            ref={svgRef} 
            className="w-full h-full overflow-visible" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            onMouseDown={handleSvgClick}
        >
           <path 
             d={generatePath()} 
             fill="none" 
             stroke={color} 
             strokeWidth="2" 
             vectorEffect="non-scaling-stroke"
             className="opacity-80"
           />
           <path 
             d={`${generatePath()} L 100,100 L 0,100 Z`} 
             fill={color} 
             stroke="none" 
             className="opacity-10"
           />

           {sortedPoints.map((p, i) => (
             <circle
               key={i}
               cx={(p.Time / duration) * 100}
               cy={100 - (p.ParameterValue * 100)}
               r="4"
               fill="white"
               stroke={color}
               strokeWidth="2"
               className={`cursor-pointer hover:scale-150 transition-transform vector-effect-non-scaling-stroke ${draggingIdx === i ? 'scale-150' : ''}`}
               vectorEffect="non-scaling-stroke"
               onMouseDown={(e) => handleMouseDown(e, i)}
               onDoubleClick={(e) => handlePointDelete(e, i)}
               onMouseEnter={() => setHoverPoint(i)}
               onMouseLeave={() => setHoverPoint(null)}
             />
           ))}
        </svg>
      </div>
      {draggingIdx !== null && (
          <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
              <span>T: {points[draggingIdx].Time.toFixed(3)}s</span>
              <span>V: {points[draggingIdx].ParameterValue.toFixed(2)}</span>
          </div>
      )}
    </div>
  );
};
