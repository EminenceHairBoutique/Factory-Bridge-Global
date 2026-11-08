/**
 * Minimal inline icon set for the design preview (no icon dependency added to the workspace).
 * 20 × 20 viewBox, 1.5 px strokes, `currentColor`. Every icon is decorative unless `label` is passed.
 */
import type { SVGProps } from "react";

type IconName =
  | "home"
  | "folder"
  | "plus"
  | "compare"
  | "upload"
  | "bell"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "alert"
  | "info"
  | "clock"
  | "document"
  | "shield"
  | "user"
  | "menu"
  | "x"
  | "search"
  | "external"
  | "download"
  | "globe"
  | "building"
  | "camera"
  | "message"
  | "eye"
  | "lock"
  | "list"
  | "truck"
  | "settings"
  | "flag";

const PATHS: Record<IconName, string> = {
  home: "M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1V9.5Z",
  folder: "M3 6a1 1 0 0 1 1-1h4l1.5 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z",
  plus: "M10 4v12M4 10h12",
  compare: "M3 5h6v10H3zM11 5h6v10h-6zM6 8v4M14 8v4",
  upload: "M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4 13v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2",
  bell: "M6 8a4 4 0 0 1 8 0v3l1.5 2.5h-11L6 11V8ZM8.5 16a1.5 1.5 0 0 0 3 0",
  "chevron-down": "m5 8 5 5 5-5",
  "chevron-right": "m8 5 5 5-5 5",
  "chevron-left": "m12 5-5 5 5 5",
  check: "m4 10.5 4 4 8-9",
  alert: "M10 3.5 17 16H3L10 3.5ZM10 8v4M10 14.2v.1",
  info: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM10 9v5M10 6.5v.1",
  clock: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM10 6v4.5l3 1.5",
  document: "M5 3h7l3 3v11H5V3ZM12 3v3h3M7.5 10h5M7.5 13h5",
  shield: "M10 3 4 5.5V10c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V5.5L10 3ZM7.5 10l2 2 3.5-4",
  user: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17a6 6 0 0 1 12 0",
  menu: "M3 6h14M3 10h14M3 14h14",
  x: "M5 5l10 10M15 5 5 15",
  search: "M9 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm3.5-1.5L17 17",
  external: "M11 4h5v5M16 4l-7 7M8 5H4v11h11v-4",
  download: "M10 4v9m0 0 3.5-3.5M10 13 6.5 9.5M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1",
  globe:
    "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14",
  building: "M4 17V4h8v13M12 8h4v9M7 7h2M7 10h2M7 13h2M14 11h.1M14 14h.1M3 17h14",
  camera: "M3 7h3l1.5-2h5L14 7h3v9H3V7Zm7 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  message: "M3 5h14v8h-7l-4 3v-3H3V5Z",
  eye: "M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Zm7.5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  lock: "M5 9h10v8H5V9Zm2 0V6.5a3 3 0 0 1 6 0V9M10 12.5v1.5",
  list: "M4 6h1M7 6h9M4 10h1M7 10h9M4 14h1M7 14h9",
  truck:
    "M3 6h9v7H3V6Zm9 2h3l2 3v2h-5V8ZM6 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  settings:
    "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6-2.5-1.3.6a5 5 0 0 1-.6 1.6l.6 1.3-1.4 1.4-1.3-.6a5 5 0 0 1-1.6.6L10 16l-1.3-.6a5 5 0 0 1-1.6-.6l-1.3.6-1.4-1.4.6-1.3a5 5 0 0 1-.6-1.6L4 10l.6-1.3a5 5 0 0 1 .6-1.6l-.6-1.3 1.4-1.4 1.3.6a5 5 0 0 1 1.6-.6L10 4l1.3.6a5 5 0 0 1 1.6.6l1.3-.6 1.4 1.4-.6 1.3a5 5 0 0 1 .6 1.6L16 10Z",
  flag: "M5 17V3m0 1h9l-2 3 2 3H5",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  /** Accessible label; when omitted the icon is hidden from assistive tech. */
  label?: string;
}

export function Icon({ name, size = 16, label, className, ...rest }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...a11y}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
