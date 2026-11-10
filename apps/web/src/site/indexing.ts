/**
 * Search-engine indexing gate for the public site (B-31). The site may not launch before OQ-02 (entity and
 * claims) and OQ-06 (privacy policy), so a deployment of this code stays out of search results unless the
 * founder explicitly opts in: APP_ENV=production AND SITE_INDEXING=enabled on a production build. Every other
 * combination serves `noindex` and a robots.txt that disallows crawling.
 */
export interface IndexingEnv {
  readonly NODE_ENV?: string | undefined;
  readonly APP_ENV?: string | undefined;
  readonly SITE_INDEXING?: string | undefined;
}

export function isSiteIndexingEnabled(env: IndexingEnv): boolean {
  if (env.NODE_ENV !== "production") return false;
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv !== "production" && appEnv !== "prod") return false;
  return env.SITE_INDEXING?.trim().toLowerCase() === "enabled";
}
