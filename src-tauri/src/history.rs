use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;

// ============================================================================
// TYPES & STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HistoryActionType {
    AddEvent,
    DeleteEvent,
    UpdateEvent,
    BatchOperation,
    UpdateGlobalSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: i64, // Unix timestamp in milliseconds
    pub action: HistoryActionType,
    pub label: String,
    pub details: Option<String>,
    pub is_pinned: bool,
    pub is_collapsed: bool,
    pub child_count: Option<usize>,
    // Diff data (stored as JSON for flexibility)
    pub forward_diff: serde_json::Value,
    pub backward_diff: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub timestamp: i64,
    pub label: String,
    pub notes: Option<String>,
    pub state: serde_json::Value, // Full project state
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryFilter {
    pub action_types: Option<Vec<HistoryActionType>>,
    pub search_query: Option<String>,
    pub date_range: Option<(i64, i64)>,
    pub pinned_only: Option<bool>,
}

// ============================================================================
// HISTORY STATE MANAGER
// ============================================================================

pub struct HistoryState {
    entries: Vec<HistoryEntry>,
    current_index: isize, // -1 means no history, 0+ is position in entries
    snapshots: Vec<Snapshot>,
    current_state: serde_json::Value,
    max_entries: usize,
    batch_window_ms: i64, // Time window for grouping operations
    last_action_time: i64,
    last_action_type: Option<HistoryActionType>,
    pending_batch: Vec<HistoryEntry>,
}

