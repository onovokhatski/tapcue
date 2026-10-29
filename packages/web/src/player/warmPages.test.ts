import type { Background, Hotspot, Page, Project, Station } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../test/demoProject';
import { imageUrls, warmPages, WARM_VIDEO_LIMIT } from './warmPages';

const demo = demoProject();
const main = demo.stations.find((s) => s.id === 'main')!;

const video = (name: string): Background => ({ type: 'video', asset: `assets/${name}.mp4` });
const image = (name: string): Background => ({ type: 'image', asset: `assets/${name}.jpg` });

function link(id: string, goTo: string | null): Hotspot {
  const template = demo.pages[0]!.hotspots[0]!;
  return { ...template, id, action: { goTo: goTo, command: null } };
}

function page(id: string, background: Background | null, links: (string | null)[] = []): Page {
  return {
    id: id,
    name: id,
    background,
    hotspots: links.map((goTo, i) => link(`h_${id.slice(2, 6)}${i}0`, goTo)),
  };
}

// A hub linking to three video pages, one twice, plus a dead end, an image page and nothing.
const project: Project = {
  ...demo,
  pages: [
    page('p_hub000', image('hub'), [
      'p_vid001',
      'p_vid002',
      'p_vid001',
      'p_gone00',
      null,
      'p_img000',
      'p_vid003',
    ]),
    page('p_vid001', video('one'), ['p_hub000']),
    page('p_vid002', video('two')),
    page('p_vid003', video('three')),
    page('p_img000', image('img')),
    page('p_start0', video('start')),
  ],
};
const station: Station = { ...main, startPageId: 'p_start0' };

describe('warmPages', () => {
  it('keeps 2 videos warm to start with', () => {
    expect(WARM_VIDEO_LIMIT).toBe(2);
  });

  it('on the demo Home page, warms the About us video', () => {
    expect(warmPages(demo, main, 'p_home00')).toEqual(['p_about0']);
  });

  it('warms nothing from a page that leads only to image pages', () => {
    expect(warmPages(demo, main, 'p_about0')).toEqual([]);
  });

  it('takes the linked video pages in stacking order, once each, up to the limit', () => {
    expect(warmPages(project, station, 'p_hub000', 2)).toEqual(['p_vid001', 'p_vid002']);
  });

  it('skips missing pages, image pages and hotspots without a link', () => {
    expect(warmPages(project, station, 'p_hub000', 10)).toEqual([
      'p_vid001',
      'p_vid002',
      'p_vid003',
      'p_start0',
    ]);
  });

  it("adds the station's start page last, for the idle return", () => {
    expect(warmPages(project, station, 'p_vid001')).toEqual(['p_start0']);
  });

  it('never lists the page itself', () => {
    expect(warmPages(project, station, 'p_start0')).toEqual([]);
  });

  it('warms nothing with a limit of 0', () => {
    expect(warmPages(project, station, 'p_hub000', 0)).toEqual([]);
  });
});

describe('imageUrls', () => {
  it('lists every image background once, as served by the server', () => {
    const withDuplicate = {
      ...demo,
      pages: [...demo.pages, { ...demo.pages[0]!, id: 'p_copy00' }],
    };
    expect(imageUrls(withDuplicate)).toEqual([
      '/assets/home.jpg',
      '/assets/product-a.jpg',
      '/assets/product-b.jpg',
    ]);
  });
});
