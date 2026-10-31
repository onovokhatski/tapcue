import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { EditorCanvas } from './EditorCanvas';

/** Makes ResizeObserver report this size for every observed element, as after layout. */
function stubStage(width: number, height: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        const entry = { target, contentRect: { width, height } } as ResizeObserverEntry;
        this.callback([entry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The canvas of a loaded project. The demo canvas is 2048 × 1536; a 1072 × 816 stage minus 24 px
 * padding on each side leaves 1024 × 768, exactly half.
 */
async function renderCanvas(
  project: Project = demoProject(),
  stage = { width: 1072, height: 816 },
) {
  stubStage(stage.width, stage.height);
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const { container } = render(
    <EditorStoreContext value={store}>
      <EditorCanvas />
    </EditorStoreContext>,
  );
  const overlay = (id: string) => container.querySelector<HTMLElement>(`[data-overlay="${id}"]`)!;
  return { store, container, overlay };
}

describe('EditorCanvas', () => {
  describe('scale (spec ED-8)', () => {
    it('fits the page into the space and shows the scale', async () => {
      await renderCanvas();
      expect(screen.getByLabelText('Canvas scale 50 percent')).toHaveTextContent('Fit · 50%');
      expect(screen.getByTestId('canvas-page')).toHaveStyle({ width: '1024px', height: '768px' });
      expect(screen.getByText('2048 × 1536')).toBeInTheDocument();
    });

    it('takes the smaller of the two ratios, so the whole page is always visible', async () => {
      await renderCanvas(demoProject(), { width: 2072, height: 816 }); // wide: height decides
      expect(screen.getByTestId('canvas-page')).toHaveStyle({ width: '1024px', height: '768px' });
    });

    it('fits even when the project itself uses fill', async () => {
      const project = demoProject();
      project.canvas.scaleMode = 'fill';
      await renderCanvas(project, { width: 2072, height: 816 });
      expect(screen.getByText('Fit · 50%')).toBeInTheDocument();
    });
  });

  describe('selection layer (spec ED-2)', () => {
    it('puts each outline over its hotspot, at the canvas scale', async () => {
      const { overlay } = await renderCanvas();
      // Product A card: x 144, y 500, 560 × 720 canvas pixels.
      expect(overlay('h_carda0')).toHaveStyle({
        left: '72px',
        top: '250px',
        width: '280px',
        height: '360px',
      });
    });

    it('draws the outline in the hotspot shape: rectangle with its scaled corner radius', async () => {
      const { overlay } = await renderCanvas();
      expect(overlay('h_carda0').querySelector('rect.hs-line')).toHaveAttribute('rx', '20');
    });

    it('draws an ellipse hotspot as an ellipse', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots[0]!.shape = { type: 'ellipse' };
      const id = project.pages[0]!.hotspots[0]!.id;
      const { overlay } = await renderCanvas(project);
      expect(overlay(id).querySelector('ellipse.hs-line')).toBeInTheDocument();
      expect(overlay(id).querySelector('rect')).toBeNull();
    });

    it('selects a hotspot on press: amber outline, name chip and eight handles', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'));
      expect(store.getState().selection).toEqual({ pageId: 'p_home00', hotspotId: 'h_carda0' });
      const selected = overlay('h_carda0');
      expect(selected).toHaveAttribute('aria-pressed', 'true');
      expect(selected.querySelector('svg')).toHaveAttribute('data-state', 'selected');
      expect(selected.querySelector('.hs-chip')).toHaveTextContent('Product A card');
      expect(selected.querySelectorAll('.hs-handle')).toHaveLength(8);
    });

    it('selects with the keyboard too: each outline is a button', async () => {
      const { store } = await renderCanvas();
      const button = screen.getByRole('button', { name: 'Product A card' });
      fireEvent.click(button); // Enter or Space on a focused button
      expect(store.getState().selection.hotspotId).toBe('h_carda0');
    });

    it('clears the selection on a press outside every hotspot', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'));
      fireEvent.pointerDown(screen.getByTestId('selection-layer'));
      expect(store.getState().selection).toEqual({ pageId: 'p_home00', hotspotId: null });
    });

    it('marks a hovered hotspot with a wash and a dark name chip', async () => {
      const { overlay } = await renderCanvas();
      fireEvent.pointerEnter(overlay('h_cardb0'));
      expect(overlay('h_cardb0').querySelector('svg')).toHaveAttribute('data-state', 'hover');
      expect(overlay('h_cardb0').querySelector('.hs-chip-idle')).toBeInTheDocument();
      fireEvent.pointerLeave(overlay('h_cardb0'));
      expect(overlay('h_cardb0').querySelector('svg')).toHaveAttribute('data-state', 'idle');
      expect(overlay('h_cardb0').querySelector('.hs-chip')).toBeNull();
    });

    it('puts the chip under a hotspot at the top of the canvas, where there is no room above', async () => {
      const project = demoProject();
      const hotspot = project.pages[0]!.hotspots[0]!;
      hotspot.y = 40; // 20 px on screen
      const { overlay } = await renderCanvas(project);
      fireEvent.pointerDown(overlay(hotspot.id));
      expect(overlay(hotspot.id).querySelector('.hs-chip')).toHaveAttribute('data-below', 'true');
    });

    it('stays on the page: a press on a hotspot that links elsewhere does not navigate', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'));
      fireEvent.pointerUp(overlay('h_carda0'));
      expect(store.getState().selection.pageId).toBe('p_home00');
      expect(screen.getByTestId('canvas-page').querySelector('img')).toHaveAttribute(
        'src',
        '/assets/home.jpg',
      );
    });
  });

  it('shows the empty canvas for a page without a background', async () => {
    const project = demoProject();
    project.pages[0]!.background = null;
    await renderCanvas(project);
    expect(screen.getByText('No background yet')).toBeInTheDocument();
  });

  it('shows no empty-canvas hint over a page that has a background', async () => {
    await renderCanvas();
    expect(screen.queryByText('No background yet')).toBeNull();
  });

  it('shows the selected page', async () => {
    const { store } = await renderCanvas();
    act(() => store.getState().select({ pageId: 'p_proda0', hotspotId: null }));
    expect(screen.getByTestId('canvas-page').querySelector('img')).toHaveAttribute(
      'src',
      '/assets/product-a.jpg',
    );
  });

  describe('add, move and resize (spec HS-1, HS-2)', () => {
    /** The demo Home hotspot as the store has it now. */
    const cardA = (store: Awaited<ReturnType<typeof renderCanvas>>['store']) =>
      store.getState().project!.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!;
    const box = ({
      x,
      y,
      width,
      height,
    }: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => ({
      x,
      y,
      width,
      height,
    });

    it('adds a hotspot in the centre and selects it', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.click(screen.getByRole('button', { name: 'Add hotspot' }));
      const added = store.getState().project!.pages[0]!.hotspots.at(-1)!;
      expect(store.getState().selection).toEqual({ pageId: 'p_home00', hotspotId: added.id });
      // 819, 615, 410 × 307 canvas pixels at half scale.
      expect(overlay(added.id)).toHaveStyle({ left: '410px', top: '308px', width: '205px' });
      expect(store.getState().save).toEqual({ state: 'saving' });
    });

    it('moves a hotspot by dragging, converting screen pixels to canvas pixels', async () => {
      const { store, overlay } = await renderCanvas();
      const layer = screen.getByTestId('selection-layer');
      fireEvent.pointerDown(overlay('h_carda0'), { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(layer, { clientX: 150, clientY: 80, pointerId: 1 });
      // 50 px right and 20 px up on screen, at half scale, is 100 and 40 canvas pixels.
      expect(box(cardA(store))).toEqual({ x: 244, y: 460, width: 560, height: 720 });
      fireEvent.pointerUp(layer, { pointerId: 1 });
      fireEvent.pointerMove(layer, { clientX: 400, clientY: 400, pointerId: 1 });
      expect(box(cardA(store))).toEqual({ x: 244, y: 460, width: 560, height: 720 });
    });

    it('measures every move of a drag from where it started, not from the last move', async () => {
      const { store, overlay } = await renderCanvas();
      const layer = screen.getByTestId('selection-layer');
      fireEvent.pointerDown(overlay('h_carda0'), { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(layer, { clientX: 110, clientY: 100 });
      fireEvent.pointerMove(layer, { clientX: 120, clientY: 100 });
      expect(cardA(store).x).toBe(184); // 144 + 20 / 0.5
    });

    it('keeps a dragged hotspot inside the canvas', async () => {
      const { store, overlay } = await renderCanvas();
      const layer = screen.getByTestId('selection-layer');
      fireEvent.pointerDown(overlay('h_carda0'), { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(layer, { clientX: -900, clientY: -900 });
      expect(box(cardA(store))).toEqual({ x: 0, y: 0, width: 560, height: 720 });
    });

    it('resizes with a handle; the opposite corner stays put', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'));
      const handle = overlay('h_carda0').querySelector('[data-handle="se"]')!;
      const layer = screen.getByTestId('selection-layer');
      fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(layer, { clientX: 130, clientY: 90 });
      expect(box(cardA(store))).toEqual({ x: 144, y: 500, width: 620, height: 700 });
    });

    it('resizes from the top-left handle, moving that corner', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'));
      const handle = overlay('h_carda0').querySelector('[data-handle="nw"]')!;
      fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(screen.getByTestId('selection-layer'), { clientX: 110, clientY: 120 });
      expect(box(cardA(store))).toEqual({ x: 164, y: 540, width: 540, height: 680 });
    });

    it('saves nothing for a press without a move', async () => {
      const { store, overlay } = await renderCanvas();
      fireEvent.pointerDown(overlay('h_carda0'), { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(screen.getByTestId('selection-layer'));
      expect(store.getState().save).toEqual({ state: 'saved' });
    });

    describe('arrow keys', () => {
      it('move the selected hotspot by 1 canvas pixel, with Shift by 10', async () => {
        const { store, overlay } = await renderCanvas();
        fireEvent.pointerDown(overlay('h_carda0'));
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        fireEvent.keyDown(window, { key: 'ArrowUp' });
        expect(box(cardA(store))).toEqual({ x: 144, y: 509, width: 560, height: 720 });
      });

      it('never undo one another, however fast they come', async () => {
        const { store, overlay } = await renderCanvas();
        fireEvent.pointerDown(overlay('h_carda0'));
        // Both keys before React draws again, as when a key repeats quickly.
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(box(cardA(store))).toEqual({ x: 154, y: 501, width: 560, height: 720 });
      });

      it('leave Alt, Cmd and Ctrl combinations alone: Alt + ↑ / ↓ reorders pages', async () => {
        const { store, overlay } = await renderCanvas();
        fireEvent.pointerDown(overlay('h_carda0'));
        fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
        fireEvent.keyDown(window, { key: 'ArrowLeft', metaKey: true });
        fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
        expect(box(cardA(store))).toEqual({ x: 144, y: 500, width: 560, height: 720 });
      });

      it('Delete and Backspace delete the selected hotspot, but not from a text field', async () => {
        const { store, overlay } = await renderCanvas();
        const ids = () => store.getState().project!.pages[0]!.hotspots.map((h) => h.id);
        const field = document.createElement('input');
        document.body.append(field);
        fireEvent.pointerDown(overlay('h_carda0'));
        fireEvent.keyDown(field, { key: 'Backspace' });
        expect(ids()).toContain('h_carda0');
        fireEvent.keyDown(window, { key: 'Delete' });
        expect(ids()).not.toContain('h_carda0');
        fireEvent.pointerDown(overlay('h_cardb0'));
        fireEvent.keyDown(window, { key: 'Backspace' });
        expect(ids()).not.toContain('h_cardb0');
        expect(store.getState().selection.hotspotId).toBeNull();
        field.remove();
      });

      it('do nothing without a selected hotspot', async () => {
        const { store } = await renderCanvas();
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(store.getState().save).toEqual({ state: 'saved' });
      });

      it('leave a text field alone: there they move the text cursor', async () => {
        const { store, overlay } = await renderCanvas();
        fireEvent.pointerDown(overlay('h_carda0'));
        const field = document.createElement('input');
        document.body.append(field);
        fireEvent.keyDown(field, { key: 'ArrowRight' });
        expect(cardA(store).x).toBe(144);
        field.remove();
      });

      it('stop at the canvas edge', async () => {
        const project = demoProject();
        project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!.x = 3;
        const { store, overlay } = await renderCanvas(project);
        fireEvent.pointerDown(overlay('h_carda0'));
        fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
        expect(cardA(store).x).toBe(0);
      });
    });
  });

  describe('safe area (spec ED-3)', () => {
    const filled = () => {
      const project = demoProject();
      project.canvas.scaleMode = 'fill';
      return project;
    };
    const toggle = () => screen.getByRole('button', { name: 'Show safe area' });

    it('has nothing to show in fit: the toggle is off and says why', async () => {
      await renderCanvas();
      expect(toggle()).toBeDisabled();
      expect(toggle()).toHaveAttribute(
        'title',
        expect.stringContaining('Nothing is cropped in Fit'),
      );
      expect(screen.queryByLabelText('Reference screen')).toBeNull();
    });

    it('draws the bands fill crops on the reference screen, at the canvas scale', async () => {
      localStorage.clear();
      await renderCanvas(filled());
      expect(screen.queryByTestId('safe-area')).toBeNull();
      fireEvent.click(toggle());
      expect(toggle()).toHaveAttribute('aria-pressed', 'true');
      const area = screen.getByTestId('safe-area');
      // 128 canvas pixels at half scale.
      expect(area.querySelector('[data-band="top"]')).toHaveStyle({ height: '64px' });
      expect(area.querySelector('[data-band="bottom"]')).toHaveStyle({ height: '64px' });
      expect(area).toHaveTextContent('Cropped on 16:10 in Fill · 128 px');
      fireEvent.click(toggle());
      expect(screen.queryByTestId('safe-area')).toBeNull();
    });

    it('switches the reference screen, and remembers it in this browser', async () => {
      localStorage.clear();
      const { store } = await renderCanvas(filled());
      fireEvent.click(toggle());
      fireEvent.change(screen.getByLabelText('Reference screen'), { target: { value: '16:9' } });
      expect(screen.getByTestId('safe-area')).toHaveTextContent('Cropped on 16:9 in Fill · 192 px');
      expect(JSON.parse(localStorage.getItem('tapcue.safeArea')!)).toEqual({
        show: true,
        reference: '16:9',
      });
      // Not part of the project: nothing to save.
      expect(store.getState().save).toEqual({ state: 'saved' });
    });

    it('flags a hotspot that reaches into a band, even with the bands hidden', async () => {
      localStorage.clear();
      const project = filled();
      project.pages[0]!.hotspots.find((h) => h.id === 'h_call00')!.y = 40;
      const { overlay } = await renderCanvas(project);
      expect(screen.queryByTestId('safe-area')).toBeNull();
      const chip = overlay('h_call00').querySelector('.hs-chip-warn');
      expect(chip).toHaveTextContent('Call our team is partly cropped');
      expect(overlay('h_carda0').querySelector('.hs-chip-warn')).toBeNull();
    });

    it('flags nothing in fit', async () => {
      const project = demoProject();
      project.pages[0]!.hotspots.find((h) => h.id === 'h_call00')!.y = 0;
      const { overlay } = await renderCanvas(project);
      expect(overlay('h_call00').querySelector('.hs-chip-warn')).toBeNull();
    });
  });
});
