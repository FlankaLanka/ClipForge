use tauri::command;
use std::path::Path;
use uuid::Uuid;
use crate::commands::VideoClip;

#[command]
pub async fn import_video(file_path: String) -> Result<VideoClip, String> {
    if !Path::new(&file_path).exists() {
        return Err("File does not exist".to_string());
    }

    // Get video metadata using ffprobe
    let metadata = crate::commands::ffmpeg::get_video_metadata(file_path.clone()).await?;
    
    let clip = VideoClip {
        id: Uuid::new_v4().to_string(),
        file_path: file_path.clone(),
        metadata: metadata.clone(),
        start_time: 0.0,
        end_time: metadata.duration,
        trim_in: 0.0,
        trim_out: metadata.duration,
    };

    Ok(clip)
}

#[command]
pub async fn import_video_from_file(file_name: String, file_data: Vec<u8>) -> Result<VideoClip, String> {
    // Create a temporary file path
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(&file_name);
    
    // Write the file data to temporary location
    std::fs::write(&temp_path, file_data)
        .map_err(|e| format!("Failed to write temporary file: {}", e))?;
    
    // Import the video using the existing function
    let file_path = temp_path.to_string_lossy().to_string();
    import_video(file_path).await
}

#[command]
pub async fn get_video_url(file_path: String) -> Result<String, String> {
    // For now, we'll return a placeholder URL
    // In a real implementation, this would serve the file through Tauri's asset protocol
    Ok(format!("tauri://localhost/video/{}", file_path.replace("/", "_")))
}

#[command]
pub async fn save_video(file_path: String, data: Vec<u8>) -> Result<String, String> {
    std::fs::write(&file_path, data)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(file_path)
}

#[command]
pub async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    let data = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    println!("Read {} bytes from file: {}", data.len(), file_path);
    
    Ok(data)
}

