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
        <div className="space-y-3 bg-gray-900/50 p-3 rounded border border-gray-800">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timing</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">Start Time</span>
              <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={selectedEvent.startTime}
                    onChange={(e) => handleChange('startTime', parseFloat(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:border-accent-cyan outline-none"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-gray-600">s</span>
              </div>
            </div>
            {selectedEvent.type === 'Continuous' && (
              <div>
                <span className="text-[10px] text-gray-500 block mb-1">Duration</span>
                <div className="relative">
                    <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={selectedEvent.duration}
                    onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-sm font-mono focus:border-accent-cyan outline-none"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-gray-600">s</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Base Parameters */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Base Parameters</label>
          
          <div className="group">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-300">Intensity</span>
              <span className="font-mono text-accent-cyan">{selectedEvent.intensity.toFixed(2)}</span>
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

          <div className="group">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-300">Sharpness</span>
              <span className="font-mono text-accent-magenta">{selectedEvent.sharpness.toFixed(2)}</span>
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
          <div className="space-y-6 pt-4 border-t border-gray-800">
             <div className="flex items-center gap-2 mb-2">
                 <h3 className="text-xs font-bold text-white">Dynamic Waveforms</h3>
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