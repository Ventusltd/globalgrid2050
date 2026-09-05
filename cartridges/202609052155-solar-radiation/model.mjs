export const irradiance=1361,radiusM=6371000;
export function solarEnergy(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid duration');return irradiance*Math.PI*radiusM**2*seconds/3.6e9;}
