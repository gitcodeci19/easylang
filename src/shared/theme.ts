import type { UiThemeMode } from './types';

export const THEME_LOCAL_STORAGE_KEY = 'lingoex_theme';

/** Normalize any persisted theme value strictly into 'light' or 'dark'. */
export function normalizeThemeMode(raw?: unknown): UiThemeMode {
  return raw === 'dark' ? 'dark' : 'light';
}

/**
 * Apply the selected UI theme to the current extension page (popup or options):
 * - Sets `data-theme="light" | "dark"` on `<html>`
 * - Enables or disables `#theme-light-css` so zero light-mode rules can leak in dark mode
 * - Mirrors to `localStorage` so `theme-init.js` prevents any white flash on next open
 */
export function applyDocumentTheme(mode: UiThemeMode): void {
  const safe: UiThemeMode = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = safe;
  const lightLink = document.getElementById('theme-light-css') as HTMLLinkElement | null;
  if (lightLink) {
    lightLink.disabled = safe === 'dark';
  }
  try {
    window.localStorage.setItem(THEME_LOCAL_STORAGE_KEY, safe);
  } catch {
    // Ignore storage access errors in restricted frames
  }
}

/**
 * Build a crisp monochrome SVG icon for the theme toggle button:
 * - In light mode: shows a crescent moon (click to switch to Night Mode)
 * - In dark mode: shows a sun (click to switch to Warm Light Mode)
 */
export function buildThemeToggleSvg(currentMode: UiThemeMode, size: number = 14): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  if (currentMode === 'dark') {
    const c = document.createElementNS(svgNs, 'circle');
    c.setAttribute('cx', '12');
    c.setAttribute('cy', '12');
    c.setAttribute('r', '4');
    svg.appendChild(c);
    for (const d of [
      'M12 2v2',
      'M12 20v2',
      'M4.93 4.93l1.41 1.41',
      'M17.66 17.66l1.41 1.41',
      'M2 12h2',
      'M20 12h2',
      'M6.34 17.66l-1.41 1.41',
      'M19.07 4.93l-1.41 1.41',
    ]) {
      const p = document.createElementNS(svgNs, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
  } else {
    const p = document.createElementNS(svgNs, 'path');
    p.setAttribute('d', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z');
    svg.appendChild(p);
  }
  return svg;
}

/**
 * Minimalist seamless 320x320 ghost travel & world-landmark pattern SVG:
 * Eiffel Tower, Statue of Liberty, Big Ben, Globe, Open Book, Paper Plane, Compass & Teacup.
 */
function buildGhostLandmarkSvgUri(strokeHex: string, opacity: string): string {
  const c = encodeURIComponent(strokeHex);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='${c}' stroke-opacity='${opacity}' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'>` +
    // 1. Eiffel Tower (top-left)
    `<g transform='translate(28,18)'>` +
    `<path d='M24 2 L24 9 M21 9 L27 9 M22 9 C21 24 16 40 7 58 M26 9 C27 24 32 40 41 58 M14 34 L34 34 M10 46 L38 46 M16 58 A8 8 0 0 1 32 58 M4 58 L44 58'/>` +
    `</g>` +
    // 2. Paper Plane + dotted trail (top-center)
    `<g transform='translate(124,34)'>` +
    `<path d='M4 18 L34 6 L22 28 L17 20 Z M34 6 L17 20'/>` +
    `<path d='M-12 28 Q-4 26 2 22' stroke-dasharray='2.5 4'/>` +
    `</g>` +
    // 3. Statue of Liberty (top-right)
    `<g transform='translate(226,14)'>` +
    `<path d='M12 6 L12 18 M9 10 C12 4 15 10 12 12 M12 18 L19 25 M23 19 A4.5 4.5 0 1 0 32 19 M23 15 L19 11 M26 14 L25 9 M29 14 L30 9 M32 15 L36 11 M21 25 L34 25 L37 56 L18 56 Z M24 25 L23 56 M31 25 L32 56 M14 56 L41 56 M12 62 L43 62'/>` +
    `</g>` +
    // 4. Compass Rose (mid-left)
    `<g transform='translate(46,128)'>` +
    `<circle cx='20' cy='20' r='16'/><path d='M20 7 L23 17 L33 20 L23 23 L20 33 L17 23 L7 20 L17 17 Z'/>` +
    `</g>` +
    // 5. Big Ben / Clock Tower (center)
    `<g transform='translate(142,118)'>` +
    `<path d='M18 4 L12 18 L24 18 Z M11 18 L25 18 L25 34 L11 34 Z M13 34 L13 64 M23 34 L23 64 M9 64 L27 64'/>` +
    `<circle cx='18' cy='26' r='4.5'/><path d='M18 26 L18 23.5 M18 26 L20.2 26'/>` +
    `</g>` +
    // 6. Hot Coffee / Teacup (mid-right)
    `<g transform='translate(248,128)'>` +
    `<path d='M8 18 L28 18 L26 32 C25 36 11 36 10 32 Z M28 21 L32 21 C34 21 34 28 31 28 L27 28 M6 38 L30 38 M14 13 C13 10 16 9 15 6 M21 13 C20 10 23 9 22 6'/>` +
    `</g>` +
    // 7. Open Book (bottom-left)
    `<g transform='translate(28,224)'>` +
    `<path d='M4 12 C12 9 20 11 24 16 C28 11 36 9 44 12 L44 36 C36 33 28 35 24 40 C20 35 12 33 4 36 Z M24 16 L24 40 M10 18 L18 19 M10 24 L18 25 M30 19 L38 18 M30 25 L38 24'/>` +
    `</g>` +
    // 8. World Globe (bottom-center-right)
    `<g transform='translate(136,226)'>` +
    `<circle cx='22' cy='22' r='17'/><ellipse cx='22' cy='22' rx='8' ry='17'/><path d='M6 16 L38 16 M6 28 L38 28 M22 5 L22 39'/>` +
    `</g>` +
    // 9. London Bridge / Arch + Tiny Star (bottom-right)
    `<g transform='translate(232,230)'>` +
    `<path d='M4 34 L50 34 M12 34 L12 10 L16 6 L20 10 L20 34 M34 34 L34 10 L38 6 L42 10 L42 34 M20 16 L34 16 M4 26 Q12 18 12 18 M42 18 Q50 26 50 26 M20 34 A7 7 0 0 1 34 34'/>` +
    `</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/\s+/g, ' ')}")`;
}

export const GHOST_LANDMARKS_LIGHT_BG = buildGhostLandmarkSvgUri('#9a6b24', '0.115');
export const GHOST_LANDMARKS_DARK_BG = buildGhostLandmarkSvgUri('#cbd5e1', '0.085');
