
// AHAP Spec Types
export interface AHAPParameterCurveControlPoint {
  Time: number;
  ParameterValue: number;
}

export interface AHAPParameterCurve {
  ParameterID: 'HapticIntensityControl' | 'HapticSharpnessControl' | 'HapticAttackTimeControl' | 'HapticDecayTimeControl' | 'HapticReleaseTimeControl';
  Time: number;
  ParameterCurveControlPoints: AHAPParameterCurveControlPoint[];
}

export interface AHAPEvent {
  EventType: 'HapticTransient' | 'HapticContinuous';
  Time: number;
  EventDuration?: number;
  EventParameters?: {
    ParameterID: string;
    ParameterValue: number;
  }[];
}

export interface AHAPPattern {
  Version: number;
  Metadata?: {
    Project?: string;
    Created?: string;
    Description?: string;
  };
  Pattern: ({ Event: AHAPEvent } | { ParameterCurve: AHAPParameterCurve })[];
}

// Application State Types
export interface EditorHapticEvent {
  id: string;
  trackId: number; // 0 to N
  type: 'Transient' | 'Continuous';
  startTime: number;
  duration: number; // 0 for transient
  intensity: number; // Base intensity (0-1)
  sharpness: number; // Base sharpness (0-1)
  selected: boolean;
  // Simplified curve support: We store keyframes relative to event start
  intensityCurve: AHAPParameterCurveControlPoint[];
  sharpnessCurve: AHAPParameterCurveControlPoint[];
}

export interface TimelineState {
  duration: number; // Total timeline duration in seconds
  zoom: number; // Pixels per second
}

// Wrapper for all serializable project data
export interface ProjectState {
  events: EditorHapticEvent[];
  duration: number;
  isLooping: boolean;
  playbackRate: number;
  isVideoMuted: boolean;
  isHapticAudioEnabled: boolean;
}