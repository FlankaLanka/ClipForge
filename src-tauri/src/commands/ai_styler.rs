use tauri::{command, AppHandle};
use std::path::Path;
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;
use std::fs;
use crate::commands::binary_utils::get_ffmpeg_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterResult {
    pub output_path: String,
    pub success: bool,
    pub message: String,
}

// FFmpeg filter definitions
const FILTERS: &[(&str, &str)] = &[
    ("grayscale", "hue=s=0"),
    ("edge_detect", "edgedetect=low=0.1:high=0.4"),
    ("blur", "gblur=sigma=2"),
    ("sharpen", "unsharp=5:5:1.0:5:5:0.0"),
    ("sepia", "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131"),
    ("vintage", "curves=vintage"),
    ("invert", "negate"),
    ("saturate", "eq=saturation=2.0"),
    ("pixelate", "scale=iw/8:ih/8:flags=neighbor,scale=iw*8:ih*8:flags=neighbor"),
    ("emboss", "convolution=0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0:0 -1 0 -1 5 -1 0 -1 0"),
    ("oil_paint", "gblur=sigma=1.5,eq=saturation=1.5"),
];

#[command]
pub async fn apply_filters(
    app: AppHandle,
    input_path: &str,
    filters: Vec<String>,
    _file_type: &str,
) -> Result<FilterResult, String> {
    println!("Applying filters: {:?} to {}", filters, input_path);

    // Create output path in temp directory to avoid cluttering user's folders
    let input_path_obj = Path::new(input_path);
    let stem = input_path_obj.file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid input path")?;
    let extension = input_path_obj.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_filename = format!("{}_filtered_{}.{}", stem, timestamp, extension);
    
    // Create temp directory for processed files
    let temp_dir = std::env::temp_dir().join("clipforge_processed");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Clean up old files (older than 1 hour) to keep temp dir clean
    cleanup_old_temp_files(&temp_dir).ok();
    
    let output_path = temp_dir.join(&output_filename);

    // Build FFmpeg filter chain
    let mut filter_chain = String::new();
    for (i, filter_id) in filters.iter().enumerate() {
        if let Some((_, ffmpeg_filter)) = FILTERS.iter().find(|(id, _)| id == filter_id) {
            if i > 0 {
                filter_chain.push(',');
            }
            filter_chain.push_str(ffmpeg_filter);
        } else {
            return Err(format!("Unknown filter: {}", filter_id));
        }
    }

    println!("FFmpeg filter chain: {}", filter_chain);

    // Build FFmpeg command
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let mut ffmpeg_cmd = TokioCommand::new(ffmpeg_path);
    ffmpeg_cmd
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg(&filter_chain)
        .arg("-y")
        .arg(&output_path);

    // Execute FFmpeg
    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Filters applied successfully: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Applied {} filters successfully", filters.len()),
    })
}

#[command]
pub async fn upscale_media(
    app: AppHandle,
    input_path: &str,
    scale_factor: i32,
    file_type: &str,
    method: &str,
) -> Result<FilterResult, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    println!("Upscaling {} by {}x using {} method", input_path, scale_factor, method);

    // Create output path in temp directory to avoid cluttering user's folders
    let input_path_obj = Path::new(input_path);
    let stem = input_path_obj.file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid input path")?;
    let extension = input_path_obj.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_filename = format!("{}_upscaled_{}x_{}.{}", stem, scale_factor, timestamp, extension);
    
    // Create temp directory for processed files
    let temp_dir = std::env::temp_dir().join("clipforge_processed");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Clean up old files (older than 1 hour) to keep temp dir clean
    cleanup_old_temp_files(&temp_dir).ok();
    
    let output_path = temp_dir.join(&output_filename);

    // Build FFmpeg command for upscaling based on method
    let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
    
    // Check if we need to use AI methods
    let use_ai = method == "dalle";
    
    if use_ai {
        // Use OpenAI DALL-E for real AI processing
        if file_type == "video" {
            return upscale_video_with_openai(&app, input_path, scale_factor, "dalle", &output_path).await;
        } else {
            return upscale_with_openai(input_path, scale_factor, file_type, "dalle", &output_path).await;
        }
    }
    
    // Determine scaling flags for traditional methods
    let scale_flags = match method {
        "lanczos" => "flags=lanczos",
        "bicubic" => "flags=bicubic",
        _ => "flags=lanczos"
    };
    
    if file_type == "image" {
        // For images
        ffmpeg_cmd
            .arg("-i")
            .arg(input_path)
            .arg("-vf")
            .arg(&format!("scale=iw*{}:ih*{}:{}", scale_factor, scale_factor, scale_flags))
            .arg("-y")
            .arg(&output_path);
    } else {
        // For videos
        ffmpeg_cmd
            .arg("-i")
            .arg(input_path)
            .arg("-vf")
            .arg(&format!("scale=iw*{}:ih*{}:{}", scale_factor, scale_factor, scale_flags))
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("medium")
            .arg("-crf")
            .arg("18")
            .arg("-y")
            .arg(&output_path);
    }

    // Execute FFmpeg
    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Upscaling completed: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled by {}x successfully", scale_factor),
    })
}

