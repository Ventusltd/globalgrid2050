/* Read-only adapter for original GIS SLD route state. No calculation or mutation. */
(() => {
  'use strict';
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const coordinate=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
  function getSnapshot() {
    const source=typeof state==='undefined'?null:state;
    if(!source)return freeze({schema:'ventus.gis-route.v1',status:'unavailable'});
    const pins=clone(source.cableRoutePins||[]);
    const routes=(source.currentGeoJSON?.features||[]).filter(f=>f.properties?.type==='export_cable');
    const route=routes.length===1?clone(routes[0]):null;
    const editing=Boolean(source.cableRoutePinMode)||(pins.length>0&&!source.cableRouteCommitted);
    const valid=route?.geometry?.type==='LineString'&&Array.isArray(route.geometry.coordinates)&&route.geometry.coordinates.length>=2&&route.geometry.coordinates.every(coordinate);
    return freeze({schema:'ventus.gis-route.v1',status:editing?'editing':routes.length>1?'ambiguous':valid?'available':routes.length?'invalid':'empty',
      route:valid&&!editing?route:null,pins,committed:Boolean(source.cableRouteCommitted),
      measurementMethod:valid&&!editing?route.properties.measurement_method:null,
      originalLengthKm:valid&&!editing&&Number.isFinite(route.properties.export_cable_length_km)?route.properties.export_cable_length_km:null,
      scope:'Read-only original manual route snapshot; no constraint routing, capacity or construction acceptance.'});
  }
  Object.defineProperty(window,'GisSldRoute',{value:Object.freeze({getSnapshot}),writable:false,configurable:false});
})();
