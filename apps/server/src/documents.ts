import { BadRequestException, Controller, Delete, Get, Injectable, Logger, NotFoundException, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Connection, Model } from 'mongoose';
import { Response } from 'express';
import { AuthGuard, ReqUser, AuthRequest } from './auth';
import { chunkPages, extractPdf, inferModel } from './pdf';
import { UpdateDocumentDto } from './dto';
import { EmbeddingsService } from './embeddings';

function oid(id: string) { if (!/^[a-f\d]{24}$/i.test(id)) throw new BadRequestException('Invalid document ID'); return new ObjectId(id); }

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private processingTail: Promise<void> = Promise.resolve();
  constructor(@InjectModel('Document') private docs: Model<any>, @InjectModel('Chunk') private chunks: Model<any>, @InjectModel('ProcessingLog') private logs: Model<any>, @InjectConnection() private conn: Connection, private embeddings: EmbeddingsService) {}
  private enqueue(id: string) {
    this.processingTail = this.processingTail.then(() => this.process(id)).catch(err => this.logger.error(`Processing ${id}: ${String(err)}`));
  }
  private bucket() { if (!this.conn.db) throw new Error('Database unavailable'); return new GridFSBucket(this.conn.db, { bucketName: 'brochures' }); }
  async list(userId: string) { return this.docs.find({ uploadedBy: oid(userId) }).select('-storageKey').sort({ createdAt: -1 }).lean(); }
  async one(userId: string, id: string) { const doc = await this.docs.findOne({ _id: oid(id), uploadedBy: oid(userId) }).select('-storageKey').lean(); if (!doc) throw new NotFoundException('Document not found'); return doc; }
  async upload(userId: string, file: Express.Multer.File, requestedModel?: string) {
    if (!file?.buffer || file.size < 100 || file.size > 15 * 1024 * 1024 || file.buffer.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('Upload a valid PDF up to 15 MB');
    const fileName = file.originalname.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 160);
    const model = (requestedModel?.trim() || inferModel(fileName)).slice(0, 80);
    if (!/^[\p{L}\p{N} .()+_-]{2,80}$/u.test(model)) throw new BadRequestException('Invalid vehicle model');
    const storageKey = new ObjectId();
    await new Promise<void>((resolve, reject) => {
      const stream = this.bucket().openUploadStreamWithId(storageKey, fileName, { contentType: 'application/pdf', metadata: { uploadedBy: userId } });
      stream.on('finish', () => resolve()); stream.on('error', reject); stream.end(file.buffer);
    });
    let doc: any;
    try { doc = await this.docs.create({ fileName, vehicleModel: model, storageKey, uploadedBy: oid(userId) }); }
    catch (err) { await this.bucket().delete(storageKey); throw err; }
    setImmediate(() => this.enqueue(String(doc._id)));
    return this.one(userId, String(doc._id));
  }
  private async readFile(key: ObjectId): Promise<Buffer> {
    const parts: Buffer[] = [];
    return new Promise((resolve, reject) => { this.bucket().openDownloadStream(key).on('data', (p: Buffer) => parts.push(p)).on('end', () => resolve(Buffer.concat(parts))).on('error', reject); });
  }
  private async waitForSearchVisibility(doc: any, embedding: number[]) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const rows = await this.chunks.aggregate([
          { $vectorSearch: { index: process.env.VECTOR_INDEX_NAME || 'brochure_vector_index', path: 'embedding', queryVector: embedding, numCandidates: 20, limit: 1, filter: { userId: doc.uploadedBy, documentId: doc._id } } },
          { $project: { _id: 1 } }
        ]);
        if (rows.length) return;
      } catch (err) { lastError = err; }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Chunks were stored but are not searchable in Atlas yet${lastError ? `: ${String((lastError as Error).message).slice(0, 180)}` : ''}`);
  }
  async process(id: string) {
    const doc = await this.docs.findOneAndUpdate({ _id: oid(id), processingStatus: 'Pending' }, { $set: { processingStatus: 'Processing', errorMessage: '' } }, { new: true });
    if (!doc) return;
    await this.logs.create({ documentId: doc._id, status: 'Processing', message: 'PDF ingestion started' });
    try {
      const pages = await extractPdf(await this.readFile(doc.storageKey));
      const vehicleModel = doc.vehicleModel === 'Unknown model' ? inferModel(doc.fileName, pages.map(p => p.text).join(' ')) : doc.vehicleModel;
      if (vehicleModel !== doc.vehicleModel) await this.docs.updateOne({ _id: doc._id }, { $set: { vehicleModel } });
      const prepared = chunkPages(pages, Number(process.env.CHUNK_SIZE || 1200), Number(process.env.CHUNK_OVERLAP || 180));
      if (!prepared.length) throw new Error('No extractable text found in PDF');
      await this.chunks.deleteMany({ documentId: doc._id });
      let firstEmbedding: number[] | undefined;
      let totalChunks = 0;
      for (let i = 0; i < prepared.length; i += 4) {
        const batch = prepared.slice(i, i + 4);
        const vectors = await this.embeddings.embed(batch.map(x => x.content));
        firstEmbedding ||= vectors[0];
        const records = batch.map((chunk, j) => ({ ...chunk, embedding: vectors[j], documentId: doc._id, userId: doc.uploadedBy, vehicleModel, metadata: { sourceDocumentName: doc.fileName, uploadedAt: doc.createdAt } }));
        await this.chunks.insertMany(records, { ordered: true });
        totalChunks += records.length;
      }
      await this.waitForSearchVisibility(doc, firstEmbedding!);
      await this.docs.updateOne({ _id: doc._id }, { $set: { processingStatus: 'Completed', totalPages: pages.length, totalChunks, processedAt: new Date() } });
      await this.logs.create({ documentId: doc._id, status: 'Completed', message: `Stored ${totalChunks} chunks from ${pages.length} pages` });
    } catch (err: any) {
      await this.chunks.deleteMany({ documentId: doc._id });
      const message = String(err?.message || err).slice(0, 500);
      await this.docs.updateOne({ _id: doc._id }, { $set: { processingStatus: 'Failed', totalChunks: 0, errorMessage: message } });
      await this.logs.create({ documentId: doc._id, status: 'Failed', message });
      this.logger.error(`Processing ${id}: ${message}`);
    }
  }
  async reprocess(userId: string, id: string) {
    await this.one(userId, id);
    const doc = await this.docs.findOneAndUpdate({ _id: oid(id), uploadedBy: oid(userId), processingStatus: 'Failed' }, { $set: { processingStatus: 'Pending', errorMessage: '' } }, { new: true });
    if (!doc) throw new BadRequestException('Only failed documents can be reprocessed');
    setImmediate(() => this.enqueue(id));
    return { status: 'Pending' };
  }
  async updateModel(userId: string, id: string, rawModel: string) {
    const vehicleModel = rawModel.trim();
    if (!/^[\p{L}\p{N} .()+_-]{2,80}$/u.test(vehicleModel)) throw new BadRequestException('Invalid vehicle model');
    const doc = await this.docs.findOneAndUpdate({ _id: oid(id), uploadedBy: oid(userId), processingStatus: { $in: ['Completed', 'Failed'] } }, { $set: { vehicleModel } }, { new: true });
    if (!doc) throw new BadRequestException('Only completed or failed documents can be edited');
    await this.chunks.updateMany({ documentId: doc._id, userId: oid(userId) }, { $set: { vehicleModel } });
    return this.one(userId, id);
  }
  async remove(userId: string, id: string) {
    const doc = await this.docs.findOne({ _id: oid(id), uploadedBy: oid(userId) });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.processingStatus === 'Processing') throw new BadRequestException('Wait for processing to finish before deleting');
    await this.chunks.deleteMany({ documentId: doc._id });
    await this.logs.deleteMany({ documentId: doc._id });
    await this.bucket().delete(doc.storageKey);
    await this.docs.deleteOne({ _id: doc._id });
    return { deleted: true };
  }
  async stream(userId: string, id: string, res: Response) {
    const doc = await this.docs.findOne({ _id: oid(id), uploadedBy: oid(userId) });
    if (!doc) throw new NotFoundException('Document not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName.replace(/["\r\n]/g, '_')}"`);
    this.bucket().openDownloadStream(doc.storageKey).on('error', () => res.destroy()).pipe(res);
  }
  async recover() {
    const stale = await this.docs.updateMany({ processingStatus: 'Processing' }, { $set: { processingStatus: 'Pending' } });
    const pending = await this.docs.find({ processingStatus: 'Pending' }).select('_id').lean();
    if (stale.modifiedCount) this.logger.warn(`Recovering ${stale.modifiedCount} interrupted ingestions`);
    for (const doc of pending) setImmediate(() => this.enqueue(String(doc._id)));
  }
}

