use tauri::{command, AppHandle};
use std::path::Path;
use std::fs;
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use image::{ImageBuffer, Rgb, RgbImage, DynamicImage};
use crate::commands::binary_utils::get_ffmpeg_path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CharacterSprite {
    pub frame_index: usize,
    pub bounding_box: BoundingBox,
    pub timestamp: f64,
    pub animation_label: Option<String>,
    pub image_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
pub struct BoundingBox {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SpriteSheetMetadata {
    pub sprites: Vec<CharacterSprite>,
    pub sprite_sheet_path: String,
    pub metadata_path: String,
    pub total_frames: usize,
    pub sprite_size: SpriteSize,
    pub padding: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpriteSize {
    pub width: i32,
    pub height: i32,
}

/// Create a temporary directory for character extraction
#[command]
pub async fn create_temp_directory(name: &str) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join(format!("clipforge_{}_{}", name, Uuid::new_v4()));
    
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    Ok(temp_dir.to_string_lossy().to_string())
}

/// Create a directory at the specified path
#[command]
pub async fn create_directory(path: &str) -> Result<String, String> {
    fs::create_dir_all(path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(format!("Directory created: {}", path))
}

/// Extract frames from video at specified FPS
#[command]
pub async fn extract_video_frames(
    app: AppHandle,
    input_path: &str,
    output_dir: &str,
    fps: u32,
) -> Result<Vec<String>, String> {
    if !Path::new(input_path).exists() {
        return Err("Input video file does not exist".to_string());
    }

    // Create output directory if it doesn't exist
    fs::create_dir_all(output_dir)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let mut ffmpeg_cmd = Command::new(ffmpeg_path);
    ffmpeg_cmd
        .arg("-i")
        .arg(input_path)
        .arg("-vf")
        .arg(format!("fps={}", fps))
        .arg("-q:v")
        .arg("2") // High quality
        .arg(Path::new(output_dir).join("frame_%04d.png").to_string_lossy().to_string())
        .arg("-y");

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }

    // Get list of extracted frames
    let frame_files: Vec<String> = fs::read_dir(output_dir)
        .map_err(|e| format!("Failed to read output directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext == "png")
                .unwrap_or(false)
        })
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    if frame_files.is_empty() {
        return Err("No frames extracted from video".to_string());
    }

    Ok(frame_files)
}

/// Detect character in a single frame using OpenAI Vision API
#[command]
pub async fn detect_character_in_frame(
    frame_path: &str,
    frame_index: usize,
    output_dir: &str,
    reference_image_path: Option<String>,
) -> Result<serde_json::Value, String> {
    // Get OpenAI API key
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY environment variable not set")?;

    // Read frame image
    let frame_bytes = fs::read(frame_path)
        .map_err(|e| format!("Failed to read frame: {}", e))?;

    // Convert to base64 for OpenAI API
    let base64_frame = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &frame_bytes);

    // Build content array with reference image if provided
    let mut content = Vec::new();
    
    // Add text prompt
    let prompt_text = if reference_image_path.is_some() {
        "🎮 MARIO CHARACTER DETECTION - CRITICAL INSTRUCTIONS 🎮

Image 1 (REFERENCE): This is MARIO - the exact character you must find.
Image 2 (GAMEPLAY): Find ONLY Mario in this Super Mario Bros frame.

🎯 WHAT MARIO LOOKS LIKE:
- Small pixelated character (16-32 pixels tall)
- Red hat/shirt, blue overalls, brown shoes
- Round head with mustache
- Humanoid shape with arms and legs
- Usually the ONLY moving character in the frame

❌ WHAT TO IGNORE (NOT MARIO):
- Large blue sky blocks/rectangles (background)
- Green ground/platforms
- Clouds or sky elements
- Pipes or level geometry
- Any large colored rectangles
- UI elements or text

🔍 DETECTION RULES:
1. Mario is SMALL and PIXELATED (not a large block)
2. Mario has RED and BLUE colors (not just blue)
3. Mario looks like a person, not a rectangle
4. Mario is usually the only moving character
5. If you see large blue blocks, those are SKY - ignore them!

Return ONLY: 'x: [number], y: [number], width: [number], height: [number]'
If you don't see Mario (the small red/blue character), return 'null'."
    } else {
        "🎮 SUPER MARIO BROS CHARACTER DETECTION 🎮

Find the main playable character (Mario) in this retro game frame.

🎯 MARIO CHARACTERISTICS:
- Small pixelated sprite (16-32 pixels tall)
- Red hat/shirt, blue overalls
- Round head with mustache
- Humanoid shape with distinct features
- Usually the only moving character

❌ IGNORE THESE (NOT MARIO):
- Large blue sky blocks/rectangles
- Green platforms or ground
- Clouds, pipes, or level geometry
- Any large colored rectangles
- Background elements

🔍 FOCUS ON:
- Small, detailed character sprites
- Red and blue colored character
- Humanoid shape, not geometric blocks
- The main player character

Return ONLY: 'x: [number], y: [number], width: [number], height: [number]'
If no clear Mario character is visible, return 'null'."
    };
    
    content.push(serde_json::json!({
        "type": "text",
        "text": prompt_text
    }));
    
    // Add reference image if provided
    if let Some(ref_path) = reference_image_path {
        println!("Using reference image: {}", ref_path);
        let ref_bytes = fs::read(&ref_path)
            .map_err(|e| format!("Failed to read reference image: {}", e))?;
        let base64_ref = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &ref_bytes);
        
        content.push(serde_json::json!({
            "type": "image_url",
            "image_url": {
                "url": format!("data:image/png;base64,{}", base64_ref),
                "detail": "high"
            }
        }));
        
        println!("Reference image size: {} bytes", ref_bytes.len());
    }
    
    // Add the frame to analyze
    content.push(serde_json::json!({
        "type": "image_url",
        "image_url": {
            "url": format!("data:image/png;base64,{}", base64_frame),
            "detail": "high"
        }
    }));

    // Call OpenAI Vision API to detect character
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
            "max_tokens": 300,
            "temperature": 0.1
        }))
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

    // Parse the response to extract bounding box
    let content = response_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");

    println!("OpenAI Response for frame {}: {}", frame_index, content);

    // Simple parsing of bounding box coordinates
    // Expected format: "x: 100, y: 50, width: 32, height: 48"
    let bounding_box = parse_bounding_box(content);
    
    println!("Final bounding box: {:?}", bounding_box);

    if let Some(bbox) = bounding_box {
        // Crop the character from the frame
        let cropped_path = crop_character_from_frame(frame_path, &bbox, output_dir, frame_index).await?;

        let character_sprite = CharacterSprite {
            frame_index,
            bounding_box: bbox,
            timestamp: frame_index as f64 * 0.1, // Assuming 10 FPS
            animation_label: None,
            image_path: cropped_path,
        };

        Ok(serde_json::json!({
            "success": true,
            "characterSprite": character_sprite
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "error": "No character detected in frame"
        }))
    }
}

