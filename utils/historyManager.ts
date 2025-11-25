import { invoke } from '@tauri-apps/api/core';
import { HistoryEntry, HistoryActionType, Snapshot, ProjectState, HistoryFilter } from '@/types';

/**
 * HistoryManager - TypeScript wrapper for Rust history operations
 * Provides high-level API for undo/redo, snapshots, and history management
 */
export class HistoryManager {
    /**
     * Initialize history with current state
     */
    static async setCurrentState(state: ProjectState): Promise<void> {
        await invoke('set_current_state', { state });
    }

    /**
     * Push a new action to history
     */
    static async pushAction(
        action: HistoryActionType,
        label: string,
        newState: ProjectState,
        details?: string
    ): Promise<HistoryEntry> {
        return await invoke('push_history', {
            action,
            label,
            details,
            newState
        });
    }

    /**
     * Undo the last action
     * @returns The restored state
     */
    static async undo(): Promise<ProjectState> {
        return await invoke('undo');
    }

    /**
     * Redo the next action
     * @returns The restored state
     */
    static async redo(): Promise<ProjectState> {
        return await invoke('redo');
    }

    /**
     * Check if undo is available
     */
    static async canUndo(): Promise<boolean> {
        return await invoke('can_undo');
    }

    /**
     * Check if redo is available
     */
    static async canRedo(): Promise<boolean> {
        return await invoke('can_redo');
    }

    /**
     * Get current history position
     * @returns [currentIndex, totalEntries]
     */
    static async getHistoryPosition(): Promise<[number, number]> {
        return await invoke('get_history_position');
    }

    /**
     * Get history list with optional filtering
     */
    static async getHistoryList(filter?: HistoryFilter): Promise<HistoryEntry[]> {
        return await invoke('get_history_list', { filter });
    }

    /**
     * Jump to a specific history index
     */
    static async jumpToHistory(index: number): Promise<ProjectState> {
        return await invoke('jump_to_history', { index });
    }

    /**
     * Delete a specific history entry
     */
    static async deleteEntry(id: string): Promise<void> {
        await invoke('delete_history_entry', { id });
    }

    /**
     * Pin or unpin a history entry
     */
    static async pinEntry(id: string, pinned: boolean): Promise<void> {
        await invoke('pin_history_entry', { id, pinned });
    }

    /**
     * Create a snapshot of the current state
     */
    static async createSnapshot(label: string, notes?: string): Promise<Snapshot> {
        return await invoke('create_snapshot', { label, notes });
    }

    /**
     * Restore from a snapshot
     */
    static async restoreSnapshot(id: string): Promise<ProjectState> {
        return await invoke('restore_snapshot', { id });
    }

    /**
     * Get all snapshots
     */
    static async getSnapshots(): Promise<Snapshot[]> {
        return await invoke('get_snapshots');
    }

    /**
     * Delete a snapshot
     */
    static async deleteSnapshot(id: string): Promise<void> {
        await invoke('delete_snapshot', { id });
    }

    /**
     * Clear old history, keeping only the specified count
     */
    static async clearOldHistory(keepCount: number): Promise<void> {
        await invoke('clear_old_history', { keepCount });
    }

    /**
     * Generate a human-readable label for an action
     */
    static generateLabel(action: HistoryActionType, details?: any): string {
        switch (action) {
            case HistoryActionType.AddEvent:
                return `Added ${details?.type || 'event'}`;
            case HistoryActionType.DeleteEvent:
                return `Deleted ${details?.type || 'event'}`;
            case HistoryActionType.UpdateEvent:
                if (details?.property) {
                    const oldVal = details.oldValue?.toFixed?.(2) ?? details.oldValue;
                    const newVal = details.newValue?.toFixed?.(2) ?? details.newValue;
                    return `${details.property}: ${oldVal} → ${newVal}`;
                }
                return 'Updated event';
            case HistoryActionType.BatchOperation:
                return `Batch operation (${details?.count || 0} changes)`;
            case HistoryActionType.UpdateGlobalSettings:
                return `Updated ${details?.setting || 'settings'}`;
            default:
                return 'Unknown action';
        }
    }
}
