#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

// --- History Module ---
mod history;
mod server;

// --- Input Types (from Frontend) ---

#[derive(Debug, Deserialize, Serialize)]
pub struct EditorHapticEvent {
    pub id: String,
    pub trackId: u32,
    #[serde(rename = "type")]
    pub event_type: String, // "Transient" or "Continuous"
    pub startTime: f64,
    pub duration: f64,
    pub intensity: f64,
    pub sharpness: f64,
    pub intensityCurve: Vec<AHAPControlPoint>,
    pub sharpnessCurve: Vec<AHAPControlPoint>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AHAPControlPoint {
    pub Time: f64,
    pub ParameterValue: f64,
}

// --- Output Types (AHAP Format) ---

#[derive(Debug, Serialize, Deserialize)]
pub struct AHAPPattern {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Version: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Metadata: Option<AHAPMetadata>,
    pub Pattern: Vec<AHAPPatternItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AHAPMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Created: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AHAPPatternItem {
    Event { Event: AHAPEvent },
    ParameterCurve { ParameterCurve: AHAPParameterCurve },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AHAPEvent {
    pub EventType: String,
    pub Time: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub EventDuration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub EventParameters: Option<Vec<AHAPEventParameter>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AHAPEventParameter {
    pub ParameterID: String,
    pub ParameterValue: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AHAPParameterCurve {
    pub ParameterID: String,
    pub Time: f64,
    pub ParameterCurveControlPoints: Vec<AHAPControlPoint>,
}

// --- Command ---

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn analyze_audio(file_path: String) -> Result<Vec<f32>, String> {
        println!("Analyzing audio for file: {}", file_path);
        // 1. Open the media source.
        let src = File::open(&file_path).map_err(|e| format!("failed to open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(src), Default::default());

        // 2. Create a probe hint using the file's extension.
        let mut hint = Hint::new();
        if let Some(ext) = Path::new(&file_path).extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        // 3. Probe the media source.
        let meta_opts: MetadataOptions = Default::default();
        let fmt_opts: FormatOptions = Default::default();
        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &fmt_opts, &meta_opts)
            .map_err(|e| format!("unsupported format: {}", e))?;

        let mut format = probed.format;

        // 4. Find the first audio track.
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("no audio track found")?;

        // 5. Create a decoder for the track.
        let dec_opts: DecoderOptions = Default::default();
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &dec_opts)
            .map_err(|e| format!("unsupported codec: {}", e))?;

        let track_id = track.id;
        let mut waveform_data = Vec::new();
        
        // Processing parameters
        // We want roughly 50-100 points per second for visualization
        // Standard sample rate is usually 44100 or 48000
        // So we need to aggregate roughly 441-960 samples into one point.
        // Let's pick a chunk size that gives us good resolution but not too much data.
        // 1024 samples at 48kHz is ~21ms, which is ~46 points/sec. Good enough.
        let chunk_size = 1024; 
        let mut current_chunk_sum = 0.0;
        let mut current_chunk_count = 0;

        // 6. Decode loop.
        loop {
            let packet = match format.next_packet() {
                Ok(packet) => packet,
                Err(Error::IoError(_)) => break, // End of stream
                Err(Error::ResetRequired) => {
                    // The track list has been changed. Re-examine it and create a new decoder if necessary.
                    // For simplicity, we'll just break here as we only care about the main audio.
                    break;
                }
                Err(err) => return Err(format!("error decoding: {}", err)),
            };

            if packet.track_id() != track_id {
                continue;
            }

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    // Consume the decoded audio samples.
                    // If the audio buffer is not in f32, it will be converted.
                    let spec = *decoded.spec();
                    let duration = decoded.capacity() as u64;
                    let mut sample_buf = SampleBuffer::<f32>::new(duration, spec);
                    sample_buf.copy_interleaved_ref(decoded);

                    // The samples are interleaved (L, R, L, R...)
                    // We want to calculate RMS or Peak for mono visualization.
                    // We'll average the channels to get mono, then square for RMS.
                    
                    let samples = sample_buf.samples();
                    let channels = spec.channels.count();

                    for frame in samples.chunks(channels) {
                        let mut mono_sample = 0.0;
                        for &s in frame {
                            mono_sample += s;
                        }
                        mono_sample /= channels as f32;

                        current_chunk_sum += mono_sample * mono_sample;
                        current_chunk_count += 1;

                        if current_chunk_count >= chunk_size {
                            let rms = (current_chunk_sum / current_chunk_count as f32).sqrt();
                            waveform_data.push(rms);
                            current_chunk_sum = 0.0;
                            current_chunk_count = 0;
                        }
                    }
                }
                Err(Error::IoError(_)) => break,
                Err(Error::DecodeError(_)) => (), // Ignore decode errors and continue
                Err(err) => return Err(format!("error decoding packet: {}", err)),
            }
        }
        
        // Push remaining
        if current_chunk_count > 0 {
             let rms = (current_chunk_sum / current_chunk_count as f32).sqrt();
             waveform_data.push(rms);
        }

        // Normalize data to 0.0 - 1.0 range for easier frontend rendering
        let max_val = waveform_data.iter().fold(0.0f32, |a, &b| a.max(b));
        if max_val > 0.0 {
            for x in &mut waveform_data {
                *x /= max_val;
            }
        }
        
        println!("Analysis complete. Generated {} points.", waveform_data.len());
        Ok(waveform_data)
    }

    fn events_to_ahap(events: &[EditorHapticEvent]) -> Result<AHAPPattern, String> {
        // Merge Strategy: Combine all continuous events into single global curves.
        let mut global_intensity_points: Vec<AHAPControlPoint> = Vec::new();
        let mut global_sharpness_points: Vec<AHAPControlPoint> = Vec::new();
        let mut transient_items: Vec<AHAPPatternItem> = Vec::new();

        for event in events {
            if event.event_type == "Transient" {
                let ahap_event = AHAPEvent {
                    EventType: "HapticTransient".to_string(),
                    Time: event.startTime,
                    EventDuration: Some(0.0),
                    EventParameters: Some(vec![
                        AHAPEventParameter {
                            ParameterID: "HapticIntensity".to_string(),
                            ParameterValue: event.intensity,
                        },
                        AHAPEventParameter {
                            ParameterID: "HapticSharpness".to_string(),
                            ParameterValue: event.sharpness,
                        },
                    ]),
                    Name: None,
                };
                transient_items.push(AHAPPatternItem::Event { Event: ahap_event });
            } else if event.event_type == "Continuous" {
                 // Intensity
                let mut intensity_points = event.intensityCurve.clone();
                if intensity_points.is_empty() {
                    intensity_points.push(AHAPControlPoint { Time: 0.0, ParameterValue: event.intensity });
                    intensity_points.push(AHAPControlPoint { Time: event.duration, ParameterValue: event.intensity });
                }
                for p in intensity_points {
                    global_intensity_points.push(AHAPControlPoint {
                        Time: event.startTime + p.Time,
                        ParameterValue: p.ParameterValue,
                    });
                }

                // Sharpness
                let mut sharpness_points = event.sharpnessCurve.clone();
                if sharpness_points.is_empty() {
                     sharpness_points.push(AHAPControlPoint { Time: 0.0, ParameterValue: event.sharpness });
                     sharpness_points.push(AHAPControlPoint { Time: event.duration, ParameterValue: event.sharpness });
                }
                for p in sharpness_points {
                    global_sharpness_points.push(AHAPControlPoint {
                        Time: event.startTime + p.Time,
                        ParameterValue: p.ParameterValue,
                    });
                }
            }
        }

        // Sort points by time
        global_intensity_points.sort_by(|a, b| a.Time.partial_cmp(&b.Time).unwrap());
        global_sharpness_points.sort_by(|a, b| a.Time.partial_cmp(&b.Time).unwrap());

        // Construct final pattern
        let mut final_pattern: Vec<AHAPPatternItem> = Vec::new();
        
        // Add merged curves if they exist
        if !global_intensity_points.is_empty() {
            final_pattern.push(AHAPPatternItem::ParameterCurve {
                ParameterCurve: AHAPParameterCurve {
                    ParameterID: "HapticIntensityControl".to_string(),
                    Time: 0.0,
                    ParameterCurveControlPoints: global_intensity_points,
                }
            });
        }
        if !global_sharpness_points.is_empty() {
            final_pattern.push(AHAPPatternItem::ParameterCurve {
                ParameterCurve: AHAPParameterCurve {
                    ParameterID: "HapticSharpnessControl".to_string(),
                    Time: 0.0,
                    ParameterCurveControlPoints: global_sharpness_points,
                }
            });
        }

        // Add transients
        final_pattern.extend(transient_items);

        if final_pattern.is_empty() {
            return Err("No valid haptic pattern data generated.".to_string());
        }

        Ok(AHAPPattern {
            Version: Some(1.0),
            Metadata: None,
            Pattern: final_pattern,
        })
    }

    #[tauri::command]
    pub async fn generate_ahap(events: Vec<EditorHapticEvent>, filepath: String) -> Result<(), String> {
        if events.is_empty() {
            return Err("No haptic events provided.".to_string());
        }
        if filepath.is_empty() {
            return Err("Invalid file path provided.".to_string());
        }

        let ahap = events_to_ahap(&events)?;

        let json = serde_json::to_string_pretty(&ahap)
            .map_err(|e| format!("Failed to serialize AHAP: {}", e))?;
        
        // Validate JSON structure
        serde_json::from_str::<serde_json::Value>(&json)
            .map_err(|e| format!("Generated invalid JSON: {}", e))?;

        let mut file = File::create(&filepath)
            .map_err(|e| format!("Failed to create file '{}': {}", filepath, e))?;
        
        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write data to file '{}': {}", filepath, e))?;

        Ok(())
    }

    #[tauri::command]
    pub async fn import_ahap(json_content: String) -> Result<Vec<EditorHapticEvent>, String> {
        // 1. Parse JSON
        let ahap: AHAPPattern = serde_json::from_str(&json_content)
            .map_err(|e| format!("Invalid AHAP JSON: {}", e))?;

        let mut events: Vec<EditorHapticEvent> = Vec::new();
        let mut track_counter = 0;

        // Helper to get next track ID (0-3)
        let mut next_track_id = || {
            let id = track_counter;
            track_counter = (track_counter + 1) % 4;
            id
        };

        for item in ahap.Pattern {
            match item {
                AHAPPatternItem::Event { Event: event } => {
                    let duration = event.EventDuration.unwrap_or(0.0);
                    let is_continuous = event.EventType == "HapticContinuous";
                    let event_type = if is_continuous { "Continuous" } else { "Transient" };
                    
                    let mut intensity = 1.0; // Default
                    let mut sharpness = 0.5; // Default

                    if let Some(params) = event.EventParameters {
                        for param in params {
                            if param.ParameterID == "HapticIntensity" {
                                intensity = param.ParameterValue;
                            } else if param.ParameterID == "HapticSharpness" {
                                sharpness = param.ParameterValue;
                            }
                        }
                    }

                    // Create basic event
                    let editor_event = EditorHapticEvent {
                        id: uuid::Uuid::new_v4().to_string(),
                        trackId: next_track_id(),
                        event_type: event_type.to_string(),
                        startTime: event.Time,
                        duration: if is_continuous && duration == 0.0 { 0.1 } else { duration },
                        intensity,
                        sharpness,
                        intensityCurve: Vec::new(),
                        sharpnessCurve: Vec::new(),
                    };
                    
                    events.push(editor_event);
                },
                AHAPPatternItem::ParameterCurve { ParameterCurve: curve } => {
                    let curve_type = if curve.ParameterID == "HapticIntensityControl" {
                        "Intensity"
                    } else if curve.ParameterID == "HapticSharpnessControl" {
                        "Sharpness"
                    } else {
                        continue;
                    };

                    for point in curve.ParameterCurveControlPoints {
                        let point_time = curve.Time + point.Time; // Global time
                        
                        // Find event that contains this time
                        if let Some(event) = events.iter_mut().find(|e| {
                            e.event_type == "Continuous" && 
                            point_time >= e.startTime && 
                            point_time <= (e.startTime + e.duration)
                        }) {
                            let relative_time = point_time - event.startTime;
                            let control_point = AHAPControlPoint {
                                Time: relative_time,
                                ParameterValue: point.ParameterValue,
                            };
                            
                            if curve_type == "Intensity" {
                                event.intensityCurve.push(control_point);
                            } else {
                                event.sharpnessCurve.push(control_point);
                            }
                        }
                    }
                }
            }
        }

        // Sort curves
        for event in &mut events {
            event.intensityCurve.sort_by(|a, b| a.Time.partial_cmp(&b.Time).unwrap_or(std::cmp::Ordering::Equal));
            event.sharpnessCurve.sort_by(|a, b| a.Time.partial_cmp(&b.Time).unwrap_or(std::cmp::Ordering::Equal));
        }

        Ok(events)
    }

    // ========================================================================
    // HISTORY COMMANDS
    // ========================================================================

    #[tauri::command]
    pub async fn push_history(
        action: history::HistoryActionType,
        label: String,
        details: Option<String>,
        new_state: serde_json::Value,
    ) -> Result<history::HistoryEntry, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.push_action(action, label, details, new_state)
    }

