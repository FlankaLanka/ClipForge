use tauri::command;
use std::fs;
use tokio::process::Command;

/// Generate a video from text using DALL-E images and FFmpeg
#[command]
pub async fn generate_text_to_video(
    prompt: String,
    duration: f64,
    style: String,
    output_path: String,
    _add_to_timeline: bool,
) -> Result<String, String> {
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set")?;

    // Create temporary directory for images
    let temp_dir = std::env::temp_dir().join("clipforge_text_to_video");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Calculate number of scenes (5 seconds per scene)
    let scenes_count = (duration / 5.0).ceil() as usize;
    let scene_duration = duration / scenes_count as f64;

    println!("Generating {} scenes for {} second video", scenes_count, duration);

    // Generate images for each scene
    let mut image_paths = Vec::new();
    for i in 0..scenes_count {
        let scene_prompt = if scenes_count == 1 {
            prompt.clone()
        } else {
            format!("{} - Scene {} of {}", prompt, i + 1, scenes_count)
        };

        // Generate image using DALL-E
        let image_bytes = crate::commands::openai::generate_dalle_image(scene_prompt, api_key.clone())
            .await
            .map_err(|e| format!("Failed to generate image for scene {}: {}", i + 1, e))?;

        // Save image
        let image_path = temp_dir.join(format!("scene_{:03}.png", i));
        fs::write(&image_path, image_bytes)
            .map_err(|e| format!("Failed to save image: {}", e))?;

        image_paths.push(image_path.to_string_lossy().to_string());
    }

    // Create video from images using FFmpeg
    create_video_from_images(&image_paths, scene_duration, &output_path, &style).await?;

    // Clean up temporary files
    if let Err(e) = fs::remove_dir_all(&temp_dir) {
        eprintln!("Warning: Failed to clean up temp directory: {}", e);
    }

    Ok(format!("Video generated successfully: {}", output_path))
}

/// Create video from image sequence using FFmpeg
async fn create_video_from_images(
    image_paths: &[String],
    scene_duration: f64,
    output_path: &str,
    style: &str,
) -> Result<(), String> {
    if image_paths.is_empty() {
        return Err("No images to process".to_string());
    }

    // Create input file list for FFmpeg
    let input_file = std::env::temp_dir().join("ffmpeg_input.txt");
    let mut input_content = String::new();
    
    for image_path in image_paths {
        input_content.push_str(&format!("file '{}'\n", image_path));
        input_content.push_str(&format!("duration {}\n", scene_duration));
    }
    
    // Add the last image again for proper ending
    if let Some(last_image) = image_paths.last() {
        input_content.push_str(&format!("file '{}'\n", last_image));
    }

    fs::write(&input_file, input_content)
        .map_err(|e| format!("Failed to create FFmpeg input file: {}", e))?;

    // Build FFmpeg command
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
        .arg("-y") // Overwrite output file
        .arg(output_path);

    // Add style-specific filters
    match style {
        "cinematic" => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=5:5:0.8:3:3:0.4");
        }
        "animated" => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=contrast=1.2:brightness=0.1");
        }
        "sketch" => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,edgedetect=low=0.1:high=0.4");
        }
        "modern" => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,curves=preset=strong_contrast");
        }
        "vintage" => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,curves=vintage,eq=contrast=1.1:brightness=-0.1:saturation=0.8");
        }
        _ => {
            ffmpeg_cmd
                .arg("-vf")
                .arg("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2");
        }
    }

    // Execute FFmpeg command
    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    // Clean up input file
    let _ = fs::remove_file(&input_file);

    Ok(())
}

/// Generate a simple video with text overlay (fallback when no images)
#[command]
pub async fn generate_text_overlay_video(
    text: String,
    duration: f64,
    output_path: String,
) -> Result<String, String> {
    let mut ffmpeg_cmd = Command::new("ffmpeg");
    
    ffmpeg_cmd
        .arg("-f")
        .arg("lavfi")
        .arg("-i")
        .arg(format!("color=c=black:size=1920x1080:duration={}", duration))
        .arg("-vf")
        .arg(format!(
            "drawtext=text='{}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2",
            text.replace("'", "\\'")
        ))
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(&output_path);

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    Ok(format!("Text overlay video generated: {}", output_path))
}
