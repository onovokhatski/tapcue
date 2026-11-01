import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { errorEntry, sentEntry } from '../../test/logEntries';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { TargetsTab } from './TargetsTab';

async function renderTab(project: Project = demoProject()) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const router = createMemoryRouter(
    [
      {
        path: '/edit/targets',
        element: (
          <EditorStoreContext value={store}>
            <TargetsTab />
          </EditorStoreContext>
        ),
      },
      { path: '/edit/pages', element: <p>Pages tab</p> },
    ],
    { initialEntries: ['/edit/targets'] },
  );
  render(<RouterProvider router={router} />);
  const state = () => store.getState();
  const target = (id: string) => state().project!.targets.find((t) => t.id === id);
  const list = () => within(screen.getByRole('complementary', { name: 'Targets' }));
  return { store, state, target, list, router };
}

describe('TargetsTab (spec TGT-1, ED-4)', () => {
  it('lists the targets with protocol and address, and shows the first one', async () => {
    const { list } = await renderTab();
    expect(screen.getByRole('heading', { name: 'Targets 3' })).toBeInTheDocument();
    expect(list().getByRole('button', { name: /Resolume/ })).toHaveTextContent(
      'OSC over UDP · 192.168.1.20:7000',
    );
    expect(list().getByRole('button', { name: /Demo receiver/ })).toHaveTextContent(
      'HTTP · http://localhost:4000',
    );
    expect(list().getByRole('button', { name: /Resolume/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Resolume' })).toBeInTheDocument();
  });

  it('edits the name and address; an invalid one stays in its field and is not saved (ED-10)', async () => {
    const { target } = await renderTab();
    fireEvent.change(screen.getByRole('textbox', { name: 'Host' }), {
      target: { value: '10.0.0.5' },
    });
    expect(target('t_resolm')).toMatchObject({ host: '10.0.0.5' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Port' }), { target: { value: '70000' } });
    expect(screen.getByRole('textbox', { name: 'Port' })).toHaveAccessibleDescription(
      'Expected a port from 1 to 65535',
    );
    expect(target('t_resolm')).toMatchObject({ port: 7000 });
    fireEvent.change(screen.getByRole('textbox', { name: 'Host' }), {
      target: { value: '192.168.1.400' },
    });
    expect(screen.getByRole('textbox', { name: 'Host' })).toHaveAccessibleDescription(
      'Each part of an IP address must be 0–255',
    );
    expect(
      screen.getByText(/2 fields need fixing\. Hotspots keep sending to the last valid address/),
    ).toHaveTextContent('10.0.0.5:7000');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Arena' } });
    expect(target('t_resolm')).toMatchObject({ name: 'Arena' });
  });

  it('edits an HTTP target base URL', async () => {
    const { target, list } = await renderTab();
    fireEvent.click(list().getByRole('button', { name: /Demo receiver/ }));
    const url = screen.getByRole('textbox', { name: 'Base URL' });
    fireEvent.change(url, { target: { value: 'http://10.0.0.9:8080' } });
    expect(target('t_demo00')).toMatchObject({ baseUrl: 'http://10.0.0.9:8080' });
    fireEvent.change(url, { target: { value: 'ftp://x' } });
    expect(url).toHaveAttribute('aria-invalid', 'true');
    expect(target('t_demo00')).toMatchObject({ baseUrl: 'http://10.0.0.9:8080' });
  });

  it('adds a target and selects it', async () => {
    const { state, list } = await renderTab();
    fireEvent.click(list().getByRole('button', { name: 'Add target' }));
    expect(state().project!.targets).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Target 4' })).toBeInTheDocument();
  });

  it('lists the hotspots that use the target, and opens one on the Pages tab', async () => {
    const { state, router } = await renderTab();
    expect(screen.getByRole('heading', { name: /^Used by \d+ hotspots?$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Product A card on Home/ }));
    expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: 'h_carda0' });
    expect(router.state.location.pathname).toBe('/edit/pages');
  });

  it('asks before switching the protocol of a target in use, then clears its commands', async () => {
    const { target, state } = await renderTab();
    fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Change “Resolume” to UDP?' });
    expect(dialog).toHaveTextContent(
      'Their commands will be cleared. Page links on those hotspots stay.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(target('t_resolm')).toMatchObject({ protocol: 'osc-udp' });
    fireEvent.click(screen.getByRole('radio', { name: 'UDP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change protocol' }));
    expect(target('t_resolm')).toMatchObject({ protocol: 'udp' });
    const commands = state()
      .project!.pages.flatMap((p) => p.hotspots)
      .filter((h) => h.action.command?.targetId === 't_resolm');
    expect(commands).toEqual([]);
  });

  it('switches the protocol of an unused target at once', async () => {
    const { list } = await renderTab();
    fireEvent.click(list().getByRole('button', { name: 'Add target' }));
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Target 4' })).getByRole('radio', { name: 'HTTP' }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(list().getByRole('button', { name: /Target 4/ })).toHaveTextContent(
      'HTTP · http://localhost:8080',
    );
  });

  it('deletes a target after asking, naming the hotspots whose commands are cleared', async () => {
    const { state } = await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Delete target' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete target “Resolume”?' });
    expect(dialog).toHaveTextContent(/send commands to it: .*Product A card/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete target' }));
    expect(state().project!.targets.map((t) => t.id)).toEqual(['t_projec', 't_demo00']);
    expect(screen.getByRole('region', { name: 'Projector' })).toBeInTheDocument();
  });

  it('invites to add the first target when there are none', async () => {
    const project = demoProject();
    project.targets = [];
    project.pages = project.pages.map((p) => ({
      ...p,
      hotspots: p.hotspots.map((h) => ({ ...h, action: { ...h.action, command: null } })),
    }));
    await renderTab(project);
    expect(screen.getByRole('heading', { name: 'Add your first target' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add target' })[1]!);
    expect(screen.getByRole('region', { name: 'Target 1' })).toBeInTheDocument();
  });

  it('shows the recent commands that went to the selected target', async () => {
    const { store } = await renderTab();
    act(() => {
      store.getState().logged(sentEntry); // Resolume
      store.getState().logged(errorEntry); // Demo receiver
    });
    const recent = screen.getByRole('region', { name: 'Recent commands' });
    expect(recent).toHaveTextContent('Product A card');
    expect(recent).not.toHaveTextContent('Call our team');
  });
});
