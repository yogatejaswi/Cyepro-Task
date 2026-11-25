const assert = require('node:assert/strict');
const { EmbeddingsService } = require('../dist/embeddings.js');

async function main() {
  const service = new EmbeddingsService();
  let ticks = 0;
  const timer = setInterval(() => ticks++, 100);
  try {
    const [first, second] = await Promise.all([
      service.embed(Array(4).fill('Hyundai Creta engine and safety features')),
      service.embed(['Hyundai Verna fuel efficiency'])
    ]);
    assert.equal(first.length, 4);
    assert.equal(second.length, 1);
    assert.equal(first[0].length, 384);
    assert.equal(second[0].length, 384);
    assert.ok(ticks > 0, 'Embedding work blocked the main event loop');
    console.log(`Embedding worker smoke test passed; ${ticks} main-thread timer ticks`);
  } finally {
    clearInterval(timer);
    await service.onModuleDestroy();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
