/**
 * The public site's single seam onto the Atlas × Obsidian design system (B-31).
 *
 * The approved primitives, icons and theme scope still live under `src/design-preview/` (owned by the design
 * track). Integration handoff H-1 moves them to `src/components/ui/` (B-05); when that happens only this file
 * changes. Import nothing here that carries synthetic data or preview routes: not `ui/AppShell` (it pulls in the
 * preview `nav.ts`), not `demo-data/*`, not any `screens/*`. site-isolation.test.ts enforces that.
 */
export {
  Badge,
  Button,
  Field,
  Notice,
  QuoteStatusTag,
  Select,
  StatusChip,
  TextArea,
  TextInput,
  buttonClasses,
  cx,
  type CostLineStatus,
  type QuoteTag,
} from "@/design-preview/ui/primitives";
export { Icon, type IconName } from "@/design-preview/ui/icons";
export { ThemeScope, THEME_OPTIONS, useTheme } from "@/design-preview/theme";
