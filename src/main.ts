import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Use cookie-parser middleware
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
