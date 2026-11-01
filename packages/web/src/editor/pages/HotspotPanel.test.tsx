import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { placeHotspot } from '../operations/hotspots';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { HotspotPanel } from './HotspotPanel';

async function renderPanel(project: Project = demoProject()) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  act(() => store.getState().select({ pageId: 'p_home00', hotspotId: 'h_carda0' }));
  render(
    <EditorStoreContext value={store}>
      <HotspotPanel />
    </EditorStoreContext>,
  );
  const state = () => store.getState();
  const hotspots = () => state().project!.pages[0]!.hotspots;
  const cardA = () => hotspots().find((h) => h.id === 'h_carda0')!;
  const field = (name: string) => screen.getByRole('textbox', { name });
  return { store, state, hotspots, cardA, field };
}

describe('HotspotPanel', () => {
  it('shows the selected hotspot: name and its box in canvas pixels', async () => {
    const { field } = await renderPanel();
    expect(field('Name')).toHaveValue('Product A card');
    expect(
      [field('X'), field('Y'), field('Width'), field('Height')].map((f) => f.getAttribute('value')),
    ).toEqual(['144', '500', '560', '720']);
  });

  it('renames the hotspot', async () => {
    const { field, cardA } = await renderPanel();
    fireEvent.change(field('Name'), { target: { value: 'Card A' } });
    fireEvent.blur(field('Name'));
    expect(cardA().name).toBe('Card A');
  });

  describe('position and size (spec HS-2, ED-10)', () => {
    it('moves and resizes as a valid value is typed', async () => {
      const { field, cardA } = await renderPanel();
      fireEvent.change(field('X'), { target: { value: '200' } });
      fireEvent.change(field('Height'), { target: { value: '300' } });
      expect(cardA()).toMatchObject({ x: 200, y: 500, width: 560, height: 300 });
    });

    it('keeps an invalid value in its field with the reason, and changes nothing until it is fixed', async () => {
      const { field, cardA, state } = await renderPanel();
      fireEvent.change(field('X'), { target: { value: '1600' } }); // 1600 + 560 > 2048
      expect(field('X')).toHaveValue('1600');
      expect(field('X')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('X: 0 to 1488, to stay inside the canvas')).toBeInTheDocument();
      expect(cardA().x).toBe(144);
      expect(state().save).toEqual({ state: 'saved' });

      fireEvent.blur(field('X'));
      expect(field('X')).toHaveValue('1600'); // still there to be fixed

      fireEvent.change(field('X'), { target: { value: '1488' } });
      expect(cardA().x).toBe(1488);
      expect(screen.queryByText(/to stay inside the canvas/)).toBeNull();
    });

    it('follows the hotspot when it moves on the canvas', async () => {
      const { store, field } = await renderPanel();
      act(() =>
        store
          .getState()
          .change((p) =>
            placeHotspot(p, 'p_home00', 'h_carda0', { x: 10, y: 20, width: 30, height: 40 }),
          ),
      );
      expect(field('X')).toHaveValue('10');
      expect(field('Height')).toHaveValue('40');
    });

    it('goes back to following the hotspot after a valid edit', async () => {
      const { store, field } = await renderPanel();
      fireEvent.change(field('X'), { target: { value: '200' } });
      fireEvent.blur(field('X'));
      act(() =>
        store
          .getState()
          .change((p) =>
            placeHotspot(p, 'p_home00', 'h_carda0', { x: 300, y: 500, width: 560, height: 720 }),
          ),
      );
      expect(field('X')).toHaveValue('300');
    });
  });

  it('duplicates the hotspot and selects the copy (spec HS-7)', async () => {
    const { hotspots, state } = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate hotspot' }));
    const copy = hotspots()[1]!;
    expect(copy).toMatchObject({ name: 'Product A card', x: 164, y: 520 });
    expect(state().selection.hotspotId).toBe(copy.id);
  });

  it('deletes the hotspot; nothing is selected afterwards (spec HS-6)', async () => {
    const { hotspots, state } = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Delete hotspot' }));
    expect(hotspots().map((h) => h.id)).not.toContain('h_carda0');
    expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: null });
  });

  describe('stacking (spec HS-6)', () => {
    it('brings forward and sends backward, saying where it is', async () => {
      const { hotspots } = await renderPanel();
      const stacking = () => screen.getByRole('region', { name: 'Stacking' });
      expect(stacking()).toHaveTextContent('1 of 5 from the bottom');
      expect(within(stacking()).getByRole('button', { name: 'Send backward' })).toBeDisabled();
      fireEvent.click(within(stacking()).getByRole('button', { name: 'Bring forward' }));
      expect(hotspots()[1]!.id).toBe('h_carda0');
      expect(stacking()).toHaveTextContent('2 of 5 from the bottom');
      fireEvent.click(within(stacking()).getByRole('button', { name: 'Send backward' }));
      expect(hotspots()[0]!.id).toBe('h_carda0');
    });

    it('cannot bring the top hotspot further forward', async () => {
      const project = demoProject();
      const [first, ...rest] = project.pages[0]!.hotspots;
      project.pages[0]!.hotspots = [...rest, first!]; // Product A card on top
      await renderPanel(project);
      expect(screen.getByRole('button', { name: 'Bring forward' })).toBeDisabled();
    });
  });

  describe('safe area warning (spec ED-3)', () => {
    it('says how much is cropped, where, and what to do', async () => {
      const project = demoProject();
      project.canvas.scaleMode = 'fill';
      project.pages[0]!.hotspots[0]!.y = 100; // 28 px into the 128 px top band on 16:10
      await renderPanel(project);
      const warning = screen.getByRole('status');
      expect(warning).toHaveTextContent('Partly outside the safe area');
      expect(warning).toHaveTextContent(
        'Its top 28 px are cropped on 16:10 screens in Fill mode. Move it down 28 px, or use Fit in Settings.',
      );
    });

    it('stays away while the hotspot is in the safe area, and in fit', async () => {
      await renderPanel();
      expect(screen.queryByText('Partly outside the safe area')).toBeNull();
    });
  });

  describe('shape (spec HS-3)', () => {
    it('switches to an ellipse, which has no corner radius', async () => {
      const { cardA } = await renderPanel();
      expect(screen.getByRole('textbox', { name: 'Corner radius' })).toHaveValue('40');
      fireEvent.click(screen.getByRole('radio', { name: 'Ellipse' }));
      expect(cardA().shape).toEqual({ type: 'ellipse' });
      expect(screen.getByRole('textbox', { name: 'Corner radius' })).toBeDisabled();
      fireEvent.click(screen.getByRole('radio', { name: 'Rectangle' }));
      expect(cardA().shape).toEqual({ type: 'rect', cornerRadius: 0 });
    });

    it('sets the corner radius, and refuses one that is not a whole number', async () => {
      const { cardA } = await renderPanel();
      const radius = screen.getByRole('textbox', { name: 'Corner radius' });
      fireEvent.change(radius, { target: { value: '12' } });
      expect(cardA().shape).toEqual({ type: 'rect', cornerRadius: 12 });
      fireEvent.change(radius, { target: { value: '-3' } });
      expect(screen.getByText('Corner radius: expected a whole number')).toBeInTheDocument();
      expect(cardA().shape).toEqual({ type: 'rect', cornerRadius: 12 });
    });
  });

  describe('style (spec HS-4)', () => {
    it('says the hotspot is invisible while it has no fill and no border', async () => {
      await renderPanel();
      expect(
        screen.getByText('No fill and no border: visitors see only the artwork.'),
      ).toBeInTheDocument();
    });

    it('sets and clears the fill', async () => {
      const { cardA } = await renderPanel();
      fireEvent.change(screen.getByLabelText('Pick fill'), { target: { value: '#ff0000' } });
      expect(cardA().style.fill).toBe('#FF0000');
      expect(screen.queryByText(/visitors see only the artwork/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Set fill to None' }));
      expect(cardA().style.fill).toBeNull();
    });

    it('sets the opacity in percent, stored from 0 to 1', async () => {
      const { cardA } = await renderPanel();
      const opacity = screen.getByRole('textbox', { name: 'Opacity' });
      expect(opacity).toHaveValue('100');
      fireEvent.change(opacity, { target: { value: '40' } });
      expect(cardA().style.opacity).toBe(0.4);
      fireEvent.change(opacity, { target: { value: '140' } });
      expect(screen.getByText('Opacity: 0 to 100')).toBeInTheDocument();
      expect(cardA().style.opacity).toBe(0.4);
    });

    it('adds a border at 2 px, changes its width, and removes it', async () => {
      const { cardA } = await renderPanel();
      const width = () => screen.getByRole('textbox', { name: 'Border width' });
      expect(width()).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Pick border'), { target: { value: '#000000' } });
      expect(cardA().style.border).toEqual({ color: '#000000', width: 2 });
      fireEvent.change(width(), { target: { value: '6' } });
      expect(cardA().style.border).toEqual({ color: '#000000', width: 6 });
      fireEvent.change(width(), { target: { value: '0' } });
      expect(screen.getByText('Border width: 1 to 100')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Set border to None' }));
      expect(cardA().style.border).toBeNull();
      expect(width()).toBeDisabled();
    });

    it('keeps the border width when the border colour changes', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots[0]!.style.border = { color: '#000000', width: 7 };
      const { cardA } = await renderPanel(project);
      fireEvent.change(screen.getByRole('textbox', { name: 'border hex' }), {
        target: { value: '#FFFFFF' },
      });
      expect(cardA().style.border).toEqual({ color: '#FFFFFF', width: 7 });
    });
  });

  it('sets the press effect (spec HS-5)', async () => {
    const { cardA } = await renderPanel();
    const effect = screen.getByRole('combobox', { name: 'Press effect' });
    expect(effect).toHaveValue('press');
    expect([...effect.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'None',
      'Highlight',
      'Press-in',
      'Ripple',
    ]);
    fireEvent.change(effect, { target: { value: 'ripple' } });
    expect(cardA().pressEffect).toBe('ripple');
  });

  describe('on tap (spec ACT-1)', () => {
    const onTap = () => within(screen.getByRole('region', { name: 'On tap' }));
    const command = (state: () => { project: Project | null }) =>
      state().project!.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!.action.command;

    it('links to another page, or stays; its own page is not offered', async () => {
      const { cardA } = await renderPanel();
      const goTo = onTap().getByRole('combobox', { name: 'Go to page' });
      expect(goTo).toHaveValue('p_proda0');
      expect([...goTo.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
        'Stay on this page',
        'Product A',
        'Product B',
        'About us',
      ]);
      fireEvent.change(goTo, { target: { value: '' } });
      expect(cardA().action.goTo).toBeNull();
    });

    it('shows the OSC command with its target address, and edits the address', async () => {
      const { state } = await renderPanel();
      expect(onTap().getByText('192.168.1.20:7000')).toBeInTheDocument();
      const address = onTap().getByRole('textbox', { name: 'OSC address' });
      expect(address).toHaveValue('/composition/columns/2/connect');
      fireEvent.change(address, { target: { value: '/composition/columns/5/connect' } });
      expect(command(state)).toMatchObject({ address: '/composition/columns/5/connect' });
      fireEvent.change(address, { target: { value: 'columns/5' } });
      expect(address).toHaveAttribute('aria-invalid', 'true');
      expect(command(state)).toMatchObject({ address: '/composition/columns/5/connect' });
    });

    it('adds, edits, retypes and removes OSC arguments', async () => {
      const { state } = await renderPanel();
      const args = () => (command(state) as { args: unknown[] }).args;
      expect(args()).toEqual([{ type: 'i', value: 1 }]);
      fireEvent.click(onTap().getByRole('button', { name: 'Add argument' }));
      expect(args()).toEqual([
        { type: 'i', value: 1 },
        { type: 'i', value: 1 },
      ]);
      fireEvent.change(onTap().getByRole('combobox', { name: 'Argument 2 type' }), {
        target: { value: 's' },
      });
      fireEvent.change(onTap().getByRole('textbox', { name: 'Argument 2 value' }), {
        target: { value: 'intro' },
      });
      expect(args()[1]).toEqual({ type: 's', value: 'intro' });
      fireEvent.change(onTap().getByRole('textbox', { name: 'Argument 1 value' }), {
        target: { value: '1.5' },
      });
      expect(onTap().getByText('Expected a whole number')).toBeInTheDocument();
      expect(args()[0]).toEqual({ type: 'i', value: 1 });
      fireEvent.click(onTap().getByRole('button', { name: 'Remove argument 1' }));
      expect(args()).toEqual([{ type: 's', value: 'intro' }]);
    });

    it('switches to a UDP target with fresh fields; line endings are typed as \\r', async () => {
      const { state } = await renderPanel();
      fireEvent.change(onTap().getByRole('combobox', { name: 'Send command to' }), {
        target: { value: 't_projec' },
      });
      const text = onTap().getByRole('textbox', { name: 'Text' });
      expect(text).toHaveValue('GO');
      fireEvent.change(text, { target: { value: '%1INPT 31\\r' } });
      expect(command(state)).toEqual({ type: 'udp', targetId: 't_projec', text: '%1INPT 31\r' });
      fireEvent.change(text, { target: { value: '' } });
      expect(text).toHaveAttribute('aria-invalid', 'true');
      expect(command(state)).toMatchObject({ text: '%1INPT 31\r' });
    });

    it('switches to an HTTP target: method, path after the base URL, and a body only for POST and PUT', async () => {
      const { state } = await renderPanel();
      fireEvent.change(onTap().getByRole('combobox', { name: 'Send command to' }), {
        target: { value: 't_demo00' },
      });
      expect(onTap().getByText('Appended to http://localhost:4000')).toBeInTheDocument();
      fireEvent.change(onTap().getByRole('textbox', { name: 'Path' }), {
        target: { value: '/demo/screen-1/a' },
      });
      fireEvent.change(onTap().getByRole('textbox', { name: 'Body' }), {
        target: { value: '{"x":1}' },
      });
      expect(command(state)).toMatchObject({
        method: 'POST',
        path: '/demo/screen-1/a',
        body: '{"x":1}',
      });
      fireEvent.change(onTap().getByRole('textbox', { name: 'Body' }), { target: { value: '' } });
      expect(command(state)).toMatchObject({ body: null }); // an empty body is no body
      fireEvent.change(onTap().getByRole('textbox', { name: 'Body' }), {
        target: { value: '{"x":1}' },
      });
      fireEvent.click(onTap().getByRole('radio', { name: 'GET' }));
      expect(command(state)).toMatchObject({ method: 'GET', body: null });
      expect(onTap().getByRole('textbox', { name: 'Body' })).toBeDisabled();
      fireEvent.change(onTap().getByRole('textbox', { name: 'Path' }), {
        target: { value: 'demo' },
      });
      expect(onTap().getByRole('textbox', { name: 'Path' })).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(command(state)).toMatchObject({ path: '/demo/screen-1/a' });
    });

    it('offers Send test under a command, and not without one', async () => {
      await renderPanel();
      expect(onTap().getByRole('button', { name: 'Send test' })).toBeInTheDocument();
      fireEvent.change(onTap().getByRole('combobox', { name: 'Send command to' }), {
        target: { value: '' },
      });
      expect(onTap().queryByRole('button', { name: 'Send test' })).toBeNull();
    });

    it('sends nothing after "No command", and says so', async () => {
      const { cardA } = await renderPanel();
      fireEvent.change(onTap().getByRole('combobox', { name: 'Send command to' }), {
        target: { value: '' },
      });
      expect(cardA().action.command).toBeNull();
      expect(
        onTap().getByText('This hotspot sends no command. Choose a target to send one.'),
      ).toBeInTheDocument();
    });
  });
});
