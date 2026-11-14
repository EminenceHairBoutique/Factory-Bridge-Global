// Test fixture: a sandbox child that exits cleanly after writing something that is not the protocol.
process.stdout.write('{"ok":true,"result":{"kind":"pdf","pageCount":1,"pages":[],"flags":[]}}');
