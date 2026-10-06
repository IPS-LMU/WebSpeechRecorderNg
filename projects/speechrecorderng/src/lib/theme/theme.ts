////
/// TypeScript mirror of the semantic tokens in `_tokens.scss`.
///
/// Canvas painting cannot use `var(--spr-*)`, so painters ask for a token by name and
/// get the resolved value from the document, falling back to the literal below (which is
/// what the library renders if a consumer never includes the theme).
///
/// Keep the keys in sync with `_tokens.scss`.
////

export const SPR_PALETTE = {
  'spr-chrome': '#2A4765',
  'spr-ink': '#1F3044',
  'spr-ink-muted': '#4A6288',
  'spr-ink-subtle': '#6D7C98',
  'spr-ok': '#73A790',
  'spr-caution': '#D7B17C',
  'spr-alert': '#EABAB9',
  'spr-canvas': '#0E1A26',
  'spr-canvas-grid': '#24497E',
  'spr-canvas-ink': '#FFFFFF',
  'spr-canvas-signal': '#73A790',
  'spr-canvas-live': '#D7B17C',
  'spr-canvas-cursor': '#D7B17C',
  'spr-select-fill': 'rgba(215, 177, 124, 0.22)',
  'spr-select-edge': '#D7B17C',
} as const;

/** Root attribute that switches to the dark scheme: a stylesheet emits the dark tokens under
 *  `:root[data-spr-scheme="dark"]` via `spr-token-styles(dark, …)` from `_tokens.scss`, which only
 *  takes the selector — see `theme.scss` and the applications' `main.scss`. */
export const SCHEME_ATTRIBUTE = 'data-spr-scheme';

type SchemeListener = () => void;
const schemeListeners = new Set<SchemeListener>();

/**
 * Registers a repaint hook for scheme switches. Canvas layers keep their pixels, so they must
 * be repainted when the scheme changes — a repaint is not automatic, the tokens only change.
 * Returns an unsubscribe function.
 */
export function onSchemeChange(listener: SchemeListener): () => void {
  installSchemeListener();
  schemeListeners.add(listener);
  return () => schemeListeners.delete(listener);
}

function notifySchemeChange(): void {
  for (const listener of Array.from(schemeListeners)) {
    listener();
  }
}

export type SprTokenName = keyof typeof SPR_PALETTE;

const resolved = new Map<SprTokenName, string>();
let schemeListenerInstalled = false;

function canReadDocument(): boolean {
  return typeof document !== 'undefined' && !!document.documentElement && typeof getComputedStyle === 'function';
}

function installSchemeListener(): void {
  if (schemeListenerInstalled || typeof window === 'undefined') {
    return;
  }
  schemeListenerInstalled = true;
  // A scheme switch changes every resolved value at once. The scheme is driven by a root
  // attribute (`data-spr-scheme`), so watch it, drop the token cache and let the canvas layers
  // repaint: they hold pixels, and nothing else would redraw them.
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    const observer = new MutationObserver(() => {
      invalidateSprTokens();
      notifySchemeChange();
    });
    observer.observe(document.documentElement, {attributes: true, attributeFilter: [SCHEME_ATTRIBUTE]});
  }
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      invalidateSprTokens();
      notifySchemeChange();
    });
  }
}

/**
 * Resolved value of a semantic token, e.g. `sprToken('spr-canvas')` -> `#0E1A26`.
 * The lookup happens once per token and is cached until {@link invalidateSprTokens}.
 */
export function sprToken(name: SprTokenName): string {
  const cached = resolved.get(name);
  if (cached !== undefined) {
    return cached;
  }
  installSchemeListener();
  let value: string = SPR_PALETTE[name];
  if (canReadDocument()) {
    const fromCss = getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
    if (fromCss) {
      value = fromCss;
    }
  }
  resolved.set(name, value);
  return value;
}

/** Drops the resolved-token cache (call after switching the colour scheme). */
export function invalidateSprTokens(): void {
  resolved.clear();
}

/**
 * Spectrogram colour ramp, quiet to loud. The stops are ordered by relative luminance
 * (0.010 / 0.059 / 0.067 / 0.333 / 0.474 / 0.860), so intensity stays readable in
 * greyscale and for colour-blind viewers; `theme.spec.ts` asserts the monotonicity of
 * every expanded table entry.
 */
export const SPR_SPECTRUM_RAMP: readonly string[] = [
  '#0E1A26', '#2A4765', '#24497E', '#73A790', '#D7B17C', '#F1EFE4',
];

function parseHex(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  return [
    parseInt(full.substring(0, 2), 16),
    parseInt(full.substring(2, 4), 16),
    parseInt(full.substring(4, 6), 16),
  ];
}

/** sRGB channel (0..255) -> linear light (0..1). */
function toLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Linear light (0..1) -> sRGB channel (0..255). */
function fromLinear(value: number): number {
  const v = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, v * 255)));
}

/**
 * Expands {@link SPR_SPECTRUM_RAMP} into an RGB lookup table of `size` steps.
 *
 * The interpolation runs in linear light: relative luminance is a *linear* combination of
 * the linear-light channels, so every table entry between two stops then has a luminance
 * between theirs and the ramp cannot dip (see theme.spec.ts).
 *
 * The sonagram worker paints image data directly, so it receives this table by message
 * (`Uint8Array` of `size * 3` bytes) instead of importing the ramp.
 */
export function buildSpectrumLut(size = 256, ramp: readonly string[] = SPR_SPECTRUM_RAMP): Uint8Array {
  const stops = ramp.map(hex => parseHex(hex).map(toLinear) as [number, number, number]);
  const lut = new Uint8Array(size * 3);
  const segments = stops.length - 1;
  for (let i = 0; i < size; i++) {
    const pos = (i / (size - 1)) * segments;
    const seg = Math.min(Math.floor(pos), segments - 1);
    const t = pos - seg;
    const from = stops[seg];
    const to = stops[seg + 1];
    for (let c = 0; c < 3; c++) {
      lut[i * 3 + c] = fromLinear(from[c] + (to[c] - from[c]) * t);
    }
  }
  return lut;
}
