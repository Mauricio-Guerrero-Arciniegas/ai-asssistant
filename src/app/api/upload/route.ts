import { NextResponse } from "next/server";
import { IncomingForm, Fields, Files, File } from "formidable";
import fs from "fs";
import mammoth from "mammoth";
import { Readable } from "stream";
import { ReadableStream as NodeReadableStream } from "stream/web";
import { IncomingMessage } from "http";

// ✅ Nuevo formato de configuración para App Router
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Asegura que no se cachee la respuesta

// Tipos
type FormidableFile = File & {
  mimetype?: string;
  originalFilename?: string;
  filepath: string;
};

interface ParseResult {
  fields: Fields;
  files: Files;
}

// 🔁 Convierte un Request → IncomingMessage simulado (sin any)
function toIncomingMessage(req: Request): IncomingMessage {
  const body = req.body;
  const nodeStream = body
    ? Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>)
    : new Readable({ read() { this.push(null); } });

  const imsg = Object.assign(nodeStream, {
    headers: Object.fromEntries(req.headers.entries()) as Record<string, string>,
    method: req.method,
    url: req.url,
  }) as unknown as IncomingMessage;

  return imsg;
}

// 📦 Parsear formulario con formidable
async function parseForm(req: Request): Promise<ParseResult> {
  const form = new IncomingForm({ keepExtensions: true, multiples: false });
  const incomingReq = toIncomingMessage(req);

  return new Promise((resolve, reject) => {
    form.parse(incomingReq, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// 📄 Extraer texto de archivos PDF o Word
async function extractTextFromFile(file: FormidableFile): Promise<string> {
  const buffer = await fs.promises.readFile(file.filepath);
  const mime = file.mimetype ?? "";

  // ✅ PDF (import dinámico evita el conflicto ESM/CommonJS)
  if (mime.includes("pdf") || file.originalFilename?.toLowerCase().endsWith(".pdf")) {
    const { default: pdf } = await import("pdf-parse");
    const data = await pdf(buffer);
    return data.text;
  }

  // ✅ Word DOCX
  if (
    mime.includes("word") ||
    file.originalFilename?.toLowerCase().endsWith(".docx") ||
    mime.includes("vnd.openxmlformats-officedocument.wordprocessingml.document")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // ✅ Texto plano
  return buffer.toString("utf-8");
}

// 🚀 POST: recibe archivo y genera resumen con OpenAI
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { files } = await parseForm(req);
    const fileField = files.file ?? files.document;
    const file = Array.isArray(fileField)
      ? (fileField[0] as FormidableFile)
      : (fileField as FormidableFile | undefined);

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    const prompt = `Resume brevemente (3 a 6 frases) el siguiente texto:\n\n${text.slice(0, 20000)}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant that provides concise summaries." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });

    const data = (await openaiRes.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    if (!openaiRes.ok) {
      console.error("OpenAI error:", data);
      return NextResponse.json(
        { error: data.error?.message ?? "OpenAI error" },
        { status: 502 }
      );
    }

    const summary = data.choices?.[0]?.message?.content ?? "No summary generated";

    return NextResponse.json({
      summary,
      text: text.slice(0, 100000),
      filename: file.originalFilename ?? null,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Server error during file upload" }, { status: 500 });
  }
}