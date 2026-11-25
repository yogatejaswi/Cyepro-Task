const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const mongoose = require('mongoose');
const { EmbeddingsService } = require('../dist/embeddings.js');
if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(x => x.trim()).filter(Boolean));
const base = process.env.API_BASE_URL || 'http://localhost:4000/api';
const email = `codex-smoke-${crypto.randomBytes(6).toString('hex')}@example.invalid`;
const password = crypto.randomBytes(18).toString('base64url');
async function call(path, method = 'GET', body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
async function main() {
  try {
    assert.equal((await call('/documents')).status, 401);
    const registered = await call('/auth/register', 'POST', { name: 'Smoke Test', email, password });
    assert.equal(registered.status, 201);
    assert.ok(registered.data.token);
    assert.equal((await call('/auth/login', 'POST', { email, password: 'wrong-password' })).status, 401);
    assert.equal((await call('/auth/login', 'POST', { email, password })).status, 201);
    assert.equal((await call('/auth/profile', 'GET', undefined, registered.data.token)).data.email, email);
    assert.deepEqual((await call('/documents', 'GET', undefined, registered.data.token)).data, []);
    const form = new FormData(); form.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), 'fake.pdf');
    assert.equal((await call('/documents/upload', 'POST', form, registered.data.token)).status, 400);
    if (process.env.BROCHURE_FILE) {
      const brochure = fs.readFileSync(path.resolve(process.env.BROCHURE_FILE));
      const valid = new FormData(); valid.append('file', new Blob([brochure], { type: 'application/pdf' }), 'creta.pdf'); valid.append('vehicleModel', 'Creta');
      const upload = await call('/documents/upload', 'POST', valid, registered.data.token);
      assert.equal(upload.status, 201, JSON.stringify(upload.data));
      const id = upload.data._id;
      let status;
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = (await call(`/documents/${id}/status`, 'GET', undefined, registered.data.token)).data;
        if (['Completed', 'Failed'].includes(status.processingStatus)) break;
      }
      assert.ok(['Completed', 'Failed'].includes(status.processingStatus));
      console.log(`Brochure processing: ${status.processingStatus}, ${status.totalChunks} chunks`);
      if (status.processingStatus === 'Completed') {
        const queryVector = (await new EmbeddingsService().embed(['Creta engine displacement specifications']))[0];
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
        const matches = await mongoose.connection.db.collection('document_chunks').aggregate([
          { $vectorSearch: { index: process.env.VECTOR_INDEX_NAME || 'brochure_vector_index', path: 'embedding', queryVector, numCandidates: 100, limit: 5, filter: { userId: new mongoose.Types.ObjectId(registered.data.user.id), documentId: new mongoose.Types.ObjectId(id) } } },
          { $project: { pageNumber: 1, content: 1, vehicleModel: 1 } }
        ]).toArray();
        assert.ok(matches.length > 0);
        assert.ok(matches.every(match => match.pageNumber > 0 && match.vehicleModel === 'Creta'));
        await mongoose.disconnect();
        console.log(`Atlas vector retrieval: ${matches.length} matching chunks`);
      }
      const fileResponse = await fetch(`${base}/documents/${id}/file`, { headers: { Authorization: `Bearer ${registered.data.token}` } });
      assert.equal(fileResponse.status, 200);
      assert.equal(fileResponse.headers.get('content-type'), 'application/pdf');
      assert.equal(Buffer.from(await fileResponse.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
      const edited = await call(`/documents/${id}`, 'PATCH', { vehicleModel: 'Creta Test' }, registered.data.token);
      assert.equal(edited.status, 200);
      assert.equal(edited.data.vehicleModel, 'Creta Test');
      assert.equal((await call(`/documents/${id}`, 'DELETE', undefined, registered.data.token)).status, 200);
    }
    console.log('Live Atlas/API auth and document workflow smoke test passed');
  } finally {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      await mongoose.connection.db.collection('users').deleteOne({ email });
      await mongoose.disconnect();
    }
  }
}
main().catch(err => { console.error(err.name, err.message); process.exitCode = 1; });
