// Test helper: a project written as Tapcue 0.4 and older wrote it, schema version 1, where each
// hotspot had one `action.command` instead of `action.commands` (ADR 0022). Only for tests.
interface Loose {
  schemaVersion: number;
  pages: { hotspots: { action: Record<string, unknown> }[] }[];
}

export function asVersion1(project: unknown): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(project)) as Loose;
  copy.schemaVersion = 1;
  for (const page of copy.pages) {
    for (const hotspot of page.hotspots) {
      const { goTo, commands } = hotspot.action as {
        goTo: unknown;
        commands: { command: unknown }[];
      };
      hotspot.action = { goTo, command: commands[0]?.command ?? null };
    }
  }
  return copy as unknown as Record<string, unknown>;
}
