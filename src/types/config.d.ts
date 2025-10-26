export interface AppConfig {
  port: number;
  app: {
    jwtSecret: string;
    jwtExpirationTime: string;
  };
  environment: string;
  database: {
    uri: string;
  };
  redis: {
    uri: string;
  };
  storage: {
    type: 'local' | 's3' | 'gcs';
    local?: LocalStorageConfig;
    s3?: S3StorageConfig;
    gcs?: GcsStorageConfig;
  };
}

export interface LocalStorageConfig {
  baseUrl: string;
  baseStoragePath: string;
}

export interface S3StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  baseUrl: string;
}

export interface GcsStorageConfig {
  projectId: string;
  keyFilename: string;
  bucketName: string;
  baseUrl: string;
}
