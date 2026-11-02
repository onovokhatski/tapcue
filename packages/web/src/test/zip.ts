// .zip files for tests, made with the same library the editor reads them with.
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { demoProjectJson } from './demoProject';

/** A .zip of name → text; a name ending in "/" is a folder. */
export async function makeZip(entries: [string, string][], name = 'stand.zip'): Promise<File> {
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false });
  for (const [path, text] of entries) {
    if (path.endsWith('/')) await writer.add(path, undefined, { directory: true });
    else await writer.add(path, new TextReader(text));
  }
  return new File([await writer.close()], name, { type: 'application/zip' });
}

/** An export of the demo stand, without its background files: enough for the dialog. */
export const demoZip = (name = 'demo-stand.zip') =>
  makeZip(
    [
      ['project.json', demoProjectJson],
      ['assets/', ''],
    ],
    name,
  );