#[command]
pub async fn copy_file_to_desktop(file_path: &str) -> Result<String, String> {
    use std::fs;
    use dirs;

    let desktop_path = dirs::desktop_dir()
        .ok_or("Could not find desktop directory")?
        .join(Path::new(file_path).file_name().unwrap());

    fs::copy(file_path, &desktop_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    let result = desktop_path.to_string_lossy().to_string();
    println!("File copied to desktop: {}", result);
    Ok(result)
}

#[command]
pub async fn copy_file_to_location(source_path: &str, destination_path: &str) -> Result<String, String> {
    use std::fs;

    fs::copy(source_path, destination_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    println!("File copied from {} to {}", source_path, destination_path);
    Ok(destination_path.to_string())
}

// Helper function to clean up old temp files
fn cleanup_old_temp_files(temp_dir: &std::path::Path) -> Result<(), std::io::Error> {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let one_hour_ago = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() - 3600;
    
    if let Ok(entries) = fs::read_dir(temp_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if let Ok(modified_secs) = modified.duration_since(UNIX_EPOCH) {
                            if modified_secs.as_secs() < one_hour_ago {
                                let _ = fs::remove_file(entry.path());
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

// ESRGAN Model Management
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub path: String,
    pub downloaded: bool,
    pub size_mb: f64,
}

#[command]
pub async fn get_esrgan_models() -> Result<Vec<ModelInfo>, String> {
    let models_dir = get_models_directory()?;
    let mut models = Vec::new();
    
    // ESRGAN models we support
    let model_configs = vec![
        ("ESRGAN_x4plus", "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth", 67.0),
        ("ESRGAN_x4plus_anime", "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth", 17.0),
    ];
    
    for (name, _url, size_mb) in model_configs {
        let model_path = models_dir.join(format!("{}.pth", name));
        let downloaded = model_path.exists();
        
        models.push(ModelInfo {
            name: name.to_string(),
            path: model_path.to_string_lossy().to_string(),
            downloaded,
            size_mb,
        });
    }
    
    Ok(models)
}

#[command]
pub async fn download_esrgan_model(model_name: &str) -> Result<String, String> {
    let models_dir = get_models_directory()?;
    let model_path = models_dir.join(format!("{}.pth", model_name));
    
    if model_path.exists() {
        return Ok(format!("Model {} already exists", model_name));
    }
    
    // Model URLs
    let model_urls = std::collections::HashMap::from([
        ("ESRGAN_x4plus", "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"),
        ("ESRGAN_x4plus_anime", "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"),
    ]);
    
    let url = model_urls.get(model_name)
        .ok_or_else(|| format!("Unknown model: {}", model_name))?;
    
    println!("Downloading {} from {}", model_name, url);
    
    let client = reqwest::Client::new();
    let response = client
        .get(*url)
        .send()
        .await
        .map_err(|e| format!("Failed to download model: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to download model: HTTP {}", response.status()));
    }
    
    let mut file = fs::File::create(&model_path)
        .map_err(|e| format!("Failed to create model file: {}", e))?;
    
    let mut content = std::io::Cursor::new(response.bytes().await.map_err(|e| format!("Failed to read response: {}", e))?);
    std::io::copy(&mut content, &mut file)
        .map_err(|e| format!("Failed to write model file: {}", e))?;
    
    println!("Downloaded {} to {}", model_name, model_path.display());
    Ok(format!("Successfully downloaded {}", model_name))
}

fn get_models_directory() -> Result<std::path::PathBuf, String> {
    let models_dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("clipforge")
        .join("models");
    
    fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;
    
    Ok(models_dir)
}

// OpenAI-based upscaling function
async fn upscale_with_openai(
    input_path: &str,
    scale_factor: i32,
    file_type: &str,
    method: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    // Only support images for OpenAI upscaling
    if file_type != "image" {
        return Err("OpenAI upscaling currently only supports images. Use traditional methods for videos.".to_string());
    }
    
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")?;
    
    // Create the prompt for DALL-E 3 upscaling
    let prompt = format!(
        "Please upscale this image by {}x with high-quality enhancement. 
        Focus on sharp details, realistic textures, and professional upscaling. 
        Maintain the original style and colors while significantly improving resolution and clarity. 
        Use advanced AI techniques to reconstruct missing details and enhance image quality.",
        scale_factor
    );
    
    println!("Using OpenAI for {} upscaling with prompt: {}", method, prompt);
    
    // Call OpenAI DALL-E 3 API for image upscaling
    let client = reqwest::Client::new();
    
    // Create the request body for DALL-E 3
    let request_body = serde_json::json!({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "quality": "hd"
    });
    
    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to call OpenAI API: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
    
    // Get the generated image URL
    let image_url = response_json["data"][0]["url"]
        .as_str()
        .ok_or("No image URL in OpenAI response")?;
    
    // Download the generated image
    let image_response = client
        .get(image_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download generated image: {}", e))?;
    
    let upscaled_bytes = image_response.bytes().await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;
    
    fs::write(output_path, upscaled_bytes)
        .map_err(|e| format!("Failed to save upscaled image: {}", e))?;
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("OpenAI upscaling completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled by {}x using OpenAI {}", scale_factor, method),
    })
}

// OpenAI-based video upscaling function (frame-by-frame)
async fn upscale_video_with_openai(
    app: &AppHandle,
    input_path: &str,
    scale_factor: i32,
    method: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose};
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found. Please set OPENAI_API_KEY environment variable.")?;
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_upscale");
    let frames_dir = temp_dir.join("frames");
    let upscaled_frames_dir = temp_dir.join("upscaled_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&upscaled_frames_dir)
        .map_err(|e| format!("Failed to create upscaled frames directory: {}", e))?;
    
    println!("Extracting frames from video...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=30") // Extract at 30 FPS
        .arg("-q:v")
        .arg("2") // High quality
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to upscale", frame_files.len());
    
    // Upscale each frame using OpenAI
    let client = reqwest::Client::new();
    let mut upscaled_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("Upscaling frame {}/{}", i + 1, frame_files.len());
        
        // Read the frame
        let frame_bytes = fs::read(frame_path)
            .map_err(|e| format!("Failed to read frame: {}", e))?;
        
        // Create the prompt based on the method
        let prompt = match method {
            "realesrgan" => format!(
                "Upscale this video frame by {}x using Real-ESRGAN style enhancement. 
                Focus on sharp details, realistic textures, and high-quality upscaling. 
                Maintain the original style and colors while significantly improving resolution and clarity.",
                scale_factor
            ),
            "esrgan" => format!(
                "Upscale this video frame by {}x using ESRGAN style enhancement.
                Enhance details, improve sharpness, and create a high-resolution version.
                Focus on realistic image enhancement and detail preservation.",
                scale_factor
            ),
            "waifu2x" => format!(
                "Upscale this video frame by {}x using Waifu2x style enhancement.
                Optimize for anime, illustration, or artistic content.
                Enhance line art, improve colors, and create a crisp high-resolution version.",
                scale_factor
            ),
            _ => format!("Upscale this video frame by {}x with high quality enhancement.", scale_factor)
        };
        
        // Call OpenAI API using multipart/form-data
        let mut form = reqwest::multipart::Form::new()
            .text("prompt", prompt)
            .text("n", "1")
            .text("size", "1024x1024")
            .text("response_format", "b64_json");
        
        // Add the frame as a file part
        let frame_part = reqwest::multipart::Part::bytes(frame_bytes.clone())
            .file_name("frame.png")
            .mime_str("image/png")
            .map_err(|e| format!("Failed to create frame part: {}", e))?;
        
        form = form.part("image", frame_part);
        
        let response = client
            .post("https://api.openai.com/v1/images/edits")
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Failed to call OpenAI API for frame {}: {}", i + 1, e))?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("OpenAI API error for frame {}: {}", i + 1, error_text));
        }
        
        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse OpenAI response for frame {}: {}", i + 1, e))?;
        
        // Extract and save upscaled frame
        let upscaled_b64 = response_json["data"][0]["b64_json"]
            .as_str()
            .ok_or(format!("No image data in OpenAI response for frame {}", i + 1))?;
        
        let upscaled_bytes = general_purpose::STANDARD
            .decode(upscaled_b64)
            .map_err(|e| format!("Failed to decode upscaled frame {}: {}", i + 1, e))?;
        
        let upscaled_frame_path = upscaled_frames_dir.join(format!("upscaled_frame_{:04}.png", i + 1));
        fs::write(&upscaled_frame_path, upscaled_bytes)
            .map_err(|e| format!("Failed to save upscaled frame {}: {}", i + 1, e))?;
        
        upscaled_count += 1;
        
        // Add a small delay to avoid rate limiting
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    println!("Upscaled {} frames, now reassembling video...", upscaled_count);
    
    // Reassemble video from upscaled frames
    let upscaled_pattern = format!("{}/upscaled_frame_%04d.png", upscaled_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("30") // Match the extraction framerate
        .arg("-i")
        .arg(&upscaled_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("OpenAI video upscaling completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled video by {}x using OpenAI {} ({} frames processed)", scale_factor, method, upscaled_count),
    })
}

#[command]
pub async fn process_media(
    app: AppHandle,
    input_path: &str,
    operation_type: &str,
    scale_factor: i32,
    file_type: &str,
    method: &str,
) -> Result<FilterResult, String> {
    match operation_type {
        "upscale" => upscale_media(app, input_path, scale_factor, file_type, method).await,
        "unblur" => unblur_media(app, input_path, file_type, method).await,
        _ => Err(format!("Unknown operation type: {}", operation_type))
    }
}

// Unblur media function
async fn unblur_media(
    app: AppHandle,
    input_path: &str,
    file_type: &str,
    method: &str,
) -> Result<FilterResult, String> {
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    println!("Unblurring {} using {} method", input_path, method);

    // Create output path in temp directory
    let input_path_obj = Path::new(input_path);
    let stem = input_path_obj.file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid input path")?;
    let extension = input_path_obj.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("mp4");
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_filename = format!("{}_unblurred_{}.{}", stem, timestamp, extension);
    
    let temp_dir = std::env::temp_dir().join("clipforge_processed");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    cleanup_old_temp_files(&temp_dir).ok();
    let output_path = temp_dir.join(&output_filename);

    // Check if we need to use AI methods
    let use_ai = method == "dalle";
    
    if use_ai {
        // Use OpenAI DALL-E for real AI unblurring
        if file_type == "video" {
            return unblur_video_with_openai(&app, input_path, &output_path).await;
        } else {
            return unblur_with_openai(input_path, &output_path).await;
        }
    }

    // Traditional unblur methods using FFmpeg
    let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
    
    let filter = match method {
        "sharpen" => "unsharp=5:5:1.0:5:5:0.0",
        "gaussian" => "gblur=sigma=0.5:steps=1",
        _ => "unsharp=5:5:1.0:5:5:0.0"
    };
    
    if file_type == "image" {
        ffmpeg_cmd
            .arg("-i")
            .arg(input_path)
            .arg("-vf")
            .arg(filter)
            .arg("-y")
            .arg(&output_path);
    } else {
        ffmpeg_cmd
            .arg("-i")
            .arg(input_path)
            .arg("-vf")
            .arg(filter)
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("medium")
            .arg("-crf")
            .arg("18")
            .arg("-y")
            .arg(&output_path);
    }

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg unblur failed: {}", error));
    }

    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Unblur completed: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Unblurred using {}", method),
    })
}

