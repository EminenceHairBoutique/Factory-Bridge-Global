import type { MetadataRoute } from "next";
import { isSiteIndexingEnabled } from "@/site/indexing";

/**
 * robots.txt (B-31). Disallows everything until the founder enables indexing for a production launch; even
 * then the API stays disallowed. Gated preview routes are not named here: in production they are plain 404s.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexingEnabled(process.env)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" } };
}
