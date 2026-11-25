const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const mongoose = require('mongoose');
if (process.env.MONGODB_DNS_SERVERS) dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map(x => x.trim()).filter(Boolean));
if (!process.env.GROQ_API_KEY || !process.env.BROCHURE_FILE) throw new Error('Set GROQ_API_KEY and BROCHURE_FILE before the live RAG test');
const base = process.env.API_BASE_URL || 'http://localhost:4000/api';
const email = `codex-rag-${crypto.randomBytes(6).toString('hex')}@example.invalid`;
const password = crypto.randomBytes(18).toString('base64url');
let token; const documentIds = [];
async function call(route, method = 'GET', body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
async function uploadAndWait(filePath, vehicleModel) {
  const file = fs.readFileSync(path.resolve(filePath));
  const form = new FormData();
  form.append('file', new Blob([file], { type: 'application/pdf' }), path.basename(filePath));
  form.append('vehicleModel', vehicleModel);
  const uploaded = await call('/documents/upload', 'POST', form);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
  const id = uploaded.data._id; documentIds.push(id);
  let status;
  for (let i = 0; i < 90; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    status = (await call(`/documents/${id}/status`)).data;
    if (status.processingStatus === 'Completed' || status.processingStatus === 'Failed') break;
  }
  assert.equal(status.processingStatus, 'Completed', JSON.stringify(status));
  assert.ok(status.totalChunks > 0);
  return { id, status };
}
async function main() {
  try {
    const registered = await call('/auth/register', 'POST', { name: 'RAG Smoke Test', email, password });
    assert.equal(registered.status, 201, JSON.stringify(registered.data));
    token = registered.data.token;
    const { id: cretaId, status } = await uploadAndWait(process.env.BROCHURE_FILE, 'Creta');
    const answer = await call('/chat', 'POST', { message: 'What are the engine displacement options documented for Creta?', documentIds: [cretaId] });
    assert.equal(answer.status, 201, JSON.stringify(answer.data));
    assert.ok(answer.data.message.sources.length > 0);
    assert.ok(answer.data.message.sources.every(source => source.vehicleModel === 'Creta' && source.pageNumber > 0));
    assert.match(answer.data.message.content, /\[\d+\]/);
    console.log(`Live RAG smoke test passed: ${status.totalChunks} chunks, ${answer.data.message.sources.length} retrieved sources`);
    const followUp = await call('/chat', 'POST', { message: 'What about the diesel version?', conversationId: answer.data.conversationId, documentIds: [cretaId] });
    assert.equal(followUp.status, 201, JSON.stringify(followUp.data));
    assert.ok(followUp.data.message.sources.length > 0);
    const unsupported = await call('/chat', 'POST', { message: 'What is the exact on-road price of this Creta in the year 2040?', conversationId: answer.data.conversationId, documentIds: [cretaId] });
    assert.equal(unsupported.status, 201, JSON.stringify(unsupported.data));
    assert.match(unsupported.data.message.content, /(?:not|unavailable|no information|does not|cannot|brochure)/i);
    console.log('Live follow-up and unsupported-question checks passed');
    if (process.env.SECOND_BROCHURE_FILE) {
      await uploadAndWait(process.env.SECOND_BROCHURE_FILE, 'Alcazar');
      const comparison = await call('/vehicles/compare', 'POST', { models: ['Creta', 'Alcazar'], focus: 'Compare documented engine options and seating.' });
      assert.equal(comparison.status, 201, JSON.stringify(comparison.data));
      assert.ok(comparison.data.sources.some(source => source.vehicleModel === 'Creta'));
      assert.ok(comparison.data.sources.some(source => source.vehicleModel === 'Alcazar'));
      assert.match(comparison.data.content, /\|/);
      const recommendation = await call('/vehicles/recommend', 'POST', { requirements: 'I need seating for six people and prefer documented safety features.' });
      assert.equal(recommendation.status, 201, JSON.stringify(recommendation.data));
      assert.ok(recommendation.data.sources.length > 0);
      console.log('Live model comparison and recommendation passed');
    }
  } finally {
    for (const documentId of documentIds) {
      if (!token) break;
      const result = await call(`/documents/${documentId}`, 'DELETE');
      if (result.status !== 200) console.error(`Test document API cleanup returned ${result.status}`);
    }
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      const user = await mongoose.connection.db.collection('users').findOne({ email });
      if (user) {
        await mongoose.connection.db.collection('messages').deleteMany({ userId: user._id });
        await mongoose.connection.db.collection('conversations').deleteMany({ userId: user._id });
        await mongoose.connection.db.collection('users').deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }
  }
}
main().catch(err => { console.error(err.name, err.message); process.exitCode = 1; });