impl HistoryState {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            current_index: -1,
            snapshots: Vec::new(),
            current_state: serde_json::Value::Null,
            max_entries: 1000,
            batch_window_ms: 500,
            last_action_time: 0,
            last_action_type: None,
            pending_batch: Vec::new(),
        }
    }

    pub fn set_current_state(&mut self, state: serde_json::Value) {
        self.current_state = state;
    }

    pub fn get_current_state(&self) -> &serde_json::Value {
        &self.current_state
    }

    /// Push a new action to history
    pub fn push_action(
        &mut self,
        action: HistoryActionType,
        label: String,
        details: Option<String>,
        new_state: serde_json::Value,
    ) -> Result<HistoryEntry, String> {
        let now = Utc::now().timestamp_millis();
        
        // Compute diffs
        let forward_diff = compute_diff(&self.current_state, &new_state);
        let backward_diff = compute_diff(&new_state, &self.current_state);

        let entry = HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: now,
            action: action.clone(),
            label,
            details,
            is_pinned: false,
            is_collapsed: false,
            child_count: None,
            forward_diff,
            backward_diff,
        };

        // Check if we should batch this operation
        let should_batch = self.should_batch(&action, now);

        if should_batch {
            self.pending_batch.push(entry.clone());
        } else {
            // Flush any pending batch first
            if !self.pending_batch.is_empty() {
                self.flush_batch()?;
            }

            // Clear any redo history when new action is added
            if self.current_index >= 0 && (self.current_index as usize) < self.entries.len() - 1 {
                self.entries.truncate((self.current_index + 1) as usize);
            }

            // Add the new entry
            self.entries.push(entry.clone());
            self.current_index = self.entries.len() as isize - 1;

            // Update current state
            self.current_state = new_state;

            // Enforce max entries limit
            self.cleanup_old_entries();
        }

        self.last_action_time = now;
        self.last_action_type = Some(action);

        Ok(entry)
    }

    /// Check if action should be batched with previous actions
    fn should_batch(&self, action: &HistoryActionType, now: i64) -> bool {
        if let Some(ref last_action) = self.last_action_type {
            if last_action == action 
                && action == &HistoryActionType::UpdateEvent
                && (now - self.last_action_time) < self.batch_window_ms {
                return true;
            }
        }
        false
    }

    /// Flush pending batch operations into a single grouped entry
    fn flush_batch(&mut self) -> Result<(), String> {
        if self.pending_batch.is_empty() {
            return Ok(());
        }

        let batch_count = self.pending_batch.len();
        let first_entry = &self.pending_batch[0];
        
        // Combine all diffs
        let mut combined_forward = first_entry.forward_diff.clone();
        let combined_backward = self.pending_batch.last().unwrap().backward_diff.clone();

        // Merge intermediate diffs (simplified - in production, would need proper merging)
        for entry in &self.pending_batch[1..] {
            merge_diffs(&mut combined_forward, &entry.forward_diff);
        }

        let batch_entry = HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: first_entry.timestamp,
            action: HistoryActionType::BatchOperation,
            label: format!("{} (x{})", first_entry.label, batch_count),
            details: Some(format!("Grouped {} operations", batch_count)),
            is_pinned: false,
            is_collapsed: true,
            child_count: Some(batch_count),
            forward_diff: combined_forward,
            backward_diff: combined_backward,
        };

        // Clear redo history
        if self.current_index >= 0 && (self.current_index as usize) < self.entries.len() - 1 {
            self.entries.truncate((self.current_index + 1) as usize);
        }

        self.entries.push(batch_entry);
        self.current_index = self.entries.len() as isize - 1;
        self.pending_batch.clear();

        Ok(())
    }

    /// Undo the last action
    pub fn undo(&mut self) -> Result<serde_json::Value, String> {
        // Flush any pending batch first
        if !self.pending_batch.is_empty() {
            self.flush_batch()?;
        }

        if self.current_index < 0 {
            return Err("Nothing to undo".to_string());
        }

        let entry = &self.entries[self.current_index as usize];
        
        // Apply backward diff
        self.current_state = apply_diff(&self.current_state, &entry.backward_diff)?;
        self.current_index -= 1;

        Ok(self.current_state.clone())
    }

    /// Redo the next action
    pub fn redo(&mut self) -> Result<serde_json::Value, String> {
        if self.current_index >= (self.entries.len() as isize - 1) {
            return Err("Nothing to redo".to_string());
        }

        self.current_index += 1;
        let entry = &self.entries[self.current_index as usize];
        
        // Apply forward diff
        self.current_state = apply_diff(&self.current_state, &entry.forward_diff)?;

        Ok(self.current_state.clone())
    }

    /// Jump to a specific history index
    pub fn jump_to_index(&mut self, target_index: isize) -> Result<serde_json::Value, String> {
        if target_index < -1 || target_index >= self.entries.len() as isize {
            return Err("Invalid history index".to_string());
        }

        // Flush pending batch
        if !self.pending_batch.is_empty() {
            self.flush_batch()?;
        }

        // Determine direction and apply diffs
        if target_index > self.current_index {
            // Moving forward
            for i in (self.current_index + 1)..=target_index {
                let entry = &self.entries[i as usize];
                self.current_state = apply_diff(&self.current_state, &entry.forward_diff)?;
            }
        } else if target_index < self.current_index {
            // Moving backward
            for i in ((target_index + 1)..=self.current_index).rev() {
                let entry = &self.entries[i as usize];
                self.current_state = apply_diff(&self.current_state, &entry.backward_diff)?;
            }
        }

        self.current_index = target_index;
        Ok(self.current_state.clone())
    }

    /// Get history list with optional filtering
    pub fn get_history_list(&self, filter: Option<HistoryFilter>) -> Vec<HistoryEntry> {
        let mut result: Vec<HistoryEntry> = self.entries.clone();

        if let Some(f) = filter {
            // Filter by action types
            if let Some(action_types) = f.action_types {
                result.retain(|e| action_types.contains(&e.action));
            }

            // Filter by search query
            if let Some(query) = f.search_query {
                let query_lower = query.to_lowercase();
                result.retain(|e| {
                    e.label.to_lowercase().contains(&query_lower)
                        || e.details.as_ref().map_or(false, |d| d.to_lowercase().contains(&query_lower))
                });
            }

            // Filter by date range
            if let Some((start, end)) = f.date_range {
                result.retain(|e| e.timestamp >= start && e.timestamp <= end);
            }

            // Filter pinned only
            if let Some(true) = f.pinned_only {
                result.retain(|e| e.is_pinned);
            }
        }

        result
    }

    /// Delete a specific history entry
    pub fn delete_entry(&mut self, id: &str) -> Result<(), String> {
        let index = self.entries.iter().position(|e| e.id == id)
            .ok_or("Entry not found")?;

        // Can't delete if it would break history continuity
        if index as isize <= self.current_index {
            return Err("Cannot delete entries in the current history chain".to_string());
        }

        self.entries.remove(index);
        Ok(())
    }

    /// Pin or unpin a history entry
    pub fn pin_entry(&mut self, id: &str, pinned: bool) -> Result<(), String> {
        let entry = self.entries.iter_mut().find(|e| e.id == id)
            .ok_or("Entry not found")?;
        
        entry.is_pinned = pinned;
        Ok(())
    }

    /// Create a snapshot of the current state
    pub fn create_snapshot(&mut self, label: String, notes: Option<String>) -> Result<Snapshot, String> {
        let snapshot = Snapshot {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now().timestamp_millis(),
            label,
            notes,
            state: self.current_state.clone(),
        };

        self.snapshots.push(snapshot.clone());
        Ok(snapshot)
    }

    /// Restore from a snapshot
    pub fn restore_snapshot(&mut self, id: &str) -> Result<serde_json::Value, String> {
        let snapshot = self.snapshots.iter().find(|s| s.id == id)
            .ok_or("Snapshot not found")?;

        self.current_state = snapshot.state.clone();
        
        // Clear history after restoration (or optionally keep it)
        // For now, we'll keep history but mark current position
        
        Ok(self.current_state.clone())
    }

    /// Get all snapshots
    pub fn get_snapshots(&self) -> Vec<Snapshot> {
        self.snapshots.clone()
    }

    /// Delete a snapshot
    pub fn delete_snapshot(&mut self, id: &str) -> Result<(), String> {
        let index = self.snapshots.iter().position(|s| s.id == id)
            .ok_or("Snapshot not found")?;
        
        self.snapshots.remove(index);
        Ok(())
    }

    /// Clear old history entries beyond max limit
    fn cleanup_old_entries(&mut self) {
        if self.entries.len() > self.max_entries {
            let remove_count = self.entries.len() - self.max_entries;
            
            // Don't remove pinned entries
            let mut removed = 0;
            let mut i = 0;
            while removed < remove_count && i < self.entries.len() {
                if !self.entries[i].is_pinned {
                    self.entries.remove(i);
                    removed += 1;
                    if self.current_index >= i as isize {
                        self.current_index -= 1;
                    }
                } else {
                    i += 1;
                }
            }
        }
    }

    /// Clear old history, keeping only the specified count
    pub fn clear_old_history(&mut self, keep_count: usize) -> Result<(), String> {
        if self.entries.len() <= keep_count {
            return Ok(());
        }

        let remove_count = self.entries.len() - keep_count;
        
        // Remove from the beginning, preserving pinned entries
        let mut removed = 0;
        let mut i = 0;
        while removed < remove_count && i < self.entries.len() {
            if !self.entries[i].is_pinned && i as isize <= self.current_index - keep_count as isize {
                self.entries.remove(i);
                removed += 1;
                self.current_index -= 1;
            } else {
                i += 1;
            }
        }

        Ok(())
    }

    pub fn can_undo(&self) -> bool {
        self.current_index >= 0
    }

    pub fn can_redo(&self) -> bool {
        self.current_index < (self.entries.len() as isize - 1)
    }

    pub fn get_current_index(&self) -> isize {
        self.current_index
    }
}

