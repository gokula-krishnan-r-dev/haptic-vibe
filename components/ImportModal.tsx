import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { EditorHapticEvent } from '@/types';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (events: EditorHapticEvent[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
    const [jsonContent, setJsonContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileSelect = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Apple Haptic Pattern',
                    extensions: ['ahap', 'json']
                }]
            });

            if (selected) {
                setIsLoading(true);
                setError(null);
                const content = await readTextFile(selected as string);
                await processImport(content);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to read file: ' + (err instanceof Error ? err.message : String(err)));
            setIsLoading(false);
        }
    };

    const handleTextImport = async () => {
        if (!jsonContent.trim()) {
            setError('Please enter JSON content');
            return;
        }
        setIsLoading(true);
        setError(null);
        await processImport(jsonContent);
    };

    const processImport = async (content: string) => {
        try {
            const events = await invoke<EditorHapticEvent[]>('import_ahap', { jsonContent: content });
            onImport(events);
            onClose();
        } catch (err) {
            console.error(err);
            setError('Import failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-lg font-bold text-white">Import AHAP Pattern</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex gap-4 mb-6">
                        <button
                            onClick={() => setActiveTab('file')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'file'
                                    ? 'bg-accent-cyan text-black shadow-lg shadow-cyan-500/20'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            Upload File
                        </button>
                        <button
                            onClick={() => setActiveTab('text')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'text'
                                    ? 'bg-accent-cyan text-black shadow-lg shadow-cyan-500/20'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            Paste JSON
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {activeTab === 'file' ? (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors cursor-pointer group" onClick={handleFileSelect}>
                            <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                <svg className="w-8 h-8 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <p className="text-gray-300 font-medium">Click to select .ahap file</p>
                            <p className="text-gray-500 text-xs mt-1">Supports .ahap and .json</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <textarea
                                value={jsonContent}
                                onChange={(e) => setJsonContent(e.target.value)}
                                placeholder="Paste AHAP JSON content here..."
                                className="w-full h-64 bg-gray-950 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-300 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan resize-none"
                            />
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={handleTextImport}
                                    disabled={isLoading || !jsonContent.trim()}
                                    className="px-6 py-2 bg-accent-cyan text-black font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? 'Importing...' : 'Import JSON'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
