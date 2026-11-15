import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { decodePDFRawStream, PDFDocument, PDFHexString } from 'pdf-lib';
import { renderReportPdf } from './pdf.js';

import { sample } from './pdf-fixture.js';

test('PDF embeds exact balances and a digest over returned bytes', async () => {
  const result = await renderReportPdf(sample);
  assert.match(result.bytes.toString('latin1', 0, 8), /%PDF/);
  assert.equal(result.sha256, createHash('sha256').update(result.bytes).digest('hex'));
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 1);
});

test('PDF rejects reconciliation drift, invalid metadata and unsupported glyphs', async () => {
  await assert.rejects(
    renderReportPdf({ ...sample, balances: [{ ...sample.balances[0], closing_paise: '12344' }] }),
    /report_reconciliation_failed/,
  );
  await assert.rejects(
    renderReportPdf({ ...sample, metadata: { ...sample.metadata, start_date: 'bad' } }),
    /invalid_report_metadata/,
  );
  await assert.rejects(
    renderReportPdf({ ...sample, lines: [{ ...sample.lines[0], description: 'ع' }] }),
    /unsupported_report_glyph/,
  );
});

test('PDF shapes Devanagari text safely alongside Latin and rupee amounts', async () => {
  const description = 'मस्जिद <income> & ₹123.45';
  const result = await renderReportPdf({
    ...sample,
    lines: [{ ...sample.lines[0], description }],
  });
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), 1);
  const stream = pdf.getPage(0).node.Contents().lookup(0);
  const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString('utf8');
  const actualText = PDFHexString.fromText(
    `${description}  [${sample.lines[0].source_type}; effect ${sample.lines[0].effect_id}]`,
  ).toString();
  assert.ok(operators.includes(`/ActualText ${actualText}`));
  assert.match(operators, />> BDC[\s\S]*? Tj[\s\S]*?EMC[\s\S]*?\/Image-/);
  assert.ok(result.bytes.length > 100_000);
});

test('PDF paginates a long report', async () => {
  const lines = Array.from({ length: 100 }, (_, index) => ({
    ...sample.lines[0],
    effect_id: `e${index}`,
    amount_paise: '1',
    description: `Entry ${index} ` + 'long description '.repeat(20),
  }));
  const balances = [{ ...sample.balances[0], period_openings_paise: '100', closing_paise: '100' }];
  const result = await renderReportPdf({ ...sample, lines, balances });
  assert.ok(result.pageCount > 1);
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), result.pageCount);
});
