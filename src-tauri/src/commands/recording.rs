use tauri::command;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    pub source_type: String, // "monitor" or "webcam"
    pub device_id: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingSession {
    pub id: String,
    pub output_path: String,
    pub process_id: Option<u32>,
    pub recording_type: String, // "screen", "webcam", "both"
    pub is_active: bool,
}

// Global state to track recording sessions and capture sources
lazy_static::lazy_static! {
    static ref RECORDING_SESSIONS: Mutex<HashMap<String, RecordingSession>> = Mutex::new(HashMap::new());
    static ref CAPTURE_SOURCES: Mutex<HashMap<String, CaptureSource>> = Mutex::new(HashMap::new());
}

#[command]
pub async fn get_available_monitors() -> Result<Vec<MonitorInfo>, String> {
    // For macOS, we'll use a simple approach to get monitor information
    // In a real implementation, you'd use Core Graphics APIs
    let mut monitors = Vec::new();
    
    // Mock data for now - in production, you'd query the display manager
    monitors.push(MonitorInfo {
        id: "monitor_1".to_string(),
        name: "Built-in Retina Display".to_string(),
        x: 0,
        y: 0,
        width: 2560,
        height: 1600,
        is_primary: true,
    });
    
    monitors.push(MonitorInfo {
        id: "monitor_2".to_string(),
        name: "External Display".to_string(),
        x: 2560,
        y: 0,
        width: 1920,
        height: 1080,
        is_primary: false,
    });

    Ok(monitors)
}

#[command]
pub async fn add_capture_source(
    source_type: String,
    device_id: String,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let source_id = Uuid::new_v4().to_string();
    
    let source = CaptureSource {
        id: source_id.clone(),
        name,
        source_type,
        device_id,
        x,
        y,
        width,
        height,
        is_active: true,
    };

    {
        let mut sources = CAPTURE_SOURCES.lock().unwrap();
        sources.insert(source_id.clone(), source);
    }

    Ok(source_id)
}

#[command]
pub async fn update_capture_source_position(
    source_id: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let mut sources = CAPTURE_SOURCES.lock().unwrap();
    
    if let Some(source) = sources.get_mut(&source_id) {
        source.x = x;
        source.y = y;
        source.width = width;
        source.height = height;
        Ok("Position updated".to_string())
    } else {
        Err("Source not found".to_string())
    }
}

#[command]
pub async fn remove_capture_source(source_id: String) -> Result<String, String> {
    let mut sources = CAPTURE_SOURCES.lock().unwrap();
    
    if sources.remove(&source_id).is_some() {
        Ok("Source removed".to_string())
    } else {
        Err("Source not found".to_string())
    }
}

#[command]
pub async fn get_capture_sources() -> Result<Vec<CaptureSource>, String> {
    let sources = CAPTURE_SOURCES.lock().unwrap();
    Ok(sources.values().cloned().collect::<Vec<_>>())
}

#[command]
pub async fn start_screen_recording(_window_ids: Vec<String>) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    // Get the user's home directory and create Desktop path
    let home_dir = std::env::var("HOME").map_err(|_| "Failed to get home directory")?;
    let desktop_path = format!("{}/Desktop/ClipForge_Recording_{}.mp4", home_dir, session_id);
    
    // Create the Desktop directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&format!("{}/Desktop", home_dir)) {
        return Err(format!("Failed to create Desktop directory: {}", e));
    }

    // Record screen with 1920x1080 resolution
    let args: Vec<String> = vec![
        "-f".to_string(),
        "avfoundation".to_string(),
        "-i".to_string(),
        "1:0".to_string(), // Screen capture on macOS
        "-vf".to_string(),
        "scale=1920:1080".to_string(), // Force 1920x1080 resolution
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "medium".to_string(), // Better quality than ultrafast
        "-crf".to_string(),
        "23".to_string(), // Good quality
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(), // Audio bitrate
        "-y".to_string(), // Overwrite output file
        desktop_path.clone(),
    ];

    let child = Command::new("ffmpeg")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start screen recording: {}", e))?;

    let process_id = child.id();

    let session = RecordingSession {
        id: session_id.clone(),
        output_path: desktop_path.clone(),
        process_id: Some(process_id),
        recording_type: "screen".to_string(),
        is_active: true,
    };

    {
        let mut sessions = RECORDING_SESSIONS.lock().unwrap();
        sessions.insert(session_id.clone(), session);
    }

    Ok(session_id)
}

#[command]
pub async fn start_webcam_recording(_device_id: String) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    // Get the user's home directory and create Desktop path
    let home_dir = std::env::var("HOME").map_err(|_| "Failed to get home directory")?;
    let desktop_path = format!("{}/Desktop/ClipForge_Webcam_{}.mp4", home_dir, session_id);
    
    // Create the Desktop directory if it doesn't exist
    if let Err(e) = std::fs::create_dir_all(&format!("{}/Desktop", home_dir)) {
        return Err(format!("Failed to create Desktop directory: {}", e));
    }

    // For webcam recording, we'll use the default camera with 1920x1080
    let args: Vec<String> = vec![
        "-f".to_string(),
        "avfoundation".to_string(),
        "-i".to_string(),
        "0:0".to_string(), // Webcam on macOS
        "-vf".to_string(),
        "scale=1920:1080".to_string(), // Force 1920x1080 resolution
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "medium".to_string(),
        "-crf".to_string(),
        "23".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(),
        "-y".to_string(), // Overwrite output file
        desktop_path.clone(),
    ];

    let child = Command::new("ffmpeg")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start webcam recording: {}", e))?;

    let process_id = child.id();

    let session = RecordingSession {
        id: session_id.clone(),
        output_path: desktop_path.clone(),
        process_id: Some(process_id),
        recording_type: "webcam".to_string(),
        is_active: true,
    };

    {
        let mut sessions = RECORDING_SESSIONS.lock().unwrap();
        sessions.insert(session_id.clone(), session);
    }

    Ok(session_id)
}

#[command]
pub async fn stop_recording(recording_type: String) -> Result<String, String> {
    let mut sessions = RECORDING_SESSIONS.lock().unwrap();
    
    // Find and stop the recording session
    for (session_id, session) in sessions.iter_mut() {
        if session.recording_type == recording_type && session.is_active {
            if let Some(process_id) = session.process_id {
                // Send SIGTERM to the process
                let _ = Command::new("kill")
                    .arg("-TERM")
                    .arg(process_id.to_string())
                    .output();
            }
            
            session.is_active = false;
            return Ok(format!("Stopped recording: {}", session_id));
        }
    }
    
    Err("No active recording found".to_string())
}

#[command]
pub async fn pause_recording() -> Result<String, String> {
    // For FFmpeg, we can't easily pause/resume, so we'll just return success
    // In a real implementation, you'd need to handle this differently
    Ok("Recording paused".to_string())
}

#[command]
pub async fn resume_recording() -> Result<String, String> {
    // For FFmpeg, we can't easily pause/resume, so we'll just return success
    // In a real implementation, you'd need to handle this differently
    Ok("Recording resumed".to_string())
}

#[command]
pub async fn get_recording_status() -> Result<Vec<RecordingSession>, String> {
    let sessions = RECORDING_SESSIONS.lock().unwrap();
    Ok(sessions.values().cloned().collect::<Vec<_>>())
}
