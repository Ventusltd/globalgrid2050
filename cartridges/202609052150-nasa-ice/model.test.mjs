import test from 'node:test';import assert from 'node:assert/strict';import {iceRows} from './model.mjs';import {readFileSync} from 'node:fs';
const s=JSON.parse(readFileSync(new URL('./source.json',import.meta.url)));
test('UTC boundary resets and noon represents half a model day',()=>{assert.ok(iceRows(s,Date.UTC(2026,8,6)).every(r=>r.tonnes===0));const r=iceRows(s,Date.UTC(2026,8,6,12));assert.equal(r[0].fraction,.5);assert.ok(Math.abs(r[0].tonnes*2*s.modelYearDays-264e9)<.01);assert.ok(Math.abs(r[1].perSecond*86400*s.modelYearDays-135e9)<.01);});
test('invalid baseline rejected',()=>{assert.throws(()=>iceRows({...s,greenlandGtPerYear:NaN},0));assert.throws(()=>iceRows(null,0));});
