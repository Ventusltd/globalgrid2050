/* Browser navigation policy, not a DNS-based source-rights or identity decision. */
export function publicHttpsUrl(value) {
  if(typeof value!=='string')throw Error('URL must be text');
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||!host.includes('.')||host.includes(':')
    ||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal)$/.test(host)
    ||(url.port&&url.port!=='443'))throw Error('Only public HTTPS hostnames are supported');
  return url;
}
export function priceWorkspaceUrl(value) {
  const url=publicHttpsUrl(value);
  if(url.href!=='https://globalgrid2050.com/uk_energy_tracking_v6/')throw Error('Price workspace is not an accepted host product');
  return url.href;
}
