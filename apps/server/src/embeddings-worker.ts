import { parentPort } from 'node:worker_threads';
import { DEFAULT_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './embeddings';

let extractorPromise: Promise<any> | undefined;
function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env }: any = await new Function('return import("@huggingface/transformers")')();
      if (process.env.EMBEDDING_CACHE_DIR) env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
      return pipeline('feature-extraction', process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL, { dtype: 'q4' });
    })().catch(error => { extractorPromise = undefined; throw error; });
  }
  return extractorPromise;
}

async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const tensor = await extractor(texts, { pooling: 'mean', normalize: true });
  const embeddings = tensor.tolist() as number[][];
  if (embeddings.length !== texts.length || embeddings.some(x => x.length !== EMBEDDING_DIMENSIONS)) throw new Error(`Embedding dimension mismatch; expected ${EMBEDDING_DIMENSIONS}`);
  return embeddings;
}

let processing = Promise.resolve();
parentPort?.on('message', (request: { id: number; texts: string[] }) => {
  processing = processing.then(async () => {
    try { parentPort?.postMessage({ id: request.id, embeddings: await embed(request.texts) }); }
    catch (error) { parentPort?.postMessage({ id: request.id, error: String((error as Error).message || error) }); }
  });
});
