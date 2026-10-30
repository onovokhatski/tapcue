// Adds DOM matchers such as toBeInTheDocument() to expect(), unmounts after each test, and puts a
// fake WebSocket in place of the real one, so no test tries to reach a server.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { FakeWebSocket } from './fakeWebSocket';

beforeEach(() => {
  FakeWebSocket.all = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(cleanup);