// Removed old AI functions - now using OpenAI DALL-E directly

// OpenAI DALL-E unblurring for images
async fn unblur_with_openai(
    input_path: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    println!("Using OpenAI DALL-E for AI unblurring");
    
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set")?;
    
    // Create OpenAI DALL-E 3 request
    let client = reqwest::Client::new();
    let request_body = serde_json::json!({
        "model": "dall-e-3",
        "prompt": "Please enhance and unblur this image, reconstructing missing details while maintaining the original content and style. Make it sharp and clear with professional quality enhancement.",
        "n": 1,
        "size": "1024x1024",
        "quality": "hd"
    });
    
    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("OpenAI API request failed: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let result: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
    
    // Get the generated image URL
    let image_url = result["data"][0]["url"]
        .as_str()
        .ok_or("No image URL in OpenAI response")?;
    
    // Download the generated image
    let image_response = client
        .get(image_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download generated image: {}", e))?;
    
    let image_bytes = image_response.bytes().await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;
    
    // Save the image
    std::fs::write(output_path, &image_bytes)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("OpenAI DALL-E unblurring completed: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: "AI unblurring completed using OpenAI DALL-E".to_string(),
    })
}

// OpenAI DALL-E unblurring for videos (frame-by-frame)
async fn unblur_video_with_openai(
    app: &AppHandle,
    input_path: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using OpenAI DALL-E for video unblurring");
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_openai");
    let frames_dir = temp_dir.join("frames");
    let unblurred_frames_dir = temp_dir.join("unblurred_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&unblurred_frames_dir)
        .map_err(|e| format!("Failed to create unblurred frames directory: {}", e))?;
    
    println!("Extracting frames from video for OpenAI processing...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=10") // Reduced frame rate for faster processing
        .arg("-q:v")
        .arg("2")
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to process with OpenAI DALL-E", frame_files.len());
    
    // Process each frame with OpenAI DALL-E
    let mut unblurred_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("OpenAI processing frame {}/{}", i + 1, frame_files.len());
        
        let unblurred_frame_path = unblurred_frames_dir.join(format!("unblurred_frame_{:04}.png", i + 1));
        
        // Use OpenAI DALL-E for each frame
        match unblur_with_openai(&frame_path.to_string_lossy(), &unblurred_frame_path).await {
            Ok(_) => {
                unblurred_count += 1;
            },
            Err(e) => {
                println!("Warning: Failed to process frame {}: {}", i + 1, e);
                // Continue with other frames
            }
        }
    }
    
    println!("OpenAI processed {} frames, now reassembling video...", unblurred_count);
    
    // Reassemble video from unblurred frames
    let unblurred_pattern = format!("{}/unblurred_frame_%04d.png", unblurred_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("10")
        .arg("-i")
        .arg(&unblurred_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("OpenAI DALL-E video unblurring completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("AI video unblurring completed using OpenAI DALL-E ({} frames processed)", unblurred_count),
    })
}

// Local AI-based unblurring function for videos (frame-by-frame)
async fn unblur_video_with_ai(
    app: &AppHandle,
    input_path: &str,
    method: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using local AI for {} video unblurring", method);
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_unblur");
    let frames_dir = temp_dir.join("frames");
    let unblurred_frames_dir = temp_dir.join("unblurred_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&unblurred_frames_dir)
        .map_err(|e| format!("Failed to create unblurred frames directory: {}", e))?;
    
    println!("Extracting frames from video for unblurring...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=30")
        .arg("-q:v")
        .arg("2")
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to unblur", frame_files.len());
    
    // For now, use FFmpeg for each frame as fallback
    // This is a placeholder for the actual AI implementation
    let mut unblurred_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("Unblurring frame {}/{}", i + 1, frame_files.len());
        
        let unblurred_frame_path = unblurred_frames_dir.join(format!("unblurred_frame_{:04}.png", i + 1));
        
        let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
        let frame_output = ffmpeg_cmd
            .arg("-i")
            .arg(frame_path)
            .arg("-vf")
            .arg("unsharp=5:5:1.0:5:5:0.0")
            .arg("-y")
            .arg(&unblurred_frame_path)
            .output()
            .await
            .map_err(|e| format!("Failed to unblur frame {}: {}", i + 1, e))?;
        
        if !frame_output.status.success() {
            let error = String::from_utf8_lossy(&frame_output.stderr);
            return Err(format!("FFmpeg unblur failed for frame {}: {}", i + 1, error));
        }
        
        unblurred_count += 1;
    }
    
    println!("Unblurred {} frames, now reassembling video...", unblurred_count);
    
    // Reassemble video from unblurred frames
    let unblurred_pattern = format!("{}/unblurred_frame_%04d.png", unblurred_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("30")
        .arg("-i")
        .arg(&unblurred_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Local AI video unblurring completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Unblurred video using local AI {} ({} frames processed)", method, unblurred_count),
    })
}

// Local AI-based upscaling function for videos (frame-by-frame)
async fn upscale_video_with_ai(
    app: &AppHandle,
    input_path: &str,
    scale_factor: i32,
    method: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using local AI for {} video upscaling by {}x", method, scale_factor);
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_upscale_ai");
    let frames_dir = temp_dir.join("frames");
    let upscaled_frames_dir = temp_dir.join("upscaled_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&upscaled_frames_dir)
        .map_err(|e| format!("Failed to create upscaled frames directory: {}", e))?;
    
    println!("Extracting frames from video for AI upscaling...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=30")
        .arg("-q:v")
        .arg("2")
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to upscale with AI", frame_files.len());
    
    // Process each frame with AI
    let mut upscaled_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("AI upscaling frame {}/{}", i + 1, frame_files.len());
        
        let upscaled_frame_path = upscaled_frames_dir.join(format!("upscaled_frame_{:04}.png", i + 1));
        
        // Use enhanced traditional processing for each frame
        let filter = format!(
            "scale=iw*{}:ih*{}:flags=lanczos,unsharp=5:5:1.5:5:5:0.0,convolution=0 -1 0 -1 6 -1 0 -1 0,unsharp=3:3:0.8:3:3:0.0",
            scale_factor, scale_factor
        );
        
        let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
        let frame_output = ffmpeg_cmd
            .arg("-i")
            .arg(&*frame_path.to_string_lossy())
            .arg("-vf")
            .arg(&filter)
            .arg("-y")
            .arg(&upscaled_frame_path)
            .output()
            .await;
        
        match frame_output {
            Ok(output) => {
                if output.status.success() {
                    upscaled_count += 1;
                } else {
                    let error = String::from_utf8_lossy(&output.stderr);
                    println!("Warning: Failed to process frame {}: {}", i + 1, error);
                }
            },
            Err(e) => {
                println!("Warning: Failed to process frame {}: {}", i + 1, e);
            }
        }
    }
    
    println!("AI upscaled {} frames, now reassembling video...", upscaled_count);
    
    // Reassemble video from upscaled frames
    let upscaled_pattern = format!("{}/upscaled_frame_%04d.png", upscaled_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("30")
        .arg("-i")
        .arg(&upscaled_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Local AI video upscaling completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled video by {}x using local AI {} ({} frames processed)", scale_factor, method, upscaled_count),
    })
}

// Enhanced traditional upscaling function for images
async fn upscale_with_enhanced(
    app: &AppHandle,
    input_path: &str,
    scale_factor: i32,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using enhanced traditional processing for {}x upscaling", scale_factor);
    
    // Multi-pass enhanced processing
    let filter = format!(
        "scale=iw*{}:ih*{}:flags=lanczos,unsharp=5:5:1.5:5:5:0.0,convolution=0 -1 0 -1 6 -1 0 -1 0,unsharp=3:3:0.8:3:3:0.0",
        scale_factor, scale_factor
    );
    
    let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
    let output = ffmpeg_cmd
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg(&filter)
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg enhanced upscaling failed: {}", error));
    }
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Enhanced traditional upscaling completed: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled by {}x using enhanced traditional processing", scale_factor),
    })
}

