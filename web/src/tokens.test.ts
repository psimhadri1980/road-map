/// <reference types="vite/client" />
import { expect, test } from 'vitest';
import css from './layout.css?raw';

// 014 FR-008, research R4: jsdom cannot compute colours, so axe's color-contrast rule is off in the page tests.
// Instead every text/background token pair is checked here, in both themes, straight from layout.css.

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}
const light = tokens(':root');
const themes = { light, dark: { ...light, ...tokens(":root[data-theme='dark']") } };

type Rgba = [number, number, number, number];
function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(([^)]+)\)$/.exec(value);
  if (rgba) return rgba[1]!.split(',').map(Number) as Rgba;
  throw new Error(`not a colour: ${value}`);
}
/** A translucent colour as it shows over an opaque one. */
function over([r, g, b, a]: Rgba, [R, G, B]: Rgba): Rgba {
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
}
function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const surfaces = ['background', 'layer-01', 'layer-02'];
// [foreground, backgrounds, minimum]: 4.5:1 for text, 3:1 for borders, focus rings and marks (WCAG 1.4.3, 1.4.11).
const pairs: [string, string[], number][] = [
  ['text-primary', [...surfaces, 'layer-hover', 'warning-subtle', 'layer-selected-subtle'], 4.5],
  ['text-secondary', [...surfaces, 'layer-hover'], 4.5],
  ['text-placeholder', ['layer-01'], 4.5],
  ['link', surfaces, 4.5],
  ['support-error', ['background', 'layer-01'], 4.5],
  ['text-on-color', ['button-primary', 'button-primary-hover'], 4.5],
  ['border-strong', ['background', 'layer-01'], 3],
  ['focus', surfaces, 3],
  ['interactive', surfaces, 3],
];

test('the test sees both themes', () => {
  expect(Object.keys(themes.light).length).toBeGreaterThan(15);
  expect(themes.dark['background']).not.toBe(themes.light['background']);
});

test('the ratio matches the WCAG reference values', () => {
  expect(ratio(parse('#000000'), parse('#ffffff'))).toBeCloseTo(21, 5);
  expect(ratio(parse('#767676'), parse('#ffffff'))).toBeCloseTo(4.54, 2);
});

for (const [theme, t] of Object.entries(themes)) {
  for (const [fg, backgrounds, min] of pairs) {
    for (const bg of backgrounds) {
      test(`${theme}: ${fg} on ${bg} reaches ${min}:1`, () => {
        const base = parse(t['background']!);
        const back = over(parse(t[bg]!), base);
        expect(ratio(over(parse(t[fg]!), back), back)).toBeGreaterThanOrEqual(min);
      });
    }
  }
}