@Controller('documents') @UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private service: DocumentsService) {}
  @Post('upload') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname)) }))
  upload(@ReqUser() user: AuthRequest['user'], @UploadedFile() file: Express.Multer.File, @Body('vehicleModel') vehicleModel?: string) { return this.service.upload(user.id, file, vehicleModel); }
  @Get() list(@ReqUser() user: AuthRequest['user']) { return this.service.list(user.id); }
  @Get(':id') one(@ReqUser() user: AuthRequest['user'], @Param('id') id: string) { return this.service.one(user.id, id); }
  @Patch(':id') update(@ReqUser() user: AuthRequest['user'], @Param('id') id: string, @Body() dto: UpdateDocumentDto) { return this.service.updateModel(user.id, id, dto.vehicleModel); }
  @Get(':id/status') async status(@ReqUser() user: AuthRequest['user'], @Param('id') id: string) { const d: any = await this.service.one(user.id, id); return { processingStatus: d.processingStatus, totalPages: d.totalPages, totalChunks: d.totalChunks, errorMessage: d.errorMessage }; }
  @Get(':id/file') file(@ReqUser() user: AuthRequest['user'], @Param('id') id: string, @Res() res: Response) { return this.service.stream(user.id, id, res); }
  @Post(':id/reprocess') reprocess(@ReqUser() user: AuthRequest['user'], @Param('id') id: string) { return this.service.reprocess(user.id, id); }
  @Delete(':id') remove(@ReqUser() user: AuthRequest['user'], @Param('id') id: string) { return this.service.remove(user.id, id); }
}
