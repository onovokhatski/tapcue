// Entry point of the Tapcue server (milestone M1).
// DELIBERATE LINT ERROR to show that CI fails; reverted in the next commit.
async function save(): Promise<void> {}
export function onTap(): void {
  save();
}
