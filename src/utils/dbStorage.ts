import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as fs from 'fs';

export class DbStorageService {
  private readonly baseStoragePath = join(__dirname, '..', '..', 'uploads');
  private readonly baseUrl = `${process.env.BASE_URL}/uploads`;

  constructor() {}

  private async saveFile(folder: string, file: Express.Multer.File): Promise<string> {
    // Replace spaces with underscores in the folder name
    const sanitizedFolder = folder.replace(/\s+/g, '_');

    // Sanitize the filename by replacing spaces and special characters with underscores
    const sanitizedFilename = file.originalname.replace(
      /[^a-zA-Z0-9.\-_]/g,
      '_',
    );

    const { buffer } = file;
    const storagePath = join(this.baseStoragePath, sanitizedFolder);
    await mkdir(storagePath, { recursive: true });

    const filePath = join(storagePath, sanitizedFilename);
    await writeFile(filePath, buffer);

    return `${this.baseUrl}/${sanitizedFolder}/${sanitizedFilename}`;
  }

  async deleteUserFiles(
    userId: string): Promise<void> {
      if (process.env.STORAGETYPE === "local") {
        const userFolder = join(this.baseStoragePath, userId);
        if (fs.existsSync(userFolder)) {
          fs.rmSync(userFolder, { recursive: true, force: true });
        } else {
          console.warn(`User folder ${userFolder} does not exist.`);
        }
      }
  }

  /**
   * Handles file upload and returns an array of media entries with URLs.
   * @param identifier Unique identifier for the user or company
   * @param files Files to be uploaded
   * @returns Array of media entries with URLs
   */
  async handleFileUpload(
    identifier: string,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<{ url: string; index: number }[]> {
    const fileArray = Array.isArray(files) ? files : [files]; // Ensure files is always an array

    return Promise.all(
      fileArray.map(async (file, index) => ({
        url:
          process.env.STORAGETYPE === 'local'
            ? await this.saveFile(identifier, file)
            : 'cloud-storage-url-placeholder', // Implement cloud storage logic
        index,
      })),
    );
  }
}
