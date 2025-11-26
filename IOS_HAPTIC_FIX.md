# Fixing Continuous Haptics in iOS Core Haptics

## The Issue
You are experiencing an issue where the **continuous haptic types** (controlled by curves) are not working in your iOS SwiftUI preview, although transient events might be firing.

**Diagnosis:**
The AHAP (Apple Haptic and Audio Pattern) JSON you provided contains `ParameterCurve` definitions for `HapticIntensityControl` and `HapticSharpnessControl`, but it is **missing the actual `HapticContinuous` event** that these curves are supposed to modulate.

In Core Haptics, `ParameterCurve`s do not generate haptic output on their own. They only modify the parameters (like volume/intensity) of an **active** haptic event. If there is no continuous event playing, the curves have nothing to affect, and you will feel nothing.

## The Fix
To fix this, you must add a `HapticContinuous` event to the `Pattern` array in your AHAP file. This event should:
1.  Start at the same time as your curves (usually `0.0`).
2.  Have a `EventDuration` long enough to cover the entire duration of your curves (e.g., `13.1` seconds or longer based on your data).

### Corrected JSON Structure

Here is the corrected version of your AHAP JSON with the required `HapticContinuous` event added:

```json
{
  "Version": 1.0,
  "Pattern": [
    {
      "Event": {
        "EventType": "HapticContinuous",
        "Time": 0.0,
        "EventDuration": 14.0,
        "EventParameters": [
          {
            "ParameterID": "HapticIntensity",
            "ParameterValue": 1.0
          },
          {
            "ParameterID": "HapticSharpness",
            "ParameterValue": 0.5
          }
        ]
      }
    },
    {
      "ParameterCurve": {
        "ParameterID": "HapticIntensityControl",
        "Time": 0.0,
        "ParameterCurveControlPoints": [
          { "Time": 5.98, "ParameterValue": 1.0 },
          { "Time": 6.98, "ParameterValue": 1.0 },
          { "Time": 7.87, "ParameterValue": 0.0 },
          { "Time": 8.87, "ParameterValue": 1.0 },
          { "Time": 9.3, "ParameterValue": 0.0 },
          { "Time": 9.36, "ParameterValue": 1.0 },
          { "Time": 9.46, "ParameterValue": 0.0 },
          { "Time": 9.56, "ParameterValue": 0.0 },
          { "Time": 9.59, "ParameterValue": 0.75 },
          { "Time": 9.66, "ParameterValue": 0.0 },
          { "Time": 10.1, "ParameterValue": 0.0 },
          { "Time": 10.16, "ParameterValue": 1.0 },
          { "Time": 10.26, "ParameterValue": 0.0 },
          { "Time": 10.36, "ParameterValue": 0.0 },
          { "Time": 10.39, "ParameterValue": 0.75 },
          { "Time": 10.46, "ParameterValue": 0.0 },
          { "Time": 10.9, "ParameterValue": 0.0 },
          { "Time": 11.1, "ParameterValue": 0.8 },
          { "Time": 13.1, "ParameterValue": 0.8 }
        ]
      }
    },
    {
      "ParameterCurve": {
        "ParameterID": "HapticSharpnessControl",
        "Time": 0.0,
        "ParameterCurveControlPoints": [
          { "Time": 5.98, "ParameterValue": 0.5 },
          { "Time": 6.98, "ParameterValue": 0.5 },
          { "Time": 7.87, "ParameterValue": 0.5 },
          { "Time": 8.87, "ParameterValue": 0.5 },
          { "Time": 9.3, "ParameterValue": 0.3 },
          { "Time": 9.46, "ParameterValue": 0.3 },
          { "Time": 9.56, "ParameterValue": 0.8 },
          { "Time": 9.66, "ParameterValue": 0.8 },
          { "Time": 9.67, "ParameterValue": 0.0 },
          { "Time": 10.09, "ParameterValue": 0.0 },
          { "Time": 10.1, "ParameterValue": 0.3 },
          { "Time": 10.26, "ParameterValue": 0.3 },
          { "Time": 10.36, "ParameterValue": 0.8 },
          { "Time": 10.46, "ParameterValue": 0.8 },
          { "Time": 10.47, "ParameterValue": 0.0 },
          { "Time": 10.9, "ParameterValue": 0.0 },
          { "Time": 11.1, "ParameterValue": 0.1 },
          { "Time": 13.1, "ParameterValue": 0.1 }
        ]
      }
    },
    {
      "Event": {
        "EventType": "HapticTransient",
        "Time": 0.2,
        "EventDuration": 0.0,
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 1.0 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.5 }
        ]
      }
    },
    {
      "Event": {
        "EventType": "HapticTransient",
        "Time": 1.23,
        "EventDuration": 0.0,
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 1.0 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.5 }
        ]
      }
    },
    {
      "Event": {
        "EventType": "HapticTransient",
        "Time": 3.75,
        "EventDuration": 0.0,
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 1.0 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.5 }
        ]
      }
    },
    {
      "Event": {
        "EventType": "HapticTransient",
        "Time": 4.77,
        "EventDuration": 0.0,
        "EventParameters": [
          { "ParameterID": "HapticIntensity", "ParameterValue": 1.0 },
          { "ParameterID": "HapticSharpness", "ParameterValue": 0.5 }
        ]
      }
    }
  ]
}
```

## Implementation in SwiftUI

Ensure your iOS app is correctly playing the pattern. Here is a minimal robust implementation:

```swift
import CoreHaptics
import SwiftUI

class HapticManager: ObservableObject {
    private var engine: CHHapticEngine?

    init() {
        prepareHaptics()
    }

    func prepareHaptics() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            engine = try CHHapticEngine()
            try engine?.start()
            
            // Handle engine reset (e.g., backgrounding)
            engine?.resetHandler = { [weak self] in
                try? self?.engine?.start()
            }
        } catch {
            print("Haptic Engine Error: \(error.localizedDescription)")
        }
    }

    func playAHAP(filename: String) {
        guard let path = Bundle.main.path(forResource: filename, ofType: "ahap") else {
            print("AHAP file not found")
            return
        }
        
        playAHAP(from: URL(fileURLWithPath: path))
    }
    
    func playAHAP(from url: URL) {
        guard let engine = engine else { return }
        
        do {
            try engine.start()
            let pattern = try CHHapticPattern(contentsOf: url)
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            print("Failed to play pattern: \(error.localizedDescription)")
        }
    }
}
```
