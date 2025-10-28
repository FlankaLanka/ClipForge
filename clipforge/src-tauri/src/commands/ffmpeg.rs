use tauri::command;
use serde::{Deserialize, Serialize};
use std::process::Command;
use anyhow::Result;
use crate::commands::{VideoMetadata, VideoClip};

#[derive(Debug, Serialize, Deserialize)]
pub struct TrimParams {
    pub input_path: String,
    pub output_path: String,
    pub start_time: f64,
    pub end_time: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportParams {
    pub clips: Vec<VideoClip>,
    pub output_path: String,
    pub resolution: String,
}

#[command]
pub async fn get_video_metadata(file_path: String) -> Result<VideoMetadata, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffprobe failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let json_output: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let format = json_output["format"].as_object()
        .ok_or("Missing format information")?;
    
    let video_stream = json_output["streams"]
        .as_array()
        .and_then(|streams| streams.iter().find(|s| s["codec_type"] == "video"))
        .ok_or("No video stream found")?;

    let duration = format["duration"]
        .as_str()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    let width = video_stream["width"]
        .as_u64()
        .unwrap_or(0) as u32;

    let height = video_stream["height"]
        .as_u64()
        .unwrap_or(0) as u32;

    let fps_str = video_stream["r_frame_rate"]
        .as_str()
        .unwrap_or("0/1");
    
    let fps = if let Some((num, den)) = fps_str.split_once('/') {
        num.parse::<f64>().unwrap_or(0.0) / den.parse::<f64>().unwrap_or(1.0)
    } else {
        0.0
    };

    let file_size = format["size"]
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let format_name = format["format_name"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    Ok(VideoMetadata {
        duration,
        width,
        height,
        fps,
        file_size,
        format: format_name,
    })
}

#[command]
pub async fn trim_video(params: TrimParams) -> Result<String, String> {
    let output = Command::new("ffmpeg")
        .args([
            "-i", &params.input_path,
            "-ss", &params.start_time.to_string(),
            "-t", &(params.end_time - params.start_time).to_string(),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            &params.output_path,
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(params.output_path)
}

#[command]
pub async fn convert_mov_to_mp4(input_path: String) -> Result<String, String> {
    let output_path = input_path.replace(".mov", "_converted.mp4");
    
    let output = Command::new("ffmpeg")
        .args([
            "-i", &input_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23",
            &output_path,
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffmpeg conversion failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(output_path)
}

#[command]
pub async fn export_timeline(params: ExportParams) -> Result<String, String> {
    if params.clips.is_empty() {
        return Err("No clips to export".to_string());
    }

    // Create a temporary concat file for FFmpeg
    let concat_file = format!("{}/concat.txt", std::env::temp_dir().to_string_lossy());
    let mut concat_content = String::new();
    
    for clip in &params.clips {
        concat_content.push_str(&format!("file '{}'\n", clip.file_path));
    }

    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;

    // Determine resolution parameters
    let resolution_args = match params.resolution.as_str() {
        "720p" => vec!["-vf", "scale=1280:720"],
        "1080p" => vec!["-vf", "scale=1920:1080"],
        _ => vec![],
    };

    let mut args = vec![
        "-f", "concat",
        "-safe", "0",
        "-i", &concat_file,
    ];
    args.extend(&resolution_args);
    args.extend(&[
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "medium",
        &params.output_path,
    ]);

    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // Clean up concat file
    let _ = std::fs::remove_file(&concat_file);

    Ok(params.output_path)
}
