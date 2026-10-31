// New ids for pages, hotspots and targets: a type prefix and six random characters, never reused
// (project format §9.2).
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `random` returns a number in [0, 1); tests pass a fixed sequence. */
export function newId(
  prefix: 'p' | 'h' | 't',
  taken: Iterable<string>,
  random: () => number = Math.random,
): string {
  const used = new Set(taken);
  for (;;) {
    let id = `${prefix}_`;
    for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(random() * ALPHABET.length)];
    if (!used.has(id)) return id;
  }
}
