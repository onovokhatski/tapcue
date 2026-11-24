import type { Hotspot } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { DEFAULT_TEXT } from '../operations/hotspots';
import {
  nameSummary,
  onTapSummary,
  positionSummary,
  stackingSummary,
  styleSummary,
  textSummary,
  typeSummary,
} from './summaries';

const project = demoProject();
const home = project.pages[0]!.hotspots;
const card = (overrides: Partial<Hotspot> = {}): Hotspot => ({ ...home[0]!, ...overrides });

describe('section summaries (spec ED-20)', () => {
  it('names the hotspot, or says it has none', () => {
    expect(nameSummary(card())).toBe('Product A card');
    expect(nameSummary(card({ name: '' }))).toBe('Unnamed');
  });

  it('says the type, with a fader’s direction and range', () => {
    expect(typeSummary(card())).toBe('Button');
    const fader = card({
      kind: 'fader',
      fader: {
        orientation: 'vertical',
        min: 0,
        max: 1,
        step: 0.01,
        start: 0,
        value: { at: 0, as: 'f' },
      },
    });
    expect(typeSummary(fader)).toBe('Fader · vertical, 0 to 1');
  });

  it('gives the position and size of the common box', () => {
    expect(positionSummary([card()])).toBe('144, 500 · 560 × 720');
    expect(positionSummary([home[0]!, home[3]!])).toBe('144, 500 · 1760 × 888');
    expect(positionSummary([])).toBe('');
  });

  describe('style', () => {
    it('says the shape, then what visitors see', () => {
      const styled = card({
        style: {
          fill: '#FFFFFF',
          fillOpacity: 0.3,
          border: { color: '#000000', width: 2 },
          opacity: 0.5,
          backdropBlur: 8,
          image: 'assets/button.png',
        },
      });
      expect(styleSummary([styled])).toBe(
        'Rectangle R 40 · fill #FFFFFF 30 % · border 2 px · frost 8 px · image · opacity 50 %',
      );
      // A solid fill and full opacity go unsaid.
      expect(styleSummary([card({ style: { fill: '#FFFFFF', border: null, opacity: 1 } })])).toBe(
        'Rectangle R 40 · fill #FFFFFF',
      );
    });

    it('says an invisible hotspot is invisible', () => {
      expect(styleSummary([card()])).toBe('Rectangle R 40 · invisible');
      expect(styleSummary([card({ shape: { type: 'ellipse' } })])).toBe('Ellipse · invisible');
    });

    it('says what several do not share', () => {
      const a = card({
        style: { fill: '#FFFFFF', border: { color: '#000', width: 2 }, opacity: 1 },
      });
      const b = card({
        shape: { type: 'ellipse' },
        style: {
          fill: '#000000',
          border: null,
          opacity: 0.5,
          backdropBlur: 4,
          image: 'assets/x.png',
        },
      });
      expect(styleSummary([a, b])).toBe(
        'Mixed shapes · mixed fill · mixed border · mixed frost · some with an image · mixed opacity',
      );
      expect(styleSummary([a, a])).toBe('Rectangle R 40 · fill #FFFFFF · border 2 px');
    });
  });

  describe('text', () => {
    const labelled = (content: string, size = 48, weight: 'medium' | 'bold' = 'medium') =>
      card({ text: { ...DEFAULT_TEXT, content, size, weight } });

    it('quotes the words with size and weight, or says there are none', () => {
      expect(textSummary([labelled('Play')])).toBe('“Play” · 48 px medium');
      expect(textSummary([card()])).toBe('No text');
    });

    it('counts the labelled ones among several, with the style they share', () => {
      expect(textSummary([labelled('A'), labelled('B'), card()])).toBe(
        '2 of 3 with text · 48 px medium',
      );
      expect(textSummary([labelled('A', 40), labelled('B', 60, 'bold')])).toBe(
        '2 of 2 with text · mixed size mixed weight',
      );
      expect(textSummary([card(), card()])).toBe('No text');
    });
  });

  describe('on tap', () => {
    const udp = (text: string) => ({ type: 'udp' as const, targetId: 't_projec', text });

    it('says where a tap goes and how many commands it sends, over how long', () => {
      expect(onTapSummary(home[0]!, project)).toBe('Go to Product A · 1 command');
      const sequence = card({
        action: {
          goTo: null,
          commands: [
            { command: udp('A') },
            { delayMs: 1500, command: udp('B') },
            { delayMs: 500, command: udp('C'), enabled: false },
          ],
        },
      });
      // The step that is off is left out, with its pause.
      expect(onTapSummary(sequence, project)).toBe('2 of 3 commands over 1.5 s');
      expect(onTapSummary(card({ action: { goTo: null, commands: [] } }), project)).toBe(
        'Nothing yet',
      );
    });

    it('says what a fader sends while dragged, and when it is off', () => {
      const fader = (enabled?: boolean) =>
        card({
          kind: 'fader',
          action: {
            goTo: null,
            commands: [{ command: udp('LEVEL {value}'), ...(enabled === false && { enabled }) }],
          },
        });
      expect(onTapSummary(fader(), project)).toBe('Projector · LEVEL {value}');
      expect(onTapSummary(fader(false), project)).toBe('Projector · LEVEL {value} · off');
      expect(
        onTapSummary(card({ kind: 'fader', action: { goTo: null, commands: [] } }), project),
      ).toBe('Sends nothing yet');
    });
  });

  it('says where the hotspot is in the stacking order', () => {
    expect(stackingSummary(0, 5)).toBe('1 of 5 from the bottom');
  });
});
