import { describe, expect, it } from 'vitest';
import { makeWindowed, readSubsystem, SUBSYSTEM } from './peSubsystem';

/**
 * The smallest file the functions read: "MZ", the PE header at 0x80, a COFF header and an optional
 * header with this magic and subsystem. The rest is filled with a pattern, to see that it stays.
 */
function fakeExe({ magic = 0x20b, subsystem = 3, at = 0x80 } = {}): Uint8Array {
  const bytes = new Uint8Array(at + 24 + 240);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) & 0xff;
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x5a4d, true); // MZ
  view.setUint32(0x3c, at, true);
  view.setUint32(at, 0x00004550, true); // PE\0\0
  view.setUint16(at + 24, magic, true);
  view.setUint16(at + 24 + 68, subsystem, true);
  return bytes;
}

describe('makeWindowed (issue #230)', () => {
  it.each([
    ['PE32+ (64-bit, as node.exe is)', 0x20b],
    ['PE32', 0x10b],
  ])('turns a console executable into a windowed one: %s', (_, magic) => {
    const exe = fakeExe({ magic });
    const before = Uint8Array.from(exe);
    expect(readSubsystem(exe)).toBe(SUBSYSTEM.console);
    makeWindowed(exe);
    expect(readSubsystem(exe)).toBe(SUBSYSTEM.gui);
    // Only the field changed: its low byte, 3 → 2.
    const changed = [...exe.keys()].filter((i) => exe[i] !== before[i]);
    expect(changed).toEqual([0x80 + 24 + 68]);
  });

  it('finds the header wherever e_lfanew says', () => {
    const exe = fakeExe({ at: 0x100 });
    makeWindowed(exe);
    expect(new DataView(exe.buffer).getUint16(0x100 + 24 + 68, true)).toBe(2);
  });

  it('leaves a windowed executable as it is', () => {
    const exe = fakeExe({ subsystem: 2 });
    const before = Uint8Array.from(exe);
    makeWindowed(exe);
    expect(exe).toEqual(before);
  });

  it('refuses another subsystem, and files that are not executables, changing nothing', () => {
    const efi = fakeExe({ subsystem: 10 });
    const before = Uint8Array.from(efi);
    expect(() => makeWindowed(efi)).toThrow('Expected a console executable, found subsystem 10');
    expect(efi).toEqual(before);

    const noMz = fakeExe();
    noMz[0] = 0;
    expect(() => makeWindowed(noMz)).toThrow('Not a Windows executable: no MZ header');
    const noPe = fakeExe();
    noPe[0x80] = 0;
    expect(() => makeWindowed(noPe)).toThrow('Not a Windows executable: no PE header');
    expect(() => makeWindowed(fakeExe({ magic: 0x107 }))).toThrow(
      'Not a Windows executable: unknown optional header 0x107',
    );
    expect(() => makeWindowed(new Uint8Array(10))).toThrow('no MZ header');
    // e_lfanew pointing past the end of the file.
    const short = fakeExe();
    new DataView(short.buffer).setUint32(0x3c, 0xffff, true);
    expect(() => makeWindowed(short)).toThrow('no PE header');
  });
});
