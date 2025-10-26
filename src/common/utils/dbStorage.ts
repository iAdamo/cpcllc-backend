import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, mkdir, stat, rm } from 'fs/promises';
import { join, dirname, relative, isAbsolute } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child-process-promise'; // Fixed import
import { promisify } from 'util';
// import ffmpegPath from 'ffmpeg-static';
import { AppConfig } from '@types';

const execAsync = promisify(exec);

interface SavedFile {
  url: string;
  path: string;
}

interface MediaResult {
  type: 'image' | 'video' | 'file';
  url: string;
  thumbnail?: string | null;
  index: number;
}

// Add type guards for better type safety
interface LocalStorageConfig {
  baseUrl: string;
  baseStoragePath: string;
}

interface S3StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  baseUrl: string;
}

interface GCSStorageConfig {
  projectId: string;
  keyFilename: string;
  bucketName: string;
  baseUrl: string;
}

// Type guards
const isLocalStorageConfig = (config: any): config is LocalStorageConfig =>
  config && 'baseStoragePath' in config;

const isS3StorageConfig = (config: any): config is S3StorageConfig =>
  config && 'accessKeyId' in config;

const isGCSStorageConfig = (config: any): config is GCSStorageConfig =>
  config && 'projectId' in config;

@Injectable()
export class DbStorageService {
  private readonly logger = new Logger(DbStorageService.name);
  private readonly config: AppConfig['storage'];
  private readonly ffmpegPath = require('ffmpeg-static');

  constructor(private configService: ConfigService<AppConfig>) {
    this.config = this.initConfig();
    this.validateFfmpeg();
  }

  private initConfig(): AppConfig['storage'] {
    const storageConfig =
      this.configService.get<AppConfig['storage']>('storage')!;

    // Ensure local storage has proper paths
    if (storageConfig.type === 'local' && storageConfig.local) {
      const baseStoragePath = storageConfig.local.baseStoragePath || 'uploads';

      // Convert relative path to absolute if needed
      storageConfig.local.baseStoragePath = isAbsolute(baseStoragePath)
        ? baseStoragePath
        : join(process.cwd(), baseStoragePath);
      // Ensure baseUrl ends with /uploads for consistency
      if (!storageConfig.local.baseUrl?.includes('/uploads')) {
        storageConfig.local.baseUrl = `${storageConfig.local.baseUrl || 'http://localhost:3333'}/uploads`;
      }
    }

    return storageConfig;
  }

  private validateFfmpeg(): void {
    if (!this.ffmpegPath) {
      this.logger.warn(
        'ffmpeg-static not found. Video thumbnail generation will be disabled.',
      );
    } else {
      this.logger.log(`FFmpeg found at: ${this.ffmpegPath}`);
    }
  }

  // Fixed: Return the specific config type with proper type checking
  private getStorageConfig(): LocalStorageConfig {
    const storageType = this.config.type;
    const config = this.config[storageType];

    if (!config) {
      throw new InternalServerErrorException(
        `Storage configuration for ${storageType} is missing`,
      );
    }

    // Type assertion with runtime checking
    if (storageType === 'local' && isLocalStorageConfig(config)) {
      return config;
    }

    throw new InternalServerErrorException(
      `Unsupported storage type or invalid configuration: ${storageType}`,
    );
  }

  // Helper method to get base URL for any storage type
  private getBaseUrl(): string {
    const storageType = this.config.type;
    const config = this.config[storageType];

    if (!config) {
      throw new InternalServerErrorException(
        `Storage configuration for ${storageType} is missing`,
      );
    }

    // All storage configs have baseUrl
    return config.baseUrl;
  }

