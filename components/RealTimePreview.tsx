import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { EditorHapticEvent } from '@/types';

interface RealTimePreviewProps {
    events: EditorHapticEvent[];
}

export const RealTimePreview: React.FC<RealTimePreviewProps> = ({ events }) => {
    const [localIp, setLocalIp] = useState<string | null>(null);
    const [clients, setClients] = useState<string[]>([]);
    const [isAutoPreview, setIsAutoPreview] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const lastEventsRef = useRef<string>("");

    useEffect(() => {
        invoke<string>('get_local_ip')
            .then(setLocalIp)
            .catch(console.error);

        // Poll for connected clients every 2 seconds
        const interval = setInterval(() => {
            invoke<string[]>('get_connected_clients')
                .then(setClients)
                .catch(console.error);
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    const broadcast = useCallback(async () => {
        if (events.length === 0) return;
        try {
            await invoke('broadcast_preview', { events });
        } catch (e) {
            console.error("Broadcast failed:", e);
        }
    }, [events]);

    // Auto-preview logic
    useEffect(() => {
        if (!isAutoPreview) return;

        const eventsStr = JSON.stringify(events);
        if (eventsStr === lastEventsRef.current) return;

        lastEventsRef.current = eventsStr;

        const timer = setTimeout(() => {
            broadcast();
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [events, isAutoPreview, broadcast]);

    return (
        <div className="relative">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-800 rounded border border-gray-700">
                <div
                    className="flex flex-col cursor-pointer group"
                    onClick={() => setShowPopover(!showPopover)}
                    title="Click to view connected devices"
                >
                    <span className="text-[10px] text-gray-500 uppercase font-bold group-hover:text-gray-300 transition-colors">Remote Preview</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${clients.length > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono text-gray-300 group-hover:text-white transition-colors">
                            {clients.length > 0 ? `${clients.length} Connected` : "Offline"}
                        </span>
                    </div>
                </div>

                <div className="h-6 w-px bg-gray-700 mx-1" />

                <button
                    onClick={() => setIsAutoPreview(!isAutoPreview)}
                    className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${isAutoPreview
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                            : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-600'
                        }`}
                    title="Automatically preview on device when changes are made"
                >
                    AUTO
                </button>

                <button
                    onClick={broadcast}
                    disabled={clients.length === 0}
                    className={`text-xs font-bold px-3 py-1 rounded transition-colors flex items-center gap-1 ${clients.length > 0
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                    title="Send current pattern to connected device"
                >
                    <span>Preview</span>
                </button>
            </div>

            {/* Devices Popover */}
            {showPopover && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPopover(false)} />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Connection Details</h3>

                        <div className="mb-3 p-2 bg-black/30 rounded border border-gray-800">
                            <p className="text-[10px] text-gray-500 mb-1">Desktop IP (Connect to this)</p>
                            <p className="text-sm font-mono text-cyan-400 select-all">{localIp || "Unknown"}</p>
                            <p className="text-[10px] text-gray-600 mt-1">Port: 8080</p>
                        </div>

                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Connected Devices</h3>
                        {clients.length === 0 ? (
                            <div className="text-center py-4 text-gray-600 text-xs italic">
                                No devices connected
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {clients.map((id) => (
                                    <div key={id} className="flex items-center gap-2 p-2 bg-gray-800 rounded border border-gray-700/50">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-xs text-gray-200 font-mono truncate" title={id}>Client {id.substring(0, 6)}...</span>
                                            <span className="text-[9px] text-green-500/80">Active</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
