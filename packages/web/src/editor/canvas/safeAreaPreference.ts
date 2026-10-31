// The safe-area settings are an editor preference kept in this browser, never in the project
// (spec ED-3). Storage may be off (a private window); the settings then last until a reload.
import { REFERENCE_SCREENS, type ReferenceScreen } from './safeArea';

const KEY = 'tapcue.safeArea';

export interface SafeAreaPreference {
  show: boolean;
  reference: ReferenceScreen;
}

export const SAFE_AREA_DEFAULTS: SafeAreaPreference = { show: false, reference: '16:10' };

export function readSafeArea(): SafeAreaPreference {
  try {
    const stored = JSON.parse(
      localStorage.getItem(KEY) ?? 'null',
    ) as Partial<SafeAreaPreference> | null;
    const reference = stored?.reference;
    return {
      show: stored?.show === true,
      reference:
        reference && reference in REFERENCE_SCREENS ? reference : SAFE_AREA_DEFAULTS.reference,
    };
  } catch {
    return SAFE_AREA_DEFAULTS;
  }
}

export function writeSafeArea(preference: SafeAreaPreference): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preference));
  } catch {
    // Not stored; it still applies until the page reloads.
  }
}
