import type { NewProject, ProjectEntry } from '@tapcue/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { LibraryApi, Refused } from '../../lib/libraryApi';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { activeFirst, changed, problem, ProjectsTab } from './ProjectsTab';

const entry = (id: string, name: string, extra: Partial<ProjectEntry> = {}): ProjectEntry =>
  ({
    id,
    active: false,
    modified: '2026-11-20T10:15:00.000Z',
    ok: true,
    name,
    width: 2048,
    height: 1536,
    ...extra,
  }) as ProjectEntry;

const broken: ProjectEntry = {
  id: 'broken',
  active: false,
  modified: '2026-11-19T09:00:00.000Z',
  ok: false,
  errors: [
    { path: 'project.json', message: 'not valid JSON' },
    { path: 'name', message: 'Expected a name' },
  ],
};

/**
 * A server with a library of "Demo stand" (open), "WePlay 2026" and a broken project. `calls`
 * records every request in order, editor saves included.
 */
async function renderTab({
  demo = false,
  outside = false,
  refuse,
}: { demo?: boolean; outside?: boolean; refuse?: Refused } = {}) {
  const calls: string[] = [];
  let projects: ProjectEntry[] = [
    entry('weplay', 'WePlay 2026', { width: 1920, height: 1080 }),
    entry('stand', 'Demo stand', { active: !outside }),
    broken,
  ];
  let revision = 1;
  const nameOf = () => {
    const active = projects.find((p) => p.active);
    if (outside) return 'Stand from elsewhere';
    return active?.ok ? active.name : 'Demo stand';
  };
  const spies = {
    list: vi.fn<LibraryApi['list']>(() => {
      calls.push('list');
      return Promise.resolve({
        projects,
        active: {
          id: outside ? null : (projects.find((p) => p.active)?.id ?? null),
          name: nameOf(),
        },
      });
    }),
    create: vi.fn<LibraryApi['create']>((input: NewProject) => {
      calls.push(`create ${input.name} ${input.width}x${input.height}`);
      if (refuse) return Promise.resolve(refuse);
      projects = [...projects, entry('hall-b', input.name)];
      return Promise.resolve({ ok: true as const, id: 'hall-b' });
    }),
    open: vi.fn<LibraryApi['open']>((id: string) => {
      calls.push(`open ${id}`);
      if (refuse) return Promise.resolve(refuse);
      projects = projects.map((p) => ({ ...p, active: p.id === id }));
      revision += 1;
      return Promise.resolve({ ok: true as const, revision });
    }),
    remove: vi.fn<LibraryApi['remove']>((id: string) => {
      calls.push(`remove ${id}`);
      if (refuse) return Promise.resolve(refuse);
      projects = projects.filter((p) => p.id !== id);
      return Promise.resolve({ ok: true as const });
    }),
  };
  const api: LibraryApi = spies;
  const store = createEditorStore({
    load: () => Promise.resolve({ revision, project: { ...demoProject(), name: nameOf() }, demo }),
    save: (project) => {
      calls.push(`save ${project.name}`);
      return Promise.resolve({ ok: true, revision });
    },
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const router = createMemoryRouter(
    [
      { path: '/edit/projects', element: <ProjectsTab api={api} /> },
      { path: '/edit/pages', element: <p>Pages tab</p> },
    ],
    { initialEntries: ['/edit/projects'] },
  );
  render(
    <EditorStoreContext value={store}>
      <RouterProvider router={router} />
    </EditorStoreContext>,
  );
  await screen.findByRole('region', { name: 'Projects' });
  return { api: spies, calls, store, router, state: () => store.getState() };
}

const row = (name: string) => within(screen.getByRole('group', { name }));

describe('ProjectsTab (spec PRJ-5)', () => {
  it('lists the projects, the open one first, with size and last change', async () => {
    await renderTab();

    const rows = within(screen.getByRole('region', { name: 'Projects' })).getAllByRole('group');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Demo stand',
      'WePlay 2026',
      'broken',
    ]);
    // The time is local to the computer running the test, so only the minutes are certain.
    expect(
      row('WePlay 2026').getByText(/^1920 × 1080 · Changed 20 Nov 2026, \d\d:15$/),
    ).toBeTruthy();
    expect(row('Demo stand').getByText('Open')).toBeTruthy(); // the badge
    expect(
      row('Demo stand').getByText('Runs on every station. Open another to delete it.'),
    ).toBeTruthy();
  });

  it('offers no action on the open project, and only Delete on one that does not load', async () => {
    await renderTab();

    expect(row('Demo stand').queryAllByRole('button')).toEqual([]);
    expect(
      row('broken')
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Delete broken']);
    expect(
      row('broken').getByText('Does not load: project.json: not valid JSON (and 1 more)'),
    ).toBeTruthy();
    expect(row('WePlay 2026').getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(row('WePlay 2026').getByRole('button', { name: 'Delete WePlay 2026' })).toBeTruthy();
  });

  it('shows a project opened from a folder outside the library as the open one', async () => {
    await renderTab({ outside: true });

    const outsideRow = row('Stand from elsewhere');
    expect(outsideRow.getByText('Opened from a folder outside the projects library')).toBeTruthy();
    expect(outsideRow.getByText('Open')).toBeTruthy();
    expect(outsideRow.queryAllByRole('button')).toEqual([]);
    // Every project in the library can be opened then, the demo stand too.
    expect(row('Demo stand').getByRole('button', { name: 'Open' })).toBeTruthy();
  });

  it('says when the list cannot be read', async () => {
    const { api } = await renderTab();
    api.list.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(row('broken').getByRole('button', { name: 'Delete broken' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete project' }),
    );

    expect(await screen.findByText('Cannot list the projects')).toBeTruthy();
  });
});

describe('reading the list again', () => {
  it('keeps the newest answer when an older one arrives late', async () => {
    const { api, store } = await renderTab();
    let late!: (list: Awaited<ReturnType<typeof api.list>>) => void;
    api.list.mockImplementationOnce(() => new Promise((resolve) => (late = resolve)));

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Delete WePlay 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2)); // the slow one, held
    act(() => store.setState({ revision: 9 })); // another editor opened a project: asks again
    await waitFor(() => expect(screen.queryByRole('group', { name: 'WePlay 2026' })).toBeNull());
    await act(async () => {
      late({ projects: [entry('ghost', 'From the old answer')], active: { id: null, name: 'x' } });
      await Promise.resolve();
    });

    expect(screen.queryByRole('group', { name: 'From the old answer' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Demo stand' })).toBeTruthy();
  });
});

describe('opening a project (spec PRJ-7)', () => {
  it('turns the confirm button off while the project opens', async () => {
    const { api } = await renderTab();
    let finish!: (answer: { ok: true; revision: number }) => void;
    api.open.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }));

    const busy = await screen.findByRole('button', { name: 'Opening…' });
    expect(busy).toHaveProperty('disabled', true);
    await act(async () => {
      finish({ ok: true, revision: 2 });
      await Promise.resolve();
    });
  });

  it('asks first, and opens nothing on Cancel', async () => {
    const { api } = await renderTab();

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Open' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Open “WePlay 2026”?' }));
    expect(dialog.getByText(/Every station and editor switches to it now/)).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.open).not.toHaveBeenCalled();
  });

  it('saves what waits first, then opens it, loads it and shows the Pages tab', async () => {
    const { calls, state, router } = await renderTab();
    act(() => state().change((project) => ({ ...project, name: 'Last edit of the stand' })));

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/edit/pages'));
    expect(calls.filter((c) => !c.startsWith('list'))).toEqual([
      'save Last edit of the stand',
      'open weplay',
    ]);
    await waitFor(() => expect(state().project?.name).toBe('WePlay 2026'));
    expect(state().revision).toBe(2);
  });

  it('shows the server refusal and stays on the page', async () => {
    const refuse = {
      ok: false as const,
      reason: 'The project could not be opened: it has invalid values.',
      errors: [],
    };
    const { router } = await renderTab({ refuse });

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }));

    expect(await screen.findByText(refuse.reason)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/edit/projects');
  });
});

