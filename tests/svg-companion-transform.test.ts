import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rotationAround, scaleAround } from '../src/lib/svg-companion-transform';
const apply=(m:number[],x:number,y:number)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
test('a rotation matrix preserves its SVG pivot and rotates a limb tip',()=>{
 const matrix=rotationAround(90,73,130); const pivot=apply(matrix,73,130),tip=apply(matrix,83,130);
 assert.ok(Math.abs(pivot[0]-73)<1e-9&&Math.abs(pivot[1]-130)<1e-9);
 assert.ok(Math.abs(tip[0]-73)<1e-9&&Math.abs(tip[1]-140)<1e-9);
 assert.equal(matrix.length,6); assert.ok(matrix.every(Number.isFinite));
});
test('blink and breath scale preserve the center and apply bounded drift',()=>{
 assert.deepEqual(apply(scaleAround(1,0.08,0,112),99,112),[99,112]);
 assert.deepEqual(apply(scaleAround(1.03,1.03,120,124,-2),120,124),[120,122]);
});
