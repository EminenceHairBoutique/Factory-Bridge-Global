/**
 * The workspace's single seam onto the Atlas × Obsidian design system (B-05), mirroring site/design-system.ts.
 *
 * The approved primitives still live under `src/design-preview/` (owned by the design track; integration handoff H-1
 * moves them to `src/components/ui/`). Import nothing that carries synthetic data or preview routes: not
 * `ui/AppShell` / `ui/AuthFrame` (they pull in the preview nav and demo stripe), not `demo-data/*`, not `screens/*`.
 * workspace-isolation.test.ts enforces that.
 */
export {
  Badge,
  Button,
  EmptyState,
  Field,
  KeyValue,
  Notice,
  PageHeader,
  Panel,
  Section,
  Select,
  TextArea,
  TextInput,
  buttonClasses,
  cx,
  type Tone,
} from "@/design-preview/ui/primitives";
export { Icon, type IconName } from "@/design-preview/ui/icons";
export { ThemeScope } from "@/design-preview/theme";
