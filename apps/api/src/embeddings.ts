import { Injectable } from '@nestjs/common';

export const EMBEDDING_DIMENSIONS = 384;
export const DEFAULT_EMBEDDING_MODEL = 'onnx-community/all-MiniLM-L6-v2-ONNX';

@Injectable()
export class EmbeddingsService {
  private extractor?: Promise<any>;
  private getExtractor(): Promise<any> {
    if (!this.extractor) {
      this.extractor = (async () => {
        const { pipeline, env }: any = await new Function('return import("@huggingface/transformers")')();
        if (process.env.EMBEDDING_CACHE_DIR) env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
        return pipeline('feature-extraction', process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL, { dtype: 'q4' });
      })().catch(err => { this.extractor = undefined; throw err; });
    }
    return this.extractor;
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const extractor = await this.getExtractor();
    const tensor = await extractor(texts, { pooling: 'mean', normalize: true });
    const embeddings = tensor.tolist() as number[][];
    if (embeddings.length !== texts.length || embeddings.some(x => x.length !== EMBEDDING_DIMENSIONS)) throw new Error(`Embedding dimension mismatch; expected ${EMBEDDING_DIMENSIONS}`);
    return embeddings;
  }
}
