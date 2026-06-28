import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const EXAMPLES_ROOT = path.join(process.cwd(), "../../examples");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const rel = segments.join("/");

  // Block path traversal
  if (rel.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(EXAMPLES_ROOT, rel);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(EXAMPLES_ROOT))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const info = await stat(resolved);
    if (!info.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}