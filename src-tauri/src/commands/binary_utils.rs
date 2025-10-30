use tauri::{AppHandle, Manager};
use std::path::PathBuf;

/// Get the path to a bundled binary, falling back to system binary in development
pub fn get_binary_path(app: &AppHandle, binary_name: &str) -> Result<PathBuf, String> {
    // Try to get the bundled binary first (production)
    if let Ok(resource_path) = app.path().resource_dir() {
        // Binaries are in the "binaries" subdirectory
        let binary_path = resource_path.join("binaries").join(binary_name);
        if binary_path.exists() {
            println!("Found bundled binary at: {:?}", binary_path);
            return Ok(binary_path);
        }
        
        // Also try directly in resource dir (fallback)
        let binary_path_direct = resource_path.join(binary_name);
        if binary_path_direct.exists() {
            println!("Found bundled binary at: {:?}", binary_path_direct);
            return Ok(binary_path_direct);
        }
        
        println!("Binary not found in bundle, looking for: {:?}", binary_path);
    }
    
    // Fall back to system binary (for development)
    println!("Using system binary: {}", binary_name);
    Ok(PathBuf::from(binary_name))
}

/// Get the path to ffmpeg binary
pub fn get_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_binary_path(app, "ffmpeg")
}

/// Get the path to ffprobe binary
pub fn get_ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_binary_path(app, "ffprobe")
}