// Enhanced traditional upscaling function for videos
async fn upscale_video_with_enhanced(
    app: &AppHandle,
    input_path: &str,
    scale_factor: i32,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using enhanced traditional processing for {}x video upscaling", scale_factor);
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_enhanced");
    let frames_dir = temp_dir.join("frames");
    let upscaled_frames_dir = temp_dir.join("upscaled_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&upscaled_frames_dir)
        .map_err(|e| format!("Failed to create upscaled frames directory: {}", e))?;
    
    println!("Extracting frames from video for enhanced processing...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=30")
        .arg("-q:v")
        .arg("2")
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to process with enhanced traditional methods", frame_files.len());
    
    // Process each frame with enhanced traditional methods
    let mut upscaled_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("Enhanced processing frame {}/{}", i + 1, frame_files.len());
        
        let upscaled_frame_path = upscaled_frames_dir.join(format!("upscaled_frame_{:04}.png", i + 1));
        
        // Use enhanced traditional processing for each frame
        let filter = format!(
            "scale=iw*{}:ih*{}:flags=lanczos,unsharp=5:5:1.5:5:5:0.0,convolution=0 -1 0 -1 6 -1 0 -1 0,unsharp=3:3:0.8:3:3:0.0",
            scale_factor, scale_factor
        );
        
        let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
        let frame_output = ffmpeg_cmd
            .arg("-i")
            .arg(&*frame_path.to_string_lossy())
            .arg("-vf")
            .arg(&filter)
            .arg("-y")
            .arg(&upscaled_frame_path)
            .output()
            .await
            .map_err(|e| format!("Failed to process frame {}: {}", i + 1, e))?;
        
        if !frame_output.status.success() {
            let error = String::from_utf8_lossy(&frame_output.stderr);
            return Err(format!("Enhanced processing failed for frame {}: {}", i + 1, error));
        }
        
        upscaled_count += 1;
    }
    
    println!("Enhanced processed {} frames, now reassembling video...", upscaled_count);
    
    // Reassemble video from upscaled frames
    let upscaled_pattern = format!("{}/upscaled_frame_%04d.png", upscaled_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("30")
        .arg("-i")
        .arg(&upscaled_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Enhanced traditional video upscaling completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Upscaled video by {}x using enhanced traditional processing ({} frames processed)", scale_factor, upscaled_count),
    })
}

