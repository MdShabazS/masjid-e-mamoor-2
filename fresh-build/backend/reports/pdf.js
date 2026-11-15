import 'regenerator-runtime/runtime.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFHexString, PDFName, PDFOperator, PDFOperatorNames, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { renderReportCsv } from './csv.js';

const FONT_NAME = 'backend/reports/fonts/NotoSansDevanagari-Regular.ttf';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** @type {[number, number]} */
const PAGE = [595.28, 841.89];
const MARGIN = 42;
const MAX_PAGES = 300;
const MAX_SHAPED_LINES = 500;
const SHAPE_SCALE = 3;
const COMPLEX_SCRIPT = /[\u0900-\u097f\p{Mark}]/u;
const GRAPHEMES = new Intl.Segmenter('hi', { granularity: 'grapheme' });

function money(paise) {
  const value = BigInt(paise);
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}₹${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function visible(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim();
}

function xml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function renderReportPdf({ runId, metadata, lines, balances }) {
  // The CSV renderer checks IDs, exact paise, account totals and transfer pairs.
  renderReportCsv({ runId, lines, balances });
  if (
    !metadata ||
    !['month', 'year', 'range'].includes(metadata.period_kind) ||
    !DATE.test(metadata.start_date ?? '') ||
    !DATE.test(metadata.end_exclusive_date ?? '') ||
    metadata.start_date >= metadata.end_exclusive_date ||
    !Number.isFinite(Date.parse(metadata.cutoff_at)) ||
    typeof metadata.include_proofs !== 'boolean'
  )
    throw new Error('invalid_report_metadata');

  const fontBytes = await readFile(
    resolve(process.cwd(), process.cwd().endsWith('/apps/web') ? '../..' : '.', FONT_NAME),
  );
  const sourceFont = fontkit.create(fontBytes);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes);
  const fontBase64 = fontBytes.toString('base64');
  doc.setTitle(`Private finance report ${runId}`);
  doc.setSubject('Reconciled, private finance snapshot');
  let page;
  let y = 0;
  let pageNumber = 0;
  let shapedLines = 0;
  function addPage() {
    if (++pageNumber > MAX_PAGES) throw new Error('report_too_large');
    page = doc.addPage(PAGE);
    y = PAGE[1] - MARGIN;
    page.drawText(`MASJID E MAMOOR  •  PRIVATE FINANCE  •  Page ${pageNumber}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.05, 0.18, 0.26),
    });
    y -= 14;
    y -= 10;
  }
  async function draw(value, size = 10, bold = false) {
    const str = visible(value);
    for (const char of str) {
      if (!sourceFont.hasGlyphForCodePoint(char.codePointAt(0)))
        throw new Error('unsupported_report_glyph');
    }
    if (COMPLEX_SCRIPT.test(str)) {
      if (++shapedLines > MAX_SHAPED_LINES) throw new Error('report_too_large');
      // pdf-lib loses Indic glyph positioning. Render only these lines with
      // Pango/Sharp, using the embedded local font and escaped, bounded SVG.
      const maxWidth = PAGE[0] - MARGIN * 2;
      const canvasWidth = Math.min(
        4096,
        Math.max(512, Math.ceil(font.widthOfTextAtSize(str, size) * SHAPE_SCALE * 1.5 + 100)),
      );
      const canvasHeight = Math.ceil((size + 12) * SHAPE_SCALE);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}"><style>@font-face{font-family:ReportFont;src:url(data:font/ttf;base64,${fontBase64})}text{font-family:ReportFont;font-size:${size * SHAPE_SCALE}px;fill:${bold ? '#0d2e42' : '#21303a'}}</style><text x="8" y="${size * SHAPE_SCALE + 6}">${xml(str)}</text></svg>`;
      const { data, info } = await sharp(Buffer.from(svg), { limitInputPixels: 1_000_000 })
        .trim()
        .png()
        .toBuffer({ resolveWithObject: true });
      const image = await doc.embedPng(data);
      const width = Math.min(maxWidth, info.width / SHAPE_SCALE);
      const height = (info.height / SHAPE_SCALE) * (width / (info.width / SHAPE_SCALE));
      if (y < MARGIN + height) addPage();
      // The visible image needs its original Unicode as replacement text.
      // pdf-lib's font drawing loses Indic cluster order; ActualText keeps the
      // intended line available to PDF text extractors and assistive readers.
      page.pushOperators(
        PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
          PDFName.of('Span'),
          // @ts-expect-error BDC accepts a PDFDict; pdf-lib omits it from PDFOperatorArg.
          doc.context.obj({ ActualText: PDFHexString.fromText(str) }),
        ]),
      );
      const textWidth = font.widthOfTextAtSize(str, size);
      page.drawText(str, {
        x: MARGIN,
        y: y - height + size,
        size: textWidth > maxWidth ? (size * maxWidth) / textWidth : size,
        font,
        opacity: 0,
      });
      page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
      page.drawImage(image, { x: MARGIN, y: y - height + size, width, height });
      y -= Math.max(size + 5, height + 3);
      return;
    }
    if (y < MARGIN + size) addPage();
    page.drawText(str, {
      x: MARGIN,
      y,
      size,
      font,
      color: bold ? rgb(0.05, 0.18, 0.26) : rgb(0.13, 0.18, 0.22),
    });
    y -= size + 5;
  }
  async function paragraph(value, size = 10) {
    const maxWidth = PAGE[0] - MARGIN * 2;
    let current = '';
    for (const { segment: char } of GRAPHEMES.segment(visible(value))) {
      const candidate = current + char;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        await draw(current, size);
        current = char;
      } else current = candidate;
    }
    if (current) await draw(current, size);
  }

  addPage();
  await draw('Reconciled report snapshot', 16, true);
  await paragraph(`Report ID: ${runId}`);
  await paragraph(
    `Period: ${metadata.period_kind}  ${metadata.start_date} to ${metadata.end_exclusive_date} (end excluded; India time)`,
  );
  await paragraph(`Snapshot cutoff: ${metadata.cutoff_at}`);
  await draw(`Proof references: ${metadata.include_proofs ? 'included' : 'excluded'}`);
  y -= 12;
  await draw('ACCOUNT BALANCES', 12, true);
  for (const balance of balances) {
    await paragraph(`${balance.account_name}  [${balance.account_id}]`, 11);
    await paragraph(
      `Opening ${money(balance.opening_paise)}  |  Period opening ${money(balance.period_openings_paise)}  |  Income ${money(balance.income_paise)}  |  Expense ${money(balance.expense_paise)}`,
    );
    await paragraph(
      `Transfer ${money(balance.transfer_paise)}  |  Closing ${money(balance.closing_paise)}`,
    );
    y -= 5;
  }
  y -= 10;
  await draw('ITEMIZED EFFECTS', 12, true);
  if (!lines.length) await draw('No effects in this period.');
  for (const line of lines) {
    await paragraph(
      `${line.occurred_at}  |  ${line.category}  |  ${money(line.amount_paise)}  |  ${line.account_id}`,
    );
    await paragraph(`${line.description ?? ''}  [${line.source_type}; effect ${line.effect_id}]`);
    if (line.proof_reference) await paragraph(`Proof reference: ${line.proof_reference}`);
    y -= 6;
  }
  const bytes = Buffer.from(await doc.save({ useObjectStreams: false }));
  if (bytes.length > 15_000_000) throw new Error('report_too_large');
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), pageCount: pageNumber };
}
