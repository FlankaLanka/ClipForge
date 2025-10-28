mod commands;

use commands::{
    ffmpeg::{get_video_metadata, trim_video, export_timeline, convert_mov_to_mp4},
    filesystem::{import_video, save_video, import_video_from_file, get_video_url},
    recording::{
        get_available_monitors, add_capture_source, update_capture_source_position,
        remove_capture_source, get_capture_sources, start_screen_recording, 
        start_webcam_recording, stop_recording, pause_recording, resume_recording, 
        get_recording_status
    },
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
