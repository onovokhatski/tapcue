// Reads the JSON examples straight from docs/project-format.md, so the documentation and the
// schemas cannot drift apart: if an example in the doc stops validating, a test fails.
import doc from '../../../../docs/project-format.md?raw';

/** The JSON code block under the given "## N. Title" heading. */
export function docExample(heading: string): unknown {
  const section = doc.split(/^## /m).find((part) => part.startsWith(heading));
  const json = section?.match(/```json\n([\s\S]*?)\n```/)?.[1];
  if (json === undefined) throw new Error(`No JSON example under "## ${heading}"`);
  return JSON.parse(json);
}
