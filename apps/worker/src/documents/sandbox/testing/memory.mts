// Test fixture: a sandbox child that allocates until V8 gives up (the heap ceiling must end it).
const hoard: string[][] = [];
for (;;) hoard.push(new Array<string>(1_000_000).fill("x".repeat(8) + String(hoard.length)));
