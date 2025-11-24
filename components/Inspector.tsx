import React from 'react';
import { EditorHapticEvent } from '../types';
import { TrashIcon } from './Icons';
import { CurveEditor } from './CurveEditor';

interface InspectorProps {
  selectedEvent: EditorHapticEvent | null;
  onUpdate: (updatedEvent: EditorHapticEvent) => void;
  onDelete: (id: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({ selectedEvent, onUpdate, onDelete }) => {
  if (!selectedEvent) {
    return (
      <div className="w-full h-full bg-gray-850 p-6 flex flex-col items-center justify-center text-gray-500">
        <p className="text-center">Select an event to edit properties</p>
      </div>
    );
  }

  const handleChange = (field: keyof EditorHapticEvent, value: any) => {
    onUpdate({ ...selectedEvent, [field]: value });
  };

  return (
    <div className="w-full h-full bg-gray-850 flex flex-col overflow-y-auto scrollbar-thin">
      <div className="p-4 border-b border-gray-750 flex justify-between items-center bg-gray-900 sticky top-0 z-10">
        <div>
          <h2 className="font-bold text-sm text-white uppercase tracking-wide">Properties</h2>
          <span className="text-xs text-gray-500 font-mono">{selectedEvent.type} • Track {selectedEvent.trackId + 1}</span>
        </div>
        <button
          onClick={() => onDelete(selectedEvent.id)}
          className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded transition-colors"
          title="Delete Event (Del)"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Timing Controls */}
        <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">⏱ Timing</span>
          </div>

          {/* Start Time - Dual Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-gray-400">Start Time</span>
              <span className="text-[10px] text-gray-500">Drag slider or type value</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Numeric Input */}
              <div className="relative flex-shrink-0" style={{ width: '90px' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={selectedEvent.startTime}
                  onChange={(e) => handleChange('startTime', parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 pr-6 text-xs font-mono text-accent-cyan focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan outline-none transition-all"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-gray-600 pointer-events-none">s</span>
              </div>
              {/* Slider */}
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.01"
                  value={selectedEvent.startTime}
                  onChange={(e) => handleChange('startTime', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan hover:accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Duration - Dual Input (Continuous events only) */}
          {selectedEvent.type === 'Continuous' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-400">Duration</span>
                <span className="text-[10px] text-gray-500">Drag slider or type value</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Numeric Input */}
                <div className="relative flex-shrink-0" style={{ width: '90px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="10"
                    value={selectedEvent.duration}
                    onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 pr-6 text-xs font-mono text-accent-cyan focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan outline-none transition-all"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-gray-600 pointer-events-none">s</span>
                </div>
                {/* Slider */}
                <div className="flex-1">
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.01"
                    value={selectedEvent.duration}
                    onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan hover:accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Base Parameters */}
        <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">⚙️ Base Parameters</span>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Intensity</span>
              <span className="text-xs font-mono text-accent-cyan bg-gray-950 px-2 py-0.5 rounded">{selectedEvent.intensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedEvent.intensity}
              onChange={(e) => handleChange('intensity', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan hover:accent-cyan-400"
            />
          </div>

          {/* Sharpness Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Sharpness</span>
              <span className="text-xs font-mono text-accent-magenta bg-gray-950 px-2 py-0.5 rounded">{selectedEvent.sharpness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedEvent.sharpness}
              onChange={(e) => handleChange('sharpness', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-magenta hover:accent-magenta-400"
            />
          </div>
        </div>

        {/* Dynamic Waveforms (Curve Editors) */}
        {selectedEvent.type === 'Continuous' && (
          <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">📊 Dynamic Waveforms</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700">Advanced</span>
            </div>

            <CurveEditor
              label="Intensity Envelope"
              color="#06b6d4"
              points={selectedEvent.intensityCurve}
              duration={selectedEvent.duration}
              onChange={(points) => handleChange('intensityCurve', points)}
            />

            <CurveEditor
              label="Sharpness Envelope"
              color="#d946ef"
              points={selectedEvent.sharpnessCurve}
              duration={selectedEvent.duration}
              onChange={(points) => handleChange('sharpnessCurve', points)}
            />
          </div>
        )}
      </div>
    </div>
  );
};