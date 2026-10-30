import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { AssetPath, Color, HotspotId, PageId, StationId, TargetId } from './values';

describe('generated ids', () => {
  it.each([
    { kind: 'page', schema: PageId, value: 'p_a1b2c3' },
    { kind: 'hotspot', schema: HotspotId, value: 'h_000000' },
    { kind: 'target', schema: TargetId, value: 't_zzzzzz' },
  ])('accepts a $kind id: $value', ({ schema, value }) => {
    expect(errorOf(schema, value)).toBeNull();
  });

  it.each([
    ['wrong prefix for the kind', PageId, 'h_a1b2c3'],
    ['uppercase', PageId, 'P_A1B2C3'],
    ['too short', PageId, 'p_a1b2c'],
    ['too long', PageId, 'p_a1b2c3d'],
    ['other characters', PageId, 'p_a1-b2c'],
    ['not a string', PageId, 123],
  ])('rejects an id that is %s', (_, schema, value) => {
    expect(errorOf(schema, value)).not.toBeNull();
  });

  it('names the kind and shows an example in the error', () => {
    expect(errorOf(TargetId, 'resolume')).toBe('Expected a target id like "t_a1b2c3"');
  });
});

describe('StationId', () => {
  it.each(['main', 'small-screen', 'kiosk-2', 'a'.repeat(40)])('accepts "%s"', (value) => {
    expect(errorOf(StationId, value)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['longer than 40 characters', 'a'.repeat(41)],
    ['uppercase', 'Main'],
    ['a space', 'main catalog'],
    ['an underscore', 'main_catalog'],
    ['a slash', 'main/2'],
  ])('rejects an id that is %s', (_, value) => {
    expect(errorOf(StationId, value)).not.toBeNull();
  });

  it('rejects "test", which marks test sends in the X-Tapcue-Station header (spec TGT-6)', () => {
    expect(errorOf(StationId, 'test')).toBe('"test" is reserved for test sends from the editor');
    expect(errorOf(StationId, 'test-2')).toBeNull();
  });
});

describe('Color', () => {
  it.each(['#3A7BFF', '#3a7bff', '#000000'])('accepts %s', (value) => {
    expect(errorOf(Color, value)).toBeNull();
  });

  it.each([
    ['short form', '#FFF'],
    ['with alpha', '#3A7BFF80'],
    ['without #', '3A7BFF'],
    ['a colour name', 'red'],
    ['non-hex digits', '#GGGGGG'],
  ])('rejects %s', (_, value) => {
    expect(errorOf(Color, value)).toBe('Expected a colour like "#3A7BFF"');
  });
});

describe('AssetPath', () => {
  it.each(['assets/home.jpg', 'assets/about-loop.mp4', 'assets/Product_A.v2.webp'])(
    'accepts %s',
    (value) => {
      expect(errorOf(AssetPath, value)).toBeNull();
    },
  );

  it.each([
    ['outside the assets folder', 'home.jpg'],
    ['in a subfolder', 'assets/img/home.jpg'],
    ['climbing out of the folder', '../assets/home.jpg'],
    ['pointing at the parent folder', 'assets/..'],
    ['pointing at the folder itself', 'assets/.'],
    ['absolute', '/assets/home.jpg'],
    ['with a space', 'assets/home page.jpg'],
    ['with non-ASCII letters', 'assets/главная.jpg'],
    ['without a file name', 'assets/'],
  ])('rejects a path %s', (_, value) => {
    expect(errorOf(AssetPath, value)).not.toBeNull();
  });
});