/// Parse bounding box coordinates from OpenAI response
fn parse_bounding_box(content: &str) -> Option<BoundingBox> {
    // Check if response is null
    if content.trim().to_lowercase().contains("null") {
        return None;
    }

    // Try to parse different formats
    let mut x = None;
    let mut y = None;
    let mut width = None;
    let mut height = None;

    // Look for patterns like "x: 100", "x=100", "x 100", etc.
    for line in content.lines() {
        let line = line.trim();
        
        // Try different separators
        if let Some(val) = extract_number_after_pattern(line, "x:") {
            x = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "x=") {
            x = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "x ") {
            x = Some(val);
        }
        
        if let Some(val) = extract_number_after_pattern(line, "y:") {
            y = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "y=") {
            y = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "y ") {
            y = Some(val);
        }
        
        if let Some(val) = extract_number_after_pattern(line, "width:") {
            width = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "width=") {
            width = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "width ") {
            width = Some(val);
        }
        
        if let Some(val) = extract_number_after_pattern(line, "height:") {
            height = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "height=") {
            height = Some(val);
        } else if let Some(val) = extract_number_after_pattern(line, "height ") {
            height = Some(val);
        }
    }

    // Also try to parse from a single line format like "x: 100, y: 50, width: 32, height: 48"
    if x.is_none() || y.is_none() || width.is_none() || height.is_none() {
        let words: Vec<&str> = content.split_whitespace().collect();
        for i in 0..words.len() {
            if words[i].to_lowercase().starts_with("x") && i + 1 < words.len() {
                if let Ok(val) = words[i + 1].trim_matches(',').parse::<i32>() {
                    x = Some(val);
                }
            }
            if words[i].to_lowercase().starts_with("y") && i + 1 < words.len() {
                if let Ok(val) = words[i + 1].trim_matches(',').parse::<i32>() {
                    y = Some(val);
                }
            }
            if words[i].to_lowercase().starts_with("width") && i + 1 < words.len() {
                if let Ok(val) = words[i + 1].trim_matches(',').parse::<i32>() {
                    width = Some(val);
                }
            }
            if words[i].to_lowercase().starts_with("height") && i + 1 < words.len() {
                if let Ok(val) = words[i + 1].trim_matches(',').parse::<i32>() {
                    height = Some(val);
                }
            }
        }
    }

    if let (Some(x), Some(y), Some(width), Some(height)) = (x, y, width, height) {
        // Validate that the bounding box makes sense
        if width > 0 && height > 0 && x >= 0 && y >= 0 {
            Some(BoundingBox { x, y, width, height })
        } else {
            None
        }
    } else {
        None
    }
}