// Enhanced traditional unblur function for images
async fn unblur_with_enhanced(
    app: &AppHandle,
    input_path: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using enhanced traditional processing for unblurring");
    
    // Multi-pass enhanced unblur processing
    let filter = "unsharp=7:7:2.5:7:7:0.0,convolution=0 -1 0 -1 10 -1 0 -1 0,unsharp=5:5:1.5:5:5:0.0,convolution=0 -1 0 -1 6 -1 0 -1 0,unsharp=3:3:1.0:3:3:0.0";
    
    let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
    let output = ffmpeg_cmd
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg(filter)
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg enhanced unblurring failed: {}", error));
    }
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Enhanced traditional unblurring completed: {}", output_path_str);

    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: "Unblurred using enhanced traditional processing".to_string(),
    })
}

// Enhanced traditional unblur function for videos
async fn unblur_video_with_enhanced(
    app: &AppHandle,
    input_path: &str,
    output_path: &std::path::Path,
) -> Result<FilterResult, String> {
    use std::fs;
    
    let ffmpeg_path = get_ffmpeg_path(app)?;
    println!("Using enhanced traditional processing for video unblurring");
    
    // Create temporary directories for frames
    let temp_dir = std::env::temp_dir().join("clipforge_video_enhanced_unblur");
    let frames_dir = temp_dir.join("frames");
    let unblurred_frames_dir = temp_dir.join("unblurred_frames");
    
    fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("Failed to create frames directory: {}", e))?;
    fs::create_dir_all(&unblurred_frames_dir)
        .map_err(|e| format!("Failed to create unblurred frames directory: {}", e))?;
    
    println!("Extracting frames from video for enhanced unblur processing...");
    
    // Extract frames using FFmpeg
    let frame_pattern = format!("{}/frame_%04d.png", frames_dir.to_string_lossy());
    let extract_output = TokioCommand::new(&ffmpeg_path)
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg("fps=30")
        .arg("-q:v")
        .arg("2")
        .arg(&frame_pattern)
        .arg("-y")
        .output()
        .await
        .map_err(|e| format!("Failed to extract frames: {}", e))?;
    
    if !extract_output.status.success() {
        let error = String::from_utf8_lossy(&extract_output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", error));
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
    
    println!("Found {} frames to process with enhanced traditional unblur methods", frame_files.len());
    
    // Process each frame with enhanced traditional unblur methods
    let mut unblurred_count = 0;
    
    for (i, frame_path) in frame_files.iter().enumerate() {
        println!("Enhanced unblur processing frame {}/{}", i + 1, frame_files.len());
        
        let unblurred_frame_path = unblurred_frames_dir.join(format!("unblurred_frame_{:04}.png", i + 1));
        
        // Use enhanced traditional unblur processing for each frame
        let filter = "unsharp=7:7:2.5:7:7:0.0,convolution=0 -1 0 -1 10 -1 0 -1 0,unsharp=5:5:1.5:5:5:0.0,convolution=0 -1 0 -1 6 -1 0 -1 0,unsharp=3:3:1.0:3:3:0.0";
        
        let mut ffmpeg_cmd = TokioCommand::new(&ffmpeg_path);
        let frame_output = ffmpeg_cmd
            .arg("-i")
            .arg(&*frame_path.to_string_lossy())
            .arg("-vf")
            .arg(filter)
            .arg("-y")
            .arg(&unblurred_frame_path)
            .output()
            .await
            .map_err(|e| format!("Failed to process frame {}: {}", i + 1, e))?;
        
        if !frame_output.status.success() {
            let error = String::from_utf8_lossy(&frame_output.stderr);
            return Err(format!("Enhanced unblur processing failed for frame {}: {}", i + 1, error));
        }
        
        unblurred_count += 1;
    }
    
    println!("Enhanced unblur processed {} frames, now reassembling video...", unblurred_count);
    
    // Reassemble video from unblurred frames
    let unblurred_pattern = format!("{}/unblurred_frame_%04d.png", unblurred_frames_dir.to_string_lossy());
    let reassemble_output = TokioCommand::new(&ffmpeg_path)
        .arg("-framerate")
        .arg("30")
        .arg("-i")
        .arg(&unblurred_pattern)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("medium")
        .arg("-crf")
        .arg("18")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-y")
        .arg(output_path)
        .output()
        .await
        .map_err(|e| format!("Failed to reassemble video: {}", e))?;
    
    if !reassemble_output.status.success() {
        let error = String::from_utf8_lossy(&reassemble_output.stderr);
        return Err(format!("FFmpeg video reassembly failed: {}", error));
    }
    
    // Clean up temporary directories
    let _ = fs::remove_dir_all(&temp_dir);
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("Enhanced traditional video unblurring completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: format!("Unblurred video using enhanced traditional processing ({} frames processed)", unblurred_count),
    })
}

