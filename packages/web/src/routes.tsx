// The three apps of Tapcue share one web app; the URL decides which one runs (architecture §4).
import { Navigate, type RouteObject } from 'react-router';
import { DemoRoute } from './demo/DemoRoute';
import { EditorRoute } from './editor/EditorRoute';
import { PlayerRoute } from './player/PlayerRoute';

export const routes: RouteObject[] = [
  // The server root opens the editor (spec ED-11).
  { path: '/', element: <Navigate to="/edit/pages" replace /> },
  { path: '/play/:stationId', element: <PlayerRoute /> },
  { path: '/edit', element: <Navigate to="/edit/pages" replace /> },
  { path: '/edit/:tab', element: <EditorRoute /> },
  { path: '/demo', element: <DemoRoute /> },
];
