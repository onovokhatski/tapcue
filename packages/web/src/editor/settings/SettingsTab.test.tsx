import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { aspectNote, SettingsTab } from './SettingsTab';

async function renderTab(demo = false) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project: demoProject(), demo }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <SettingsTab />
    </EditorStoreContext>,
  );
  return { canvas: () => store.getState().project!.canvas };
}

const type = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
const diagrams = (mode: 'Fit' | 'Fill') => screen.getByRole('region', { name: `${mode} diagrams` });

// The demo canvas: 2048 × 1536, fit, black.
describe('SettingsTab (spec CNV-1, CNV-2, ED-10)', () => {
  it('changes the width and height', async () => {
    const { canvas } = await renderTab();
    type('Width', '2560');
    type('Height', '1600');
    expect(canvas()).toMatchObject({ width: 2560, height: 1600 });
  });

  it('refuses a size that would leave a hotspot outside, naming the hotspot', async () => {
    const { canvas } = await renderTab();
    type('Width', '1800');
    expect(screen.getByRole('textbox', { name: 'Width' })).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText(
        '“Product C card” on Home would be outside. Expected at least 1904 px, or move the hotspot first',
      ),
    ).toBeInTheDocument();
    expect(canvas().width).toBe(2048);
  });

  it('refuses a size that is not a whole number', async () => {
    const { canvas } = await renderTab();
    type('Height', '15x0');
    expect(screen.getByText('Expected a whole number of pixels')).toBeInTheDocument();
    expect(canvas().height).toBe(1536);
  });

  it('changes the scale mode, and the diagrams mark it as current', async () => {
    const { canvas } = await renderTab();
    expect(diagrams('Fit')).toHaveAttribute('aria-current', 'true');
    expect(diagrams('Fill')).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('radio', { name: 'Fill' }));
    expect(canvas().scaleMode).toBe('fill');
    expect(diagrams('Fill')).toHaveAttribute('aria-current', 'true');
    expect(diagrams('Fit')).not.toHaveAttribute('aria-current');
  });

  it('changes the background colour; an invalid hex is not saved', async () => {
    const { canvas } = await renderTab();
    type('background colour hex', '#12345');
    expect(canvas().backgroundColor).toBe('#000000');
    type('background colour hex', '#123456');
    expect(canvas().backgroundColor).toBe('#123456');
  });

  it('shows the bars of Fit and the crops of Fill on each reference screen', async () => {
    await renderTab();
    const fit = within(diagrams('Fit'));
    expect(fit.getByText('16:10 · 1280 × 800').nextSibling).toHaveTextContent(
      '107 px bars left and right',
    );
    expect(fit.getByText('16:9 · 1920 × 1080').nextSibling).toHaveTextContent(
      '240 px bars left and right',
    );
    const fill = within(diagrams('Fill'));
    // Canvas pixels, the same numbers as the safe area on the Pages tab.
    expect(fill.getByText('16:10 · 1280 × 800').nextSibling).toHaveTextContent(
      '128 px cropped top and bottom',
    );
    expect(fill.getByText('16:9 · 1920 × 1080').nextSibling).toHaveTextContent(
      '192 px cropped top and bottom',
    );
  });

  it('redraws the diagrams for a new canvas size', async () => {
    await renderTab();
    type('Width', '2560');
    type('Height', '1600');
    expect(within(diagrams('Fit')).getByText('16:10 · 1280 × 800').nextSibling).toHaveTextContent(
      'No bars',
    );
    expect(within(diagrams('Fill')).getByText('16:10 · 1280 × 800').nextSibling).toHaveTextContent(
      'Nothing cropped',
    );
    expect(within(diagrams('Fill')).getByText('16:9 · 1920 × 1080').nextSibling).toHaveTextContent(
      '80 px cropped top and bottom',
    );
    expect(screen.getByText('The 2560 × 1600 page is 8:5.')).toBeInTheDocument();
  });
});

describe('SettingsTab in demo mode (spec DEMO-3, frame G4)', () => {
  it('explains that changes stay in this tab', async () => {
    await renderTab(true);
    const banner = screen.getByText('Demo mode').closest('[role="status"]');
    expect(banner).toHaveTextContent(
      'Demo modeChanges stay in this browser tab and are lost when you close it. Saving, uploads and import are turned off; Export still works.',
    );
  });

  it('shows no demo notice otherwise', async () => {
    await renderTab();
    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });
});

describe('aspectNote', () => {
  it('mentions the iPad only for a 4:3 page', () => {
    expect(aspectNote({ width: 2048, height: 1536 })).toBe(
      'The 2048 × 1536 page is 4:3, like the iPad (1024 × 768), so on the iPad both modes show the whole page.',
    );
    expect(aspectNote({ width: 1920, height: 1080 })).toBe('The 1920 × 1080 page is 16:9.');
  });
});
