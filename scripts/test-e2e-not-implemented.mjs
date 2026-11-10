#!/usr/bin/env node
// `pnpm test:e2e` placeholder (M0-D). There is no end-to-end suite yet: Playwright arrives with B-05 (auth flows).
// This command FAILS on purpose so that no script, CI step or report can mistake "nothing ran" for "e2e passed".
console.error(
  "test:e2e: no end-to-end suite exists yet (Playwright arrives with B-05 — auth flows). " +
    "Exiting 1 on purpose: nothing was tested.",
);
process.exit(1);
