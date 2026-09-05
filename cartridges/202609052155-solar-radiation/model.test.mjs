import test from 'node:test';import assert from 'node:assert/strict';import {solarEnergy} from './model.mjs';
test('incoming solar energy uses disk area, not four times surface area',()=>{assert.equal(solarEnergy(0),0);assert.ok(solarEnergy(1)>48e6&&solarEnergy(1)<49e6);assert.ok(Math.abs(solarEnergy(60)-60*solarEnergy(1))<1e-5);assert.throws(()=>solarEnergy(-1));});
