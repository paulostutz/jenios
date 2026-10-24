#!/usr/bin/env node
/** Offline comparison only. Exit 2 always retains operational acceptance. */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { compareR70ProvidedTargetSnapshot } from '../../../lib/platform/research/robot-r70-target-snapshot.mjs';

try {
  const [flag, path, ...extra] = process.argv.slice(2);
  if (flag !== '--snapshot' || !path || extra.length) throw Error('R70_TARGET_SNAPSHOT_USAGE');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let text;
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size < 1 || before.size > 1048576) throw Error('R70_TARGET_SNAPSHOT_FILE');
    const bytes = Buffer.alloc(before.size + 1), read = await file.read(bytes, 0, bytes.length, 0), after = await file.stat();
    if (read.bytesRead !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
      throw Error('R70_TARGET_SNAPSHOT_FILE_CHANGED');
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, read.bytesRead));
  } finally { await file.close(); }
  process.stdout.write(JSON.stringify(compareR70ProvidedTargetSnapshot(JSON.parse(text)), null, 2) + '\n');
  process.exitCode = 2;
} catch {
  process.stderr.write('R70_TARGET_SNAPSHOT_INVALID\n'); process.exitCode = 1;
}