/// Extract number after a specific pattern in a string
fn extract_number_after_pattern(line: &str, pattern: &str) -> Option<i32> {
    if let Some(pattern_pos) = line.to_lowercase().find(&pattern.to_lowercase()) {
        let after_pattern = &line[pattern_pos + pattern.len()..];
        let number_str = after_pattern.trim().split_whitespace().next()?;
        number_str.trim_matches(',').parse().ok()
    } else {
        None
    }
}

/// Extract number after colon in a string
fn extract_number_after_colon(line: &str) -> Option<i32> {
    if let Some(colon_pos) = line.find(':') {
        let after_colon = &line[colon_pos + 1..];
        let number_str = after_colon.trim().split_whitespace().next()?;
        number_str.parse().ok()
    } else {
        None
    }
}

/// Crop character from frame using FFmpeg
async fn crop_character_from_frame(
    frame_path: &str,
    bbox: &BoundingBox,
    output_dir: &str,
    frame_index: usize,
) -> Result<String, String> {
    let output_path = Path::new(output_dir).join(format!("character_{:04}.png", frame_index));
    let output_path_str = output_path.to_string_lossy().to_string();

    let mut ffmpeg_cmd = Command::new("ffmpeg");
    ffmpeg_cmd
        .arg("-i")
        .arg(frame_path)
        .arg("-vf")
        .arg(format!(
            "crop={}:{}:{}:{}",
            bbox.width, bbox.height, bbox.x, bbox.y
        ))
        .arg("-y")
        .arg(&output_path_str);

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to crop character: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg crop error: {}", error_msg));
    }

    Ok(output_path_str)
}

/// Compare two images for similarity
#[command]
pub async fn compare_images(
    image1: &str,
    image2: &str,
    _threshold: f64,
) -> Result<bool, String> {
    // Simple pixel-based comparison using FFmpeg
    let mut ffmpeg_cmd = Command::new("ffmpeg");
    ffmpeg_cmd
        .arg("-i")
        .arg(image1)
        .arg("-i")
        .arg(image2)
        .arg("-lavfi")
        .arg("psnr")
        .arg("-f")
        .arg("null")
        .arg("-");

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to compare images: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Extract PSNR value from FFmpeg output
    if let Some(psnr_line) = stderr.lines().find(|line| line.contains("psnr")) {
        if let Some(psnr_value) = extract_psnr_value(psnr_line) {
            // Convert PSNR to similarity (higher PSNR = more similar)
            // PSNR > 30 is generally considered very similar
            return Ok(psnr_value > 30.0);
        }
    }

    Ok(false)
}

/// Extract PSNR value from FFmpeg output
fn extract_psnr_value(line: &str) -> Option<f64> {
    if let Some(psnr_pos) = line.find("psnr:") {
        let after_psnr = &line[psnr_pos + 5..];
        let value_str = after_psnr.trim().split_whitespace().next()?;
        value_str.parse().ok()
    } else {
        None
    }
}