    #[tauri::command]
    pub async fn undo() -> Result<serde_json::Value, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.undo()
    }

    #[tauri::command]
    pub async fn redo() -> Result<serde_json::Value, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.redo()
    }

    #[tauri::command]
    pub async fn get_history_list(filter: Option<history::HistoryFilter>) -> Result<Vec<history::HistoryEntry>, String> {
        let hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        Ok(hist.get_history_list(filter))
    }

    #[tauri::command]
    pub async fn jump_to_history(index: isize) -> Result<serde_json::Value, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.jump_to_index(index)
    }

    #[tauri::command]
    pub async fn delete_history_entry(id: String) -> Result<(), String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.delete_entry(&id)
    }

    #[tauri::command]
    pub async fn pin_history_entry(id: String, pinned: bool) -> Result<(), String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.pin_entry(&id, pinned)
    }

    #[tauri::command]
    pub async fn create_snapshot(label: String, notes: Option<String>) -> Result<history::Snapshot, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.create_snapshot(label, notes)
    }

    #[tauri::command]
    pub async fn restore_snapshot(id: String) -> Result<serde_json::Value, String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.restore_snapshot(&id)
    }

    #[tauri::command]
    pub async fn get_snapshots() -> Result<Vec<history::Snapshot>, String> {
        let hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        Ok(hist.get_snapshots())
    }

    #[tauri::command]
    pub async fn delete_snapshot(id: String) -> Result<(), String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.delete_snapshot(&id)
    }

    #[tauri::command]
    pub async fn clear_old_history(keep_count: usize) -> Result<(), String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.clear_old_history(keep_count)
    }

    #[tauri::command]
    pub async fn can_undo() -> Result<bool, String> {
        let hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        Ok(hist.can_undo())
    }

    #[tauri::command]
    pub async fn can_redo() -> Result<bool, String> {
        let hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        Ok(hist.can_redo())
    }

    #[tauri::command]
    pub async fn get_history_position() -> Result<(isize, usize), String> {
        let hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        Ok((hist.get_current_index(), hist.get_history_list(None).len()))
    }

    #[tauri::command]
    pub async fn set_current_state(state: serde_json::Value) -> Result<(), String> {
        let mut hist = history::HISTORY.lock().map_err(|e| e.to_string())?;
        hist.set_current_state(state);
        Ok(())
    }
    #[tauri::command]
    pub async fn get_local_ip() -> Result<String, String> {
        local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .map_err(|e| format!("Failed to get local IP: {}", e))
    }

    #[tauri::command]
    pub async fn broadcast_preview(events: Vec<EditorHapticEvent>) -> Result<(), String> {
        let ahap = events_to_ahap(&events)?;
        let json = serde_json::to_string(&ahap)
            .map_err(|e| format!("Failed to serialize AHAP: {}", e))?;
        crate::server::broadcast_message(json);
        Ok(())
    }

    #[tauri::command]
    pub async fn set_preview_video_path(path: Option<String>) -> Result<(), String> {
        crate::server::set_video_path(path);
        Ok(())
    }

    #[tauri::command]
    pub async fn get_connected_clients() -> Result<Vec<String>, String> {
        Ok(crate::server::get_connected_clients())
    }
}

fn main() {
    tauri::async_runtime::spawn(async {
        server::start_server().await;
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::generate_ahap,
            commands::import_ahap,
            commands::analyze_audio,
            commands::push_history,
            commands::undo,
            commands::redo,
            commands::get_history_list,
            commands::jump_to_history,
            commands::delete_history_entry,
            commands::pin_history_entry,
            commands::create_snapshot,
            commands::restore_snapshot,
            commands::get_snapshots,
            commands::delete_snapshot,
            commands::clear_old_history,
            commands::can_undo,
            commands::can_redo,
            commands::get_history_position,
            commands::set_current_state,
            commands::get_local_ip,
            commands::broadcast_preview,
            commands::set_preview_video_path,
            commands::get_connected_clients,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
