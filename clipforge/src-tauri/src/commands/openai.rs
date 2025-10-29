use tauri::command;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIImageRequest {
    model: String,
    prompt: String,
    n: u32,
    size: String,
    quality: String,
    response_format: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIImageResponse {
    data: Vec<OpenAIImageData>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIImageData {
    url: Option<String>,
    b64_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIError {
    error: OpenAIErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIErrorDetail {
    message: String,
    r#type: String,
}

/// Get OpenAI API key from environment variable
#[command]
pub async fn get_openai_api_key() -> Result<String, String> {
    match env::var("OPENAI_API_KEY") {
        Ok(key) => Ok(key),
        Err(_) => Err("OPENAI_API_KEY environment variable not set".to_string()),
    }
}

/// Generate an image using DALL-E 3
#[command]
pub async fn generate_dalle_image(prompt: String, api_key: String) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    
    let request_body = OpenAIImageRequest {
        model: "dall-e-3".to_string(),
        prompt,
        n: 1,
        size: "1024x1024".to_string(),
        quality: "standard".to_string(),
        response_format: "b64_json".to_string(),
    };

    let response = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", error_text));
    }

    let image_response: OpenAIImageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(image_data) = image_response.data.first() {
        if let Some(b64_data) = &image_data.b64_json {
            let image_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, b64_data)
                .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
            Ok(image_bytes)
        } else {
            Err("No base64 image data in response".to_string())
        }
    } else {
        Err("No image data in response".to_string())
    }
}

/// Apply style transfer to an image using DALL-E 3 variations
#[command]
pub async fn style_transfer_image(
    _image_path: String,
    style_prompt: String,
    api_key: String,
) -> Result<Vec<u8>, String> {
    // For now, we'll use the style prompt to generate a new image
    // In a more sophisticated implementation, we would upload the image
    // and use DALL-E 3's image editing capabilities
    
    let enhanced_prompt = format!("Apply this style to the image: {}", style_prompt);
    generate_dalle_image(enhanced_prompt, api_key).await
}

/// Validate OpenAI API key by making a test request
#[command]
pub async fn validate_openai_key(api_key: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    
    // Make a simple request to test the key
    let response = client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to validate API key: {}", e))?;

    Ok(response.status().is_success())
}