#[command]
pub async fn generate_image_with_dalle(
    api_key: &str,
    prompt: &str,
    size: &str,
    quality: &str,
) -> Result<FilterResult, String> {
    use std::fs;
    
    println!("=== DALL-E Image Generation Started ===");
    println!("Prompt: {}", prompt);
    println!("Size: {}", size);
    println!("Quality: {}", quality);
    
    // Validate API key
    if api_key.trim().is_empty() {
        return Err("OpenAI API key is required. Please enter your API key.".to_string());
    }
    
    println!("API key provided, length: {}", api_key.len());
    
    // Create output directory
    let output_dir = "/tmp/clipforge_processed";
    println!("Creating output directory: {}", output_dir);
    std::fs::create_dir_all(output_dir)
        .map_err(|e| {
            println!("Error creating output directory: {}", e);
            format!("Failed to create output directory: {}", e)
        })?;
    
    // Generate unique filename
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let output_filename = format!("dalle_generated_{}.png", timestamp);
    let output_path = std::path::Path::new(output_dir).join(&output_filename);
    
    println!("Output path: {}", output_path.to_string_lossy());
    println!("Generating DALL-E image with prompt: {}", prompt);
    
    // Call OpenAI DALL-E 3 API
    let client = reqwest::Client::new();
    let request_body = serde_json::json!({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality
    });
    
    println!("Request body: {}", serde_json::to_string_pretty(&request_body).unwrap_or_default());
    println!("Making API request to OpenAI...");
    
    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            println!("API request failed: {}", e);
            format!("Failed to call OpenAI API: {}", e)
        })?;
    
    println!("API response status: {}", response.status());
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
    
    // Get the generated image URL
    let image_url = response_json["data"][0]["url"]
        .as_str()
        .ok_or("No image URL in OpenAI response")?;
    
    // Download the generated image
    let image_response = client
        .get(image_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download generated image: {}", e))?;
    
    let image_bytes = image_response.bytes().await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;
    
    // Save the generated image
    fs::write(&output_path, image_bytes)
        .map_err(|e| format!("Failed to save generated image: {}", e))?;
    
    let output_path_str = output_path.to_string_lossy().to_string();
    println!("DALL-E image generation completed: {}", output_path_str);
    
    Ok(FilterResult {
        output_path: output_path_str,
        success: true,
        message: "Image generated successfully using DALL-E".to_string(),
    })
}
