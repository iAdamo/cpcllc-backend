import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { logger } from './common/middleware/logger.middleware';
import { RedisSocketAdapter } from '@modules/socket.adapter';
import { Redis } from 'ioredis';
import { Model } from 'mongoose';
import { Terms } from '@users/schemas/terms.schema';
import { seedTerms } from './scripts/terms';
import { getModelToken } from '@nestjs/mongoose';
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable Versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('CPCLLC API')
    .setDescription('CPCLLC API Description')
    .setVersion('1.0')
    .addTag('companiescenter')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // WebSocket adapter for Redis (scaling)
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
  };

  const redisPub = new Redis(redisConfig);
  const redisSub = new Redis(redisConfig);

  // Attach the adapter
  const redisAdapter = new RedisSocketAdapter(app, redisPub, redisSub);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Use cookie-parser middleware
  app.use(cookieParser());
  app.use(logger);

  // CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN
        : 'http://localhost:3000',
    credentials: true,
  });


  // const termsModel = app.get<Model<Terms>>(getModelToken(Terms.name));

  // await seedTerms(termsModel);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
