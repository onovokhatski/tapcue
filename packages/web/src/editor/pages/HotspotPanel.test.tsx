import type { LogEntry, Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TestSent } from '../../lib/projectApi';
import { demoProject } from '../../test/demoProject';
import { placeHotspot } from '../operations/hotspots';
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
            sequence: { ...step1, step: 2, delayMs: 1000 },
          }),
        );
      });

      const results = within(onTap().getByRole('list', { name: 'Test results' }));
      expect(results.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        expect.stringMatching(/^Command 1: sent at \d\d:\d\d:01$/),
        'Command 2: No route to host',
      ]);
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
    });
  });
});
