const dns = require('node:dns');
const mongoose = require('mongoose');
if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(x => x.trim()).filter(Boolean));
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
const name = process.env.VECTOR_INDEX_NAME || 'brochure_vector_index';
const definition = {
  fields: [
    { type: 'vector', path: 'embedding', numDimensions: 384, similarity: 'cosine' },
    { type: 'filter', path: 'userId' },
    { type: 'filter', path: 'documentId' },
    { type: 'filter', path: 'vehicleModel' },
    { type: 'filter', path: 'variantName' }
  ]
};
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const exists = await mongoose.connection.db.listCollections({ name: 'document_chunks' }).hasNext();
  if (!exists) await mongoose.connection.db.createCollection('document_chunks');
  const collection = mongoose.connection.db.collection('document_chunks');
  const existing = await collection.listSearchIndexes(name).toArray();
  if (existing.length) {
    const dimensions = (existing[0].latestDefinition || existing[0].definition)?.fields?.find(field => field.type === 'vector')?.numDimensions;
    if (dimensions === 384) { console.log(`Atlas Search index ${name} already exists with 384 dimensions; status: ${existing[0].status}`); return; }
    await collection.updateSearchIndex(name, definition);
    console.log(`Atlas Vector Search index ${name} updated to 384 dimensions. Wait for status READY before querying.`);
    return;
  }
  await collection.createSearchIndex({ name, type: 'vectorSearch', definition });
  console.log(`Atlas Vector Search index ${name} created. Wait for status READY before querying.`);
}
main().catch(err => { console.error(`Atlas index setup failed: ${err.name}: ${String(err.message).replace(process.env.MONGODB_URI || '', '[redacted URI]')}`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
