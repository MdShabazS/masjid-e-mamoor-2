# Phase 7 private PDF Unicode extraction — 22 October 2026

## Change

The Devanagari lines in private finance PDFs remain visibly shaped by the existing bounded PNG fallback. Each such line now also has an invisible, positioned font text operation wrapped in a PDF `ActualText` marked-content span containing the exact logical Unicode line. This avoids treating pdf-lib's unshaped Indic glyph order as the extracted text. Normal text remains unchanged. The existing reconciliation, glyph, page and byte-size checks still run.

## Checks

- Before this change, Poppler `pdftotext` omitted the sample's Devanagari effect description. A transparent text layer alone produced corrupt text (`म    जद`), so the implementation also supplies `ActualText`.
- After the change, Poppler `pdftotext -layout` extracted `मस्जिद नकद  [a1]` and `मस्जिद <income> & ₹123.45  [account_opening; effect e1]` from a synthetic one-page PDF. The extra separator spaces are Poppler layout spacing; the Hindi words, punctuation and amount survived exactly.
- A focused Node test decodes the PDF content stream and checks the expected UTF-16 `ActualText`, marked-content scope, text operation and visible image. All 131 Node tests pass.
- Poppler rendered the original and changed sample pages at 110 DPI to RGB images of 910 × 1287 pixels. The pixel difference was empty; visual appearance did not change. The rendered page was also inspected for clipping and glyph quality.
- The bundled `pdfplumber`/PDFMiner extractor still does not honor `ActualText` and reports corrupted Indic clusters. Drawing one Unicode code point at a time also produced dotted-circle marks, so that approach was rejected. Poppler extraction is the proven compatibility level for this change.
- Lint, format, typecheck and web build pass. The TypeScript check exposed pdf-lib's missing PDF dictionary operand type; the narrow annotation documents that library typing gap. The final check result is recorded in `tasks.md`.

## Remaining acceptance

Poppler extraction and unchanged pixels do not establish PDF/UA conformance, all-extractor compatibility or screen-reader reading order. Test actual selection, copying and spoken output with the supported PDF viewers and assistive technology; assess document tagging, headings, language and table semantics. Repeat with large, multipage Hindi reports and the hosted worker output. Private export activation remains gated by the named masjid approver and full report-source verification.
