
import React, { useRef, useState, useEffect } from 'react';
import { EditorHapticEvent } from '../types';
import { HistoryToolbar } from './HistoryToolbar';
import { useHistory } from '../hooks/useHistory';

interface TimelineProps {
  currentTime: number;
  duration: number;
  events: EditorHapticEvent[];
  waveform?: number[]; // Normalized 0-1
  onSeek: (time: number) => void;
  onSelectEvent: (id: string | null) => void;
  onUpdateEvent: (event: EditorHapticEvent) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const TRACK_HEIGHT = 60;
const HEADER_HEIGHT = 32;
const TRACK_COUNT = 4;

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  duration,
  events,
  waveform,
  onSeek,
  onSelectEvent,
  onUpdateEvent,
  onUndo,
  onRedo
}) => {
  const { canUndo, canRedo, historyList } = useHistory();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const totalWidth = Math.max(duration * pixelsPerSecond, 800);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Background click for seeking
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scrollLeft = containerRef.current.scrollLeft;
    const time = (x + scrollLeft) / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(time, duration)));
    onSelectEvent(null); // Deselect when clicking background
  };

  const renderGrid = () => {
    const lines = [];
    const step = 1;
    for (let i = 0; i <= duration; i += step) {
      const x = i * pixelsPerSecond;
      lines.push(
        <div key={i} className="absolute top-0 bottom-0 border-l border-gray-800/50 pointer-events-none select-none" style={{ left: x }}>
          <span className="text-[9px] text-gray-600 pl-1">{i}s</span>
        </div>
      );
    }
    return lines;
  };

  const renderWaveform = () => {
    if (!waveform || waveform.length === 0) {
      // console.log("Timeline: No waveform data to render");
      return null;
    }

    // console.log("Timeline: Rendering waveform with points:", waveform.length);

    // We need to map the waveform data to the total width.
    // The waveform is just an array of amplitudes.
    // We can use an SVG path or just a series of rects.
    // SVG path is cleaner.

    const points = [];
    const height = TRACK_COUNT * TRACK_HEIGHT;
    const centerY = height / 2;
    const amplitude = height * 0.4; // Leave some padding

    // Downsample for display if needed, but SVG handles many points okay.
    // We map index to x coordinate.
    const stepX = totalWidth / waveform.length;

    // Build path string
    // M x0 y0 L x1 y1 ...
    // We'll mirror it for a nice audio look

    let pathTop = `M 0 ${centerY}`;
    let pathBottom = `M 0 ${centerY}`;

    for (let i = 0; i < waveform.length; i++) {
      const x = i * stepX;
      const val = waveform[i] * amplitude;
      pathTop += ` L ${x.toFixed(1)} ${(centerY - val).toFixed(1)}`;
      pathBottom += ` L ${x.toFixed(1)} ${(centerY + val).toFixed(1)}`;
    }

    // Close paths
    pathTop += ` L ${totalWidth} ${centerY}`;
    pathBottom += ` L ${totalWidth} ${centerY}`;

    return (
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        <svg width={totalWidth} height={height} preserveAspectRatio="none">
          <path d={pathTop + " " + pathBottom} fill="none" stroke="#38bdf8" strokeWidth="1" />
          <path d={pathTop + " " + pathBottom} fill="#38bdf8" fillOpacity="0.1" stroke="none" />
        </svg>
      </div>
    );
  };

  // Drag Logic
  const dragRef = useRef<{
    id: string,
    startX: number,
    startStartTime: number,
    startTrackId: number
  } | null>(null);

  // Resize Logic
  const resizeDragRef = useRef<{
    id: string,
    handle: 'left' | 'right',
    startX: number,
    startStartTime: number,
    startDuration: number
  } | null>(null);

  const handleBlockMouseDown = (e: React.MouseEvent, evt: EditorHapticEvent) => {
    e.stopPropagation(); // Prevent seek
    onSelectEvent(evt.id);

    dragRef.current = {
      id: evt.id,
      startX: e.clientX,
      startStartTime: evt.startTime,
      startTrackId: evt.trackId
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;

      // Time Update
      const diffX = moveEvent.clientX - dragRef.current.startX;
      const diffTime = diffX / pixelsPerSecond;
      let newStartTime = dragRef.current.startStartTime + diffTime;

      // Snapping (0.05s threshold)
      const snapThreshold = 10 / pixelsPerSecond;
      if (Math.abs(newStartTime) < snapThreshold) newStartTime = 0;

      // Simple snap to other events
      events.forEach(other => {
        if (other.id !== evt.id) {
          if (Math.abs(newStartTime - other.startTime) < snapThreshold) newStartTime = other.startTime;
          if (Math.abs(newStartTime - (other.startTime + other.duration)) < snapThreshold) newStartTime = other.startTime + other.duration;
        }
      });

      newStartTime = Math.max(0, newStartTime);

      // Track Update
      // Calculate relative Y in the timeline container
      const rect = containerRef.current.getBoundingClientRect();
      const relY = moveEvent.clientY - rect.top - HEADER_HEIGHT; // Subtract header
      let newTrackId = Math.floor(relY / TRACK_HEIGHT);
      newTrackId = Math.max(0, Math.min(TRACK_COUNT - 1, newTrackId));

      onUpdateEvent({
        ...evt,
        startTime: newStartTime,
        trackId: newTrackId
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, evt: EditorHapticEvent, handle: 'left' | 'right') => {
    e.stopPropagation(); // Prevent block drag and seek
    onSelectEvent(evt.id);

    resizeDragRef.current = {
      id: evt.id,
      handle,
      startX: e.clientX,
      startStartTime: evt.startTime,
      startDuration: evt.duration
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeDragRef.current || !containerRef.current) return;

      const diffX = moveEvent.clientX - resizeDragRef.current.startX;
      const diffTime = diffX / pixelsPerSecond;

      let newStartTime = resizeDragRef.current.startStartTime;
      let newDuration = resizeDragRef.current.startDuration;

      const MIN_DURATION = 0.1;
      const snapThreshold = 10 / pixelsPerSecond;

      if (resizeDragRef.current.handle === 'right') {
        // Resize from right: adjust duration
        newDuration = Math.max(MIN_DURATION, resizeDragRef.current.startDuration + diffTime);

        // Snap end time to grid
        const endTime = newStartTime + newDuration;
        const nearestSecond = Math.round(endTime);
        if (Math.abs(endTime - nearestSecond) < snapThreshold) {
          newDuration = nearestSecond - newStartTime;
        }

        // Snap to other events
        events.forEach(other => {
          if (other.id !== evt.id) {
            const otherEnd = other.startTime + other.duration;
            if (Math.abs(endTime - other.startTime) < snapThreshold) {
              newDuration = other.startTime - newStartTime;
            }
            if (Math.abs(endTime - otherEnd) < snapThreshold) {
              newDuration = otherEnd - newStartTime;
            }
          }
        });
      } else {
        // Resize from left: adjust startTime and duration to keep end time fixed
        const originalEndTime = resizeDragRef.current.startStartTime + resizeDragRef.current.startDuration;
        newStartTime = resizeDragRef.current.startStartTime + diffTime;
        newStartTime = Math.max(0, newStartTime);

        // Snap start time to grid
        const nearestSecond = Math.round(newStartTime);
        if (Math.abs(newStartTime - nearestSecond) < snapThreshold) {
          newStartTime = nearestSecond;
        }

        // Snap to other events
        events.forEach(other => {
          if (other.id !== evt.id) {
            const otherEnd = other.startTime + other.duration;
            if (Math.abs(newStartTime - other.startTime) < snapThreshold) {
              newStartTime = other.startTime;
            }
            if (Math.abs(newStartTime - otherEnd) < snapThreshold) {
              newStartTime = otherEnd;
            }
          }
        });

        newDuration = originalEndTime - newStartTime;

        // Enforce minimum duration
        if (newDuration < MIN_DURATION) {
          newStartTime = originalEndTime - MIN_DURATION;
          newDuration = MIN_DURATION;
        }
      }

      onUpdateEvent({
        ...evt,
        startTime: newStartTime,
        duration: newDuration
      });
    };

    const handleMouseUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden border-t border-gray-800 select-none">
      {/* Toolbar */}
      <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between z-20 shrink-0">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xs font-bold uppercase tracking-wider">Timeline</span>
          <span className="text-[10px] bg-gray-800 px-1.5 rounded"> {events.length} Events </span>
        </div>

        {/* History Toolbar */}
        <div className="flex items-center gap-3">
          <HistoryToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={() => onUndo?.()}
            onRedo={() => onRedo?.()}
            lastAction={historyList[historyList.length - 1]?.label}
            nextAction={historyList[historyList.length]?.label}
          />

          <div className="h-6 w-px bg-gray-700" />

          <span className="text-[10px] text-gray-600 mr-2">Hold Shift to Scroll • Click & Drag to Move</span>
          <button onClick={() => setPixelsPerSecond(p => Math.max(20, p * 0.8))} className="text-xs px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-300">-</button>
          <button onClick={() => setPixelsPerSecond(p => Math.min(500, p * 1.2))} className="text-xs px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700 text-gray-300">+</button>
        </div>
      </div>

      {/* Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar"
        onMouseDown={handleMouseDown}
      >
        <div
          style={{
            width: totalWidth,
            height: TRACK_COUNT * TRACK_HEIGHT + 20
          }}
          className="relative"
        >
          {/* Waveform Layer */}
          {renderWaveform()}

          {/* Grid Layer */}
          {renderGrid()}

          {/* Tracks Background */}
          {Array.from({ length: TRACK_COUNT }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-b border-gray-800/30 box-border"
              style={{ top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
            >
              <span className="absolute left-2 top-2 text-[9px] text-gray-700 font-mono">T{i + 1}</span>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            <div className="w-3 h-3 bg-red-500 -ml-[5px] rotate-45 transform shadow-sm" />
          </div>

          {/* Events Layer */}
          {events.map(evt => {
            const width = evt.type === 'Transient' ? 6 : Math.max(10, evt.duration * pixelsPerSecond);
            const left = evt.startTime * pixelsPerSecond;
            const top = evt.trackId * TRACK_HEIGHT + 4; // Padding
            const height = TRACK_HEIGHT - 8;
            const isTransient = evt.type === 'Transient';

            // Visualizing intensity
            const baseColor = isTransient ? 'rgb(217, 70, 239)' : 'rgb(6, 182, 212)'; // Magenta vs Cyan
            const opacity = 0.4 + (evt.intensity * 0.6);

            return (
              <div
                key={evt.id}
                onMouseDown={(e) => handleBlockMouseDown(e, evt)}
                className={`absolute rounded-md cursor-pointer group transition-all shadow-sm overflow-hidden
                            ${evt.selected ? 'ring-2 ring-white z-20' : 'hover:ring-1 hover:ring-gray-400 z-10'}
                        `}
                style={{
                  left,
                  top,
                  height,
                  width,
                  backgroundColor: isTransient ? `rgba(217, 70, 239, ${opacity})` : `rgba(6, 182, 212, ${opacity})`
                }}
              >
                {/* Event Content */}
                <div className="px-2 py-1 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white font-bold mix-blend-screen truncate opacity-90">
                      {isTransient ? '⚡ Pulse' : '〰️ Wave'}
                    </span>
                    {isTransient && (
                      <span className="text-[8px] text-white opacity-70">{(evt.intensity * 100).toFixed(0)}%</span>
                    )}
                  </div>

                  {/* Curve Mini-Viz */}
                  {!isTransient && (
                    <div className="w-full h-1/2 opacity-60">
                      <svg className="w-full h-full" preserveAspectRatio="none">
                        <path
                          d={`M0,${100 - (evt.intensity * 100)} L${width},${100 - (evt.intensity * 100)}`} // Simplified viz
                          stroke="white"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Resize Handles (Interactive) */}
                {evt.selected && !isTransient && (
                  <>
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 hover:bg-white/60 cursor-ew-resize transition-colors z-30"
                      onMouseDown={(e) => handleResizeMouseDown(e, evt, 'left')}
                      title="Drag to adjust start time"
                    />
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 hover:bg-white/60 cursor-ew-resize transition-colors z-30"
                      onMouseDown={(e) => handleResizeMouseDown(e, evt, 'right')}
                      title="Drag to adjust duration"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
