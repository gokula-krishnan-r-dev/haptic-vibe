import { useState, useEffect, useCallback } from 'react';
import { HistoryManager } from '@/utils/historyManager';
import { HistoryEntry, HistoryActionType, ProjectState, HistoryFilter } from '@/types';

/**
 * useHistory Hook
 * Provides history management functionality with keyboard shortcuts
 */
export function useHistory() {
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [totalEntries, setTotalEntries] = useState(0);

    /**
     * Refresh history state
     */
    const refreshHistoryState = useCallback(async () => {
        try {
            const [canUndoResult, canRedoResult, position, list] = await Promise.all([
                HistoryManager.canUndo(),
                HistoryManager.canRedo(),
                HistoryManager.getHistoryPosition(),
                HistoryManager.getHistoryList(),
            ]);

            setCanUndo(canUndoResult);
            setCanRedo(canRedoResult);
            setCurrentIndex(position[0]);
            setTotalEntries(position[1]);
            setHistoryList(list);
        } catch (error) {
            console.error('Failed to refresh history state:', error);
        }
    }, []);

    /**
     * Undo last action
     */
    const undo = useCallback(async (): Promise<ProjectState | null> => {
        try {
            const newState = await HistoryManager.undo();
            await refreshHistoryState();
            return newState;
        } catch (error) {
            console.error('Undo failed:', error);
            return null;
        }
    }, [refreshHistoryState]);

    /**
     * Redo next action
     */
    const redo = useCallback(async (): Promise<ProjectState | null> => {
        try {
            const newState = await HistoryManager.redo();
            await refreshHistoryState();
            return newState;
        } catch (error) {
            console.error('Redo failed:', error);
            return null;
        }
    }, [refreshHistoryState]);

    /**
     * Track a new action
     */
    const trackAction = useCallback(async (
        action: HistoryActionType,
        label: string,
        newState: ProjectState,
        details?: string
    ): Promise<void> => {
        try {
            await HistoryManager.pushAction(action, label, newState, details);
            await refreshHistoryState();
        } catch (error) {
            console.error('Failed to track action:', error);
        }
    }, [refreshHistoryState]);

    /**
     * Jump to specific history index
     */
    const jumpToHistory = useCallback(async (index: number): Promise<ProjectState | null> => {
        try {
            const newState = await HistoryManager.jumpToHistory(index);
            await refreshHistoryState();
            return newState;
        } catch (error) {
            console.error('Failed to jump to history:', error);
            return null;
        }
    }, [refreshHistoryState]);

    /**
     * Get filtered history list
     */
    const getFilteredHistory = useCallback(async (filter: HistoryFilter): Promise<HistoryEntry[]> => {
        try {
            return await HistoryManager.getHistoryList(filter);
        } catch (error) {
            console.error('Failed to get filtered history:', error);
            return [];
        }
    }, []);

    /**
     * Delete history entry
     */
    const deleteEntry = useCallback(async (id: string): Promise<void> => {
        try {
            await HistoryManager.deleteEntry(id);
            await refreshHistoryState();
        } catch (error) {
            console.error('Failed to delete entry:', error);
        }
    }, [refreshHistoryState]);

    /**
     * Pin/unpin history entry
     */
    const pinEntry = useCallback(async (id: string, pinned: boolean): Promise<void> => {
        try {
            await HistoryManager.pinEntry(id, pinned);
            await refreshHistoryState();
        } catch (error) {
            console.error('Failed to pin entry:', error);
        }
    }, [refreshHistoryState]);

    /**
     * Initialize history state on mount
     */
    useEffect(() => {
        refreshHistoryState();
    }, [refreshHistoryState]);

    /**
     * Keyboard shortcuts for undo/redo
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            if (modifier && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
                    if (canRedo) redo();
                } else {
                    // Ctrl+Z or Cmd+Z = Undo
                    if (canUndo) undo();
                }
            } else if (modifier && e.key === 'y') {
                // Ctrl+Y or Cmd+Y = Redo (Windows/Linux style)
                e.preventDefault();
                if (canRedo) redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    return {
        // State
        canUndo,
        canRedo,
        historyList,
        currentIndex,
        totalEntries,

        // Actions
        undo,
        redo,
        trackAction,
        jumpToHistory,
        getFilteredHistory,
        deleteEntry,
        pinEntry,
        refreshHistoryState,
    };
}
