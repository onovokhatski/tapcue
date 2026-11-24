import type { Hotspot, LogEntry, Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TestSent } from '../../lib/projectApi';
import { demoProject } from '../../test/demoProject';
import { DEFAULT_TEXT, placeHotspot } from '../operations/hotspots';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { HotspotPanel } from './HotspotPanel';

const testSends: unknown[][] = [];

async function renderPanel(
  project: Project = demoProject(),
  answer: TestSent = { ok: false, reason: 'Recorded by the test' },
) {
  testSends.length = 0;
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: (...args: unknown[]) => {
      testSends.push(args);
      return Promise.resolve(answer);
    },
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  act(() => store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_carda0'] }));
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

  describe('unique names (spec ED-14)', () => {
    const HINT = 'Already used on this page by another hotspot';

    it('refuses a name another hotspot on the page has, keeping the text with a hint', async () => {
      const { field, cardA } = await renderPanel();
      fireEvent.change(field('Name'), { target: { value: 'product b card ' } });
      expect(field('Name')).toHaveAccessibleDescription(HINT);
      expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
      fireEvent.blur(field('Name'));
      expect(cardA().name).toBe('Product A card');
      expect(field('Name')).toHaveValue('product b card ');
      fireEvent.change(field('Name'), { target: { value: 'Product A' } });
      expect(field('Name')).not.toHaveAccessibleDescription(HINT);
      fireEvent.keyDown(field('Name'), { key: 'Enter' });
      expect(cardA().name).toBe('Product A');
    });

    it('leaves a duplicate from an older project alone until it is edited', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots[1]!.name = 'Product A card';
      const { field, cardA } = await renderPanel(project);
      expect(field('Name')).toHaveValue('Product A card');
      expect(field('Name')).not.toHaveAttribute('aria-invalid', 'true');
      fireEvent.blur(field('Name'));
      expect(cardA().name).toBe('Product A card');
    });

    it('shows the new name when a new kind renames the hotspot', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots[0]!.name = 'Button 1';
      const { field, cardA } = await renderPanel(project);
      fireEvent.click(screen.getByRole('radio', { name: 'Fader' }));
      expect(cardA().name).toBe('Fader 1');
      expect(field('Name')).toHaveValue('Fader 1');
      fireEvent.blur(field('Name'));
      expect(cardA().name).toBe('Fader 1');
    });
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

    it('moves the hotspot while X is dragged, up to the canvas edge, then follows it again', async () => {
      const { store, field, cardA } = await renderPanel();
      const handle = within(field('X').closest('label')!).getByText('X');
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 6 });
      expect(cardA().x).toBe(150);
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000 }); // past 2048 - 560
      expect(cardA().x).toBe(1488);
      expect(field('X')).not.toHaveAttribute('aria-invalid');
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 5000 });
      act(() =>
        store
          .getState()
          .change((p) =>
            placeHotspot(p, 'p_home00', 'h_carda0', { x: 300, y: 500, width: 560, height: 720 }),
          ),
      );
      expect(field('X')).toHaveValue('300');
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
    expect(copy).toMatchObject({ name: 'Product A card 2', x: 164, y: 520 });
    expect(state().selection.hotspotIds).toEqual([copy.id]);
  });

  it('copies the hotspot for pasting on any page (spec ED-17)', async () => {
    const { state } = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(state().clipboard).toMatchObject({
      pageId: 'p_home00',
      hotspots: [{ id: 'h_carda0', name: 'Product A card' }],
    });
  });

  it('deletes the hotspot; nothing is selected afterwards (spec HS-6)', async () => {
    const { hotspots, state } = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Delete hotspot' }));
    expect(hotspots().map((h) => h.id)).not.toContain('h_carda0');
    expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
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

    it('sets the frost in px, 0 for none, and the hotspot is no longer invisible (spec HS-8)', async () => {
      const { cardA } = await renderPanel();
      const frost = screen.getByRole('textbox', { name: 'Frost' });
      expect(frost).toHaveValue('0');
      fireEvent.change(frost, { target: { value: '20' } });
      expect(cardA().style.backdropBlur).toBe(20);
      expect(screen.queryByText(/visitors see only the artwork/)).toBeNull();
      fireEvent.change(frost, { target: { value: '101' } });
      expect(screen.getByText('Frost: 0 to 100')).toBeInTheDocument();
      expect(cardA().style.backdropBlur).toBe(20);
      fireEvent.change(frost, { target: { value: '0' } });
      expect(cardA().style).not.toHaveProperty('backdropBlur');
    });

    it('sets the fill opacity in percent, only while there is a fill (spec HS-4)', async () => {
      const { cardA } = await renderPanel();
      const fillOpacity = () => screen.getByRole('textbox', { name: 'Fill opacity' });
      expect(fillOpacity()).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Pick fill'), { target: { value: '#ffffff' } });
      expect(fillOpacity()).toHaveValue('100');
      fireEvent.change(fillOpacity(), { target: { value: '30' } });
      expect(cardA().style).toMatchObject({ fillOpacity: 0.3, opacity: 1 });
      fireEvent.change(fillOpacity(), { target: { value: '120' } });
      expect(screen.getByText('Fill opacity: 0 to 100')).toBeInTheDocument();
      expect(cardA().style.fillOpacity).toBe(0.3);
      fireEvent.change(fillOpacity(), { target: { value: '100' } });
      expect(cardA().style).not.toHaveProperty('fillOpacity');
    });

    it('does not call a hotspot with an image invisible (spec HS-9)', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots[0]!.style.image = 'assets/home.jpg';
      await renderPanel(project);
      expect(screen.queryByText(/visitors see only the artwork/)).toBeNull();
      expect(screen.getByText('home.jpg')).toBeInTheDocument();
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

  describe('text (spec HS-10)', () => {
    it('adds a label, which makes the hotspot visible, and removes it', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
      expect(cardA().text).toMatchObject({ content: 'Label', align: 'center' });
      expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('Label');
      expect(screen.queryByText(/visitors see only the artwork/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Remove text' }));
      expect(cardA()).not.toHaveProperty('text');
      expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();
    });

    it('changes the words, keeping empty text out of the project', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
      const words = screen.getByRole('textbox', { name: 'Text' });
      fireEvent.change(words, { target: { value: 'Play\nthe reel' } });
      expect(cardA().text?.content).toBe('Play\nthe reel');
      fireEvent.change(words, { target: { value: '  ' } });
      expect(screen.getByText('Type some text, or remove the label')).toBeInTheDocument();
      expect(cardA().text?.content).toBe('Play\nthe reel');
    });

    it('sets size and padding within their limits', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Text size' }), {
        target: { value: '72' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Text padding' }), {
        target: { value: '0' },
      });
      expect(cardA().text).toMatchObject({ size: 72, padding: 0 });
      fireEvent.change(screen.getByRole('textbox', { name: 'Text size' }), {
        target: { value: '7' },
      });
      expect(screen.getByText('Size: 8 to 400')).toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: 'Text padding' }), {
        target: { value: '501' },
      });
      expect(screen.getByText('Padding: 0 to 500')).toBeInTheDocument();
      expect(cardA().text).toMatchObject({ size: 72, padding: 0 });
    });

    it('sets weight, alignment, position and colour', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Bold' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Left' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Bottom' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'text hex' }), {
        target: { value: '#112233' },
      });
      expect(cardA().text).toMatchObject({
        weight: 'bold',
        align: 'left',
        verticalAlign: 'bottom',
        color: '#112233',
      });
    });
  });

  describe('fader (spec FD-1, ADR 0020)', () => {
    async function asFader() {
      const panel = await renderPanel();
      fireEvent.click(screen.getByRole('radio', { name: 'Fader' }));
      return panel;
    }
    const field = (name: string) => screen.getByRole('textbox', { name });

    it('turns the hotspot into a fader: no page change, no press effect', async () => {
      const { cardA } = await asFader();
      expect(cardA()).toMatchObject({ kind: 'fader', pressEffect: 'none' });
      expect(screen.getByText('While dragged')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Go to page' })).toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Press effect' })).toBeNull();
      fireEvent.click(screen.getByRole('radio', { name: 'Button' }));
      expect(cardA()).not.toHaveProperty('kind');
      expect(screen.getByRole('combobox', { name: 'Go to page' })).toBeInTheDocument();
    });

    it('sets direction, range, step and start, each only when it fits the others', async () => {
      const { cardA } = await asFader();
      fireEvent.click(screen.getByRole('radio', { name: 'Horizontal' }));
      fireEvent.change(field('Fader max'), { target: { value: '100' } });
      fireEvent.change(field('Fader step'), { target: { value: '5' } });
      fireEvent.change(field('Fader start'), { target: { value: '50' } });
      expect(cardA().fader).toMatchObject({
        orientation: 'horizontal',
        min: 0,
        max: 100,
        step: 5,
        start: 50,
      });
      fireEvent.change(field('Fader max'), { target: { value: '40' } });
      expect(screen.getByText('Max: at least the start value (50)')).toBeInTheDocument();
      fireEvent.change(field('Fader min'), { target: { value: '60' } });
      expect(screen.getByText('Min: at most the start value (50)')).toBeInTheDocument();
      fireEvent.change(field('Fader step'), { target: { value: '0' } });
      expect(screen.getByText('Step: more than 0')).toBeInTheDocument();
      fireEvent.change(field('Fader start'), { target: { value: '101' } });
      expect(screen.getByText('Start: 0 to 100')).toBeInTheDocument();
      fireEvent.change(field('Fader start'), { target: { value: 'half' } });
      expect(screen.getByText('Start: expected a number')).toBeInTheDocument();
      expect(cardA().fader).toMatchObject({ min: 0, max: 100, step: 5, start: 50 });
    });

    it('sends the value as a whole number only with a whole step', async () => {
      const { cardA } = await asFader();
      fireEvent.click(screen.getByRole('radio', { name: 'Whole' }));
      expect(
        screen.getByText('Whole needs a whole-number step: change the step first.'),
      ).toBeInTheDocument();
      expect(cardA().fader?.value.as).toBe('f');
      fireEvent.change(field('Fader max'), { target: { value: '255' } });
      fireEvent.change(field('Fader step'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('radio', { name: 'Whole' }));
      expect(cardA().fader?.value.as).toBe('i');
      fireEvent.change(field('Fader step'), { target: { value: '0.5' } });
      expect(
        screen.getByText('Step: a whole number, since the value is sent as one'),
      ).toBeInTheDocument();
    });

    it('places the value among the OSC arguments, up to after the last one', async () => {
      const { cardA } = await asFader(); // Product A card's command has one argument
      expect(field('Value position')).toHaveValue('1');
      fireEvent.change(field('Value position'), { target: { value: '0' } });
      expect(cardA().fader?.value.at).toBe(0);
      fireEvent.change(field('Value position'), { target: { value: '2' } });
      expect(
        screen.getByText('Value position: 0 to 1, the number of arguments'),
      ).toBeInTheDocument();
      expect(cardA().fader?.value.at).toBe(0);
    });

    describe('UDP and HTTP commands with {value} (ADR 0020)', () => {
      const dragged = () => within(screen.getByRole('region', { name: 'While dragged' }));
      const sendTo = (targetId: string) =>
        fireEvent.change(dragged().getByRole('combobox', { name: 'Send command to' }), {
          target: { value: targetId },
        });

      it('starts UDP text with {value}, says what it becomes, and keeps it there', async () => {
        const { cardA } = await asFader();
        sendTo('t_projec');
        const text = dragged().getByRole('textbox', { name: 'Text' });
        expect(text).toHaveValue('{value}');
        expect(
          screen.getByText("{value} in the text is replaced by the fader's value, such as 0.5."),
        ).toBeInTheDocument();
        // The value's OSC position and type are not asked for.
        expect(screen.queryByRole('textbox', { name: 'Value position' })).toBeNull();
        expect(screen.queryByRole('radio', { name: 'Whole' })).toBeNull();
        fireEvent.change(text, { target: { value: 'VOL {value}\\r' } });
        expect(cardA().action.commands[0]?.command).toEqual({
          type: 'udp',
          targetId: 't_projec',
          text: 'VOL {value}\r',
        });
        fireEvent.change(text, { target: { value: 'VOL 5' } });
        expect(
          screen.getByText("Text needs {value}, where the fader's value goes"),
        ).toBeInTheDocument();
        expect(cardA().action.commands[0]?.command).toMatchObject({ text: 'VOL {value}\r' });
      });

      it('takes {value} in the HTTP path or body, and puts it back in the path for GET', async () => {
        const { cardA } = await asFader();
        sendTo('t_demo00');
        const path = dragged().getByRole('textbox', { name: 'Path' });
        const body = dragged().getByRole('textbox', { name: 'Body' });
        expect(path).toHaveValue('/{value}');
        fireEvent.change(path, { target: { value: '/volume' } });
        expect(
          screen.getByText("The path or the body needs {value}, where the fader's value goes"),
        ).toBeInTheDocument();
        expect(cardA().action.commands[0]?.command).toMatchObject({ path: '/{value}' });
        // {value} in the body makes the waiting path valid, and both are saved.
        fireEvent.change(body, { target: { value: '{"level": {value}}' } });
        expect(path).not.toHaveAttribute('aria-invalid');
        expect(cardA().action.commands[0]?.command).toMatchObject({
          path: '/volume',
          body: '{"level": {value}}',
        });
        fireEvent.change(body, { target: { value: '{"level": 1}' } });
        expect(body).toHaveAttribute('aria-invalid', 'true');
        expect(cardA().action.commands[0]?.command).toMatchObject({ body: '{"level": {value}}' });
        fireEvent.blur(body);
        fireEvent.change(body, { target: { value: '{"level": {value}}' } });
        fireEvent.click(dragged().getByRole('radio', { name: 'GET' }));
        expect(cardA().action.commands[0]?.command).toMatchObject({
          method: 'GET',
          path: '/volume/{value}',
          body: null,
        });
      });
    });

    it('sends a test with the value chosen next to the button (spec FD-2)', async () => {
      const { store } = await asFader();
      act(() => store.getState().setConnection('open'));
      fireEvent.change(field('Test value'), { target: { value: '0.25' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
      // The editor saves the change to a fader first, then sends.
      await waitFor(() => expect(testSends.at(-1)).toEqual(['p_home00', 'h_carda0', 0.25]));
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
      state().project!.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!.action.commands[0]
        ?.command;

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
      fireEvent.change(onTap().getByRole('combobox', { name: 'Command 1 target' }), {
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
      fireEvent.change(onTap().getByRole('combobox', { name: 'Command 1 target' }), {
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
      fireEvent.click(onTap().getByRole('button', { name: 'Remove command 1' }));
      expect(onTap().queryByRole('button', { name: 'Send test' })).toBeNull();
    });

    it('sends nothing once its last command is removed, and says so', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(onTap().getByRole('button', { name: 'Remove command 1' }));
      expect(cardA().action.commands).toEqual([]);
      expect(onTap().getByText('This hotspot sends no command.')).toBeInTheDocument();
    });
  });

  describe('command sequences (spec ACT-5, ACT-6, ADR 0022)', () => {
    const onTap = () => within(screen.getByRole('region', { name: 'On tap' }));
    const step = (n: number) => within(onTap().getByRole('group', { name: `Command ${n}` }));
    const udp = (text: string) => ({ type: 'udp' as const, targetId: 't_projec', text });
    /** The demo stand with Product A's card sending these steps. */
    function withSteps(
      commands: Project['pages'][number]['hotspots'][number]['action']['commands'],
    ) {
      const project = demoProject();
      const card = project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
      card.action = { ...card.action, commands };
      return project;
    }
    const texts = (cardA: () => { action: { commands: { command: unknown }[] } }) =>
      cardA().action.commands.map((s) => (s.command as { text?: string }).text ?? 'osc');

    it('adds a command to the same target as the last one, with no pause', async () => {
      const { cardA } = await renderPanel();
      fireEvent.click(onTap().getByRole('button', { name: 'Add command' }));
      expect(cardA().action.commands[1]).toEqual({
        command: { type: 'osc-udp', targetId: 't_resolm', address: '/', args: [] },
      });
      expect(step(2).getByRole('textbox', { name: 'Wait before command 2' })).toHaveValue('0');
    });

    it('sets a pause in seconds with tenths and stores milliseconds', async () => {
      const { cardA } = await renderPanel(
        withSteps([{ command: udp('A') }, { command: udp('B') }]),
      );
      const wait = step(2).getByRole('textbox', { name: 'Wait before command 2' });

      fireEvent.change(wait, { target: { value: '2.5' } });
      expect(cardA().action.commands[1]).toEqual({ delayMs: 2500, command: udp('B') });
      expect(onTap().getByText('2 commands over 2.5 s')).toBeInTheDocument();

      fireEvent.change(wait, { target: { value: '0' } });
      expect(cardA().action.commands[1]).toEqual({ command: udp('B') });
    });

    it.each(['61', '2.55', '-1', 'soon'])(
      'refuses a pause of %s and keeps the saved one',
      async (text) => {
        const { cardA } = await renderPanel(
          withSteps([{ command: udp('A') }, { delayMs: 1000, command: udp('B') }]),
        );
        const wait = step(2).getByRole('textbox', { name: 'Wait before command 2' });
        fireEvent.change(wait, { target: { value: text } });
        expect(wait).toHaveAttribute('aria-invalid', 'true');
        expect(step(2).getByText('Expected 0 to 60 seconds, in tenths')).toBeInTheDocument();
        expect(cardA().action.commands[1]!.delayMs).toBe(1000);
      },
    );

    it('shows a saved pause in seconds', async () => {
      await renderPanel(withSteps([{ command: udp('A') }, { delayMs: 1500, command: udp('B') }]));
      expect(step(2).getByRole('textbox', { name: 'Wait before command 2' })).toHaveValue('1.5');
      expect(onTap().getByText('2 commands over 1.5 s')).toBeInTheDocument();
    });

    it('removes the command it belongs to', async () => {
      const { cardA } = await renderPanel(
        withSteps([{ command: udp('A') }, { command: udp('B') }, { command: udp('C') }]),
      );
      fireEvent.click(onTap().getByRole('button', { name: 'Remove command 2' }));
      expect(texts(cardA)).toEqual(['A', 'C']);
    });

    it('edits the fields of the command it belongs to', async () => {
      const { cardA } = await renderPanel(
        withSteps([{ command: udp('A') }, { command: udp('B') }]),
      );
      fireEvent.change(step(2).getByRole('textbox', { name: 'Text' }), {
        target: { value: 'NEW' },
      });
      expect(texts(cardA)).toEqual(['A', 'NEW']);
    });

    it('reorders with Alt + arrow keys on the handle, and not past the ends', async () => {
      const { cardA } = await renderPanel(
        withSteps([
          { command: udp('A') },
          { delayMs: 500, command: udp('B') },
          { command: udp('C') },
        ]),
      );
      const handle = (n: number) => onTap().getByRole('button', { name: `Reorder command ${n}` });

      fireEvent.keyDown(handle(2), { key: 'ArrowUp', altKey: true });
      expect(texts(cardA)).toEqual(['B', 'A', 'C']);
      expect(cardA().action.commands[0]!.delayMs).toBe(500); // the pause goes with its command
      fireEvent.keyDown(handle(3), { key: 'ArrowDown', altKey: true });
      fireEvent.keyDown(handle(1), { key: 'ArrowUp', altKey: true });
      fireEvent.keyDown(handle(2), { key: 'ArrowDown' }); // without Alt: nothing
      expect(texts(cardA)).toEqual(['B', 'A', 'C']);
    });

    it('reorders by dragging a command onto another one', async () => {
      const { cardA } = await renderPanel(
        withSteps([{ command: udp('A') }, { command: udp('B') }, { command: udp('C') }]),
      );
      const card = (n: number) =>
        onTap()
          .getByRole('group', { name: `Command ${n}` })
          .closest('li')!;
      fireEvent.mouseDown(onTap().getByRole('button', { name: 'Reorder command 1' }));
      expect(card(1)).toHaveAttribute('draggable', 'true');
      expect(card(2)).toHaveAttribute('draggable', 'false');

      fireEvent.dragStart(card(1));
      // happy-dom has no layout, so the pointer is at the top of command 3: dropped before it.
      fireEvent.dragOver(card(3));
      fireEvent.drop(card(3));
      expect(texts(cardA)).toEqual(['B', 'A', 'C']);
    });

    it('stops adding at 20 commands, and says so', async () => {
      await renderPanel(withSteps(Array.from({ length: 20 }, () => ({ command: udp('X') }))));
      expect(onTap().getByRole('button', { name: 'Add command' })).toBeDisabled();
      expect(onTap().getByText('At most 20 commands per tap.')).toBeInTheDocument();
    });

    it('asks for a target first when the project has none', async () => {
      const project = withSteps([]);
      project.targets = [];
      await renderPanel(project);
      expect(onTap().getByRole('button', { name: 'Add command' })).toBeDisabled();
      expect(
        onTap().getByText('Add a target on the Targets tab to send commands.'),
      ).toBeInTheDocument();
    });

    it('shows no summary for one command sent at once', async () => {
      await renderPanel();
      expect(onTap().queryByText(/commands? over/)).toBeNull();
    });

    it('shows each step of a test as the server reports it', async () => {
      const { store } = await renderPanel(
        withSteps([{ command: udp('A') }, { delayMs: 1000, command: udp('B') }]),
        { ok: true, entry: null },
      );
      const entry = (seq: number, fields: Partial<LogEntry>) =>
        ({
          seq,
          time: '2026-11-23T10:00:0' + seq + '.000Z',
          source: { type: 'test' },
          pageId: 'p_home00',
          hotspotId: 'h_carda0',
          ...fields,
        }) as LogEntry;
      act(() => store.getState().setConnection('open'));
      // An entry from before the test, and one from another hotspot, are not this test's.
      act(() => store.getState().logged(entry(0, { status: 'ignored', message: 'Old' })));

      fireEvent.click(onTap().getByRole('button', { name: 'Send test' }));
      await waitFor(() =>
        expect(onTap().getByText('Waiting for the first command…')).toBeInTheDocument(),
      );
      const step1 = { run: 0, step: 1, of: 2, delayMs: 0 };
      act(() => {
        store.getState().logged(
          entry(1, {
            status: 'sent',
            hotspotName: 'Product A card',
            targetName: 'Projector',
            command: udp('A'),
            sequence: step1,
          }),
        );
        store
          .getState()
          .logged(entry(2, { hotspotId: 'h_cardb0', status: 'ignored', message: 'Other' }));
        store.getState().logged(
          entry(3, {
            status: 'error',
            hotspotName: 'Product A card',
            targetName: 'Projector',
            command: udp('B'),
            message: 'No route to host',
            sequence: { ...step1, step: 2, delayMs: 1000, name: 'Lights up' },
          }),
        );
      });

      const results = within(onTap().getByRole('list', { name: 'Test results' }));
      expect(results.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        expect.stringMatching(/^Command 1: sent at \d\d:\d\d:01$/),
        'Lights up: No route to host',
      ]);
    });

    describe('command cards (spec ED-15, ACT-9)', () => {
      const three = () =>
        withSteps([
          { command: udp('A') },
          { delayMs: 1500, command: udp('B') },
          { command: udp('C'), name: 'Lights up' },
        ]);
      const toggle = (n: number) =>
        step(n).getByRole('button', { name: new RegExp(`^(Fold|Unfold) command ${n}$`) });
      const isOpen = (n: number) =>
        step(n).queryByRole('combobox', { name: `Command ${n} target` }) !== null;
      const summary = (n: number) => step(n).queryByTestId('step-summary')?.textContent;

      it('starts folded with three or more commands from the project, each one line', async () => {
        await renderPanel(three());
        expect([1, 2, 3].map(isOpen)).toEqual([false, false, false]);
        expect(toggle(1)).toHaveAttribute('aria-expanded', 'false');
        expect(summary(1)).toBe('Projector · A');
        expect(summary(2)).toBe('Projector · B · after 1.5 s');
        // A named step shows its name as the title.
        expect(step(3).getByRole('button', { name: 'Rename Lights up' })).toHaveTextContent(
          'Lights up',
        );
      });

      it('sums up an OSC command with its arguments', async () => {
        const project = three();
        const card = project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
        const osc = demoProject().pages[0]!.hotspots[0]!.action.commands[0]!;
        card.action.commands[0] = osc;
        await renderPanel(project);
        expect(summary(1)).toBe('Resolume · /composition/columns/2/connect i 1');
      });

      it('starts afresh for another hotspot', async () => {
        const project = three();
        const cardB = project.pages[0]!.hotspots.find((h) => h.id === 'h_cardb0')!;
        cardB.action = {
          ...cardB.action,
          commands: three().pages[0]!.hotspots[0]!.action.commands,
        };
        const { store } = await renderPanel(project);
        fireEvent.click(onTap().getByRole('button', { name: 'Unfold all' }));
        act(() => store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_cardb0'] }));
        expect([1, 2, 3].map(isOpen)).toEqual([false, false, false]);
      });

      it('starts open with fewer than three', async () => {
        await renderPanel(withSteps([{ command: udp('A') }, { command: udp('B') }]));
        expect([1, 2].map(isOpen)).toEqual([true, true]);
        expect(summary(1)).toBeUndefined();
      });

      it('folds and unfolds one card, and all at once', async () => {
        await renderPanel(three());
        fireEvent.click(toggle(2));
        expect([1, 2, 3].map(isOpen)).toEqual([false, true, false]);
        expect(toggle(2)).toHaveAttribute('aria-expanded', 'true');
        expect(toggle(2)).toHaveAccessibleName('Fold command 2');
        fireEvent.click(onTap().getByRole('button', { name: 'Unfold all' }));
        expect([1, 2, 3].map(isOpen)).toEqual([true, true, true]);
        fireEvent.click(onTap().getByRole('button', { name: 'Fold all' }));
        expect([1, 2, 3].map(isOpen)).toEqual([false, false, false]);
        fireEvent.click(toggle(2));
        expect(isOpen(2)).toBe(true);
      });

      it('opens a new command, keeping the others as they were', async () => {
        await renderPanel(three());
        fireEvent.click(onTap().getByRole('button', { name: 'Add command' }));
        expect([1, 2, 3, 4].map(isOpen)).toEqual([false, false, false, true]);
      });

      it('keeps each fold with its command when one is removed or moved', async () => {
        const { cardA } = await renderPanel(three());
        fireEvent.click(toggle(3)); // C open
        fireEvent.click(step(1).getByRole('button', { name: 'Remove command 1' }));
        expect(texts(cardA)).toEqual(['B', 'C']);
        expect([1, 2].map(isOpen)).toEqual([false, true]);
        fireEvent.keyDown(step(2).getByRole('button', { name: 'Reorder command 2' }), {
          key: 'ArrowUp',
          altKey: true,
        });
        expect(texts(cardA)).toEqual(['C', 'B']);
        expect([1, 2].map(isOpen)).toEqual([true, false]);
      });

      it('has no fold buttons for one command', async () => {
        await renderPanel(withSteps([{ command: udp('A') }]));
        expect(onTap().queryByRole('button', { name: 'Fold all' })).toBeNull();
      });

      it('renames a command with a click or F2; Escape keeps the old name, empty clears it', async () => {
        const { cardA } = await renderPanel(three());
        fireEvent.click(step(1).getByRole('button', { name: 'Rename Command 1' }));
        const field = () => step(1).getByRole('textbox', { name: 'Command 1 name' });
        expect(field()).toHaveFocus();
        expect(field()).toHaveAttribute('placeholder', 'Command 1');
        fireEvent.change(field(), { target: { value: '  Screen on ' } });
        // The browser presses whatever has the focus with an Enter that was not stopped.
        expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);
        expect(cardA().action.commands[0]!.name).toBe('Screen on');
        const title = step(1).getByRole('button', { name: 'Rename Screen on' });
        expect(title).toHaveFocus();

        fireEvent.keyDown(title, { key: 'F2' });
        expect(field()).toHaveValue('Screen on');
        fireEvent.change(field(), { target: { value: 'Other' } });
        expect(fireEvent.keyDown(field(), { key: 'Escape' })).toBe(false);
        expect(cardA().action.commands[0]!.name).toBe('Screen on');

        fireEvent.click(step(1).getByRole('button', { name: 'Rename Screen on' }));
        expect(field()).toHaveValue('Screen on');
        fireEvent.change(field(), { target: { value: '   ' } });
        fireEvent.blur(field());
        expect(cardA().action.commands[0]).not.toHaveProperty('name');
        expect(step(1).getByRole('button', { name: 'Rename Command 1' })).toHaveTextContent(
          'Command 1',
        );
      });

      it('switches a command off and on: dimmed with "Off", and left out of the summary', async () => {
        const { cardA } = await renderPanel(three());
        const send = () => step(2).getByRole('button', { name: 'Send command 2' });
        expect(send()).toHaveAttribute('aria-pressed', 'true');
        expect(onTap().getByText('3 commands over 1.5 s')).toBeInTheDocument();

        fireEvent.click(send());
        expect(cardA().action.commands[1]!.enabled).toBe(false);
        expect(send()).toHaveAttribute('aria-pressed', 'false');
        expect(onTap().getByRole('group', { name: 'Command 2' })).toHaveAttribute(
          'data-off',
          'true',
        );
        expect(step(2).getByText('Off')).toBeInTheDocument();
        // Its pause is skipped with it.
        expect(onTap().getByText('2 of 3 commands over 0 s')).toBeInTheDocument();

        fireEvent.click(send());
        expect(cardA().action.commands[1]).not.toHaveProperty('enabled');
        expect(onTap().getByRole('group', { name: 'Command 2' })).not.toHaveAttribute('data-off');
        expect(step(2).queryByText('Off')).toBeNull();
      });

      it('shows test results as steps when two commands are on, not by the list length', async () => {
        const { store } = await renderPanel(
          withSteps([{ command: udp('A') }, { command: udp('B'), enabled: false }]),
          { ok: true, entry: null },
        );
        act(() => store.getState().setConnection('open'));
        fireEvent.click(onTap().getByRole('button', { name: 'Send test' }));
        // One command on, sent at once: a single result, not a list of steps.
        await waitFor(() => expect(onTap().getByText(/^Started:/)).toBeInTheDocument());
        expect(onTap().queryByRole('list', { name: 'Test results' })).toBeNull();
      });
    });

    it('keeps one command for a fader: no list, no pauses', async () => {
      const project = demoProject();
      const card = project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
      Object.assign(card, {
        kind: 'fader',
        pressEffect: 'none',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0.01,
          start: 0,
          value: { at: 1, as: 'f' },
        },
        action: { goTo: null, commands: card.action.commands },
      });
      await renderPanel(project);
      const dragged = within(screen.getByRole('region', { name: 'While dragged' }));
      expect(dragged.getByRole('combobox', { name: 'Send command to' })).toBeInTheDocument();
      expect(dragged.queryByRole('button', { name: 'Add command' })).toBeNull();
      expect(dragged.queryByRole('textbox', { name: /Wait before/ })).toBeNull();
      expect(dragged.queryByRole('button', { name: /^(Fold|Unfold)/ })).toBeNull();
    });

    it("switches a fader's command off and on (spec ACT-9)", async () => {
      const project = demoProject();
      const card = project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
      Object.assign(card, {
        kind: 'fader',
        pressEffect: 'none',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0.01,
          start: 0,
          value: { at: 1, as: 'f' },
        },
        action: { goTo: null, commands: card.action.commands },
      });
      const { cardA } = await renderPanel(project);
      const dragged = within(screen.getByRole('region', { name: 'While dragged' }));
      const send = () => dragged.getByRole('button', { name: 'Send this command' });
      expect(send()).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(send());
      expect(cardA().action.commands[0]!.enabled).toBe(false);
      expect(dragged.getByText('Off: dragging the fader sends nothing.')).toBeInTheDocument();
      fireEvent.click(send());
      expect(cardA().action.commands[0]).not.toHaveProperty('enabled');
      expect(dragged.queryByText(/^Off:/)).toBeNull();
    });
  });
});

