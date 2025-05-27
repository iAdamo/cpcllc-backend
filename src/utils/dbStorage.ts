import { Injectable } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class DbStorageService {
  private readonly baseStoragePath = join(__dirname, '..', '..', 'uploads');
  private readonly baseUrl = `${process.env.BASE_URL}/uploads`;

  constructor() {}

  async saveFile(folder: string, file: Express.Multer.File): Promise<string> {
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
}
