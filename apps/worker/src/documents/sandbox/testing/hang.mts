// Test fixture: a sandbox child that never answers (the runner must kill it at the timeout).
setInterval(() => undefined, 1_000);