describe('HotspotPanel for several hotspots (spec ED-16)', () => {
  async function renderGroup(ids = ['h_carda0', 'h_cardc0']) {
    const rendered = await renderPanel();
    act(() => rendered.store.getState().select({ pageId: 'p_home00', hotspotIds: ids }));
    return rendered;
  }
  const at = (h: { x: number; y: number }) => [h.x, h.y];

  it('says how many, with the position and size of their common box', async () => {
    const { field } = await renderGroup();
    expect(screen.getByRole('heading', { name: '2 hotspots' })).toBeInTheDocument();
    expect(field('Group X')).toHaveValue('144');
    expect(field('Group Y')).toHaveValue('500');
    expect(screen.getByText('1760 × 720')).toBeInTheDocument();
    // None of a single hotspot's own fields.
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  it('moves them all by the group position; an invalid value stays with its reason', async () => {
    const { field, hotspots } = await renderGroup();
    fireEvent.change(field('Group X'), { target: { value: '100' } });
    expect(
      hotspots()
        .filter((h) => h.id !== 'h_cardb0')
        .slice(0, 2)
        .map(at),
    ).toEqual([
      [100, 500],
      [1300, 500],
    ]);
    fireEvent.change(field('Group Y'), { target: { value: '900' } });
    expect(screen.getByText('Group Y: 0 to 816, to stay inside the canvas')).toBeInTheDocument();
    expect(hotspots()[0]!.y).toBe(500);
    fireEvent.blur(field('Group Y'));
    expect(field('Group Y')).toHaveValue('900');
    fireEvent.change(field('Group Y'), { target: { value: '16' } });
    fireEvent.blur(field('Group Y'));
    expect(at(hotspots()[0]!)).toEqual([100, 16]);
    expect(field('Group Y')).toHaveValue('16');
  });

  it('duplicates them all and selects the copies', async () => {
    const { state, hotspots } = await renderGroup();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate 2 hotspots' }));
    const names = hotspots().map((h) => h.name);
    expect(names).toContain('Product A card 2');
    expect(names).toContain('Product C card 2');
    const copies = hotspots()
      .filter((h) => / 2$/.test(h.name))
      .map((h) => h.id);
    expect(state().selection.hotspotIds).toEqual(copies);
  });

  it('deletes them all after asking once', async () => {
    const { state, hotspots } = await renderGroup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 hotspots' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete 2 hotspots?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(hotspots()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 hotspots' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete 2 hotspots' }),
    );
    expect(hotspots().map((h) => h.id)).toEqual(['h_cardb0', 'h_about0', 'h_call00']);
    expect(state().selection.hotspotIds).toEqual([]);
  });

  it('copies them all for pasting on any page (spec ED-17)', async () => {
    const { state } = await renderGroup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(state().clipboard?.hotspots.map((h) => h.id)).toEqual(['h_carda0', 'h_cardc0']);
  });

  it('lists them, and a click selects only that one', async () => {
    const { state } = await renderGroup();
    const list = within(screen.getByRole('region', { name: 'Selected hotspots' }));
    expect(list.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Product A card',
      'Product C card',
    ]);
    fireEvent.click(list.getByRole('button', { name: 'Product C card' }));
    expect(state().selection.hotspotIds).toEqual(['h_cardc0']);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Product C card');
  });
});

