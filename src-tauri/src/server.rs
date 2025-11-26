use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use warp::Filter;
use tokio::sync::mpsc;
use futures_util::{StreamExt, SinkExt};
use once_cell::sync::Lazy;

// Global store for connected clients
// Map: SessionID -> Sender
type ClientSender = mpsc::UnboundedSender<warp::ws::Message>;
pub type Clients = Arc<Mutex<HashMap<String, ClientSender>>>;

pub static CLIENTS: Lazy<Clients> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

// Global store for current video path
pub static CURRENT_VIDEO_PATH: Lazy<Arc<Mutex<Option<String>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn set_video_path(path: Option<String>) {
    println!("DEBUG: set_video_path called with: {:?}", path);
    let mut p = CURRENT_VIDEO_PATH.lock().unwrap();
    *p = path.clone();
    
    // Notify all connected clients
    if let Some(_) = p.as_ref() {
        let ip = local_ip_address::local_ip().unwrap();
        let msg = serde_json::json!({
             "type": "VIDEO_AVAILABLE",
             "url": format!("http://{}:8080/video", ip)
         });
        println!("DEBUG: Broadcasting VIDEO_AVAILABLE: {}", msg);
        broadcast_message(msg.to_string());
    }
}

pub fn get_connected_clients() -> Vec<String> {
    let clients = CLIENTS.lock().unwrap();
    clients.keys().cloned().collect()
}

pub async fn start_server() {
    let clients = CLIENTS.clone();
    let clients_filter = warp::any().map(move || clients.clone());

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(clients_filter)
        .map(|ws: warp::ws::Ws, clients| {
            ws.on_upgrade(move |socket| handle_connection(socket, clients))
        });

    // Video route: /video
    // Serves the file at CURRENT_VIDEO_PATH if set
    // Video route: /video
    // Serves the file at CURRENT_VIDEO_PATH with Range support
    let video_route = warp::path("video")
        .and(warp::get())
        .and(warp::header::optional::<String>("Range"))
        .and_then(handle_video_request);

    let routes = ws_route.or(video_route);

    println!("WebSocket & Media server starting on 0.0.0.0:8080...");
    warp::serve(routes).run(([0, 0, 0, 0], 8080)).await;
}

async fn handle_video_request(range_header: Option<String>) -> Result<impl warp::Reply, warp::Rejection> {
    use std::io::SeekFrom;
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let path_opt = CURRENT_VIDEO_PATH.lock().unwrap().clone();
    let path = match path_opt {
        Some(p) => p,
        None => {
            println!("DEBUG: No video path set");
            return Err(warp::reject::not_found());
        }
    };

    let mut file = match tokio::fs::File::open(&path).await {
        Ok(f) => f,
        Err(e) => {
            println!("DEBUG: Failed to open video file: {}", e);
            return Err(warp::reject::not_found());
        }
    };

    let metadata = match file.metadata().await {
        Ok(m) => m,
        Err(e) => {
            println!("DEBUG: Failed to get metadata: {}", e);
            return Err(warp::reject::not_found());
        }
    };
    let file_size = metadata.len();

    let mut start = 0;
    let mut end = file_size - 1;
    
    // Parse Range Header
    if let Some(range) = range_header {
        if range.starts_with("bytes=") {
            let ranges: Vec<&str> = range["bytes=".len()..].split('-').collect();
            if ranges.len() >= 1 {
                if let Ok(s) = ranges[0].parse::<u64>() {
                    start = s;
                }
                if ranges.len() > 1 && !ranges[1].is_empty() {
                    if let Ok(e) = ranges[1].parse::<u64>() {
                        end = e;
                    }
                }
            }
        }
    }

    // Sanity checks
    if start >= file_size {
         return Ok(warp::http::Response::builder()
            .status(warp::http::StatusCode::RANGE_NOT_SATISFIABLE)
            .header("Content-Range", format!("bytes */{}", file_size))
            .body(vec![])
            .unwrap());
    }
    
    if end >= file_size {
        end = file_size - 1;
    }

    // Limit chunk size to avoid memory issues (e.g. 5MB)
    // iOS AVPlayer typically requests small chunks (e.g. 2 bytes, then larger)
    const MAX_CHUNK_SIZE: u64 = 5 * 1024 * 1024; 
    if end - start + 1 > MAX_CHUNK_SIZE {
        end = start + MAX_CHUNK_SIZE - 1;
    }

    let length = end - start + 1;
    let mut buffer = vec![0u8; length as usize];

    if let Err(e) = file.seek(SeekFrom::Start(start)).await {
         println!("DEBUG: Seek failed: {}", e);
         return Err(warp::reject::not_found());
    }
    
    if let Err(e) = file.read_exact(&mut buffer).await {
         println!("DEBUG: Read failed: {}", e);
         return Err(warp::reject::not_found());
    }

    let mime = if path.ends_with(".mp4") { 
        "video/mp4" 
    } else if path.ends_with(".mov") {
        "video/quicktime"
    } else if path.ends_with(".mkv") {
        "video/x-matroska"
    } else { 
        "application/octet-stream" 
    };
    
    let response = warp::http::Response::builder()
        .status(warp::http::StatusCode::PARTIAL_CONTENT)
        .header("Content-Type", mime)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", length.to_string()) // Ensure string
        .header("Content-Range", format!("bytes {}-{}/{}", start, end, file_size))
        .body(buffer)
        .unwrap();

    Ok(response)
}

async fn handle_connection(ws: warp::ws::WebSocket, clients: Clients) {
    let (mut client_ws_sender, mut client_ws_rcv) = ws.split();
    let (client_sender, mut client_rcv) = mpsc::unbounded_channel();

    let client_id = uuid::Uuid::new_v4().to_string();
    println!("Client connected: {}", client_id);

    // Store sender
    clients.lock().unwrap().insert(client_id.clone(), client_sender);

    // Send current video status to new client
    // Fix: Check state and drop lock BEFORE await
    let path_opt = CURRENT_VIDEO_PATH.lock().unwrap().clone();
    println!("DEBUG: Client connected. Current video path: {:?}", path_opt);
    
    if let Some(_) = path_opt {
         // Notify client that a video is available
         let ip = local_ip_address::local_ip().unwrap();
         let msg = serde_json::json!({
             "type": "VIDEO_AVAILABLE",
             "url": format!("http://{}:8080/video", ip)
         });
         let _ = client_ws_sender.send(warp::ws::Message::text(msg.to_string())).await;
    }

    println!("Client connected: {}", client_id);

    // Background task to push messages from channel to WebSocket
    tokio::task::spawn(async move {
        while let Some(message) = client_rcv.recv().await {
            if let Err(e) = client_ws_sender.send(message).await {
                println!("Error sending websocket msg: {}", e);
                break;
            }
        }
    });

    // Keep connection open and handle incoming (ping/close)
    while let Some(result) = client_ws_rcv.next().await {
        match result {
            Ok(msg) => {
                if msg.is_close() {
                    break;
                }
            }
            Err(e) => {
                println!("Websocket error: {}", e);
                break;
            }
        }
    }

    println!("Client disconnected: {}", client_id);
    clients.lock().unwrap().remove(&client_id);
}

pub fn broadcast_message(msg: String) {
    let clients = CLIENTS.lock().unwrap();
    for (_, sender) in clients.iter() {
        let _ = sender.send(warp::ws::Message::text(msg.clone()));
    }
}
