declare module "pdf-parse" {
  import { Buffer } from "buffer";

  interface PDFInfo {
    [key: string]: string | number | boolean | null | undefined;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata?: unknown;
    version: string;
    text: string;
  }

  function pdf(buffer: Buffer): Promise<PDFData>;

  export = pdf;
}