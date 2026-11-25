export type PdfPage = { pageNumber: number; text: string };
const sections = ['Engine', 'Safety', 'Exterior', 'Interior', 'Comfort', 'Infotainment', 'Technology', 'Dimensions', 'Variants', 'Transmission', 'Performance'];

export async function extractPdf(buffer: Buffer): Promise<PdfPage[]> {
  const pdfjs: any = await new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")')();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  if (pdf.numPages > 150) throw new Error('PDF exceeds 150 pages');
  const pages: PdfPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue;
      text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    pages.push({ pageNumber: n, text: cleanText(text) });
  }
  return pages;
}

export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000E-\u001F]/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function inferModel(fileName: string, text = ''): string {
  const known = ['Grand i10 Nios', 'Exter', 'Venue', 'Creta', 'Alcazar', 'Tucson', 'Verna', 'Aura', 'i20', 'Ioniq 5', 'Kona'];
  const haystack = `${fileName} ${text.slice(0, 5000)}`;
  return known.find(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)) || 'Unknown model';
}

export type TextChunk = { content: string; pageNumber: number; section: string; variantName: string };
export function chunkPages(pages: PdfPage[], size = 1200, overlap = 180): TextChunk[] {
  if (size < 300 || overlap < 0 || overlap >= size) throw new Error('Invalid chunk configuration');
  const chunks: TextChunk[] = [];
  for (const page of pages) {
    const text = page.text;
    if (!text) continue;
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end));
        if (boundary > start + size * 0.6) end = boundary + 1;
      }
      const content = text.slice(start, end).trim();
      if (content) {
        const section = sections.find(s => new RegExp(`\\b${s}\\b`, 'i').test(content.slice(0, 250))) || 'General';
        const variantName = (/(?<![A-Za-z0-9])(?:Prestige|Platinum|Signature|Executive|SX\s*\(O\)|SX|EX|Sportz|Asta|Magna|Era)(?![A-Za-z0-9])/i.exec(content)?.[0] || '').toUpperCase().replace(/\s+/g, '');
        chunks.push({ content, pageNumber: page.pageNumber, section, variantName });
      }
      if (end === text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }
  return chunks;
}
