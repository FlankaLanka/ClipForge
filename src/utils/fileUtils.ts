// File utility functions

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/ogg'
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
  '.ogv'
];

export function isValidVideoFile(file: File): boolean {
  return SUPPORTED_VIDEO_FORMATS.includes(file.type) ||
         SUPPORTED_VIDEO_EXTENSIONS.some(ext => 
           file.name.toLowerCase().endsWith(ext)
         );
}

export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

export function formatFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;
  
  const extension = getFileExtension(filename);
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));
  const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 4);
  
  return `${truncatedName}...${extension}`;
}
