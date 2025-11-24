'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Timeline } from '@/components/Timeline';
import { Inspector } from '@/components/Inspector';
import { DeviceSimulator } from '@/components/DeviceSimulator';
import { ResizablePanel } from '@/components/ResizablePanel';
import { GenerationLoader } from '@/components/GenerationLoader';
import { EditorHapticEvent, ProjectState } from '@/types';
import { HapticAudioEngine } from '@/utils/audioEngine';
import * as storage from '@/utils/storage';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { PlayIcon, PauseIcon, BoltIcon, WaveIcon, LoopIcon, ClockIcon, ResetIcon, LoaderIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@/components/Icons';

export default function Home() {
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(10);
    const [events, setEvents] = useState<EditorHapticEvent[]>([]);
    const [waveform, setWaveform] = useState<number[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLooping, setIsLooping] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isHapticAudioEnabled, setIsHapticAudioEnabled] = useState(true);

    // Initialize Audio Engine
    const [audioEngine] = useState(() => new HapticAudioEngine());

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const requestRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastFrameTimeRef = useRef<number>(0);

    // --- Handlers defined before effects that use them ---
    const handlePlayPause = useCallback(() => {
        audioEngine.init();
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        } else {
            setIsPlaying(p => !p);
        }
    }, [audioEngine]);

    const deleteEvent = useCallback((id: string) => {
        setEvents(prevEvents => prevEvents.filter(e => e.id !== id));
        if (selectedEventId === id) setSelectedEventId(null);
    }, [selectedEventId]);

    const handleSeek = useCallback((time: number) => {
        setCurrentTime(time);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    }, []);

    // --- Project Loading & Saving ---
    useEffect(() => {
        const loadProject = async () => {
            try {
                const videoUrl = await storage.loadVideo();
                if (videoUrl) {
                    setVideoSrc(videoUrl);
                }

                const projectState = storage.loadProjectState();
                if (projectState) {
                    setEvents(projectState.events || []);
                    setDuration(projectState.duration || 10);
                    setIsLooping(projectState.isLooping || false);
                    setPlaybackRate(projectState.playbackRate || 1);
                    setIsVideoMuted(projectState.isVideoMuted ?? false);
                    setIsHapticAudioEnabled(projectState.isHapticAudioEnabled ?? true);
                    // We might want to persist waveform too, but for now let's re-analyze or just keep it in memory if possible.
                    // Actually, since we don't have the file path on reload (unless we store it), we can't re-analyze easily without user interaction or storing the waveform.
                    // Let's assume for now waveform is lost on reload unless we store it.
                    // TODO: Add waveform to ProjectState if needed.
                    if (projectState.waveform) {
                        setWaveform(projectState.waveform);
                    }
                }
            } catch (error) {
                console.error("Failed to load project:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProject();

        // Cleanup audio on unmount
        return () => {
            audioEngine.close();
        };
    }, [audioEngine]);

    useEffect(() => {
        if (isLoading) return;

        const projectState: ProjectState = {
            events,
            duration,
            isLooping,
            playbackRate,
            isVideoMuted,
            isHapticAudioEnabled,
            waveform, // Save waveform to state
        };
        storage.saveProjectState(projectState);
    }, [events, duration, isLooping, playbackRate, isVideoMuted, isHapticAudioEnabled, waveform, isLoading]);


    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (selectedEventId) deleteEvent(selectedEventId);
                    break;
                case 'ArrowLeft':
                    handleSeek(Math.max(0, currentTime - 0.1));
                    break;
                case 'ArrowRight':
                    handleSeek(Math.min(duration, currentTime + 0.1));
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEventId, currentTime, duration, handlePlayPause, deleteEvent, handleSeek]);


    // --- Animation Loop ---
    const updateTime = useCallback((time: number) => {
        if (lastFrameTimeRef.current === 0) {
            lastFrameTimeRef.current = time;
        }

        const deltaTime = (time - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = time;

        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);

            if (videoRef.current.ended) {
                if (isLooping) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                } else {
                    setIsPlaying(false);
                }
            }
        } else if (isPlaying) {
            setCurrentTime(prev => {
                const next = prev + (deltaTime * playbackRate);
                if (next >= duration) {
                    if (isLooping) return 0;
                    setIsPlaying(false);
                    return duration;
                }
                return next;
            });
        }
        requestRef.current = requestAnimationFrame(updateTime);
    }, [isPlaying, duration, playbackRate, isLooping]);

    useEffect(() => {
        if (isPlaying) {
            lastFrameTimeRef.current = 0;
            requestRef.current = requestAnimationFrame(updateTime);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, updateTime]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    // Imperatively set muted property to ensure it's always in sync
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isVideoMuted;
        }
    }, [isVideoMuted, videoSrc]);


    // --- Other Handlers ---
    const handleStop = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
        audioEngine.stop();
    };

    const handleNewProject = async () => {
        if (window.confirm("Are you sure you want to start a new project? All data will be cleared.")) {
            setIsLoading(true);
            await storage.clearAllProjectData();
            window.location.reload();
        }
    };

    const toggleLoop = () => setIsLooping(!isLooping);

    const cyclePlaybackRate = () => {
        const rates = [1, 0.5, 0.25];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        setPlaybackRate(rates[nextIdx]);
    };

    /**
     * Handle video file upload with proper error handling and cleanup
     * Now uses native dialog and Rust backend for analysis
     */
    const handleVideoImport = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Video',
                    extensions: ['mp4', 'mov', 'avi', 'mkv']
                }]
            });

            if (!selected) return; // User cancelled

            const filePath = selected as string;
            setIsLoading(true);

            // 1. Analyze Audio in Rust
            let waveformData: number[] = [];
            try {
                waveformData = await invoke('analyze_audio', { filePath });
                console.log("Audio analysis complete, points:", waveformData.length);
            } catch (e) {
                console.error("Audio analysis failed:", e);
                // Continue without waveform
            }

            // 2. Read file to Blob for frontend playback
            const fileBytes = await readFile(filePath);
            const blob = new Blob([fileBytes], { type: 'video/mp4' }); // Mime type might need better detection but mp4 is safe default for blob url

            // 3. Save to storage
            await storage.clearAllProjectData();
            await storage.saveVideo(blob);

            // 4. Save initial state with waveform
            storage.saveProjectState({
                events: [],
                duration: 10, // Will be updated when video loads
                isLooping: false,
                playbackRate: 1,
                isVideoMuted: false,
                isHapticAudioEnabled: true,
                waveform: waveformData
            });

            window.location.reload();

        } catch (error) {
            console.error("Failed to import video:", error);
            setIsLoading(false);
            alert(`Failed to import video: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleVideoLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const getNextTrackId = () => {
        const lastEvent = events[events.length - 1];
        return lastEvent ? (lastEvent.trackId + 1) % 4 : 0;
    };

    const addEvent = (type: 'Transient' | 'Continuous', preset?: string) => {
        let intensityCurve: any[] = [];
        let sharpnessCurve: any[] = [];
        let durationVal = type === 'Continuous' ? 1.0 : 0;
        let intensity = 1.0;
        let sharpness = 0.5;

        if (preset === 'FadeIn') {
            intensityCurve = [{ Time: 0, ParameterValue: 0 }, { Time: 1, ParameterValue: 1 }];
        } else if (preset === 'Heartbeat') {
            durationVal = 1.6; // Two full beats for a rhythmic feel
            intensity = 1.0;
            sharpness = 0.5;

            // "lub-dub" ... "lub-dub"
            intensityCurve = [
                // Beat 1
                { Time: 0.0, ParameterValue: 0.0 },
                { Time: 0.06, ParameterValue: 1.0 }, // lub peak
                { Time: 0.16, ParameterValue: 0.0 },

                { Time: 0.26, ParameterValue: 0.0 },
                { Time: 0.29, ParameterValue: 0.75 }, // dub peak
                { Time: 0.36, ParameterValue: 0.0 },

                // Beat 2
                { Time: 0.8, ParameterValue: 0.0 },
                { Time: 0.86, ParameterValue: 1.0 }, // lub peak
                { Time: 0.96, ParameterValue: 0.0 },

                { Time: 1.06, ParameterValue: 0.0 },
                { Time: 1.09, ParameterValue: 0.75 }, // dub peak
                { Time: 1.16, ParameterValue: 0.0 },

                { Time: 1.6, ParameterValue: 0.0 }, // Ensure it ends at 0
            ];

            sharpnessCurve = [
                // Beat 1
                { Time: 0.0, ParameterValue: 0.3 }, // Low sharpness for "lub"
                { Time: 0.16, ParameterValue: 0.3 },

                { Time: 0.26, ParameterValue: 0.8 }, // High sharpness for "dub"
                { Time: 0.36, ParameterValue: 0.8 },

                { Time: 0.37, ParameterValue: 0.0 },
                { Time: 0.79, ParameterValue: 0.0 },

                // Beat 2
                { Time: 0.8, ParameterValue: 0.3 }, // Low sharpness for "lub"
                { Time: 0.96, ParameterValue: 0.3 },

                { Time: 1.06, ParameterValue: 0.8 }, // High sharpness for "dub"
                { Time: 1.16, ParameterValue: 0.8 },

                { Time: 1.17, ParameterValue: 0.0 },
                { Time: 1.6, ParameterValue: 0.0 },
            ];
        } else if (preset === 'Rumble') {
            durationVal = 2.0;
            intensity = 0.8;
            sharpness = 0.1;
        }

        const newEvent: EditorHapticEvent = {
            id: Math.random().toString(36).substr(2, 9),
            trackId: getNextTrackId(),
            type,
            startTime: currentTime,
            duration: durationVal,
            intensity,
            sharpness,
            selected: true,
            intensityCurve,
            sharpnessCurve
        };

        const updatedEvents = events.map(e => ({ ...e, selected: false }));
        setEvents([...updatedEvents, newEvent]);
        setSelectedEventId(newEvent.id);
    };

    const updateEvent = (updated: EditorHapticEvent) => {
        setEvents(events.map(e => e.id === updated.id ? updated : e));
    };

    /**
     * Handle AHAP export with validation and comprehensive error handling
     */
    const handleExport = async () => {
        // Validate that we have events to export
        if (events.length === 0) {
            alert('No haptic events to export. Please add at least one event to the timeline.');
            return;
        }

        setIsGenerating(true);

        try {
            // 1. Get Save Path from User
            const filepath = await save({
                filters: [{
                    name: 'Apple Haptic Pattern',
                    extensions: ['ahap']
                }],
                defaultPath: 'haptic-pattern.ahap'
            });

            if (!filepath) {
                setIsGenerating(false);
                return; // User cancelled
            }

            // 2. Invoke Rust Command with validated events
            await invoke('generate_ahap', {
                events: events,
                filepath: filepath
            });

            // 3. Show success feedback
            const filename = filepath.split('/').pop() || 'pattern.ahap';
            setSuccessMessage(`✓ Successfully exported ${filename}`);
            setTimeout(() => setSuccessMessage(null), 3000);

            console.log("Export successful to:", filepath);

        } catch (error) {
            console.error("Export failed:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Failed to generate AHAP file:\n\n${errorMessage}\n\nPlease check the console for more details.`);
        } finally {
            setIsGenerating(false);
        }
    };

    const selectedEvent = events.find(e => e.id === selectedEventId) || null;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-950">
                <div className="text-center">
                    <LoaderIcon className="w-12 h-12 mx-auto text-accent-cyan" />
                    <p className="mt-4 text-lg text-gray-400 font-mono">Loading Project...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-black text-white font-sans selection:bg-accent-cyan selection:text-black">
            {isGenerating && <GenerationLoader />}

            {/* Success Notification Toast */}
            {successMessage && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-2xl border border-green-500 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="font-semibold text-sm">{successMessage}</p>
                </div>
            )}

            <header className="h-12 border-b border-gray-800 bg-gray-900 flex items-center px-4 justify-between shrink-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                    <h1 className="font-bold text-sm tracking-wide uppercase text-gray-200">Haptic Studio <span className="text-[9px] bg-gray-800 px-1 py-0.5 rounded ml-1 text-cyan-400 border border-cyan-900">PRO</span></h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleNewProject}
                        className="text-xs font-medium px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-all"
                    >
                        New Project
                    </button>
                    <button
                        onClick={handleVideoImport}
                        className="text-xs font-medium px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-all"
                    >
                        Import Video
                    </button>
                    {/* Hidden input removed as we use native dialog now */}
                    <button
                        onClick={handleExport}
                        disabled={isGenerating || events.length === 0}
                        className={`
                            relative overflow-hidden
                            bg-gradient-to-r from-cyan-500 to-blue-600 
                            text-white text-xs font-bold 
                            px-5 py-2 rounded-lg
                            transition-all duration-300
                            shadow-lg shadow-cyan-500/30
                            disabled:opacity-50 disabled:cursor-not-allowed
                            disabled:shadow-none
                            hover:shadow-xl hover:shadow-cyan-500/50
                            hover:scale-105
                            active:scale-95
                            flex items-center gap-2
                        `}
                        title={events.length === 0 ? "Add events to export" : "Export AHAP file"}
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Exporting...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                <span>Export .AHAP</span>
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 relative">

                    {/* Main Stage: Responsive Layout */}
                    <div className="flex-1 bg-[#0a0a0a] relative flex flex-col lg:grid lg:grid-cols-12 gap-1 p-1 min-h-0">
                        <div className="flex-1 lg:col-span-8 relative rounded-lg overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center group min-h-0">
                            {videoSrc ? (
                                <video
                                    ref={videoRef}
                                    src={videoSrc}
                                    className="w-full h-full object-contain"
                                    onLoadedMetadata={handleVideoLoadedMetadata}
                                    onClick={handlePlayPause}
                                    playsInline
                                />
                            ) : (
                                <div className="text-center opacity-30 select-none">
                                    <p className="text-4xl font-bold mb-2">NO SIGNAL</p>
                                    <p className="text-sm font-mono">Import a video to begin</p>
                                </div>
                            )}

                            <div className="absolute top-4 right-4 font-mono text-xl font-bold text-white drop-shadow-md tabular-nums z-10">
                                {currentTime.toFixed(3)}s
                            </div>

                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur px-4 py-2 rounded-full flex gap-4 border border-white/10 text-gray-300">
                                <button onClick={handleStop} className="hover:text-red-400"><ResetIcon className="w-5 h-5" /></button>
                                <button onClick={handlePlayPause} className="hover:text-white">{isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}</button>
                                <button onClick={() => setIsVideoMuted(v => !v)} className="hover:text-white" title={isVideoMuted ? "Unmute Video" : "Mute Video"}>
                                    {isVideoMuted ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="lg:col-span-4 relative rounded-lg overflow-hidden bg-gray-900 border border-gray-800 h-64 lg:h-full">
                            <DeviceSimulator
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                events={events}
                                audioEngine={audioEngine}
                                isHapticAudioEnabled={isHapticAudioEnabled}
                            />
                        </div>
                    </div>

                    <div className="h-14 bg-gray-900 border-y border-gray-800 flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handlePlayPause}
                                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-lg 
                        ${isPlaying ? 'bg-accent-cyan text-black hover:scale-105' : 'bg-white text-black hover:bg-gray-200'}
                    `}
                                title="Play/Pause (Space)"
                            >
                                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
                            </button>

                            <div className="flex flex-col justify-center mr-2">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Status</span>
                                <span className="text-xs text-gray-300 font-mono">{isPlaying ? 'Running' : 'Standby'}</span>
                            </div>

                            <div className="h-8 w-px bg-gray-800 mx-1"></div>

                            <button
                                onClick={toggleLoop}
                                className={`p-2 rounded hover:bg-gray-800 transition-colors ${isLooping ? 'text-accent-cyan' : 'text-gray-500'}`}
                                title="Toggle Loop"
                            >
                                <LoopIcon className="w-5 h-5" />
                            </button>

                            <button
                                onClick={cyclePlaybackRate}
                                className={`flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-800 transition-colors ${playbackRate !== 1 ? 'text-accent-magenta' : 'text-gray-500'}`}
                                title="Playback Speed"
                            >
                                <ClockIcon className="w-5 h-5" />
                                <span className="text-xs font-mono font-bold w-8">{playbackRate}x</span>
                            </button>

                            <button
                                onClick={() => setIsHapticAudioEnabled(e => !e)}
                                className={`p-2 rounded hover:bg-gray-800 transition-colors ${isHapticAudioEnabled ? 'text-accent-cyan' : 'text-gray-500'}`}
                                title="Toggle Haptic Audio Simulation"
                            >
                                {isHapticAudioEnabled ? <SpeakerWaveIcon className="w-5 h-5" /> : <SpeakerXMarkIcon className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="h-8 w-px bg-gray-700 mx-2"></div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold mr-2">Add Effect</span>

                            <button
                                onClick={() => addEvent('Transient')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-accent-magenta font-bold border border-gray-700 hover:border-accent-magenta transition-all"
                            >
                                <BoltIcon className="w-3.5 h-3.5" /> Transient
                            </button>

                            <div className="flex bg-gray-800 rounded border border-gray-700 overflow-hidden">
                                <button
                                    onClick={() => addEvent('Continuous')}
                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-700 text-xs text-accent-cyan font-bold border-r border-gray-700 hover:text-cyan-300 transition-all"
                                >
                                    <WaveIcon className="w-3.5 h-3.5" /> Continuous
                                </button>
                                <button onClick={() => addEvent('Continuous', 'FadeIn')} className="px-2 hover:bg-gray-700 text-[10px] text-gray-400 border-r border-gray-700" title="Fade In">↗</button>
                                <button onClick={() => addEvent('Continuous', 'Heartbeat')} className="px-2 hover:bg-gray-700 text-[10px] text-gray-400 border-r border-gray-700" title="Heartbeat">♥</button>
                                <button onClick={() => addEvent('Continuous', 'Rumble')} className="px-2 hover:bg-gray-700 text-[10px] text-gray-400" title="Rumble">〰</button>
                            </div>
                        </div>
                    </div>

                    <div className="h-72 bg-gray-950 flex flex-col">
                        <Timeline
                            currentTime={currentTime}
                            duration={duration}
                            events={events}
                            waveform={waveform}
                            onSeek={handleSeek}
                            onSelectEvent={(id) => {
                                setSelectedEventId(id);
                                setEvents(prev => prev.map(e => ({ ...e, selected: e.id === id })));
                            }}
                            onUpdateEvent={updateEvent}
                        />
                    </div>
                </div>

                {/* Resizable Inspector for large screens */}
                <ResizablePanel
                    direction="horizontal"
                    initialSize={384}
                    minSize={320}
                    maxSize={600}
                    className="hidden lg:flex"
                >
                    <Inspector
                        selectedEvent={selectedEvent}
                        onUpdate={updateEvent}
                        onDelete={deleteEvent}
                    />
                </ResizablePanel>

                {/* Static Inspector for small screens */}
                <div className="lg:hidden h-96 border-t border-gray-750 shrink-0">
                    <Inspector
                        selectedEvent={selectedEvent}
                        onUpdate={updateEvent}
                        onDelete={deleteEvent}
                    />
                </div>

            </div>
        </div>
    );
}
