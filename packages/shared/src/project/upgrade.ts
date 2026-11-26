// Older project files, brought up to the current format before they are checked (project format
// §12). One function per version step; nothing else in Tapcue reads an old field.

/**
 * Version 1 → 2 (ADR 0022): each hotspot's `action.command` becomes `action.commands`, a list of
 * one step, or none for `null`. Anything that is not a version 1 project is returned as it is, so
 * the schema reports what is wrong with it; within a version 1 project, an action that does not
 * look like one is left for the schema too.
 */
export function upgradeProject(input: unknown): unknown {
  if (!isObject(input) || input['schemaVersion'] !== 1) return input;
  const pages = Array.isArray(input['pages']) ? input['pages'].map(upgradePage) : input['pages'];
  return { ...input, schemaVersion: 2, pages };
}

function upgradePage(page: unknown): unknown {
  if (!isObject(page) || !Array.isArray(page['hotspots'])) return page;
  return { ...page, hotspots: page['hotspots'].map(upgradeHotspot) };
}

function upgradeHotspot(hotspot: unknown): unknown {
  if (!isObject(hotspot) || !isObject(hotspot['action']) || !('command' in hotspot['action'])) {
    return hotspot;
  }
  const { command, ...action } = hotspot['action'];
  const commands = command === null ? [] : [{ command }];
  return { ...hotspot, action: { ...action, commands } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
