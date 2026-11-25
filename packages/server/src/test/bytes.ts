// Test helper: the SHA-256 of some bytes, to check that two files are identical. Only for tests.
// `expect(buffer).toEqual(other)` walks a Buffer byte by byte in JavaScript: about 250 ms for a
// 200 kB image, enough to run a test into its 5 s timeout on a busy machine (issue #249). A hash
// still checks every byte, in under a millisecond, and a mismatch shows as two short strings.
import { createHash } from 'node:crypto';

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
