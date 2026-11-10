/**
 * Pre-hydration appearance script for the public site — the same contract as the design preview's THEME_BOOT
 * (app/design-preview/layout.tsx): one validated localStorage key (shared, so the visitor's Atlas/Obsidian/
 * System choice is the same everywhere on the origin) or `?theme=atlas|obsidian`, written as
 * `<meta name="fbg-theme">`, which design-preview.css reads with `:has()` until React applies the choice.
 * Emitted as raw HTML so it runs at parse time; it reads nothing else and sends nothing anywhere.
 */
export const THEME_STORAGE_KEY = "fbg-design-preview-theme";

export const SITE_THEME_BOOT =
  '<script>(function(){try{var p=new URLSearchParams(location.search).get("theme");' +
  `var v=(p==="atlas"||p==="obsidian")?p:localStorage.getItem("${THEME_STORAGE_KEY}");` +
  'if(v==="atlas"||v==="obsidian"||v==="system"){var m=document.createElement("meta");' +
  'm.name="fbg-theme";m.content=v;document.head.appendChild(m)}}catch(e){}})();</script>';
