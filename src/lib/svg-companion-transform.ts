/** SVG's six-number affine matrix; native Reanimated does not parse SVG pivot strings. */
export function rotationAround(degrees: number, x: number, y: number): number[] {
  'worklet';
  const angle=degrees*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
  return [c,s,-s,c,x*(1-c)+y*s,y*(1-c)-x*s];
}
export function scaleAround(sx: number, sy: number, x: number, y: number, driftY=0): number[] {
  'worklet';
  return [sx,0,0,sy,x*(1-sx),y*(1-sy)+driftY];
}
