import { describe, expect, it } from 'vitest';
import { chunkPages, cleanText, inferModel } from './pdf';

describe('PDF processing helpers', () => {
  it('preserves page attribution and overlap while splitting long text', () => {
    const chunks = chunkPages([{ pageNumber: 3, text: `Safety\n${'Airbags and ESC. '.repeat(60)}` }], 400, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(x => x.pageNumber === 3)).toBe(true);
    expect(chunks[0].section).toBe('Safety');
  });
  it('cleans control characters without removing specification text', () => {
    expect(cleanText('Engine   1.5L\u0000\n\n\nPower  85 kW')).toBe('Engine 1.5L\n\nPower 85 kW');
  });
  it('infers known model from filename', () => {
    expect(inferModel('Hyundai-Creta-brochure.pdf')).toBe('Creta');
    expect(inferModel('brochure.pdf', 'Introducing Hyundai Alcazar')).toBe('Alcazar');
  });
  it('normalizes variant names for exact Atlas filtering', () => {
    expect(chunkPages([{ pageNumber: 1, text: 'SX (O) variant includes airbags.' }])[0].variantName).toBe('SX(O)');
  });
});
