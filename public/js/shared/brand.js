import { h } from './dom.js';

/**
 * TASCO wordmark: "TASCO" (navy, heavy, extended) over "INSURANCE" (teal, light, wide tracking), set in Lexend.
 *
 * STAND-IN ONLY: this is a typographic placeholder in the spirit of the baohiemtasco.vn header. It is not the
 * official TASCO Insurance logo and must be replaced by the asset TASCO marketing supplies (do not copy the
 * logo image from the TASCO website). Styles: .wordmark in public/css/components.css.
 *
 * @param {{ size?: 'sm'|'md'|'lg'|'xl', variant?: 'color'|'white'|'navy', label?: string|null, tag?: string, attrs?: object }} [o]
 *   variant 'white' is for navy and teal backgrounds; 'navy' keeps the light-theme colours in dark mode.
 *   label: accessible name (default "TASCO Insurance"); pass null when a surrounding link already names it.
 */
export function wordmark({ size = 'md', variant = 'color', label = 'TASCO Insurance', tag = 'span', attrs = {} } = {}) {
  const cls = ['wordmark', size !== 'md' ? size : null, variant !== 'color' ? variant : null].filter(Boolean).join(' ');
  const a = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
  return h(tag, { class: cls, ...a, ...attrs },
    h('span', { class: 'wm-tasco' }, 'TASCO'),
    h('span', { class: 'wm-ins' }, 'INSURANCE'));
}
