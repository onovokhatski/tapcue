// Builds the click-to-run app for this computer's system (ADR 0017): Node.js with the bundled server
// inside one executable (a Node single executable application), the web app and the demo stand
// next to it, and a .zip to download.
//
//   npm run package:app -w @tapcue/server
//
// macOS: dist/app/Tapcue.app and Tapcue-macos.zip. Windows: dist/app/Tapcue/Tapcue.exe and
// Tapcue-windows.zip. The app is not code-signed yet (ad hoc on macOS, so it runs at all).
import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const SERVER = resolve(import.meta.dirname, '..');
const ROOT = resolve(SERVER, '../..');
const OUT = join(SERVER, 'dist', 'app');
const WORK = join(OUT, '.work');
const windows = process.platform === 'win32';

function run(command: string, args: string[], options: ExecFileSyncOptions = {}) {
  // npm is npm.cmd on Windows, which only a shell can start.
  execFileSync(command, args, {
    stdio: 'inherit',
    shell: windows && command === 'npm',
    ...options,
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

// 1. The web app's build and the server in one CommonJS file.
run('npm', ['run', 'build'], { cwd: ROOT });
run('npm', ['run', 'build:app'], { cwd: SERVER });

// 2. The single-executable blob: the bundle, prepared for injection into a copy of Node.
const blob = join(WORK, 'tapcue.blob');
const seaConfig = join(WORK, 'sea-config.json');
writeFileSync(
  seaConfig,
  JSON.stringify({
    main: join(SERVER, 'dist', 'tapcue.cjs'),
    output: blob,
    disableExperimentalSEAWarning: true,
  }),
);
run(process.execPath, ['--experimental-sea-config', seaConfig]);

/** A copy of this Node.js that can be changed: an installed one may be read-only. */
function copyNode(target: string) {
  copyFileSync(process.execPath, target);
  chmodSync(target, 0o755);
}

/** Puts the blob inside a copy of Node.js (postject, Node's own tool for this). */
function injectBlob(target: string, extra: string[]) {
  const postject = createRequire(import.meta.url).resolve('postject/dist/cli.js');
  run(process.execPath, [
    postject,
    target,
    'NODE_SEA_BLOB',
    blob,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
    ...extra,
  ]);
}

/** What the app serves and opens on its first start. */
function copyResources(dir: string) {
  cpSync(join(ROOT, 'packages', 'web', 'dist'), join(dir, 'web'), { recursive: true });
  cpSync(join(ROOT, 'examples', 'demo-stand'), join(dir, 'demo-stand'), { recursive: true });
}

if (process.platform === 'darwin') {
  const app = join(OUT, 'Tapcue.app');
  const executable = join(app, 'Contents', 'MacOS', 'Tapcue');
  const resources = join(app, 'Contents', 'Resources');
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true });
  mkdirSync(resources, { recursive: true });

  // Node's own signature no longer matches once the blob is in.
  copyNode(executable);
  run('codesign', ['--remove-signature', executable]);
  injectBlob(executable, ['--macho-segment-name', 'NODE_SEA']);
  copyResources(resources);
  makeIcon(join(resources, 'Tapcue.icns'));
  writeFileSync(join(app, 'Contents', 'Info.plist'), infoPlist());
  // Apple silicon runs only signed code: the finished bundle is signed ad hoc ("-"), which needs
  // no Apple account. Last, so the signature covers the resources and Info.plist too.
  run('codesign', ['--sign', '-', '--force', '--deep', app]);
  run('codesign', ['--verify', '--deep', '--strict', app]);
  // ditto keeps the bundle's structure and the executable bit, which a plain zip may lose.
  run('ditto', ['-c', '-k', '--keepParent', app, join(OUT, 'Tapcue-macos.zip')]);
} else if (windows) {
  const dir = join(OUT, 'Tapcue');
  mkdirSync(dir, { recursive: true });
  copyNode(join(dir, 'Tapcue.exe'));
  injectBlob(join(dir, 'Tapcue.exe'), []);
  copyResources(dir);
  run('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${dir}' -DestinationPath '${join(OUT, 'Tapcue-windows.zip')}'`,
  ]);
} else {
  console.error('The click-to-run app is built on macOS and Windows.');
  process.exit(1);
}

rmSync(WORK, { recursive: true, force: true });
console.log(`\nThe app is in ${OUT}`);

/** The Tapcue icon in every size macOS asks for, from the brand's 512 px PNG. */
function makeIcon(target: string) {
  const iconset = join(WORK, 'Tapcue.iconset');
  mkdirSync(iconset);
  const source = join(ROOT, 'docs', 'design', 'brand', 'icon-512.png');
  for (const [name, size] of [
    ['16x16', 16],
    ['16x16@2x', 32],
    ['32x32', 32],
    ['32x32@2x', 64],
    ['128x128', 128],
    ['128x128@2x', 256],
    ['256x256', 256],
    ['256x256@2x', 512],
    ['512x512', 512],
  ] as const) {
    const out = join(iconset, `icon_${name}.png`);
    run('sips', ['-z', String(size), String(size), source, '--out', out], { stdio: 'ignore' });
  }
  run('iconutil', ['-c', 'icns', iconset, '-o', target]);
}

/**
 * LSUIElement: Tapcue has no window of its own (the editor opens in the browser), so it runs in the
 * background without a Dock icon that could only show "not responding".
 */
function infoPlist(): string {
  const version = (
    createRequire(import.meta.url)(join(ROOT, 'package.json')) as { version: string }
  ).version;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Tapcue</string>
  <key>CFBundleDisplayName</key><string>Tapcue</string>
  <key>CFBundleIdentifier</key><string>io.github.onovokhatski.tapcue</string>
  <key>CFBundleExecutable</key><string>Tapcue</string>
  <key>CFBundleIconFile</key><string>Tapcue</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`;
}
