const assert = require('node:assert/strict');
const { extractPdf } = require('../dist/pdf.js');
const stream = 'BT /F1 12 Tf 72 720 Td (Hyundai Creta Safety Airbags) Tj ET';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
];
let pdf = '%PDF-1.4\n'; const offsets = [0];
for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
const start = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
extractPdf(Buffer.from(pdf)).then(pages => {
  assert.deepEqual(pages, [{ pageNumber: 1, text: 'Hyundai Creta Safety Airbags' }]);
  process.stdout.write('PDF extraction smoke test passed\n');
}).catch(err => { console.error(err); process.exitCode = 1; });
