mod commands;

use commands::{
    ffmpeg::{get_video_metadata, trim_video, export_timeline, convert_mov_to_mp4},
    filesystem::{import_video, save_video, import_video_from_file, get_video_url, read_file_bytes},
    recording::{
        get_available_monitors, add_capture_source, update_capture_source_position,
        remove_capture_source, get_capture_sources, start_screen_recording, 
        start_webcam_recording, stop_recording, pause_recording, resume_recording, 
        get_recording_status
    },
    openai::{get_openai_api_key, generate_dalle_image, style_transfer_image, validate_openai_key},
    text_to_video::{generate_text_to_video, generate_text_overlay_video},
    style_generator::{apply_style_to_video, get_available_ffmpeg_styles, get_available_ai_styles},
    video_upscaler::{upscale_video, get_available_upscale_models, get_video_enhancement_options},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_video_metadata,
            trim_video,
            export_timeline,
            convert_mov_to_mp4,
            import_video,
            save_video,
            import_video_from_file,
            get_video_url,
            read_file_bytes,
            get_available_monitors,
            add_capture_source,
            update_capture_source_position,
            remove_capture_source,
            get_capture_sources,
            start_screen_recording,
            start_webcam_recording,
            stop_recording,
            pause_recording,
            resume_recording,
            get_recording_status,
            get_openai_api_key,
            generate_dalle_image,
            style_transfer_image,
            validate_openai_key,
            generate_text_to_video,
            generate_text_overlay_video,
            apply_style_to_video,
            get_available_ffmpeg_styles,
            get_available_ai_styles,
            upscale_video,
            get_available_upscale_models,
            get_video_enhancement_options,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
