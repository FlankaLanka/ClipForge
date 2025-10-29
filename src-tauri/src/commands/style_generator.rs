use tauri::command;
use std::path::Path;
use std::fs;
use tokio::process::Command;

/// Apply style to video using hybrid FFmpeg + AI approach
#[command]
pub async fn apply_style_to_video(
    input_path: String,
    style: String,
    is_ai: bool,
    output_path: String,
    quality: String,
    _add_to_timeline: bool,
) -> Result<String, String> {
    if !Path::new(&input_path).exists() {
        return Err("Input video file does not exist".to_string());
    }

    if is_ai && quality == "high" {
        // Use AI processing for complex styles
        apply_ai_style_to_video(input_path, style, output_path).await
    } else {
        // Use FFmpeg filters for fast processing
        apply_ffmpeg_style_to_video(input_path, style, output_path).await
    }
}

/// Apply style using FFmpeg filters (fast processing)
async fn apply_ffmpeg_style_to_video(
    input_path: String,
    style: String,
    output_path: String,
) -> Result<String, String> {
    let mut ffmpeg_cmd = Command::new("ffmpeg");
    ffmpeg_cmd
        .arg("-i")
        .arg(&input_path)
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(&output_path);

    // Apply style-specific filters
    let filter = match style.as_str() {
        "cartoon" => "colorchannelmixer=rr=0.393:gg=0.769:bb=0.189:aa=1.0,eq=contrast=1.5:brightness=0.1:saturation=1.2",
        "grayscale" => "colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3:0",
        "sepia" => "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0",
        "sketch" => "edgedetect=low=0.1:high=0.4",
        "edge" => "edgedetect=low=0.1:high=0.4",
        "vintage" => "curves=vintage,eq=contrast=1.1:brightness=-0.1:saturation=0.8",
        "dramatic" => "eq=contrast=1.5:brightness=-0.1:saturation=1.3,unsharp=5:5:0.8:3:3:0.4",
        "soft" => "eq=contrast=0.8:brightness=0.1:saturation=0.7,boxblur=2:1",
        _ => "eq=contrast=1.1:brightness=0.05:saturation=1.1", // Default enhancement
    };

    ffmpeg_cmd.arg("-vf").arg(filter);

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    Ok(format!("Video styled successfully: {}", output_path))
}

