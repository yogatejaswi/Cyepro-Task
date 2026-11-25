import { Module, OnApplicationBootstrap, Injectable } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthController, AuthGuard } from './auth';
import { DocumentsController, DocumentsService } from './documents';
import { ChatController, RagService, VehiclesController } from './chat';
import { ChunkSchema, ConversationSchema, DocumentSchema, MessageSchema, ProcessingLogSchema, UserSchema } from './schemas';
import { EmbeddingsService } from './embeddings';
import { HealthController } from './health';

@Injectable()
class RecoverIngestion implements OnApplicationBootstrap {
  constructor(private docs: DocumentsService) {}
  async onApplicationBootstrap() { await this.docs.recover(); }
}

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/hyundai_assistant'),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema, collection: 'users' }, { name: 'Document', schema: DocumentSchema, collection: 'documents' }, { name: 'Chunk', schema: ChunkSchema, collection: 'document_chunks' }, { name: 'Conversation', schema: ConversationSchema, collection: 'conversations' }, { name: 'Message', schema: MessageSchema, collection: 'messages' }, { name: 'ProcessingLog', schema: ProcessingLogSchema, collection: 'processing_logs' }]),
    JwtModule.register({ secret: process.env.JWT_SECRET || 'development-only-change-this-secret-now', signOptions: { expiresIn: '8h' } }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])
  ],
  controllers: [HealthController, AuthController, DocumentsController, ChatController, VehiclesController],
  providers: [AuthGuard, DocumentsService, RagService, EmbeddingsService, RecoverIngestion, { provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
