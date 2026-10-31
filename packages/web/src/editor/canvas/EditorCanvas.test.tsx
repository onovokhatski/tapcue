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
});