/// Apply style using AI processing (high quality)
async fn apply_ai_style_to_video(
    input_path: String,
    style: String,
    output_path: String,
) -> Result<String, String> {
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set")?;

    // Create temporary directory for frames
    let temp_dir = std::env::temp_dir().join("clipforge_style_generator");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Extract frames from video (every 2 seconds)
    let frames_dir = temp_dir.join("frames");
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;

    let mut extract_cmd = Command::new("ffmpeg");
    extract_cmd
        .arg("-i")
        .arg(&input_path)
        .arg("-vf")
        .arg("fps=1/2") // Extract every 2 seconds
        .arg("-q:v")
        .arg("2")
        .arg(frames_dir.join("frame_%04d.png").to_string_lossy().to_string())
        .arg("-y");

    let extract_output = extract_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;

    if !extract_output.status.success() {
        let error_msg = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("Failed to extract frames: {}", error_msg));
    }

    // Get list of extracted frames
    let frame_files: Vec<_> = fs::read_dir(&frames_dir)
        .map_err(|e| format!("Failed to read frames directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext == "png")
                .unwrap_or(false)
        })
        .map(|entry| entry.path())
        .collect();

    if frame_files.is_empty() {
        return Err("No frames extracted from video".to_string());
    }

    println!("Extracted {} frames for AI processing", frame_files.len());

    // Process each frame with AI
    let styled_frames_dir = temp_dir.join("styled_frames");
    fs::create_dir_all(&styled_frames_dir)
        .map_err(|e| format!("Failed to create styled frames directory: {}", e))?;

    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("Processing frame {}/{}", i + 1, frame_files.len());
        
        // Read frame image
        let frame_bytes = fs::read(frame_path)
            .map_err(|e| format!("Failed to read frame: {}", e))?;

        // Convert to base64 for OpenAI API
        let base64_frame = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &frame_bytes);

        // Apply style using OpenAI (simplified - in practice you'd use image editing API)
        let style_prompt = match style.as_str() {
            "toon-shade" => "Convert this image to a cartoon style with cel shading and bold outlines",
            "oil-painting" => "Transform this image into an oil painting with thick brushstrokes and rich colors",
            "watercolor" => "Convert this image to a watercolor painting with soft, flowing colors",
            "cyberpunk" => "Transform this image into a cyberpunk style with neon colors and futuristic elements",
            "retro" => "Convert this image to a retro/vintage style with muted colors and film grain",
            "anime" => "Convert this image to anime/manga style with clean lines and vibrant colors",
            "pixel-art" => "Convert this image to pixel art style with 8-bit graphics",
            "impressionist" => "Transform this image into impressionist painting style with visible brushstrokes",
            _ => &style,
        };

        // For now, we'll use the text-to-image approach
        // In a real implementation, you'd use image editing APIs
        let styled_image_bytes = crate::commands::openai::generate_dalle_image(
            style_prompt.to_string(),
            api_key.clone(),
        )
        .await
        .map_err(|e| format!("Failed to process frame with AI: {}", e))?;

        // Save styled frame
        let styled_frame_path = styled_frames_dir.join(format!("styled_frame_{:04}.png", i + 1));
        fs::write(&styled_frame_path, styled_image_bytes)
            .map_err(|e| format!("Failed to save styled frame: {}", e))?;
    }

    // Reassemble video from styled frames
    let input_file = temp_dir.join("styled_input.txt");
    let mut input_content = String::new();
    
    for styled_frame_path in &frame_files {
        let frame_name = styled_frame_path.file_name().unwrap().to_string_lossy();
        let styled_path = styled_frames_dir.join(&*frame_name);
        
        if styled_path.exists() {
            input_content.push_str(&format!("file '{}'\n", styled_path.to_string_lossy()));
            input_content.push_str("duration 2\n"); // Each frame represents 2 seconds
        }
    }
    
    // Add the last frame again for proper ending
    if let Some(last_frame) = frame_files.last() {
        let frame_name = last_frame.file_name().unwrap().to_string_lossy();
        let styled_path = styled_frames_dir.join(&*frame_name);
        if styled_path.exists() {
            input_content.push_str(&format!("file '{}'\n", styled_path.to_string_lossy()));
        }
    }

    fs::write(&input_file, input_content)
        .map_err(|e| format!("Failed to create FFmpeg input file: {}", e))?;

    // Create video from styled frames
    let mut ffmpeg_cmd = Command::new("ffmpeg");
    ffmpeg_cmd
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(input_file.to_string_lossy().to_string())
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-r")
        .arg("30")
        .arg("-y")
        .arg(&output_path);

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to create video from styled frames: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    // Clean up temporary files
    if let Err(e) = fs::remove_dir_all(&temp_dir) {
        eprintln!("Warning: Failed to clean up temp directory: {}", e);
    }

    Ok(format!("AI-styled video generated: {}", output_path))
}

/// Get available FFmpeg style filters
#[command]
pub async fn get_available_ffmpeg_styles() -> Result<Vec<String>, String> {
    let styles = vec![
        "cartoon".to_string(),
        "grayscale".to_string(),
        "sepia".to_string(),
        "sketch".to_string(),
        "edge".to_string(),
        "vintage".to_string(),
        "dramatic".to_string(),
        "soft".to_string(),
    ];
    Ok(styles)
}

/// Get available AI styles
#[command]
pub async fn get_available_ai_styles() -> Result<Vec<String>, String> {
    let styles = vec![
        "toon-shade".to_string(),
        "oil-painting".to_string(),
        "watercolor".to_string(),
        "cyberpunk".to_string(),
        "retro".to_string(),
    ];
    Ok(styles)
}
