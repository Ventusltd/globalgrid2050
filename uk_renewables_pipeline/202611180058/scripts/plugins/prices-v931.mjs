import {fetchPinned} from './verified-inputs.mjs';
const host = document.getElementById('pricesLayerHost');
const manifest = new URL('../../contracts/prices.v931.json', import.meta.url);
const manifestHash = '57df11f2866836442395910ba307dc9232bf8f0bada365dfcfb0b64207af332c';
let pending = null, controller = null;

function ensurePrices() {
  if (!host || pending || host.querySelector('.pn-daily-prices[data-state="available"]')) return pending;
  pending = (async () => {
    const raw = await fetchPinned(manifest, manifestHash, 12000);
    const spec = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(raw));
    if (spec.schema !== 'globalgrid2050.daily-price-cartridge.v1' ||
        !/^[a-f0-9]{40}$/.test(spec.producer.commit) ||
        JSON.stringify(Object.keys(spec.files).sort()) !== JSON.stringify(['canvas.mjs','model.mjs','styles.css','view.mjs'])) throw Error('Unsupported daily price cartridge');
    const base = new URL('../../../../automation/price_daily_ui/' + spec.producer.commit + '/', import.meta.url);
    await Promise.all(Object.entries(spec.files).map(([name, pin]) => {
      if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes > 65536) throw Error('Daily price cartridge exceeds its bound');
      return fetchPinned(new URL(name,base), pin.sha256, pin.bytes, pin.bytes);
    }));
    const {SOURCE} = await import(new URL('model.mjs', base));
    if (SOURCE.commit !== spec.input.commit || SOURCE.base !== spec.input.base ||
        !['path','bytes','sha256'].every(k => SOURCE.index[k] === spec.input.index[k])) throw Error('Daily price source contract changed');
    const {mountDailyPrices} = await import(new URL('view.mjs', base));
    controller?.disconnect();
    host.querySelector('.price-cartridge-status')?.remove();
    const transport = (url,options={}) => fetch(url, {...options,redirect:'error',signal:AbortSignal.timeout(15000)});
    controller = mountDailyPrices(host, {transport});
    await controller.ready;
    host.dataset.priceState = host.querySelector('.pn-daily-prices')?.dataset.state || 'unavailable';
  })().catch(() => {
    host.dataset.priceState = 'unavailable';
    if (!host.querySelector('.price-cartridge-status')) {
      const message = document.createElement('p'); message.className = 'category-scope price-cartridge-status';
      message.textContent = 'Historical daily prices unavailable. The original electricity workspace remains available below.';
      host.append(message);
    }
  }).finally(() => {pending = null;});
  return pending;
}
window.addEventListener('pipeline-category-changed', event => {if (event.detail === 'prices') void ensurePrices();});
if (document.getElementById('pricesTab')?.getAttribute('aria-selected') === 'true') void ensurePrices();