describe('deleting a project (spec PRJ-8)', () => {
  it('asks first, naming the folder and the .trash folder, and deletes nothing on Cancel', async () => {
    const { api } = await renderTab();

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Delete WePlay 2026' }));
    const dialog = within(screen.getByRole('alertdialog', { name: 'Delete “WePlay 2026”?' }));
    expect(dialog.getByText('weplay')).toBeTruthy();
    expect(dialog.getByText('.trash')).toBeTruthy();
    // A danger dialog starts on Cancel, so Enter never deletes by accident.
    expect(document.activeElement).toBe(dialog.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(api.remove).not.toHaveBeenCalled();
  });

  it('deletes it and lists the projects again', async () => {
    const { api } = await renderTab();

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Delete WePlay 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'WePlay 2026' })).toBeNull());
    expect(api.remove).toHaveBeenCalledWith('weplay');
  });

  it('shows the server refusal', async () => {
    const refuse = {
      ok: false as const,
      reason: 'This project is open on every station: open another one first.',
      errors: [],
    };
    await renderTab({ refuse });

    fireEvent.click(row('WePlay 2026').getByRole('button', { name: 'Delete WePlay 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));

    expect(await screen.findByText(refuse.reason)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'WePlay 2026' })).toBeTruthy();
  });
});

