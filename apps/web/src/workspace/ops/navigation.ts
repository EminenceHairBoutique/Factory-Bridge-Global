import { canProvisionStaff } from "@fbg/domain/workspace";
import type { MemberRole } from "@fbg/domain/enums";
import type { NavItem } from "../WorkspaceShell";
import { OPS_COPY, STAFF_COPY } from "../copy";

/** Ops workspace navigation: only routes that exist, filtered by role for clarity (not as a control). */
export function opsNav(role: MemberRole, current: "overview" | "staff" | null): NavItem[] {
  const items: NavItem[] = [
    { href: "/ops", label: OPS_COPY.overviewTitle, current: current === "overview" },
  ];
  if (canProvisionStaff(role))
    items.push({ href: "/ops/admin/staff", label: STAFF_COPY.nav, current: current === "staff" });
  return items;
}
