// FFmpeg utility functions for the frontend
// These would typically call Tauri commands, but for now they're placeholders

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  file_size: number;
  format: string;
}

export interface TrimParams {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
}

export interface ExportParams {
  clips: Array<{
    filePath: string;
    startTime: number;
    endTime: number;
  }>;
  outputPath: string;
  resolution: '720p' | '1080p' | 'source';
}

export class FFmpegUtils {
  static async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    // This would call the Tauri command
    // For now, return mock data
    return {
      duration: 30.5,
      width: 1920,
      height: 1080,
      fps: 30,
      file_size: 1024000,
      format: 'mp4'
    };
  }

  static async trimVideo(params: TrimParams): Promise<string> {
    // This would call the Tauri command
    console.log('Trimming video:', params);
    return params.outputPath;
  }

  static async exportTimeline(params: ExportParams): Promise<string> {
    // This would call the Tauri command
    console.log('Exporting timeline:', params);
    return params.outputPath;
  }

  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
}
