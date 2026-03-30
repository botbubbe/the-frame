import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "dev-secret-change-me");

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Unified session resolver: tries NextAuth first, then falls back to
 * the custom `session-token` JWT cookie set by magic-link / manual login.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // 1. Try NextAuth
  const session = await auth();
  if (session?.user) {
    return session.user as SessionUser;
  }

  // 2. Fallback: custom session-token cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session-token")?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.id && payload.email) {
      return {
        id: payload.id as string,
        email: payload.email as string,
        name: (payload.name as string) || "",
        role: (payload.role as string) || "viewer",
      };
    }
  } catch {
    // Invalid/expired token
  }

  return null;
}