// ============================================================================
// DIFF COMPUTATION & APPLICATION
// ============================================================================

/// Compute diff between two JSON values
fn compute_diff(old: &serde_json::Value, new: &serde_json::Value) -> serde_json::Value {
    use serde_json::json;

    match (old, new) {
        (serde_json::Value::Object(old_map), serde_json::Value::Object(new_map)) => {
            let mut changes = serde_json::Map::new();
            
            // Check for modified and added keys
            for (key, new_val) in new_map {
                if let Some(old_val) = old_map.get(key) {
                    if old_val != new_val {
                        changes.insert(key.clone(), compute_diff(old_val, new_val));
                    }
                } else {
                    changes.insert(key.clone(), json!({ "added": new_val }));
                }
            }
            
            // Check for removed keys
            for (key, old_val) in old_map {
                if !new_map.contains_key(key) {
                    changes.insert(key.clone(), json!({ "removed": old_val }));
                }
            }
            
            serde_json::Value::Object(changes)
        }
        (serde_json::Value::Array(old_arr), serde_json::Value::Array(new_arr)) => {
            // Simplified array diff - store entire new array if different
            if old_arr != new_arr {
                json!({ "array_replace": new_arr })
            } else {
                json!(null)
            }
        }
        _ => {
            if old != new {
                new.clone()
            } else {
                json!(null)
            }
        }
    }
}

