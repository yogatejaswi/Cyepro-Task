import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && (!process.env.MONGODB_URI || !process.env.OPENAI_API_KEY || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.FRONTEND_URL)) throw new Error('Missing required production configuration');
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.use(helmet());
  app.enableCors({ origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(x => x.trim()), credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
  Logger.log(`API listening on ${process.env.PORT || 4000}`, 'Bootstrap');
}
bootstrap();
