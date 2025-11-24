#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;

// --- Input Types (from Frontend) ---

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Serialize)]
pub struct AHAPPattern {
    pub Version: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Metadata: Option<AHAPMetadata>,
    pub Pattern: Vec<AHAPPatternItem>,
}

#[derive(Debug, Serialize)]
pub struct AHAPMetadata {
    pub Project: String,
    pub Created: String,
    pub Description: String,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum AHAPPatternItem {
    Event { Event: AHAPEvent },
    ParameterCurve { ParameterCurve: AHAPParameterCurve },
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct AHAPEventParameter {
    pub ParameterID: String,
    pub ParameterValue: f64,
}

#[derive(Debug, Serialize)]
pub struct AHAPParameterCurve {
    pub ParameterID: String,
    pub Time: f64,
    pub ParameterCurveControlPoints: Vec<AHAPControlPoint>,
}

// --- Command ---

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn generate_ahap(events: Vec<EditorHapticEvent>, filepath: String) -> Result<(), String> {
        // Validate input
        if events.is_empty() {
            return Err("No haptic events provided. Please add at least one event to the timeline.".to_string());
        }

        if filepath.is_empty() {
            return Err("Invalid file path provided.".to_string());
        }

        // Merge Strategy: Combine all continuous events into single global curves.
        
        let mut global_intensity_points: Vec<AHAPControlPoint> = Vec::new();
        let mut global_sharpness_points: Vec<AHAPControlPoint> = Vec::new();
        let mut transient_items: Vec<AHAPPatternItem> = Vec::new();

        for event in events {
            if event.event_type == "Transient" {
                let ahap_event = AHAPEvent {
                    EventType: "HapticTransient".to_string(),
                    Time: event.startTime,
                    EventDuration: Some(0.0), // Transients have 0 duration per AHAP spec
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

        // Validate that we have at least some pattern data
        if final_pattern.is_empty() {
            return Err("No valid haptic pattern data generated. Please check your events.".to_string());
        }

        let ahap = AHAPPattern {
            Version: 1.0,
            Metadata: None, // Explicitly removed as per request
            Pattern: final_pattern,
        };

        // Serialize to JSON with validation
        let json = serde_json::to_string_pretty(&ahap)
            .map_err(|e| format!("Failed to serialize AHAP data to JSON: {}", e))?;
        
        // Validate JSON structure by parsing it back
        serde_json::from_str::<serde_json::Value>(&json)
            .map_err(|e| format!("Generated invalid JSON structure: {}", e))?;

        // Write to file
        let mut file = File::create(&filepath)
            .map_err(|e| format!("Failed to create file '{}': {}", filepath, e))?;
        
        file.write_all(json.as_bytes())
            .map_err(|e| format!("Failed to write data to file '{}': {}", filepath, e))?;

        Ok(())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![commands::generate_ahap])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
