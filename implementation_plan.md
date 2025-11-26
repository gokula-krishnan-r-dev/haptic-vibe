# Enhancement Plan: Device Info & Remote Disconnect

## Goal
Display detailed device information (Name, Model) in the "Connected Devices" list and allow users to disconnect specific devices from the desktop.

## 1. Backend Changes (Rust)

### `src-tauri/src/server.rs`
*   **Structs**:
    *   Define `ClientMetadata` struct: `{ id: String, name: String, model: String, ip: String }`.
    *   Define `ClientSession` struct: `{ sender: ClientSender, metadata: ClientMetadata }`.
*   **State**:
    *   Update `Clients` type alias to `Arc<Mutex<HashMap<String, ClientSession>>>`.
*   **Logic**:
    *   Update `handle_connection`:
        *   Initialize session with "Unknown Device".
        *   Listen for `{"type": "HANDSHAKE", "name": "...", "model": "..."}` message.
        *   Update session metadata upon handshake.
    *   Update `get_connected_clients`: Return `Vec<ClientMetadata>`.
    *   Implement `disconnect_client(id: String)`: Remove from map and close connection (dropping sender should close channel, need to ensure WS task exits).

### `src-tauri/src/main.rs`
*   Update `get_connected_clients` command signature.
*   Add `disconnect_client` command.

## 2. Frontend Changes (React)

### `src/types.ts` (or local interface)
*   Define `ConnectedClient` interface matching `ClientMetadata`.

### `components/RealTimePreview.tsx`
*   Update `clients` state type to `ConnectedClient[]`.
*   Update Popover UI:
    *   Show Name and Model (e.g., "iPhone 15 Pro").
    *   Add "Disconnect" button (X icon) for each row.
    *   Call `disconnect_client` command on click.

## 3. iOS Implementation Guide

### `IOS_DEVICE_INFO_PROMPT.md`
*   Create a prompt explaining:
    *   How to get `UIDevice.current.name` and `model`.
    *   Constructing the `HANDSHAKE` JSON.
    *   Sending it immediately after WebSocket connection opens.

## Verification Plan

### Manual Verification
1.  **Run Desktop App**: `yarn tauri dev`.
2.  **Connect Simulated Client**:
    *   Use a WebSocket test tool (e.g., Postman, websocat).
    *   Connect to `ws://localhost:8080/ws`.
    *   Send: `{"type": "HANDSHAKE", "name": "Test Device", "model": "Simulator"}`.
3.  **Check UI**:
    *   Verify "Test Device (Simulator)" appears in the popover.
4.  **Disconnect**:
    *   Click "Disconnect" button in UI.
    *   Verify WebSocket connection closes in test tool.
