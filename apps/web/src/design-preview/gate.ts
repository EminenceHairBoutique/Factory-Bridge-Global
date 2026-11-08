/**
 * Design-preview isolation gate (track UX-01).
 *
 * The prototype routes under `/design-preview` render synthetic data only and must never be reachable
 * from a production deployment. The rule is deliberately conservative:
 *
 *   - `NODE_ENV !== "production"`  → enabled (local `next dev`, unit tests).
 *   - `NODE_ENV === "production"`  → disabled, unless BOTH `APP_ENV` names a non-production environment
 *                                   (e.g. `staging`, `preview`) AND `DESIGN_PREVIEW=enabled` is set
 *                                   explicitly for that host.
 *
 * `APP_ENV=production` (or an unset `APP_ENV`) under a production build can never enable the routes,
 * whatever `DESIGN_PREVIEW` says. The layout calls `notFound()` when this returns false, so the routes
 * behave exactly like any unknown path.
 */
export interface DesignPreviewEnv {
  readonly NODE_ENV?: string | undefined;
  readonly APP_ENV?: string | undefined;
  readonly DESIGN_PREVIEW?: string | undefined;
}

export function isDesignPreviewEnabled(env: DesignPreviewEnv): boolean {
  if (env.NODE_ENV !== "production") return true;
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (!appEnv || appEnv === "production" || appEnv === "prod") return false;
  return env.DESIGN_PREVIEW?.trim().toLowerCase() === "enabled";
}
