"use client";

/**
 * "Skip to content" (WCAG 2.4.1). Without JavaScript it is a plain in-page link. With it, focus moves into
 * <main> and the temporary tabindex is removed on blur, so a click elsewhere in the page never resets the Tab
 * order to the top of <main> (a permanent tabindex=-1 would).
 */
import type { MouseEvent } from "react";
import { buttonClasses, cx } from "../design-system";
import { SECTION_IDS } from "../links";

export function SkipLink() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(SECTION_IDS.main);
    if (!main) return;
    e.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
    main.focus();
  };
  return (
    <a
      href={`#${SECTION_IDS.main}`}
      onClick={onClick}
      className={cx(buttonClasses("primary", "md"), "fbg-skip")}
    >
      Skip to content
    </a>
  );
}
