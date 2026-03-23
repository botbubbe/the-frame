export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Use /data for Railway, fallback to local
const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "the-frame.db");
const TMP_PATH = path.join(DATA_DIR, "the-frame-upload.db");

export async function POST(request: NextRequest) {
  try {
    const key = request.headers.get("x-admin-key");
    if (key !== "jaxy2026") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, data, chunk } = body;

    if (action === "start") {
      if (fs.existsSync(TMP_PATH)) fs.unlinkSync(TMP_PATH);
      fs.writeFileSync(TMP_PATH, Buffer.alloc(0));
      return NextResponse.json({ status: "ready", dbPath: DB_PATH, tmpPath: TMP_PATH, dataDir: DATA_DIR });
    }

    if (action === "chunk" && data) {
      const buf = Buffer.from(data, "base64");
      fs.appendFileSync(TMP_PATH, buf);
      const size = fs.statSync(TMP_PATH).size;
      return NextResponse.json({ status: "ok", chunk, size });
    }

    if (action === "finish") {
      if (!fs.existsSync(TMP_PATH)) {
        return NextResponse.json({ error: "no upload in progress" }, { status: 400 });
      }
      const size = fs.statSync(TMP_PATH).size;
      
      // Remove WAL/SHM
      try { fs.unlinkSync(DB_PATH + "-shm"); } catch {}
      try { fs.unlinkSync(DB_PATH + "-wal"); } catch {}
      
      // Replace
      fs.copyFileSync(TMP_PATH, DB_PATH);
      fs.unlinkSync(TMP_PATH);
      
      return NextResponse.json({ status: "complete", size });
    }

    if (action === "status") {
      const exists = fs.existsSync(DB_PATH);
      const size = exists ? fs.statSync(DB_PATH).size : 0;
      const tmpExists = fs.existsSync(TMP_PATH);
      const tmpSize = tmpExists ? fs.statSync(TMP_PATH).size : 0;
      return NextResponse.json({ dbPath: DB_PATH, exists, size, tmpExists, tmpSize, dataDir: DATA_DIR });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message, stack: (err as Error).stack?.split("\n").slice(0, 3) }, { status: 500 });
  }
}
