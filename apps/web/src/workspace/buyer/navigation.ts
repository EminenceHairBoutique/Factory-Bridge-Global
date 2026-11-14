import { canManageTeam, canWriteBuyerProjects } from "@fbg/domain/workspace";
import type { MemberRole } from "@fbg/domain/enums";
import type { NavItem } from "../WorkspaceShell";
import { BUYER_COPY } from "../copy";

/** Buyer workspace navigation: only routes that exist, filtered by role for clarity (not as a control). */
export function buyerNav(role: MemberRole, current: "overview" | "new" | "team" | null): NavItem[] {
  const items: NavItem[] = [
    { href: "/app", label: BUYER_COPY.overviewTitle, current: current === "overview" },
  ];
  if (canWriteBuyerProjects(role))
    items.push({
      href: "/app/projects/new",
      label: BUYER_COPY.newProject,
      current: current === "new",
    });
  if (canManageTeam(role))
    items.push({ href: "/app/settings/team", label: BUYER_COPY.team, current: current === "team" });
  return items;
}