describe('arranging (spec ED-18)', () => {
  const toolbar = () => within(screen.getByRole('toolbar', { name: 'Arrange' }));
  const box = (h: { x: number; y: number; width: number; height: number }) => [
    h.x,
    h.y,
    h.width,
    h.height,
  ];

  it('aligns one hotspot to the canvas, and offers nothing else for one', async () => {
    const { cardA } = await renderPanel();
    expect(toolbar().getByRole('button', { name: 'Align right' })).toHaveAttribute(
      'title',
      'Align right, to the canvas',
    );
    fireEvent.click(toolbar().getByRole('button', { name: 'Align right' }));
    expect(cardA().x).toBe(2048 - 560);
    fireEvent.click(toolbar().getByRole('button', { name: 'Align top' }));
    expect(cardA().y).toBe(0);
    expect(toolbar().queryByRole('button', { name: /Distribute|Same/ })).toBeNull();
  });

  it('aligns several to their common box', async () => {
    const { store, hotspots } = await renderPanel();
    act(() =>
      store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_carda0', 'h_about0'] }),
    );
    expect(toolbar().getByRole('button', { name: 'Align left' })).toHaveAttribute(
      'title',
      'Align left, to their common box',
    );
    fireEvent.click(toolbar().getByRole('button', { name: 'Align left' }));
    expect(hotspots().find((h) => h.id === 'h_about0')!.x).toBe(144);
    fireEvent.click(toolbar().getByRole('button', { name: 'Align bottom' }));
    expect(hotspots().find((h) => h.id === 'h_carda0')!.y).toBe(1388 - 720);
  });

  it('distributes only three or more, and says why it cannot', async () => {
    const { store, hotspots } = await renderPanel();
    act(() =>
      store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_carda0', 'h_cardb0'] }),
    );
    const spread = () => toolbar().getByRole('button', { name: 'Distribute horizontally' });
    expect(spread()).toBeDisabled();
    expect(spread()).toHaveAttribute('title', 'Distribute horizontally: select three or more');
    expect(toolbar().getByRole('button', { name: 'Distribute vertically' })).toBeDisabled();
    act(() =>
      store.getState().select({
        pageId: 'p_home00',
        hotspotIds: ['h_carda0', 'h_cardb0', 'h_about0'],
      }),
    );
    expect(spread()).toBeEnabled();
    fireEvent.click(toolbar().getByRole('button', { name: 'Distribute vertically' }));
    // By y: A and B at 500 (720 high), About at 1244 (144 high). The span 500–1388 is shorter
    // than their heights (1584), so the two gaps are -348: B goes to 500 + 720 - 348 = 872.
    const y = (id: string) => hotspots().find((h) => h.id === id)!.y;
    expect([y('h_carda0'), y('h_cardb0'), y('h_about0')]).toEqual([500, 872, 1244]);
  });

  it('gives several the size of the first one listed', async () => {
    const { store, hotspots } = await renderPanel();
    act(() =>
      store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_call00', 'h_about0'] }),
    );
    expect(toolbar().getByRole('button', { name: 'Same width' })).toHaveAttribute(
      'title',
      'Same width as About',
    );
    fireEvent.click(toolbar().getByRole('button', { name: 'Same width' }));
    const call = () => hotspots().find((h) => h.id === 'h_call00')!;
    expect(box(call())).toEqual([1592, 76, 144, 96]);
    fireEvent.click(toolbar().getByRole('button', { name: 'Same height' }));
    expect(box(call())).toEqual([1592, 76, 144, 144]);
    act(() =>
      store.getState().select({ pageId: 'p_home00', hotspotIds: ['h_about0', 'h_carda0'] }),
    );
    fireEvent.click(toolbar().getByRole('button', { name: 'Same size' }));
    expect(box(hotspots().find((h) => h.id === 'h_about0')!)).toEqual([1488, 816, 560, 720]);
  });
});

