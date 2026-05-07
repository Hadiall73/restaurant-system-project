import { NextRequest, NextResponse } from "next/server";

// In-memory rate limit store (per Vercel Edge instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/register-employee": { max: 5,  windowMs: 15 * 60 * 1000 }, // 5x pro 15 Min
  "/api/auth/ensure-profile":    { max: 20, windowMs: 60 * 1000 },       // 20x pro Min
};

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const limit = LIMITS[pathname];

  if (limit) {
    const ip = getIp(req);
    const key = `${ip}:${pathname}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + limit.windowMs });
    } else {
      entry.count++;
      if (entry.count > limit.max) {
        return NextResponse.json(
          { error: "Zu viele Anfragen. Bitte warte kurz." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
            },
          }
        );
      }
    }
  }

  // Schutz: API-Routen mit Service-Key nur vom Server erreichbar
  if (pathname.startsWith("/api/admin") && req.headers.get("x-internal-key") !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && !origin.includes(host || "")) {
      return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
