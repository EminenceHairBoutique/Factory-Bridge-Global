// Test fixture: a sandbox child that writes without bound (the runner must kill it at the stdout cap).
const block = "x".repeat(64 * 1024);
const pump = (): void => {
  while (process.stdout.write(block)) {
    // keep writing until the pipe pushes back
  }
  process.stdout.once("drain", pump);
};
pump();
