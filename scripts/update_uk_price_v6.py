import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
import requests

FOLDER = Path(__file__).parent.parent / 'uk_energy_tracking_v6'
OUT = FOLDER / 'live_grid_price.json'
HISTORY_CSV = FOLDER / 'electricity_price_history.csv'
HISTORY_JSON = FOLDER / 'electricity_price_history.json'
ELEXON = 'https://data.elexon.co.uk/bmrs/api/v1'
CARBON = 'https://api.carbonintensity.org.uk'
TIMEOUT = 12


def iso_minutes_ago(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).strftime('%Y-%m-%dT%H:%MZ')


def get_json(url):
    r = requests.get(url, timeout=TIMEOUT, headers={'Accept': 'application/json', 'User-Agent': 'GlobalGrid2050 V6'})
    r.raise_for_status()
    return r.json()


def parse_dt(value):
    if not value:
        return None
    text = str(value).replace('Z', '+00:00')
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def to_z(dt):
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ('data', 'items', 'results'):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def pick(row, keys):
    for key in keys:
        if row.get(key) not in (None, ''):
            return row.get(key)
    return None


def row_time(row):
    for key in ('startTime', 'publishDateTime', 'publishTime', 'time', 'datetime'):
        dt = parse_dt(row.get(key))
        if dt:
            return dt
    date = pick(row, ['settlementDate', 'SettlementDate'])
    period = pick(row, ['settlementPeriod', 'SettlementPeriod'])
    base = parse_dt(str(date)[:10] + 'T00:00:00Z') if date else None
    try:
        p = int(period)
    except Exception:
        p = None
    if base and p:
        return base + timedelta(minutes=(p - 1) * 30)
    return None


def fetch_price():
    start = iso_minutes_ago(240)
    end = iso_minutes_ago(0)
    query = urlencode({'from': start, 'to': end, 'format': 'json'})
    url = f'{ELEXON}/balancing/pricing/market-index?{query}'
    priced = []
    for row in rows(get_json(url)):
        price = pick(row, ['price', 'marketIndexPrice', 'MarketIndexPrice', 'value'])
        dt = row_time(row)
        if price is None or not dt:
            continue
        try:
            priced.append((dt, float(price)))
        except Exception:
            pass
    if not priced:
        raise RuntimeError('No valid V6 market index price rows')
    priced.sort(key=lambda x: x[0], reverse=True)
    dt, price = priced[0]
    return price, to_z(dt)


def fetch_carbon():
    data = get_json(f'{CARBON}/intensity').get('data', [])
    if not data:
        return None, None, None
    i = data[0].get('intensity', {})
    return i.get('actual'), i.get('forecast'), i.get('index')


def append_history(out):
    price = out.get('priceGBPperMWh')
    price_time = out.get('priceTime')
    if price is None or not price_time:
        return
    FOLDER.mkdir(parents=True, exist_ok=True)
    rows_out = []
    if HISTORY_CSV.exists():
        lines = HISTORY_CSV.read_text(encoding='utf-8').splitlines()
        rows_out = lines[1:]
    header = 'capturedAtUTC,priceTimeUTC,priceGBPperMWh,carbonGperKWh,carbonIndex,source'
    line = f"{to_z(datetime.now(timezone.utc))},{price_time},{price},{out.get('carbonGperKWh') or ''},{out.get('carbonIndex') or ''},Elexon BMRS Market Index Data"
    seen = set()
    final = []
    for r in rows_out + [line]:
        key = r.split(',')[1] if ',' in r else r
        seen.add(key)
        final.append(r)
    HISTORY_CSV.write_text(header + '\n' + '\n'.join(final[-200000:]) + '\n', encoding='utf-8')
    json_rows = []
    for r in final[-200000:]:
        c = r.split(',')
        if len(c) >= 6:
            json_rows.append({'capturedAtUTC': c[0], 'priceTimeUTC': c[1], 'priceGBPperMWh': c[2], 'carbonGperKWh': c[3], 'carbonIndex': c[4], 'source': c[5]})
    HISTORY_JSON.write_text(json.dumps({'rows': json_rows}, indent=2), encoding='utf-8')


def main():
    health = {}
    try:
        price, price_time = fetch_price(); health['price'] = 'ok'
    except Exception as exc:
        price, price_time = None, None; health['price'] = f'error: {exc}'
    try:
        carbon, forecast, index = fetch_carbon(); health['carbon'] = 'ok'
    except Exception as exc:
        carbon, forecast, index = None, None, None; health['carbon'] = f'error: {exc}'
    out = {'updated': datetime.now(timezone.utc).isoformat(), 'priceGBPperMWh': round(price, 2) if price is not None else None, 'priceTime': price_time, 'carbonGperKWh': carbon, 'carbonForecast': forecast, 'carbonIndex': index, 'health': health}
    FOLDER.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2), encoding='utf-8')
    append_history(out)
    print(json.dumps({'v6_price_updated': out['updated'], 'price': out['priceGBPperMWh'], 'health': health}, indent=2))

if __name__ == '__main__':
    main()
