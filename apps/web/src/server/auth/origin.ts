/**
 * The app's own origin for links shown to a signed-in user (invite links, B-05 / B-05b). Built from the request's
 * Host (or the proxy's X-Forwarded-Host); a host with unexpected characters yields "" so the link stays relative.
 * Server-only; never used for redirects (those are same-origin paths).
 */
import { headers } from "next/headers";

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return /^[a-z0-9.:[\]-]+$/i.test(host) ? `${proto === "http" ? "http" : "https"}://${host}` : "";
}
