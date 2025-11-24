# Haptic Studio Pro - Technical Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [Application Workflow](#application-workflow)
6. [Key Components](#key-components)
7. [AHAP Format Implementation](#ahap-format-implementation)
8. [File Structure](#file-structure)
9. [Technical Implementation Details](#technical-implementation-details)
10. [API Reference](#api-reference)
11. [Development Guide](#development-guide)

---

## Project Overview

**Haptic Studio Pro** is a professional desktop application for creating, editing, and exporting haptic feedback patterns for iOS devices. It provides a visual timeline-based editor for designing haptic experiences that comply with Apple's AHAP (Apple Haptic and Audio Pattern) specification.

### Purpose

- **Design Haptic Patterns**: Create complex haptic feedback sequences visually
- **Video Synchronization**: Align haptic events with video content
- **AHAP Export**: Generate industry-standard `.ahap` files for iOS CoreHaptics
- **Real-time Preview**: Auditory simulation of haptic feedback during editing

### Target Users

- iOS developers implementing haptic feedback
- UX designers prototyping haptic experiences
- Game developers creating immersive haptic effects
- Audio-visual content creators

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.x | React framework with SSR/SSG capabilities |
| **React** | 18.x | UI component library |
| **TypeScript** | 5.x | Type-safe JavaScript |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **Lucide React** | - | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tauri** | 2.x | Desktop application framework |
| **Rust** | 1.x | Backend language for native performance |
| **Serde** | 1.x | Serialization/deserialization library |

### Audio Engine

- **Web Audio API**: Browser-native audio synthesis
- Custom oscillator-based haptic simulation

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Haptic Studio Pro                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │   Next.js UI   │◄───────►│  Tauri Runtime   │           │
│  │   (Frontend)   │         │   (Native OS)    │           │
│  └────────────────┘         └──────────────────┘           │
│         │                            │                       │
│         │                            │                       │
│  ┌──────▼────────┐         ┌────────▼─────────┐           │
│  │  React State  │         │   Rust Backend   │           │
│  │  Management   │         │  AHAP Generator  │           │
│  └───────────────┘         └──────────────────┘           │
│         │                            │                       │
│  ┌──────▼────────┐         ┌────────▼─────────┐           │
│  │ Web Audio API │         │  File System     │           │
│  │ Haptic Audio  │         │  Dialog System   │           │
│  └───────────────┘         └──────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
app/
├── page.tsx                 # Main application component
├── layout.tsx              # Root layout
└── globals.css            # Global styles

components/
└── GenerationLoader.tsx   # Loading animation component

utils/
├── audioEngine.ts         # Haptic audio simulation
└── storage.ts            # Local storage utilities

src-tauri/
└── src/
    └── main.rs           # Rust backend & AHAP generation
```

---

## Core Features

### 1. Video Upload & Playback

**Description**: Import video files to synchronize haptic patterns with visual content.

**Technical Implementation**:
- HTML5 `<video>` element for playback
- File input with drag-and-drop support
- Video metadata extraction (duration, dimensions)
- Playback controls (play/pause, seek, speed)

**Key Functions**:
- `handleVideoUpload()`: Processes uploaded video files
- `togglePlayback()`: Controls video play/pause state
- `handleSeek()`: Handles timeline scrubbing

### 2. Timeline-Based Event Editor

**Description**: Visual timeline for creating and editing haptic events.

**Features**:
- Drag-and-drop event creation
- Event resizing (for continuous haptics)
- Multi-track support
- Snap-to-grid functionality
- Real-time visual feedback

**Technical Implementation**:
- Canvas-based or SVG rendering
- Mouse event handlers for interaction
- State management with React hooks
- Time-to-pixel conversion calculations

### 3. Haptic Event Types

#### Transient Events
- **Duration**: Instantaneous (0 seconds)
- **Use Case**: Taps, clicks, impacts
- **Parameters**: Intensity, Sharpness

#### Continuous Events
- **Duration**: Variable (user-defined)
- **Use Case**: Sustained vibrations, rumbles
- **Parameters**: Intensity, Sharpness, Duration
- **Advanced**: Curve control for parameter modulation

### 4. Real-Time Audio Simulation

**Description**: Auditory representation of haptic feedback using Web Audio API.

**Technical Implementation**:
```typescript
class HapticAudioEngine {
  - AudioContext: Web Audio API context
  - OscillatorNode: Frequency generation
  - GainNode: Amplitude control
  - BiquadFilterNode: Frequency filtering
}
```

**Parameters Mapping**:
- **Intensity** → Gain (volume)
- **Sharpness** → Filter frequency (brightness)

**Key Functions**:
- `init()`: Initialize audio context
- `update(intensity, sharpness)`: Adjust parameters
- `stop()`: Halt audio playback

### 5. AHAP Export System

**Description**: Generate industry-standard AHAP files compatible with iOS CoreHaptics.

**Output Format**: JSON-based `.ahap` files

**Key Features**:
- Event merging and optimization
- Parameter curve generation
- Automatic validation
- Pretty-printed JSON output

---

## Application Workflow

### User Journey

```
1. Launch Application
   ↓
2. Upload Video (Optional)
   ↓
3. Add Haptic Events to Timeline
   ├─ Transient Events (clicks)
   └─ Continuous Events (sustained)
   ↓
4. Configure Event Parameters
   ├─ Intensity (0.0 - 1.0)
   └─ Sharpness (0.0 - 1.0)
   ↓
5. Preview with Audio Simulation
   ↓
6. Export to AHAP File
   ↓
7. Use in iOS Application
```

### Technical Workflow

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ React State      │
│ Update           │
└──────┬───────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌─────────────┐
│ UI Re-render │  │ Audio Engine│
│              │  │ Update      │
└──────────────┘  └─────────────┘
       │
       ▼
┌──────────────────┐
│ Export Action    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Tauri Command    │
│ (IPC Bridge)     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Rust Backend     │
│ AHAP Generation  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ File System      │
│ Write .ahap      │
└──────────────────┘
```

---

## Key Components

### 1. Main Application Component (`app/page.tsx`)

**Purpose**: Core application logic and state management

**State Variables**:

```typescript
const [isLoading, setIsLoading] = useState<boolean>(true)
const [isGenerating, setIsGenerating] = useState<boolean>(false)
const [videoSrc, setVideoSrc] = useState<string | null>(null)
const [isPlaying, setIsPlaying] = useState<boolean>(false)
const [currentTime, setCurrentTime] = useState<number>(0)
const [duration, setDuration] = useState<number>(10)
const [events, setEvents] = useState<EditorHapticEvent[]>([])
const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string>('')
```

**Key Methods**:

| Method | Purpose | Parameters |
|--------|---------|------------|
| `handleVideoUpload()` | Process video file upload | `event: ChangeEvent<HTMLInputElement>` |
| `handleExport()` | Export AHAP file | None |
| `togglePlayback()` | Control video playback | None |
| `handleSeek()` | Timeline seeking | `time: number` |
| `addEvent()` | Add haptic event | `type: string, time: number` |
| `updateEvent()` | Modify event properties | `id: string, updates: Partial<Event>` |
| `deleteEvent()` | Remove event | `id: string` |

### 2. Haptic Audio Engine (`utils/audioEngine.ts`)

**Purpose**: Simulate haptic feedback with audio

**Class Structure**:

```typescript
export class HapticAudioEngine {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private isInitialized: boolean = false

  public init(): void
  public update(intensity: number, sharpness: number): void
  public stop(): void
  public close(): void
}
```

**Audio Graph**:

```
OscillatorNode (440 Hz)
        ↓
BiquadFilterNode (lowpass)
        ↓
   GainNode (volume)
        ↓
  AudioDestination
```

### 3. Generation Loader (`components/GenerationLoader.tsx`)

**Purpose**: Display loading animation during AHAP generation

**Features**:
- Full-screen overlay
- Animated spinner
- Dynamic status message
- Backdrop blur effect

---

## AHAP Format Implementation

### AHAP Specification Compliance

Haptic Studio Pro generates AHAP files that strictly comply with Apple's CoreHaptics specification.

### Data Structures

#### Rust Backend Structures

```rust
// Top-level AHAP pattern
pub struct AHAPPattern {
    pub Version: f64,                          // Always 1.0
    pub Metadata: Option<AHAPMetadata>,        // Optional metadata
    pub Pattern: Vec<AHAPPatternItem>,         // Array of events/curves
}

// Pattern items (events or curves)
pub enum AHAPPatternItem {
    Event { Event: AHAPEvent },
    ParameterCurve { ParameterCurve: AHAPParameterCurve },
}

// Haptic event
pub struct AHAPEvent {
    pub EventType: String,                     // "HapticTransient" or "HapticContinuous"
    pub Time: f64,                            // Timestamp in seconds
    pub EventDuration: Option<f64>,           // Duration (0 for transients)
    pub EventParameters: Option<Vec<AHAPEventParameter>>,
    pub Name: Option<String>,                 // Optional label
}

// Event parameter
pub struct AHAPEventParameter {
    pub ParameterID: String,                  // "HapticIntensity" or "HapticSharpness"
    pub ParameterValue: f64,                  // 0.0 - 1.0
}

// Parameter curve for dynamic modulation
pub struct AHAPParameterCurve {
    pub ParameterID: String,                  // "HapticIntensityControl" or "HapticSharpnessControl"
    pub Time: f64,                           // Start time
    pub ParameterCurveControlPoints: Vec<AHAPControlPoint>,
}

// Control point for curves
pub struct AHAPControlPoint {
    pub Time: f64,                           // Relative time
    pub ParameterValue: f64,                 // 0.0 - 1.0
}
```

### Generation Algorithm

```rust
pub async fn generate_ahap(
    events: Vec<EditorHapticEvent>,
    filepath: String
) -> Result<(), String> {
    // 1. Validate input
    // 2. Separate transients and continuous events
    // 3. Merge continuous events into global parameter curves
    // 4. Construct AHAP pattern
    // 5. Serialize to JSON
    // 6. Validate JSON structure
    // 7. Write to file
}
```

**Processing Steps**:

1. **Event Separation**: Divide events into transients and continuous
2. **Curve Merging**: Combine continuous events into global intensity/sharpness curves
3. **Sorting**: Order control points by time
4. **Pattern Assembly**: Construct final AHAP structure
5. **Validation**: Verify JSON validity
6. **File Output**: Write formatted AHAP file

### Example AHAP Output

```json
{
  "Version": 1.0,
  "Pattern": [
    {
      "Event": {
        "EventType": "HapticTransient",
        "Time": 0.5,
        "EventDuration": 0,
        "EventParameters": [
          {
            "ParameterID": "HapticIntensity",
            "ParameterValue": 0.8
          },
          {
            "ParameterID": "HapticSharpness",
            "ParameterValue": 0.5
          }
        ],
        "Name": null
      }
    },
    {
      "ParameterCurve": {
        "ParameterID": "HapticIntensityControl",
        "Time": 0.0,
        "ParameterCurveControlPoints": [
          {
            "Time": 0.0,
            "ParameterValue": 0.5
          },
          {
            "Time": 1.0,
            "ParameterValue": 1.0
          }
        ]
      }
    }
  ]
}
```

---

## File Structure

```
haptic-vibe/
├── app/                          # Next.js application
│   ├── favicon.ico
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main application page
│
├── components/                   # React components
│   └── GenerationLoader.tsx     # Loading animation
│
├── utils/                        # Utility modules
│   ├── audioEngine.ts           # Haptic audio simulation
│   └── storage.ts               # Local storage helpers
│
├── types.ts                      # TypeScript type definitions
│
├── src-tauri/                    # Tauri backend
│   ├── src/
│   │   └── main.rs              # Rust backend logic
│   ├── capabilities/
│   │   └── default.json         # Tauri permissions
│   ├── tauri.conf.json          # Tauri configuration
│   ├── Cargo.toml               # Rust dependencies
│   └── build.rs                 # Build script
│
├── public/                       # Static assets
│
├── .gitignore
├── package.json                  # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── next.config.js               # Next.js configuration
└── README.md                    # Project documentation
```

---

## Technical Implementation Details

### 1. Video Upload System

**File Handling**:
```typescript
const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  // Validate file type
  if (!file.type.startsWith('video/')) {
    alert('Please select a valid video file')
    return
  }
  
  // Create object URL
  const url = URL.createObjectURL(file)
  setVideoSrc(url)
  
  // Extract metadata when video loads
  videoRef.current.onloadedmetadata = () => {
    setDuration(videoRef.current.duration)
  }
}
```

### 2. Event State Management

**Event Data Structure**:
```typescript
interface EditorHapticEvent {
  id: string
  trackId: number
  type: 'Transient' | 'Continuous'
  startTime: number
  duration: number
  intensity: number
  sharpness: number
  intensityCurve: AHAPParameterCurveControlPoint[]
  sharpnessCurve: AHAPParameterCurveControlPoint[]
}
```

### 3. Tauri IPC Communication

**Frontend (TypeScript)**:
```typescript
import { invoke } from '@tauri-apps/api/core'

const handleExport = async () => {
  try {
    const filePath = await save({
      filters: [{
        name: 'AHAP',
        extensions: ['ahap']
      }]
    })
    
    await invoke('generate_ahap', {
      events: events,
      filepath: filePath
    })
  } catch (error) {
    console.error('Export failed:', error)
  }
}
```

**Backend (Rust)**:
```rust
#[tauri::command]
pub async fn generate_ahap(
    events: Vec<EditorHapticEvent>,
    filepath: String
) -> Result<(), String> {
    // Implementation
}
```

### 4. Error Handling

**Frontend Validation**:
- Empty events check before export
- File type validation on upload
- Audio context availability check

**Backend Validation**:
- Empty events array check
- File path validation
- JSON structure verification
- File write error handling

### 5. Performance Optimizations

**React Optimizations**:
- `useCallback` for event handlers
- `useMemo` for computed values
- Debounced parameter updates
- Virtual scrolling for large event lists

**Audio Engine**:
- Single AudioContext instance
- Node reuse
- Lazy initialization
- Cleanup on unmount

---

## API Reference

### Tauri Commands

#### `generate_ahap`

Generate and save an AHAP file from haptic events.

**Signature**:
```rust
pub async fn generate_ahap(
    events: Vec<EditorHapticEvent>,
    filepath: String
) -> Result<(), String>
```

**Parameters**:
- `events`: Array of haptic events to export
- `filepath`: Absolute path for output file

**Returns**:
- `Ok(())`: Success
- `Err(String)`: Error message

**Example**:
```typescript
await invoke('generate_ahap', {
  events: [
    {
      id: '1',
      trackId: 0,
      type: 'Transient',
      startTime: 0.5,
      duration: 0,
      intensity: 0.8,
      sharpness: 0.5,
      intensityCurve: [],
      sharpnessCurve: []
    }
  ],
  filepath: '/path/to/output.ahap'
})
```

---

## Development Guide

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Cargo
- Tauri CLI

### Installation

```bash
# Clone repository
git clone <repository-url>
cd haptic-vibe

# Install Node dependencies
yarn install

# Install Tauri CLI
cargo install tauri-cli
```

### Development

```bash
# Start development server
yarn tauri dev
```

### Build

```bash
# Build production application
yarn tauri build
```

### Project Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

### Compilation Process

```
1. Next.js compiles frontend
   ↓
2. Rust compiles backend
   ↓
3. Tauri bundles application
   ↓
4. Platform-specific installers created
```

---

## Security & Permissions

### Tauri Capabilities

Defined in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "dialog:allow-save",
    "dialog:allow-message",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-create",
    "fs:allow-remove"
  ]
}
```

### Security Features

- Sandboxed file system access
- User-approved dialog operations
- No arbitrary code execution
- Content Security Policy enforced

---

## Future Enhancements

### Planned Features

1. **Advanced Curve Editor**: Bezier curve control for parameter modulation
2. **Event Library**: Preset haptic patterns
3. **Undo/Redo**: Full history management
4. **Multi-language Support**: Internationalization
5. **Cloud Sync**: Project cloud storage
6. **Collaboration**: Real-time multi-user editing
7. **AHAP Import**: Load and edit existing files
8. **Audio Synchronization**: Align haptics with audio tracks
9. **Device Preview**: Test on physical iOS devices
10. **Batch Export**: Generate multiple variations

### Technical Improvements

- WebAssembly for performance-critical operations
- Offline-first architecture with IndexedDB
- Automated testing suite (Jest, Playwright)
- CI/CD pipeline with GitHub Actions
- Performance monitoring and analytics

---

## Troubleshooting

### Common Issues

**Issue**: "dialog.save not allowed"  
**Solution**: Ensure `src-tauri/capabilities/default.json` includes dialog permissions

**Issue**: Audio not playing  
**Solution**: User interaction required before AudioContext initialization

**Issue**: JSON format error in AHAP  
**Solution**: Verify EventDuration is 0 for transients, not null

**Issue**: Video not loading  
**Solution**: Check file format support in browser

---

## License

[Your License Here]

## Contributors

[Your Team/Contributors]

## Contact

[Contact Information]

---

**Last Updated**: 2025-11-24
**Version**: 1.0.0
