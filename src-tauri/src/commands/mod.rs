pub mod ffmpeg;
pub mod filesystem;
pub mod recording;
pub mod openai;
pub mod text_to_video;
pub mod video_upscaler;
pub mod character_extractor;
pub mod ai_styler;
pub mod binary_utils;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub file_size: u64,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoClip {
    pub id: String,
    pub file_path: String,
    pub metadata: VideoMetadata,
    pub start_time: f64,
    pub end_time: f64,
    pub trim_in: f64,
    pub trim_out: f64,
}

// This function is no longer needed in Tauri 2.0
