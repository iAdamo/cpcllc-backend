import { DatabaseConfig } from '@types';

export default (): DatabaseConfig => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  app: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpirationTime: process.env.JWT_EXPIRATION_TIME,
  },
  database: {
    uri: process.env.MONGO_URI,
  },
  redis: {
    uri: process.env.REDIS_URL,
  },

});