describe('shared settings of several hotspots (spec ED-19)', () => {
  /** Home with cards A and C and About (an ellipse) given distinct looks. */
  function styled() {
    const project = demoProject();
    const [a, , c, about] = project.pages[0]!.hotspots;
    a!.style = { fill: '#FFFFFF', border: { color: '#000000', width: 2 }, opacity: 0.5 };
    c!.style = { fill: '#FFFFFF', border: { color: '#000000', width: 4 }, opacity: 0.8 };
    about!.style = { fill: null, border: null, opacity: 0.5 };
    a!.text = { ...DEFAULT_TEXT, size: 40 };
    c!.text = { ...DEFAULT_TEXT, size: 60, content: 'Other words', align: 'left' };
    return project;
  }
  async function renderGroup(ids: string[], project = styled()) {
    const rendered = await renderPanel(project);
    act(() => rendered.store.getState().select({ pageId: 'p_home00', hotspotIds: ids }));
    return rendered;
  }
  const region = (name: string) => within(screen.getByRole('region', { name }));
  const byId = (hotspots: () => Hotspot[], id: string) => hotspots().find((h) => h.id === id)!;

  it('shows a value they share, and Mixed for one that differs', async () => {
    await renderGroup(['h_carda0', 'h_cardc0']);
    const style = region('Style');
    expect(style.getByRole('textbox', { name: 'fill hex' })).toHaveValue('#FFFFFF');
    expect(style.getByRole('textbox', { name: 'Opacity' })).toHaveValue('');
    expect(style.getByRole('textbox', { name: 'Opacity' })).toHaveAttribute('placeholder', 'Mixed');
    expect(style.getByRole('textbox', { name: 'Border width' })).toHaveValue('');
    expect(style.getByRole('textbox', { name: 'Frost' })).toHaveValue('0');
    // Both rectangles with radius 40.
    expect(region('Shape').getByRole('radio', { name: 'Rectangle' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(region('Shape').getByRole('textbox', { name: 'Corner radius' })).toHaveValue('40');
  });

  it('gives a value to all of them, replacing Mixed', async () => {
    const { hotspots } = await renderGroup(['h_carda0', 'h_cardc0', 'h_about0']);
    const style = region('Style');
    fireEvent.change(style.getByRole('textbox', { name: 'Opacity' }), { target: { value: '70' } });
    expect(
      ['h_carda0', 'h_cardc0', 'h_about0'].map((id) => byId(hotspots, id).style.opacity),
    ).toEqual([0.7, 0.7, 0.7]);
    expect(style.getByRole('textbox', { name: 'Opacity' })).toHaveValue('70');
    // The fill is mixed (About has none); a colour typed goes to all three.
    const fill = style.getByRole('textbox', { name: 'fill hex' });
    expect(fill).toHaveAttribute('placeholder', 'Mixed');
    fireEvent.change(fill, { target: { value: '#112233' } });
    expect(['h_carda0', 'h_cardc0', 'h_about0'].map((id) => byId(hotspots, id).style.fill)).toEqual(
      ['#112233', '#112233', '#112233'],
    );
    // Hotspots not selected keep theirs.
    expect(byId(hotspots, 'h_cardb0').style.fill).toBeNull();
  });

  it('gives a fill opacity only to those with a fill', async () => {
    const { hotspots } = await renderGroup(['h_carda0', 'h_about0']);
    fireEvent.change(region('Style').getByRole('textbox', { name: 'Fill opacity' }), {
      target: { value: '40' },
    });
    expect(byId(hotspots, 'h_carda0').style.fillOpacity).toBe(0.4);
    expect(byId(hotspots, 'h_about0').style).not.toHaveProperty('fillOpacity');
  });

  it('offers no image for several: each keeps its own', async () => {
    await renderGroup(['h_carda0', 'h_about0']);
    expect(screen.queryByRole('button', { name: 'Choose image' })).toBeNull();
  });

  it('gives a border width only to those with a border, and a new border its own width', async () => {
    const { hotspots } = await renderGroup(['h_carda0', 'h_cardc0', 'h_about0']);
    const style = region('Style');
    fireEvent.change(style.getByRole('textbox', { name: 'Border width' }), {
      target: { value: '6' },
    });
    expect(byId(hotspots, 'h_carda0').style.border).toEqual({ color: '#000000', width: 6 });
    expect(byId(hotspots, 'h_about0').style.border).toBeNull();
    fireEvent.change(style.getByRole('textbox', { name: 'border hex' }), {
      target: { value: '#FF0000' },
    });
    expect(byId(hotspots, 'h_cardc0').style.border).toEqual({ color: '#FF0000', width: 6 });
    expect(byId(hotspots, 'h_about0').style.border).toEqual({ color: '#FF0000', width: 2 });
  });

  it('chooses no shape when they differ; a choice applies to all, a radius to the rectangles', async () => {
    const { hotspots } = await renderGroup(['h_carda0', 'h_about0', 'h_call00']);
    const shape = region('Shape');
    expect(shape.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(shape.getByRole('radio', { name: 'Ellipse' })).toHaveAttribute('aria-checked', 'false');
    // Card A has 40, "Call our team" 48: mixed among the rectangles.
    expect(shape.getByRole('textbox', { name: 'Corner radius' })).toHaveValue('');
    fireEvent.change(shape.getByRole('textbox', { name: 'Corner radius' }), {
      target: { value: '12' },
    });
    expect(byId(hotspots, 'h_call00').shape).toEqual({ type: 'rect', cornerRadius: 12 });
    expect(byId(hotspots, 'h_about0').shape).toEqual({ type: 'ellipse' });
    fireEvent.click(shape.getByRole('radio', { name: 'Rectangle' }));
    // The ellipse becomes a square-cornered rectangle; the rectangles keep their radius.
    expect(byId(hotspots, 'h_about0').shape).toEqual({ type: 'rect', cornerRadius: 0 });
    expect(byId(hotspots, 'h_carda0').shape).toEqual({ type: 'rect', cornerRadius: 12 });
    fireEvent.click(shape.getByRole('radio', { name: 'Ellipse' }));
    expect(['h_carda0', 'h_about0', 'h_call00'].map((id) => byId(hotspots, id).shape)).toEqual([
      { type: 'ellipse' },
      { type: 'ellipse' },
      { type: 'ellipse' },
    ]);
    expect(shape.getByRole('textbox', { name: 'Corner radius' })).toBeDisabled();
  });

  it('gives the press effect to the buttons and leaves faders alone, saying so', async () => {
    const project = styled();
    Object.assign(project.pages[0]!.hotspots[4]!, {
      kind: 'fader',
      pressEffect: 'none',
      fader: {
        orientation: 'horizontal',
        min: 0,
        max: 1,
        step: 0.01,
        start: 0,
        value: { at: 0, as: 'f' },
      },
      action: { goTo: null, commands: [] },
    });
    const { hotspots } = await renderGroup(['h_carda0', 'h_cardc0', 'h_call00'], project);
    const style = region('Style');
    // A presses in, C ripples: mixed.
    const effect = style.getByRole('combobox', { name: 'Press effect' });
    expect(effect).toHaveValue('');
    expect(
      style.getByText('Faders have no press effect: it applies to the 2 buttons.'),
    ).toBeInTheDocument();
    fireEvent.change(effect, { target: { value: 'highlight' } });
    expect(byId(hotspots, 'h_carda0').pressEffect).toBe('highlight');
    expect(byId(hotspots, 'h_cardc0').pressEffect).toBe('highlight');
    expect(byId(hotspots, 'h_call00').pressEffect).toBe('none');
    expect(effect).toHaveValue('highlight');
  });

  it('shares the text style among those with a label, never the words', async () => {
    const { hotspots } = await renderGroup(['h_carda0', 'h_cardc0', 'h_about0']);
    const text = region('Text');
    expect(
      text.getByText("Applies to the 2 with a text label; the words stay each one's own."),
    ).toBeInTheDocument();
    expect(text.queryByRole('textbox', { name: 'Text' })).toBeNull();
    expect(text.queryByRole('button', { name: 'Remove text' })).toBeNull();
    expect(text.getByRole('textbox', { name: 'Text size' })).toHaveValue('');
    // Both are medium; the alignment differs once C's is changed.
    expect(text.getByRole('radio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');
    const alignment = within(text.getByRole('radiogroup', { name: 'Text alignment' }));
    expect(alignment.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
    ]);
    // With none chosen, the first option is where Tab enters the group.
    expect(alignment.getByRole('radio', { name: 'Left' })).toHaveAttribute('tabindex', '0');
    expect(alignment.getByRole('radio', { name: 'Center' })).toHaveAttribute('tabindex', '-1');
    fireEvent.change(text.getByRole('textbox', { name: 'Text size' }), { target: { value: '50' } });
    fireEvent.click(text.getByRole('radio', { name: 'Bold' }));
    expect(byId(hotspots, 'h_carda0').text).toMatchObject({
      size: 50,
      weight: 'bold',
      content: 'Label',
    });
    expect(byId(hotspots, 'h_cardc0').text).toMatchObject({
      size: 50,
      weight: 'bold',
      content: 'Other words',
    });
    // About had no label and gets none.
    expect(byId(hotspots, 'h_about0').text).toBeUndefined();
  });

  it('says so when none of them has a text label', async () => {
    await renderGroup(['h_cardb0', 'h_about0']);
    expect(region('Text').getByText('None of them has a text label.')).toBeInTheDocument();
  });
});