describe('a new project (spec PRJ-6)', () => {
  const dialog = () => within(screen.getByRole('dialog', { name: 'New project' }));

  it('starts on the name, with the demo stand’s size', async () => {
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    expect(document.activeElement).toBe(dialog().getByRole('textbox', { name: 'Name' }));
    expect(dialog().getByRole('combobox', { name: 'Canvas size' })).toHaveProperty(
      'value',
      '2048x1536',
    );
    expect(dialog().getByRole('textbox', { name: 'Width' })).toHaveProperty('value', '2048');
    expect(dialog().getByRole('textbox', { name: 'Height' })).toHaveProperty('value', '1536');
  });

  it('creates it with a preset size, opens it and shows the Pages tab', async () => {
    const { calls, router, state } = await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    fireEvent.change(dialog().getByRole('textbox', { name: 'Name' }), {
      target: { value: '  Hall B ' },
    });
    fireEvent.change(dialog().getByRole('combobox', { name: 'Canvas size' }), {
      target: { value: '1920x1080' },
    });
    fireEvent.click(dialog().getByRole('button', { name: 'Create and open' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/edit/pages'));
    expect(calls.filter((c) => !c.startsWith('list'))).toEqual([
      'create Hall B 1920x1080',
      'open hall-b',
    ]);
    await waitFor(() => expect(state().project?.name).toBe('Hall B'));
  });

  it('shows a typed size as Custom, and creates with it on Enter in the name', async () => {
    const { calls } = await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    fireEvent.change(dialog().getByRole('textbox', { name: 'Width' }), {
      target: { value: '1000' },
    });
    expect(dialog().getByRole('combobox', { name: 'Canvas size' })).toHaveProperty(
      'value',
      'custom',
    );
    const name = dialog().getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Kiosk' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() => expect(calls).toContain('create Kiosk 1000x1536'));
  });

  it('shows what is wrong on each field and sends nothing', async () => {
    const { api } = await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    fireEvent.change(dialog().getByRole('textbox', { name: 'Width' }), { target: { value: '0' } });
    fireEvent.change(dialog().getByRole('textbox', { name: 'Height' }), {
      target: { value: '12.5' },
    });
    fireEvent.click(dialog().getByRole('button', { name: 'Create and open' }));

    expect(dialog().getByText('Expected a name')).toBeTruthy();
    expect(dialog().getByText('Expected at least 1 px')).toBeTruthy();
    expect(dialog().getByText('Expected a whole number of pixels')).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();

    fireEvent.change(dialog().getByRole('textbox', { name: 'Name' }), { target: { value: 'A' } });
    expect(dialog().queryByText('Expected a name')).toBeNull(); // cleared once typed again
  });

  it('shows a field the server refuses on that field, and keeps the dialog open', async () => {
    const refuse = {
      ok: false as const,
      reason: 'The project could not be created: it has invalid values.',
      errors: [{ path: 'name', message: 'Expected at most 100 characters' }],
    };
    const { api } = await renderTab({ refuse });
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    fireEvent.change(dialog().getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Hall B' },
    });
    fireEvent.click(dialog().getByRole('button', { name: 'Create and open' }));

    expect(await dialog().findByText('Expected at most 100 characters')).toBeTruthy();
    expect(api.open).not.toHaveBeenCalled();
  });

  it('shows a refusal without fields in the dialog', async () => {
    const refuse = { ok: false as const, reason: 'Not available in demo mode.', errors: [] };
    await renderTab({ refuse });
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));

    fireEvent.change(dialog().getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Hall B' },
    });
    fireEvent.click(dialog().getByRole('button', { name: 'Create and open' }));

    expect((await dialog().findByRole('alert')).textContent).toBe('Not available in demo mode.');
  });
});

describe('in demo mode (spec DEMO-3)', () => {
  it('says so and turns every action off', async () => {
    await renderTab({ demo: true });

    expect(screen.getByText('Creating, opening and deleting projects is turned off.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New project' })).toHaveProperty('disabled', true);
    for (const button of row('WePlay 2026').getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});

describe('helpers', () => {
  it('puts the open project first and keeps the server’s order for the rest', () => {
    const list = [entry('a', 'A'), entry('b', 'B', { active: true }), entry('c', 'C')];
    expect(activeFirst(list).map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('writes the change time the same way on every computer', () => {
    expect(changed('2026-01-05T08:07:00.000Z')).toMatch(/^Changed 5 Jan 2026, \d\d:07$/);
  });

  it('says why a project does not load', () => {
    expect(problem({ ...broken, errors: [] })).toBe('Does not load: unknown problem');
  });
});
