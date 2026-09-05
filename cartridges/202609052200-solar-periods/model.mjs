import {solarEnergy} from '../202609052155-solar-radiation/model.mjs';
export function periods(now){if(!Number.isFinite(now)||now<0)throw new RangeError('Expected a nonnegative epoch time');return Object.fromEntries([['day',86400000],['hour',3600000],['minute',60000]].map(([key,ms])=>[key,solarEnergy((now%ms)/1000)]));}
