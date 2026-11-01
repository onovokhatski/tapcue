// Adds DOM matchers such as toBeInTheDocument() to expect(), unmounts after each test, puts a
// fake WebSocket in place of the real one, so no test tries to reach a server, and gives every
// test the same start: a 1440 × 900 window (the editor's full layout) and empty storage.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { FakeWebSocket } from './fakeWebSocket';
import { setWindowSize } from './windowSize';

beforeEach(() => {
  FakeWebSocket.all = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  setWindowSize(1440, 900);
  localStorage.clear();
});

afterEach(cleanup);
