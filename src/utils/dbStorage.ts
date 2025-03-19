import { Injectable } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class DbStorageService {
  private readonly baseStoragePath = join(
    __dirname,
    '..',
    '..',
    'uploads',
  );
  private readonly baseUrl = `${process.env.BASE_URL}/uploads`;

  constructor() {}

  async saveFile(email: string, file: Express.Multer.File): Promise<string> {
    const { buffer, originalname } = file;
    const storagePath = join(this.baseStoragePath, email);
    await mkdir(storagePath, { recursive: true });

    const filePath = join(storagePath, originalname);
    await writeFile(filePath, buffer);

    return `${this.baseUrl}/${email}/${originalname}`;
  }
}
