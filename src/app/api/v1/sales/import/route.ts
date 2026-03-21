export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { importProspectsFromCSV } from "@/modules/sales/lib/import-engine";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    // Write to temp file since importProspectsFromCSV expects a file path
    const tmpPath = path.join(os.tmpdir(), `import-${Date.now()}.csv`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);

    try {
      const stats = await importProspectsFromCSV(tmpPath);
      return NextResponse.json({ success: true, stats });
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack?.split('\n').slice(0, 5) }, { status: 500 });
  }
}
