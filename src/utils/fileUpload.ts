import { DbStorageService } from "./dbStorage";

export async function handleFileUpload(
  identifier: string,
  files: Express.Multer.File | Express.Multer.File[],
): Promise<{ url: string; index: number }[]> {
  const fileArray = Array.isArray(files) ? files : [files]; // Ensure files is always an array

  return Promise.all(
    fileArray.map(async (file, index) => ({
      url:
        process.env.STORAGETYPE === 'local'
          ? await new DbStorageService().saveFile(identifier, file)
          : 'cloud-storage-url-placeholder', // Implement cloud storage logic
      index,
    })),
  );
}
