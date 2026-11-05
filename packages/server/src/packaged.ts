// Entry point of the click-to-run app (ADR 0017), bundled into one file by `npm run build:app`.
// It holds no logic, so tests import launcher.ts without starting anything; no top-level await,
// since the bundle is CommonJS.
import { launch } from './launcher';

void launch();
