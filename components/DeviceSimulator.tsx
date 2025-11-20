import React, { useEffect, useRef, useState } from 'react';
import { EditorHapticEvent } from '../types';
import { HapticAudioEngine } from '../utils/audioEngine';

interface DeviceSimulatorProps {
  currentTime: number;
  isPlaying: boolean;
  events: EditorHapticEvent[];
  audioEngine: HapticAudioEngine | null;
  isHapticAudioEnabled: boolean;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({ currentTime, isPlaying, events, audioEngine, isHapticAudioEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Feedback State for React Render (text overlay)
  const [feedbackState, setFeedbackState] = useState<{ intensity: number, sharpness: number } | null>(null);

  // Physics State Refs (for Canvas loop)
  const stateRef = useRef({
    intensity: 0,
    sharpness: 0,
    rotation: 0,
    waveform: [] as {i: number, s: number}[],
    shockwaves: [] as {scale: number, opacity: number, color: string}[],
    lastTime: 0
  });

  // 1. Logic Loop: Determine current Haptic Output based on props
  useEffect(() => {
    // Find all active events across tracks
    const activeEvents = events.filter(e => {
      if (e.type === 'Transient') {
        // Transient is a "one-shot". In preview, we stretch it slightly for visibility
        return currentTime >= e.startTime && currentTime <= e.startTime + 0.08; 
      } else {
        return currentTime >= e.startTime && currentTime <= (e.startTime + e.duration);
      }
    });

    let maxIntensity = 0;
    let maxSharpness = 0;
    let isTransient = false;

    if (activeEvents.length > 0) {
        activeEvents.forEach(evt => {
            let currentIntensity = evt.intensity;
            let currentSharpness = evt.sharpness;

            // Apply Curve interpolation if Continuous
            if (evt.type === 'Continuous') {
                const relTime = currentTime - evt.startTime;
                if (evt.intensityCurve.length > 0) currentIntensity = interpolateCurve(evt.intensityCurve, relTime, evt.intensity);
                if (evt.sharpnessCurve.length > 0) currentSharpness = interpolateCurve(evt.sharpnessCurve, relTime, evt.sharpness);
            } else {
                isTransient = true;
            }

            maxIntensity = Math.max(maxIntensity, currentIntensity);
            maxSharpness = Math.max(maxSharpness, currentSharpness);
        });
    }

    // Update React State for UI overlays
    if (maxIntensity > 0) {
        setFeedbackState({ intensity: maxIntensity, sharpness: maxSharpness });
    } else {
        setFeedbackState(null);
    }

    // Update Refs for Animation Loop
    stateRef.current.intensity = maxIntensity;
    stateRef.current.sharpness = maxSharpness;
    
    // Trigger shockwave visual if a new transient starts or intensity spikes suddenly
    if (isTransient && maxIntensity > 0.1) {
         // Debounce slightly in loop
         if (stateRef.current.shockwaves.length === 0 || stateRef.current.shockwaves[stateRef.current.shockwaves.length-1].scale > 0.5) {
             stateRef.current.shockwaves.push({
                 scale: 0,
                 opacity: 1,
                 color: maxSharpness > 0.5 ? '#06b6d4' : '#d946ef'
             });
         }
    }

    // --- Audio Simulation Sync ---
    if (audioEngine && isPlaying && isHapticAudioEnabled) {
        if (maxIntensity > 0) {
            audioEngine.update(maxIntensity, maxSharpness);
        } else {
            audioEngine.stop();
        }
    } else if (audioEngine) {
        audioEngine.stop();
    }

  }, [currentTime, events, isPlaying, audioEngine, isHapticAudioEnabled]);


  // 2. Animation Loop: Visuals
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = (time: number) => {
        const deltaTime = (time - stateRef.current.lastTime) / 1000;
        stateRef.current.lastTime = time;
        
        const { intensity, sharpness } = stateRef.current;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2 - 40; // Shift up slightly

        // Clear
        ctx.fillStyle = '#111827'; // gray-900
        ctx.fillRect(0, 0, width, height);

        // --- Background Grid ---
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<width; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
        for(let i=0; i<height; i+=40) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
        ctx.stroke();

        // --- Waveform History ---
        // Push new value
        stateRef.current.waveform.push({ i: intensity, s: sharpness });
        if (stateRef.current.waveform.length > 100) stateRef.current.waveform.shift();

        // Draw Waveform (Bottom)
        const waveHeight = 60;
        const waveBottom = height - 20;
        const waveStep = width / 100;

        // Intensity Line (Cyan)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 2;
        stateRef.current.waveform.forEach((pt, idx) => {
            const x = idx * waveStep;
            const y = waveBottom - (pt.i * waveHeight);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Sharpness Line (Magenta)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(217, 70, 239, 0.5)';
        ctx.lineWidth = 1; // Thinner
        stateRef.current.waveform.forEach((pt, idx) => {
            const x = idx * waveStep;
            const y = waveBottom - (pt.s * waveHeight * 0.8); // Slightly lower amplitude
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();


        // --- Haptic Core (Main Visual) ---
        
        // Base Rotation
        stateRef.current.rotation += deltaTime * (0.5 + intensity * 2);

        // Jitter/Vibration amount based on Sharpness
        // Sharpness 0 = Smooth wobble
        // Sharpness 1 = High freq jitter
        const shake = intensity * 10;
        const jitterFreq = 5 + (sharpness * 40); // 5Hz to 45Hz
        const offsetX = Math.sin(time * 0.01 * jitterFreq) * shake;
        const offsetY = Math.cos(time * 0.01 * jitterFreq) * shake;

        ctx.save();
        ctx.translate(centerX + offsetX, centerY + offsetY);
        ctx.rotate(stateRef.current.rotation);

        // Core Circle
        const baseRadius = 40;
        const expandRadius = baseRadius + (intensity * 30);
        
        // Glow
        const gradient = ctx.createRadialGradient(0, 0, baseRadius * 0.5, 0, 0, expandRadius * 1.5);
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(0.4, sharpness > 0.5 ? 'rgba(6, 182, 212, 1)' : 'rgba(217, 70, 239, 1)'); // Cyan/Magenta mix
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, expandRadius, 0, Math.PI * 2);
        ctx.fill();

        // Wireframe rings (Tactile feel)
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Deformed ring
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            // Deform based on sharpness (spiky vs round)
            const deform = Math.sin(theta * 8 + time * 0.01) * (intensity * sharpness * 10);
            const r = expandRadius * 0.8 + deform;
            const x = Math.cos(theta) * r;
            const y = Math.sin(theta) * r;
            if (i===0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();


        // --- Shockwaves (Transient) ---
        stateRef.current.shockwaves.forEach((wave, index) => {
            wave.scale += deltaTime * 4; // Expand speed
            wave.opacity -= deltaTime * 2; // Fade speed

            if (wave.opacity <= 0) {
                stateRef.current.shockwaves.splice(index, 1);
                return;
            }

            ctx.beginPath();
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 4 * wave.opacity;
            ctx.globalAlpha = wave.opacity;
            ctx.arc(centerX, centerY, wave.scale * 100 + 40, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });


        animationFrameId = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Run once, uses refs for updates

  // --- Helpers ---
  const interpolateCurve = (points: {Time: number, ParameterValue: number}[], time: number, base: number) => {
        const sorted = [...points].sort((a, b) => a.Time - b.Time);
        if (sorted.length === 0) return base;
        if (time < sorted[0].Time) return sorted[0].ParameterValue;
        if (time > sorted[sorted.length - 1].Time) return sorted[sorted.length - 1].ParameterValue;
        for (let i = 0; i < sorted.length - 1; i++) {
            if (time >= sorted[i].Time && time <= sorted[i+1].Time) {
                const p1 = sorted[i];
                const p2 = sorted[i+1];
                const range = p2.Time - p1.Time;
                if (range === 0) return p1.ParameterValue;
                const t = (time - p1.Time) / range;
                return p1.ParameterValue + (p2.ParameterValue - p1.ParameterValue) * t;
            }
        }
        return base;
  };

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-gray-950 relative overflow-hidden">
        {/* Canvas Layer */}
        <canvas 
            ref={canvasRef}
            width={300}
            height={550}
            className="w-full h-full object-contain opacity-90"
        />
        
        {/* UI Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
             <div className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-gray-800">
                 <span className="text-[10px] font-mono text-gray-400">DEVICE:</span>
                 <span className="text-xs font-bold text-white ml-1">SIMULATOR</span>
             </div>
             <div className={`w-2 h-2 rounded-full ${feedbackState ? 'bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]' : 'bg-gray-700'}`} />
        </div>

        {/* Active Metrics Overlay */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
             <div className="bg-black/80 backdrop-blur border border-gray-800 rounded-lg p-3 space-y-2 shadow-xl">
                 {/* Intensity Bar */}
                 <div>
                     <div className="flex justify-between text-[10px] mb-1">
                         <span className="text-gray-400 font-bold">INTENSITY</span>
                         <span className="text-accent-cyan font-mono">{feedbackState ? feedbackState.intensity.toFixed(2) : '0.00'}</span>
                     </div>
                     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-accent-cyan transition-all duration-75 ease-out"
                            style={{ width: `${(feedbackState?.intensity || 0) * 100}%` }}
                         />
                     </div>
                 </div>
                 {/* Sharpness Bar */}
                 <div>
                     <div className="flex justify-between text-[10px] mb-1">
                         <span className="text-gray-400 font-bold">SHARPNESS</span>
                         <span className="text-accent-magenta font-mono">{feedbackState ? feedbackState.sharpness.toFixed(2) : '0.00'}</span>
                     </div>
                     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-accent-magenta transition-all duration-75 ease-out"
                            style={{ width: `${(feedbackState?.sharpness || 0) * 100}%` }}
                         />
                     </div>
                 </div>
             </div>
        </div>

        {/* Center Label when Idle */}
        {!feedbackState && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center opacity-20">
                    <div className="w-16 h-16 border-2 border-white rounded-full flex items-center justify-center mx-auto mb-2">
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <p className="text-xs tracking-widest font-mono">WAITING FOR HAPTICS</p>
                </div>
            </div>
        )}
    </div>
  );
};