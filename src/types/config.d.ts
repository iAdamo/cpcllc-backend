export interface DatabaseConfig {
  port: number;
  app: {
    jwtSecret: string;
    jwtExpirationTime: string;
  };
  database: {
    uri: string;
  };
}
