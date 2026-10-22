import type { HYIconName } from '../core/types.js';
/** Public vector geometry. 24 × 24, 1.8 unit round strokes, no font or platform assets. */
export const HY_ICONS: Readonly<Record<HYIconName, readonly (readonly (readonly [number, number])[])[]>> = Object.freeze({
  save:[[[4,3],[17,3],[21,7],[21,21],[3,21],[3,3],[4,3]],[[7,3],[7,9],[17,9],[17,3]],[[7,21],[7,14],[17,14],[17,21]]],
  export:[[[12,15],[12,3]],[[7,8],[12,3],[17,8]],[[4,14],[4,21],[20,21],[20,14]]],
  play:[[[7,4],[20,12],[7,20],[7,4]]], pause:[[[8,4],[8,20]],[[16,4],[16,20]]],
  reset:[[[4,9],[6,5],[10,3],[15,3],[19,6],[21,10],[21,14],[18,19],[14,21],[9,20],[6,17]],[[4,3],[4,9],[10,9]]],
  step:[[[5,5],[15,12],[5,19],[5,5]],[[19,5],[19,19]]],
  settings:[[[9,3],[15,3],[16,6],[19,6],[22,11],[20,14],[20,17],[15,21],[12,20],[9,21],[4,17],[4,14],[2,11],[5,6],[8,6],[9,3]],[[16,12],[15,9],[12,8],[9,9],[8,12],[9,15],[12,16],[15,15],[16,12]]],
  back:[[[14,4],[6,12],[14,20]],[[6,12],[21,12]]], chevronDown:[[[6,9],[12,15],[18,9]]],
  check:[[[4,12],[9,17],[20,6]]],close:[[[6,6],[18,18]],[[18,6],[6,18]]],add:[[[12,4],[12,20]],[[4,12],[20,12]]],
});
for(const paths of Object.values(HY_ICONS)){for(const points of paths){for(const point of points)Object.freeze(point);Object.freeze(points);}Object.freeze(paths);}
/** Safe SVG built only from the library's numeric paths. Color inherits from its host. */
export function hyIconSvg(name: HYIconName): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HY_ICONS[name].map(points => `<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('')}</svg>`;
}
