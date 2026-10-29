// The three apps of Tapcue share one web app; the URL decides which one runs (architecture §4).
import { Navigate, type RouteObject } from 'react-router';
import { DemoRoute } from './demo/DemoRoute';
import { EditorRoute } from './editor/EditorRoute';
import { PlayerRoute } from './player/PlayerRoute';

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/edit" replace /> },
  { path: '/play/:stationId', element: <PlayerRoute /> },
  { path: '/edit', element: <EditorRoute /> },
  { path: '/demo', element: <DemoRoute /> },
];
