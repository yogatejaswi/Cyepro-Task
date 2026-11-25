import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AuthController, AuthGuard } from './auth';
import { DocumentsService } from './documents';
import { RagService } from './chat';

describe('authentication', () => {
  const jwt = new JwtService({ secret: 'a-test-secret-that-is-long-enough', signOptions: { expiresIn: '1h' } });
  it('registers with a password hash and logs in', async () => {
    const users: any = { exists: vi.fn().mockResolvedValue(false), create: vi.fn(async (x: any) => ({ ...x, _id: '507f1f77bcf86cd799439011', role: 'user' })) };
    const auth = new AuthController(users, jwt);
    const result = await auth.register({ name: 'Test User', email: 'test@example.com', password: 'StrongPass123' });
    expect(result.token).toBeTruthy();
    expect(users.create.mock.calls[0][0].passwordHash).not.toBe('StrongPass123');
    users.findOne = vi.fn().mockReturnValue({ select: () => Promise.resolve(users.create.mock.results[0].value) });
    const login = await auth.login({ email: 'test@example.com', password: 'StrongPass123' });
    expect(login.user.email).toBe('test@example.com');
    await expect(auth.login({ email: 'test@example.com', password: 'wrong' })).rejects.toMatchObject({ status: 401 });
  });
  it('rejects requests without a bearer token', async () => {
    const guard = new AuthGuard(jwt);
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as any)).rejects.toMatchObject({ status: 401 });
  });
});

describe('document validation', () => {
  it('rejects a disguised non-PDF before storage', async () => {
    const service = new DocumentsService({} as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.upload('507f1f77bcf86cd799439011', { buffer: Buffer.from('plain text'), size: 200, originalname: 'fake.pdf' } as any)).rejects.toMatchObject({ status: 400 });
  });
});

describe('retrieval', () => {
  it('returns a cited response from Atlas results filtered by user and model', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const docs: any = { distinct: vi.fn().mockResolvedValue(['Creta']) };
    const chunks: any = { aggregate: vi.fn().mockResolvedValue([{ _id: 'c1', documentId: '507f1f77bcf86cd799439012', vehicleModel: 'Creta', content: 'Six airbags are listed.', pageNumber: 4, section: 'Safety', metadata: { sourceDocumentName: 'creta.pdf' }, score: 0.95 }]) };
    const rag = new RagService(docs, chunks, { embed: vi.fn().mockResolvedValue([Array(384).fill(0.1)]) } as any);
    (rag as any).ai = { chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'The brochure lists six airbags 【1】.' } }] }) } } };
    const prior = process.env.GROQ_API_KEY; process.env.GROQ_API_KEY = 'test-key';
    try {
      const result = await rag.answer(userId, 'What safety features does Creta have?');
      expect(result.sources[0]).toMatchObject({ fileName: 'creta.pdf', vehicleModel: 'Creta', pageNumber: 4 });
      expect(chunks.aggregate.mock.calls[0][0][0].$vectorSearch.filter.vehicleModel).toBe('Creta');
      expect(String(chunks.aggregate.mock.calls[0][0][0].$vectorSearch.filter.userId)).toBe(userId);
      expect(result.content).toContain('[1]');
    } finally { if (prior === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = prior; }
  });
  it('adds variant filtered retrieval alongside model retrieval', async () => {
    const docs: any = { distinct: vi.fn().mockResolvedValue(['Alcazar']) };
    const chunks: any = { aggregate: vi.fn().mockResolvedValue([]) };
    const rag = new RagService(docs, chunks, { embed: vi.fn().mockResolvedValue([Array(384).fill(0.1)]) } as any);
    const prior = process.env.GROQ_API_KEY; process.env.GROQ_API_KEY = 'test-key';
    try {
      await rag.answer('507f1f77bcf86cd799439011', 'Compare Alcazar Prestige and Platinum variants');
      const filters = chunks.aggregate.mock.calls.map(call => call[0][0].$vectorSearch.filter);
      expect(filters.map(filter => filter.variantName).filter(Boolean)).toEqual(['PRESTIGE', 'PLATINUM']);
      expect(filters.every(filter => filter.vehicleModel === 'Alcazar')).toBe(true);
    } finally { if (prior === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = prior; }
  });
});