/// Build character sprite sheet from detected sprites
#[command]
pub async fn build_character_sprite_sheet(
    app: AppHandle,
    sprites: Vec<CharacterSprite>,
    output_dir: &str,
    padding: i32,
) -> Result<SpriteSheetMetadata, String> {
    if sprites.is_empty() {
        return Err("No sprites to assemble".to_string());
    }

    // Calculate sprite sheet dimensions
    let sprite_count = sprites.len();
    let cols = (sprite_count as f64).sqrt().ceil() as i32;
    let rows = (sprite_count as f32 / cols as f32).ceil() as i32;

    // Find the maximum sprite dimensions
    let max_width = sprites.iter().map(|s| s.bounding_box.width).max().unwrap_or(32);
    let max_height = sprites.iter().map(|s| s.bounding_box.height).max().unwrap_or(32);

    let sprite_width = max_width + padding * 2;
    let sprite_height = max_height + padding * 2;
    let _sheet_width = cols * sprite_width;
    let _sheet_height = rows * sprite_height;

    // Create sprite sheet using FFmpeg
    let sprite_sheet_path = Path::new(output_dir).join("character_spritesheet.png");
    let sprite_sheet_str = sprite_sheet_path.to_string_lossy().to_string();

    // Use a simpler approach: create individual sprite sheets and combine them
    // First, let's try a basic hstack approach for all sprites in one row
    let ffmpeg_path = get_ffmpeg_path(&app)?;
    let mut ffmpeg_cmd = Command::new(ffmpeg_path);
    
    // Add all sprite inputs
    for sprite in sprites.iter() {
        ffmpeg_cmd.arg("-i").arg(&sprite.image_path);
    }
    
    // Create a simple horizontal stack of all sprites
    let mut filter_parts = Vec::new();
    for i in 0..sprite_count {
        filter_parts.push(format!("[{}:v]scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:color=black@0[s{}]", 
            i, max_width, max_height, sprite_width, sprite_height, i));
    }
    
    // Create hstack input string
    let mut hstack_inputs = String::new();
    for i in 0..sprite_count {
        hstack_inputs.push_str(&format!("[s{}]", i));
    }
    
    let filter_complex = format!(
        "{};{}hstack=inputs={}",
        filter_parts.join(";"),
        hstack_inputs,
        sprite_count
    );
    
    println!("=== Sprite Sheet Assembly ===");
    println!("Sprite count: {}", sprite_count);
    println!("Sprite dimensions: {}x{} (with padding)", sprite_width, sprite_height);
    println!("FFmpeg filter: {}", filter_complex);
    println!("============================");
    
    ffmpeg_cmd
        .arg("-filter_complex")
        .arg(&filter_complex)
        .arg("-y")
        .arg(&sprite_sheet_str);

    let output = ffmpeg_cmd
        .output()
        .await
        .map_err(|e| format!("Failed to create sprite sheet: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        println!("FFmpeg STDERR: {}", error_msg);
        println!("FFmpeg STDOUT: {}", stdout_msg);
        println!("Filter complex used: {}", filter_complex);
        
        // Extract just the actual error message, not the full version info
        let actual_error = error_msg
            .lines()
            .skip_while(|line| line.contains("version") || line.contains("configuration") || line.contains("lib"))
            .collect::<Vec<_>>()
            .join("\n");
        
        return Err(format!("FFmpeg sprite sheet error: {}", actual_error));
    }
    
    println!("Sprite sheet created successfully at: {}", sprite_sheet_str);

    // Update sprite positions in metadata
    let mut updated_sprites = Vec::new();
    for (i, mut sprite) in sprites.into_iter().enumerate() {
        let row = i as i32 / cols;
        let col = i as i32 % cols;
        sprite.bounding_box.x = col * sprite_width + padding;
        sprite.bounding_box.y = row * sprite_height + padding;
        updated_sprites.push(sprite);
    }

    let metadata = SpriteSheetMetadata {
        sprites: updated_sprites,
        sprite_sheet_path: sprite_sheet_str,
        metadata_path: String::new(), // Will be set later
        total_frames: sprite_count,
        sprite_size: SpriteSize {
            width: sprite_width,
            height: sprite_height,
        },
        padding,
    };

    // Save metadata as JSON
    let metadata_path = Path::new(output_dir).join("character_spritesheet.json");
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    
    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("Failed to save metadata: {}", e))?;

    // Update metadata with the actual metadata path
    let mut final_metadata = metadata;
    final_metadata.metadata_path = metadata_path.to_string_lossy().to_string();

    Ok(final_metadata)
}