  private sanitizeName(name: string): string {
    return (
      name
        .normalize('NFKD')
        // NOTE: this is for single-name sanitization (filenames, simple folder parts)
        .replace(/[^\w.\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 255)
    );
  }

  /**
   * Split a folder path into sanitized segments while preserving '@' in emails
   * and retaining path structure. Prevents directory traversal and absolute
   * paths. Example: "tundey520@gmail.com/profile_picture" ->
   * ["tundey520@gmail.com","profile_picture"]
   */
  private sanitizePathSegments(folder: string): string[] {
    if (!folder || typeof folder !== 'string') {
      throw new BadRequestException('Invalid folder path');
    }

    // Normalize separators to forward slash and collapse duplicates
    const normalized = folder.replace(/\\+/g, '/').replace(/\/+/g, '/');

    const rawSegments = normalized.split('/').filter(Boolean);
    if (rawSegments.length === 0) {
      throw new BadRequestException('Invalid folder path');
    }

    const segments = rawSegments.map((seg) => {
      // Disallow traversal
      if (seg === '..' || seg === '.') {
        throw new BadRequestException('Invalid folder segment');
      }

      // Allow alphanumerics, dot, hyphen, underscore and @ (for emails)
      const cleaned = seg
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9@._\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 255);

      if (!cleaned) {
        throw new BadRequestException(
          'Invalid folder segment after sanitization',
        );
      }

      return cleaned;
    });

    return segments;
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      await mkdir(path, { recursive: true });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw new InternalServerErrorException(
          `Failed to create directory: ${error.message}`,
        );
      }
    }
  }

  private async saveFile(
    folder: string,
    file: Express.Multer.File,
  ): Promise<SavedFile> {
    // Only allow local storage for file operations
    if (this.config.type !== 'local') {
      throw new InternalServerErrorException(
        'Only local storage is currently supported for file operations',
      );
    }

    const storageConfig = this.getStorageConfig(); // Now returns LocalStorageConfig

    const segments = this.sanitizePathSegments(folder);
    const sanitizedFilename = this.sanitizeName(file.originalname);
    const storagePath = join(storageConfig.baseStoragePath, ...segments);

    await this.ensureDirectoryExists(storagePath);

    const filePath = join(storagePath, sanitizedFilename);
    await writeFile(filePath, file.buffer);

    // Verify file was written
    try {
      await stat(filePath);
    } catch (error) {
      throw new InternalServerErrorException('Failed to verify file was saved');
    }

    return {
      url: `${storageConfig.baseUrl}/${segments.join('/')}/${sanitizedFilename}`,
      path: filePath,
    };
  }

  async generateImageThumbnail(
    folder: string,
    file: Express.Multer.File,
  ): Promise<string | null> {
    try {
      if (!file.mimetype.startsWith('image/')) {
        throw new Error('File is not an image');
      }

      // Only generate thumbnails for local storage
      if (this.config.type !== 'local') {
        this.logger.warn(
          'Thumbnail generation only supported for local storage',
        );
        return null;
      }

      const storageConfig = this.getStorageConfig();
      // Use the same sanitized folder name as saveFile so originals and
      // thumbnails land in the same directory. This prevents mismatches like
      // `tundey520_gmail.com_profile_picture` vs `tundey520@gmail.com/profile_picture`.
      const segments = this.sanitizePathSegments(folder);
      const storagePath = join(storageConfig.baseStoragePath, ...segments);
      await this.ensureDirectoryExists(storagePath);

      const baseName = this.sanitizeName(
        file.originalname.replace(/\.[^/.]+$/, ''),
      );
      const thumbName = `${baseName}_thumb.jpg`;
      const thumbPath = join(storagePath, thumbName);

      let sharpLib: any;
      try {
        sharpLib = require('sharp');
      } catch (e) {
        this.logger.warn('Sharp not installed, skipping thumbnail generation');
        return null;
      }

      await sharpLib(file.buffer)
        .resize(300, 300, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 80,
          mozjpeg: true,
        })
        .toFile(thumbPath);

      this.logger.log(`Image thumbnail generated: ${thumbPath}`);
      // Use sanitized folder in the public URL as well for consistency.
      return `${storageConfig.baseUrl}/${segments.join('/')}/${thumbName}`;
    } catch (err: any) {
      this.logger.warn(`Image thumbnail generation failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Generate video thumbnail using ffmpeg-static with proper error handling
   */
  async generateVideoThumbnail(savedFilePath: string): Promise<string | null> {
    if (!this.ffmpegPath) {
      this.logger.warn(
        'FFmpeg not available, skipping video thumbnail generation',
      );
      return null;
    }

    try {
      // Verify source file exists
      if (!existsSync(savedFilePath)) {
        throw new Error(`Source video file not found: ${savedFilePath}`);
      }

      // Only generate thumbnails for local storage
      if (this.config.type !== 'local') {
        this.logger.warn(
          'Video thumbnail generation only supported for local storage',
        );
        return null;
      }

      const storageConfig = this.getStorageConfig();
      const dir = dirname(savedFilePath);
      const base = savedFilePath.split(/[\\/]/).pop() || 'video';
      const baseName = base.replace(/\.[^.]+$/, '');
      const thumbName = `${baseName}_thumb.jpg`;
      const thumbPath = join(dir, thumbName);

      // Build ffmpeg command with proper escaping and error handling
      const command = [
        `"${this.ffmpegPath}"`,
        '-y', // Overwrite output file without asking
        '-ss',
        '00:00:01', // Seek to 1 second
        '-i',
        `"${savedFilePath}"`,
        '-frames:v',
        '1', // Capture exactly 1 frame
        '-q:v',
        '2', // Quality level (2-31, lower is better)
        '-vf',
        'scale=300:300:force_original_aspect_ratio=decrease:flags=lanczos', // Better scaling
        `"${thumbPath}"`,
      ].join(' ');

      this.logger.debug(`Executing FFmpeg command: ${command}`);

      try {
        await execAsync(command, { timeout: 30000 }); // 30 second timeout

        // Verify thumbnail was created
        if (!existsSync(thumbPath)) {
          throw new Error('Thumbnail file was not created');
        }

        const stats = await stat(thumbPath);
        if (stats.size === 0) {
          throw new Error('Thumbnail file is empty');
        }
      } catch (execError: any) {
        // Clean up potentially corrupted thumbnail
        if (existsSync(thumbPath)) {
          await rm(thumbPath, { force: true });
        }
        throw new Error(`FFmpeg execution failed: ${execError.message}`);
      }

      // Build public URL
      const relDir = relative(storageConfig.baseStoragePath, dir)
        .split(/\\|\//)
        .filter(Boolean)
        .join('/');
      const urlPath = relDir ? `${relDir}/${thumbName}` : thumbName;

      this.logger.log(`Video thumbnail generated: ${thumbPath}`);
      return `${storageConfig.baseUrl}/${urlPath}`;
    } catch (err: any) {
      this.logger.error(`Video thumbnail generation failed: ${err.message}`);
      return null;
    }
  }

  async handleFileUpload(
    identifier: string,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<MediaResult[]> {
    const fileArray = Array.isArray(files) ? files : [files];

    if (fileArray.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const results = await Promise.all(
      fileArray.map(async (file, index) => {
        try {
          const mime = file.mimetype || '';
          const kind = (
            mime.startsWith('image/')
              ? 'image'
              : mime.startsWith('video/')
                ? 'video'
                : 'file'
          ) as MediaResult['type'];

          let url: string;
          let savedPath: string | undefined;

          if (this.config.type === 'local') {
            const saved = await this.saveFile(identifier, file);
            url = saved.url;
            savedPath = saved.path;
          } else {
            // For cloud storage, use the appropriate base URL and sanitize segments
            const baseUrl = this.getBaseUrl();
            const cloudSegments = this.sanitizePathSegments(identifier);
            url = `${baseUrl}/${cloudSegments.join('/')}/${this.sanitizeName(file.originalname)}`;
            this.logger.warn(
              `Cloud storage for ${this.config.type} using placeholder URL`,
            );
          }

          let thumbnail: string | null = null;

          if (kind === 'image') {
            thumbnail = await this.generateImageThumbnail(identifier, file);
          } else if (kind === 'video' && savedPath) {
            thumbnail = await this.generateVideoThumbnail(savedPath);
          }

          return {
            type: kind,
            url,
            thumbnail,
            index,
          };
        } catch (error: any) {
          this.logger.error(
            `Failed to process file ${file.originalname}: ${error.message}`,
          );
          throw error;
        }
      }),
    );

    return results;
  }

  async deleteUserFiles(userId: string): Promise<void> {
    if (this.config.type !== 'local') {
      this.logger.warn('File deletion only supported for local storage');
      return;
    }

    const storageConfig = this.getStorageConfig();
    // Allow userId to include nested folders like "user@example.com/profile_picture"
    const userSegments = this.sanitizePathSegments(userId);
    const userFolder = join(storageConfig.baseStoragePath, ...userSegments);

    if (!existsSync(userFolder)) {
      this.logger.warn(`User folder ${userFolder} does not exist`);
      return;
    }

    try {
      await rm(userFolder, { recursive: true, force: true });
      this.logger.log(`Successfully deleted user folder: ${userFolder}`);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to delete user files: ${error.message}`,
      );
    }
  }

  async handleFileUploads(
    userId: string,
    files?: Record<string, Express.Multer.File[]>,
  ): Promise<Record<string, any | any[] | null>> {
    if (!files || Object.keys(files).length === 0) {
      return {};
    }

    // Filter out empty file arrays
    const validFiles = Object.entries(files).reduce(
      (acc, [key, fileList]) => {
        if (fileList?.length > 0) {
          acc[key] = fileList;
        }
        return acc;
      },
      {} as Record<string, Express.Multer.File[]>,
    );

    if (Object.keys(validFiles).length === 0) {
      return {};
    }

    const result: Record<string, any | any[] | null> = {};

    for (const [fieldName, fileList] of Object.entries(validFiles)) {
      try {
        if (fileList.length === 1) {
          const [uploaded] = await this.handleFileUpload(userId, fileList[0]);
          result[fieldName] = uploaded || null;
        } else {
          const uploadedFiles = await this.handleFileUpload(userId, fileList);
          result[fieldName] = uploadedFiles;
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to upload files for field ${fieldName}: ${error.message}`,
        );
        result[fieldName] = null;
      }
    }

    return result;
  }

  /**
   * Utility to check if ffmpeg is available
   */
  isFfmpegAvailable(): boolean {
    return !!this.ffmpegPath;
  }

  /**
   * Get current storage configuration
   */
  getStorageType(): string {
    return this.config.type;
  }
}
