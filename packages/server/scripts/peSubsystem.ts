// Marks a Windows executable as a windowed program instead of a console one (issue #230).
//
// Tapcue.exe is a copy of node.exe, whose PE header says "console subsystem": Windows then opens a
// command-prompt window for it before any code runs. The packaged app has no window of its own,
// it opens the editor in the browser, so its copy is changed to "Windows GUI subsystem", which
// opens none. That is one 16-bit field of the header; nothing else in the file changes.
//
// PE layout used here (Microsoft's PE format documentation):
//   0x00        "MZ"
//   0x3C        uint32: where the PE header starts (e_lfanew)
//   e_lfanew    "PE\0\0", then the 20-byte COFF header
//   e_lfanew+24 the optional header: uint16 magic (0x10B PE32, 0x20B PE32+) …
//   … +68       uint16 Subsystem, at the same offset in PE32 and PE32+
//
// The header's checksum is left as it is: Windows checks it only for drivers and system DLLs.

export const SUBSYSTEM = { gui: 2, console: 3 } as const;

/** The header offsets, or why the buffer is not a PE executable. */
function locate(exe: Uint8Array): { subsystem: number } | string {
  const view = new DataView(exe.buffer, exe.byteOffset, exe.byteLength);
  if (exe.length < 0x40 || view.getUint16(0, true) !== 0x5a4d) return 'no MZ header';
  const pe = view.getUint32(0x3c, true);
  if (pe + 24 + 70 > exe.length || view.getUint32(pe, true) !== 0x00004550) {
    return 'no PE header';
  }
  const optional = pe + 24;
  const magic = view.getUint16(optional, true);
  if (magic !== 0x10b && magic !== 0x20b) return `unknown optional header 0x${magic.toString(16)}`;
  return { subsystem: optional + 68 };
}

/** The executable's subsystem: 2 for a windowed program, 3 for a console one. */
export function readSubsystem(exe: Uint8Array): number {
  const at = locate(exe);
  if (typeof at === 'string') throw new Error(`Not a Windows executable: ${at}`);
  return new DataView(exe.buffer, exe.byteOffset).getUint16(at.subsystem, true);
}

/**
 * Changes a console executable into a windowed one, in place. A program that is already windowed
 * is left alone; any other subsystem is refused, so a wrong file is never half changed.
 */
export function makeWindowed(exe: Uint8Array): void {
  const current = readSubsystem(exe);
  if (current === SUBSYSTEM.gui) return;
  if (current !== SUBSYSTEM.console) {
    throw new Error(`Expected a console executable, found subsystem ${current}`);
  }
  const at = locate(exe) as { subsystem: number };
  new DataView(exe.buffer, exe.byteOffset).setUint16(at.subsystem, SUBSYSTEM.gui, true);
}