/// Copy sprite sheet to user-chosen location
#[command]
pub async fn copy_sprite_sheet_to_location(
    sprite_sheet_path: &str,
    metadata_path: &str,
    target_path: &str,
) -> Result<String, String> {
    use std::path::Path;
    
    println!("=== COPY SPRITE SHEET TO LOCATION ===");
    println!("Source sprite sheet: {}", sprite_sheet_path);
    println!("Source metadata: {}", metadata_path);
    println!("Target path: {}", target_path);
    
    // Check if source files exist
    if !Path::new(sprite_sheet_path).exists() {
        let error = format!("Source sprite sheet does not exist: {}", sprite_sheet_path);
        println!("ERROR: {}", error);
        return Err(error);
    }
    
    if !Path::new(metadata_path).exists() {
        let error = format!("Source metadata does not exist: {}", metadata_path);
        println!("ERROR: {}", error);
        return Err(error);
    }
    
    let target_path = Path::new(target_path);
    println!("Target directory: {:?}", target_path.parent());
    
    // Create metadata path by replacing .png with .json
    let metadata_target = if let Some(stem) = target_path.file_stem() {
        let meta_path = target_path.parent()
            .unwrap_or(Path::new(""))
            .join(format!("{}.json", stem.to_string_lossy()));
        println!("Metadata target: {:?}", meta_path);
        meta_path
    } else {
        let error = "Invalid target path - no file stem found".to_string();
        println!("ERROR: {}", error);
        return Err(error);
    };
    
    // Copy sprite sheet
    println!("Copying sprite sheet...");
    match fs::copy(sprite_sheet_path, target_path) {
        Ok(bytes_copied) => {
            println!("Sprite sheet copied successfully: {} bytes", bytes_copied);
        },
        Err(e) => {
            let error = format!("Failed to copy sprite sheet: {}", e);
            println!("ERROR: {}", error);
            return Err(error);
        }
    }
    
    // Copy metadata
    println!("Copying metadata...");
    match fs::copy(metadata_path, &metadata_target) {
        Ok(bytes_copied) => {
            println!("Metadata copied successfully: {} bytes", bytes_copied);
        },
        Err(e) => {
            let error = format!("Failed to copy metadata: {}", e);
            println!("ERROR: {}", error);
            return Err(error);
        }
    }
    
    let result = target_path.to_string_lossy().to_string();
    println!("Copy operation completed successfully: {}", result);
    Ok(result)
}

/// Copy sprite sheet to desktop and return the path
#[command]
pub async fn copy_sprite_sheet_to_desktop(
    sprite_sheet_path: &str,
    metadata_path: &str,
) -> Result<String, String> {
    
    println!("=== COPY SPRITE SHEET TO DESKTOP ===");
    println!("Source sprite sheet: {}", sprite_sheet_path);
    println!("Source metadata: {}", metadata_path);
    
    // Check if source files exist
    if !std::path::Path::new(sprite_sheet_path).exists() {
        let error = format!("Source sprite sheet does not exist: {}", sprite_sheet_path);
        println!("ERROR: {}", error);
        return Err(error);
    }
    
    if !std::path::Path::new(metadata_path).exists() {
        let error = format!("Source metadata does not exist: {}", metadata_path);
        println!("ERROR: {}", error);
        return Err(error);
    }
    
    // Get desktop path
    let desktop_path = match dirs::home_dir() {
        Some(home) => {
            let desktop = home.join("Desktop");
            println!("Desktop path: {:?}", desktop);
            desktop
        },
        None => {
            let error = "Could not find home directory".to_string();
            println!("ERROR: {}", error);
            return Err(error);
        }
    };
    
    // Create filename with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let sprite_filename = format!("mario_spritesheet_{}.png", timestamp);
    let metadata_filename = format!("mario_spritesheet_{}.json", timestamp);
    
    let desktop_sprite_path = desktop_path.join(&sprite_filename);
    let desktop_metadata_path = desktop_path.join(&metadata_filename);
    
    println!("Target sprite sheet: {:?}", desktop_sprite_path);
    println!("Target metadata: {:?}", desktop_metadata_path);
    
    // Copy sprite sheet
    println!("Copying sprite sheet to desktop...");
    match fs::copy(sprite_sheet_path, &desktop_sprite_path) {
        Ok(bytes_copied) => {
            println!("Sprite sheet copied successfully: {} bytes", bytes_copied);
        },
        Err(e) => {
            let error = format!("Failed to copy sprite sheet: {}", e);
            println!("ERROR: {}", error);
            return Err(error);
        }
    }
    
    // Copy metadata
    println!("Copying metadata to desktop...");
    match fs::copy(metadata_path, &desktop_metadata_path) {
        Ok(bytes_copied) => {
            println!("Metadata copied successfully: {} bytes", bytes_copied);
        },
        Err(e) => {
            let error = format!("Failed to copy metadata: {}", e);
            println!("ERROR: {}", error);
            return Err(error);
        }
    }
    
    let result = desktop_sprite_path.to_string_lossy().to_string();
    println!("Desktop copy operation completed successfully: {}", result);
    Ok(result)
}