/// Apply a diff to a JSON value
fn apply_diff(base: &serde_json::Value, diff: &serde_json::Value) -> Result<serde_json::Value, String> {
    use serde_json::json;

    match (base, diff) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(diff_map)) => {
            let mut result = base_map.clone();
            
            for (key, diff_val) in diff_map {
                if let Some(obj) = diff_val.as_object() {
                    if obj.contains_key("added") {
                        result.insert(key.clone(), obj["added"].clone());
                    } else if obj.contains_key("removed") {
                        result.remove(key);
                    } else if obj.contains_key("array_replace") {
                        result.insert(key.clone(), obj["array_replace"].clone());
                    } else {
                        // Recursive diff
                        let base_val = base_map.get(key).unwrap_or(&json!(null));
                        result.insert(key.clone(), apply_diff(base_val, diff_val)?);
                    }
                } else {
                    result.insert(key.clone(), diff_val.clone());
                }
            }
            
            Ok(serde_json::Value::Object(result))
        }
        _ => {
            if diff.is_null() {
                Ok(base.clone())
            } else {
                Ok(diff.clone())
            }
        }
    }
}

/// Merge two diffs (simplified version)
fn merge_diffs(base_diff: &mut serde_json::Value, new_diff: &serde_json::Value) {
    if let (Some(base_obj), Some(new_obj)) = (base_diff.as_object_mut(), new_diff.as_object()) {
        for (key, val) in new_obj {
            base_obj.insert(key.clone(), val.clone());
        }
    }
}

// ============================================================================
// GLOBAL STATE (Thread-safe)
// ============================================================================

lazy_static::lazy_static! {
    pub static ref HISTORY: Mutex<HistoryState> = Mutex::new(HistoryState::new());
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_push_and_undo() {
        let mut history = HistoryState::new();
        let state1 = json!({ "events": [], "duration": 10 });
        let state2 = json!({ "events": [{"id": "1"}], "duration": 10 });
        
        history.set_current_state(state1.clone());
        history.push_action(
            HistoryActionType::AddEvent,
            "Added event".to_string(),
            None,
            state2.clone(),
        ).unwrap();
        
        assert_eq!(history.get_current_state(), &state2);
        
        let undone = history.undo().unwrap();
        assert_eq!(undone, state1);
    }

    #[test]
    fn test_redo_after_undo() {
        let mut history = HistoryState::new();
        let state1 = json!({ "value": 1 });
        let state2 = json!({ "value": 2 });
        
        history.set_current_state(state1.clone());
        history.push_action(
            HistoryActionType::UpdateEvent,
            "Update".to_string(),
            None,
            state2.clone(),
        ).unwrap();
        
        history.undo().unwrap();
        let redone = history.redo().unwrap();
        
        assert_eq!(redone, state2);
    }

    #[test]
    fn test_snapshot_creation() {
        let mut history = HistoryState::new();
        let state = json!({ "test": "data" });
        history.set_current_state(state.clone());
        
        let snapshot = history.create_snapshot("Test Snapshot".to_string(), Some("Notes".to_string())).unwrap();
        
        assert_eq!(snapshot.label, "Test Snapshot");
        assert_eq!(snapshot.state, state);
    }
}
