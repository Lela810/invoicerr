import { SUGGESTED_UNIT_CODES, UNAMBIGUOUS_UNIT_WORDS, knownUnitCode, unitCodeFor } from './unit-code';

describe('unitCodeFor', () => {
  it.each([
    ['day', 'DAY'],
    ['Hours', 'HUR'],
    ['h', 'HUR'],
    ['Stunde', 'HUR'],
    ['kg', 'KGM'],
    ['piece', 'H87'],
    ['szt.', 'H87'],
    ['box', 'BX'],
  ])('maps the unambiguous word %s to %s', (word, code) => {
    expect(unitCodeFor(word)).toBe(code);
  });

  it.each(SUGGESTED_UNIT_CODES)('passes the suggested Rec20 code %s through unchanged', (code) => {
    expect(unitCodeFor(code)).toBe(code);
    expect(unitCodeFor(`  ${code} `)).toBe(code);
  });

  it.each(['sprint', 'm', 'lot', ''])('exports the free text "%s" as C62', (text) => {
    expect(knownUnitCode(text)).toBeUndefined();
    expect(unitCodeFor(text)).toBe('C62');
  });

  it('never lists one word under two codes', () => {
    const words = Object.values(UNAMBIGUOUS_UNIT_WORDS).flat();
    expect(new Set(words).size).toBe(words.length);
  });
});
