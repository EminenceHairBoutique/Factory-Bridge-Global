import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness only. Never report secrets, dependency versions or tenant data here. */
export function GET() {
  return NextResponse.json({ ok: true, service: "web", env: process.env.APP_ENV ?? "development" });
}
