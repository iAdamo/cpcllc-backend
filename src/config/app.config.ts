import { AppConfig } from '@types';

export default (): AppConfig => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  app: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpirationTime: process.env.JWT_EXPIRATION_TIME,
  },
  environment: process.env.NODE_ENV || 'development',
  database: {
    uri: process.env.MONGO_URI,
  },
  redis: {
    uri: process.env.REDIS_URL,
  },
  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3' | 'gcs') || 'local',
    local: {
      baseUrl: process.env.STORAGE_BASE_URL,
      baseStoragePath: process.env.STORAGE_PATH || 'uploads',
    },
    s3: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION,
      bucketName: process.env.S3_BUCKET_NAME,
      baseUrl: process.env.S3_BASE_URL,
    },
    gcs: {
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILENAME,
      bucketName: process.env.GCS_BUCKET_NAME,
      baseUrl: process.env.GCS_BASE_URL,
    },
  },
});
