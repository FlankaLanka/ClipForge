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

    // Sort clips by timeline position
    let mut sorted_clips = params.clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    println!("Exporting {} clips:", sorted_clips.len());
    for (i, clip) in sorted_clips.iter().enumerate() {
        println!("  Clip {}: {} ({}s - {}s, trim: {}s - {}s)", 
            i, clip.file_path, clip.start_time, clip.end_time, clip.trim_in, clip.trim_out);
    }

    println!("Exporting timeline with {} clips", sorted_clips.len());

    // Build FFmpeg command for timeline export
    let mut args = vec!["-y".to_string()]; // Overwrite output file

    // Add input files
    for clip in &sorted_clips {
        args.push("-i".to_string());
        args.push(clip.file_path.clone());
    }

    // Build complex filter for timeline composition with gaps and audio
    let mut filter_parts = Vec::new();

    // Get target resolution
    let (width, height) = match params.resolution.as_str() {
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        _ => (1920, 1080), // Default to 1080p
    };

    // Create black screen generator for gaps
    let max_duration = sorted_clips.iter().map(|c| c.end_time).fold(0.0, f64::max) + 1.0;
    let black_video = format!(
        "color=c=black:size={}x{}:duration={}:rate=30,setsar=1[black_v]",
        width, height, max_duration
    );
    filter_parts.push(black_video);
    
    let black_audio = format!(
        "anullsrc=channel_layout=stereo:sample_rate=48000[black_a]"
    );
    filter_parts.push(black_audio);

    // Process each clip and create timeline segments
    let mut timeline_segments = Vec::new();
    let mut current_time = 0.0;
    let mut segment_count = 0;

    for (i, clip) in sorted_clips.iter().enumerate() {
        let trim_start = clip.trim_in;
        let trim_duration = clip.trim_out - clip.trim_in;
        
        // Add black screen if there's a gap
        if clip.start_time > current_time {
            let gap_duration = clip.start_time - current_time;
            let gap_video = format!(
                "[black_v]trim=start=0:duration={},setsar=1[gap_v{}]",
                gap_duration, segment_count
            );
            let gap_audio = format!(
                "[black_a]atrim=start=0:duration={}[gap_a{}]",
                gap_duration, segment_count
            );
            filter_parts.push(gap_video);
            filter_parts.push(gap_audio);
            timeline_segments.push(format!("[gap_v{}][gap_a{}]", segment_count, segment_count));
            segment_count += 1;
        }
        
        // Trim and scale video with proper aspect ratio handling
        let video_filter = format!(
            "[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS,scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v{}_trimmed]",
            i, trim_start, trim_duration, width, height, width, height, i
        );
        filter_parts.push(video_filter);
        
        // Trim audio if it exists
        let audio_filter = format!(
            "[{}:a]atrim=start={}:duration={},asetpts=PTS-STARTPTS[a{}_trimmed]",
            i, trim_start, trim_duration, i
        );
        filter_parts.push(audio_filter);
        
        // Add the actual clip to timeline
        timeline_segments.push(format!("[v{}_trimmed][a{}_trimmed]", i, i));
        
        current_time = clip.end_time;
    }

    // Concatenate all segments
    let concat_inputs = timeline_segments.join("");
    let concat_filter = format!(
        "{}concat=n={}:v=1:a=1[outv][outa]",
        concat_inputs, timeline_segments.len()
    );
    filter_parts.push(concat_filter);

    let filter_complex = filter_parts.join(";");
    println!("FFmpeg filter complex: {}", filter_complex);
    args.push("-filter_complex".to_string());
    args.push(filter_complex);
    
    // Map video and audio outputs
    args.push("-map".to_string());
    args.push("[outv]".to_string());
    args.push("-map".to_string());
    args.push("[outa]".to_string());

    // Output settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-preset".to_string());
    args.push("medium".to_string());
    args.push("-crf".to_string());
    args.push("23".to_string());
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("128k".to_string());
    args.push("-movflags".to_string());
    args.push("+faststart".to_string());
    
    // Calculate the total timeline duration (end of last clip)
    let max_end_time = sorted_clips.iter()
        .map(|clip| clip.end_time)
        .fold(0.0, f64::max);
    
    // Add padding to ensure we capture the last frame
    let total_duration = max_end_time + 0.1; // Add 100ms padding
    args.push("-t".to_string());
    args.push(total_duration.to_string());
    
    args.push(params.output_path.clone());

    println!("FFmpeg command: ffmpeg {}", args.join(" "));

    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        println!("FFmpeg error: {}", error_msg);
        return Err(format!("ffmpeg failed: {}", error_msg));
    }

    println!("Export completed successfully: {}", params.output_path);
    Ok(params.output_path)
}
