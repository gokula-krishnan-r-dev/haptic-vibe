import React from 'react';
import { UndoIcon, RedoIcon, HistoryIcon } from './Icons';

interface HistoryToolbarProps {
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onToggleHistoryPanel?: () => void;
    lastAction?: string;
    nextAction?: string;
}

export const HistoryToolbar: React.FC<HistoryToolbarProps> = ({
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onToggleHistoryPanel,
    lastAction,
    nextAction,
}) => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z';
    const redoShortcut = isMac ? '⌘⇧Z' : 'Ctrl+Y';

    return (
        <div className="flex items-center gap-1">
            {/* Undo Button */}
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`
          p-2 rounded transition-all
          ${canUndo
                        ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                        : 'text-gray-600 cursor-not-allowed opacity-50'
                    }
        `}
                title={canUndo ? `Undo: ${lastAction || 'Last action'} (${undoShortcut})` : 'Nothing to undo'}
            >
                <UndoIcon className="w-4 h-4" />
            </button>

            {/* Redo Button */}
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`
          p-2 rounded transition-all
          ${canRedo
                        ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                        : 'text-gray-600 cursor-not-allowed opacity-50'
                    }
        `}
                title={canRedo ? `Redo: ${nextAction || 'Next action'} (${redoShortcut})` : 'Nothing to redo'}
            >
                <RedoIcon className="w-4 h-4" />
            </button>

            {/* Divider */}
            {onToggleHistoryPanel && (
                <>
                    <div className="h-6 w-px bg-gray-700 mx-1" />

                    {/* History Panel Toggle */}
                    <button
                        onClick={onToggleHistoryPanel}
                        className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                        title="Toggle History Panel (Ctrl+H)"
                    >
                        <HistoryIcon className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};
