import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { logger } from './common/middleware/logger.middleware';
// import { RedisSocketAdapter } from '@modules/socket.adapter';

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
    .addTag('companiescenterllc')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

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

  // WebSocket adapter for Redis (scaling)
  // const redisAdapter = new RedisSocketAdapter(
  //   app,
  //   // These would be injected Redis instances
  //   // In a real implementation, you'd get these from a Redis service
  // );

  //   await redisAdapter.connectToRedis();
  //   app.useWebSocketAdapter(redisAdapter);

  // CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN
        : 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
