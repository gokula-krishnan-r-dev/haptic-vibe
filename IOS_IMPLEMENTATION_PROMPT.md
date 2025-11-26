# Prompt for AI: Generate iOS Haptic Preview App

**Context:**
I have a desktop Haptic Editor application (Rust/Tauri) that broadcasts haptic patterns (AHAP JSON format) via a local WebSocket server on port 8080. I need a companion iOS application to receive these patterns and play them in real-time using CoreHaptics.

**Task:**
Create a complete, single-file (or minimal multi-file) SwiftUI application for iOS that acts as a client for this system.

**Requirements:**

1.  **UI (SwiftUI)**:
    *   A text field to enter the Desktop's IP address (default to `192.168.1.X`).
    *   A "Connect" button.
    *   A status indicator showing "Connected" (Green) or "Disconnected" (Red).
    *   A log view or status text showing the last received message time or size.

2.  **Networking (WebSocket)**:
    *   Use `URLSession`'s native WebSocket support (`URLSessionWebSocketTask`).
    *   Connect to `ws://<IP>:8080/ws`.
    *   Automatically reconnect if disconnected (optional but nice).
    *   Listen for incoming messages. The messages will be JSON strings representing an Apple Haptic Audio Pattern (AHAP).

3.  **Haptics (CoreHaptics)**:
    *   Initialize `CHHapticEngine`.
    *   Handle engine stops/restarts (backgrounding).
    *   When a WebSocket message is received:
        *   Parse the message as a String.
        *   Save it to a temporary file (e.g., `temp.ahap`).
        *   Play the pattern using `engine.playPattern(from: URL)`.

4.  **Code Structure**:
    *   Provide a `WebSocketManager` class (ObservableObject).
    *   Provide a `HapticManager` class.
    *   Provide the `ContentView` struct.

**Specific Constraints:**
*   Target iOS 15+.
*   Handle errors gracefully (print to console).
*   Ensure the haptic engine is started before trying to play.

**Output Format:**
Please provide the full Swift code, ready to be pasted into Xcode.
