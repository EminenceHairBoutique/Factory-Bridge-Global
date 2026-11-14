// Test fixture: a sandbox child that answers a different question than it was asked (a sheet for a PDF job).
process.stdout.write(
  JSON.stringify({
    ok: true,
    result: {
      kind: "sheet",
      format: "csv",
      sheets: [{ name: "csv", hidden: false, cellCount: 1 }],
      cells: [{ s: 0, r: 1, c: 1, v: "smuggled", t: "s" }],
      flags: [],
    },
  }),
);
