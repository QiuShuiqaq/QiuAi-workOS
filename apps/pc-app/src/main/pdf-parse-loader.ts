import { createRequire } from 'node:module';

type PdfParseResult = {
  text: string;
};

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>;

const requireFromHere = createRequire(import.meta.url);

let cachedPdfParse: PdfParse | undefined;

export function loadPdfParse(): PdfParse {
  cachedPdfParse ??= requireFromHere('pdf-parse/lib/pdf-parse.js') as PdfParse;
  return cachedPdfParse;
}
