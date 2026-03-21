export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        password_hash TEXT,
        role TEXT DEFAULT 'owner',
        is_active INTEGER DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync("jaxy2026!", 10);

    sqlite.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "582f8be0-cad3-47f2-8c3e-bc12b5a69c72",
      "daniel@getjaxy.com",
      "Daniel Seeff",
      passwordHash,
      "owner",
      1,
      now,
      now
    );

    const users = sqlite.prepare("SELECT id, email, name, role FROM users").all();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST to this endpoint to seed the database" });
}