/// Remove a directory and all its contents
#[command]
pub async fn remove_directory(path: &str) -> Result<String, String> {
    fs::remove_dir_all(path)
        .map_err(|e| format!("Failed to remove directory: {}", e))?;
    
    Ok(format!("Directory removed: {}", path))
}

// Traditional computer vision approach for character detection
async fn detect_character_traditional(frame_path: &str, frame_index: usize) -> Result<Option<BoundingBox>, String> {
    println!("Attempting traditional detection for frame {}", frame_index);
    
    // Load the image
    let img = image::open(frame_path)
        .map_err(|e| format!("Failed to open image: {}", e))?;
    
    let rgb_img = img.to_rgb8();
    let (width, height) = rgb_img.dimensions();
    
    println!("Image dimensions: {}x{}", width, height);
    
    // Much more efficient approach: scan with larger steps and focus on likely areas
    let mut best_region: Option<BoundingBox> = None;
    let mut best_score = 0.0;
    
    // Scan with larger steps to avoid hanging
    let step_size = 8; // Check every 8 pixels instead of every pixel
    let min_size = 16;
    let max_size = 48;
    
    for y in (0..height.saturating_sub(min_size)).step_by(step_size) {
        for x in (0..width.saturating_sub(min_size)).step_by(step_size) {
            // Try a few common character sizes
            for size in [16, 24, 32, 40, 48] {
                if x + size > width || y + size > height {
                    continue;
                }
                
                let score = analyze_region_fast(&rgb_img, x, y, size, size);
                if score > best_score && score > 0.2 { // Lower threshold for faster detection
                    best_score = score;
                    best_region = Some(BoundingBox {
                        x: x as i32,
                        y: y as i32,
                        width: size as i32,
                        height: size as i32,
                    });
                }
            }
        }
    }
    
    if let Some(region) = best_region {
        println!("Traditional detection found region: {:?} with score: {}", region, best_score);
    } else {
        println!("Traditional detection found no suitable regions");
    }
    
    Ok(best_region)
}

fn analyze_region_fast(img: &RgbImage, x: u32, y: u32, w: u32, h: u32) -> f64 {
    let mut color_count = std::collections::HashSet::new();
    let mut total_pixels = 0;
    let mut non_sky_pixels = 0;
    
    // Sample pixels more sparsely for speed
    let sample_step = 2; // Check every 2nd pixel instead of every pixel
    
    for py in (y..y+h).step_by(sample_step) {
        for px in (x..x+w).step_by(sample_step) {
            if let Some(pixel) = img.get_pixel_checked(px, py) {
                total_pixels += 1;
                let rgb = [pixel[0], pixel[1], pixel[2]];
                color_count.insert(rgb);
                
                // Check if it's not sky blue (common background color)
                if !is_sky_color(pixel[0], pixel[1], pixel[2]) {
                    non_sky_pixels += 1;
                }
            }
        }
    }
    
    if total_pixels == 0 {
        return 0.0;
    }
    
    let color_diversity = color_count.len() as f64 / total_pixels as f64;
    let non_sky_ratio = non_sky_pixels as f64 / total_pixels as f64;
    
    // Score based on color diversity and non-sky content
    color_diversity * non_sky_ratio
}

fn analyze_region(img: &RgbImage, x: u32, y: u32, w: u32, h: u32) -> f64 {
    let mut color_count = std::collections::HashSet::new();
    let mut total_pixels = 0;
    let mut non_sky_pixels = 0;
    
    // Sample pixels in the region
    for py in y..y+h {
        for px in x..x+w {
            if let Some(pixel) = img.get_pixel_checked(px, py) {
                total_pixels += 1;
                let rgb = [pixel[0], pixel[1], pixel[2]];
                color_count.insert(rgb);
                
                // Check if it's not sky blue (common background color)
                if !is_sky_color(pixel[0], pixel[1], pixel[2]) {
                    non_sky_pixels += 1;
                }
            }
        }
    }
    
    if total_pixels == 0 {
        return 0.0;
    }
    
    let color_diversity = color_count.len() as f64 / total_pixels as f64;
    let non_sky_ratio = non_sky_pixels as f64 / total_pixels as f64;
    
    // Score based on color diversity and non-sky content
    color_diversity * non_sky_ratio
}

fn is_sky_color(r: u8, g: u8, b: u8) -> bool {
    // Check if color is sky blue (common in retro game backgrounds)
    r < 100 && g > 150 && b > 200
}
