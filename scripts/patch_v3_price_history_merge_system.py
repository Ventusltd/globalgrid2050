from pathlib import Path

JS = Path('uk_energy_tracking_v3/price-history-ui.js')
DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')
MARKER = '## Diary entry: 2026-05-26 V3 merged price source patch'


def main():
    text = JS.read_text(encoding='utf-8')
    text = text.replace('var ENABLE_CSV_FEED = false;', 'var ENABLE_CSV_FEED = true;')
    text = text.replace('var CSV_URL = "/uk_energy_tracking_v3/elexon_system_prices_half_hourly.csv";', 'var CSV_URL = "/data/electricity/elexon_system_prices_half_hourly.csv";')
    if 'function mergeSystemAndCapturedRows' not in text:
        anchor = '  function load(){\n    var rangeEl = document.getElementById("price-history-range");'
        insert = '  function mergeSystemAndCapturedRows(systemRows, capturedRows){\n    var merged = {};\n    (systemRows || []).forEach(function(r){ if(r.priceTimeUTC){ merged[r.priceTimeUTC] = Object.assign({}, r, {source:"Elexon BMRS System Prices", priceHealth:(r.priceHealth || "historical system price")}); } });\n    (capturedRows || []).forEach(function(r){ if(r.priceTimeUTC){ merged[r.priceTimeUTC] = Object.assign({}, r, {source:(r.source || "V3 captured Elexon Market Index Price")}); } });\n    return Object.keys(merged).sort(function(a,b){ return new Date(a) - new Date(b); }).map(function(k){ return merged[k]; });\n  }\n\n'
        text = text.replace(anchor, insert + anchor, 1)
    text = text.replace('var allRows = csvRows.length ? csvRows : jsonRows;', 'var allRows = mergeSystemAndCapturedRows(csvRows, jsonRows);')
    text = text.replace('setText("ph-source", latest && latest.source ? latest.source : "Elexon BMRS");', 'setText("ph-source", csvRows.length ? "Historical Elexon System Prices plus V3 captured Market Index" : (latest && latest.source ? latest.source : "Elexon BMRS"));')
    JS.write_text(text, encoding='utf-8')

    diary = DIARY.read_text(encoding='utf-8')
    if MARKER not in diary:
        diary += '\n\n' + MARKER + '\n\nMerged the existing Elexon historical system price CSV with the V3 captured live Market Index trail. The chart and dropdown now use historical context plus new live captured rows, while the live gauge remains separate. System Prices and Market Index Prices remain labelled as different price products.\n'
        DIARY.write_text(diary, encoding='utf-8')
    print('patched merged V3 price source')


if __name__ == '__main__':
    main()
