import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export const EMBEDDING_DIMENSIONS = 384;
export const DEFAULT_EMBEDDING_MODEL = 'onnx-community/all-MiniLM-L6-v2-ONNX';

type Pending = { resolve: (value: number[][]) => void; reject: (reason: Error) => void };
type WorkerReply = { id: number; embeddings?: number[][]; error?: string };

@Injectable()
export class EmbeddingsService implements OnModuleDestroy {
  private worker?: Worker;
  private nextId = 0;
  private pending = new Map<number, Pending>();

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(join(__dirname, 'embeddings-worker.js'));
    this.worker = worker;
    worker.unref();
    worker.on('message', (reply: WorkerReply) => {
      const request = this.pending.get(reply.id);
      if (!request) return;
      this.pending.delete(reply.id);
      if (reply.error) request.reject(new Error(reply.error));
      else if (!reply.embeddings || reply.embeddings.some(x => x.length !== EMBEDDING_DIMENSIONS)) request.reject(new Error(`Embedding dimension mismatch; expected ${EMBEDDING_DIMENSIONS}`));
      else request.resolve(reply.embeddings);
      if (!this.pending.size) worker.unref();
    });
    const fail = (error: Error) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    };
    worker.on('error', fail);
    worker.on('exit', code => fail(new Error(`Embedding worker exited with code ${code}`)));
    return worker;
  }

  embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      worker.ref();
      try { worker.postMessage({ id, texts }); }
      catch (error) {
        this.pending.delete(id);
        if (!this.pending.size) worker.unref();
        reject(error);
      }
    });
  }

  async onModuleDestroy() { await this.worker?.terminate(); }
}
