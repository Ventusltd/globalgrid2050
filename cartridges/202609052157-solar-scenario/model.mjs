export const targetTW=75;
export function scenarioMWh(seconds,capacityFactor){if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(capacityFactor)||capacityFactor<0||capacityFactor>1)throw Error('Invalid scenario');return targetTW*1e6*capacityFactor*seconds/3600;}
