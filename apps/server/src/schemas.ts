import { Schema } from 'mongoose';

const opts = { timestamps: true, versionKey: false } as const;
export const UserSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true }, name: { type: String, required: true }, passwordHash: { type: String, required: true }, role: { type: String, enum: ['user', 'admin'], default: 'user' } }, opts);
export const DocumentSchema = new Schema({ fileName: { type: String, required: true }, vehicleModel: { type: String, required: true, index: true }, storageKey: { type: Schema.Types.ObjectId, required: true }, uploadedBy: { type: Schema.Types.ObjectId, required: true, index: true }, processingStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed'], default: 'Pending', index: true }, totalPages: { type: Number, default: 0 }, totalChunks: { type: Number, default: 0 }, errorMessage: { type: String, default: '' }, processedAt: Date }, opts);
export const ChunkSchema = new Schema({ documentId: { type: Schema.Types.ObjectId, required: true, index: true }, userId: { type: Schema.Types.ObjectId, required: true, index: true }, vehicleModel: { type: String, required: true, index: true }, variantName: { type: String, default: '' }, content: { type: String, required: true }, embedding: { type: [Number], required: true }, pageNumber: { type: Number, required: true }, section: { type: String, default: 'General' }, metadata: { type: Schema.Types.Mixed, default: {} } }, opts);
export const ConversationSchema = new Schema({ userId: { type: Schema.Types.ObjectId, required: true, index: true }, title: { type: String, required: true } }, opts);
export const MessageSchema = new Schema({ conversationId: { type: Schema.Types.ObjectId, required: true, index: true }, userId: { type: Schema.Types.ObjectId, required: true, index: true }, role: { type: String, enum: ['user', 'assistant'], required: true }, content: { type: String, required: true }, sources: { type: [Schema.Types.Mixed], default: [] } }, opts);
export const ProcessingLogSchema = new Schema({ documentId: { type: Schema.Types.ObjectId, required: true, index: true }, status: { type: String, required: true }, message: { type: String, required: true } }, opts);
ConversationSchema.index({ userId: 1, updatedAt: -1 });
DocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
ChunkSchema.index({ userId: 1, documentId: 1 });
