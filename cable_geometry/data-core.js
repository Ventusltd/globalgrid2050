// =============================================================
// data-core.js
// Core reference data: burial depths, conductor labels,
// voltage class definitions, CSA ranges, dropdown groups,
// and formation library.
// =============================================================

const DEFAULT_BURIAL_DEPTHS = { lv: 900, mv: 900, ehv: 900, dc: 900 };

// Removed enforced minimums — system will not block lower or higher values
const MIN_BURIAL_DEPTHS = null;

const CONDUCTOR_SHAPE_LABELS = {
circular_stranded: “Stranded circular conductor”,
sector_stranded:   “Stranded sector conductor”,
compacted_round:   “Compacted round conductor”,
solid_round:       “Solid round conductor”,
flexible_round:    “Flexible round conductor”
};

// =============================================================
// VOLTAGE CLASSES
// =============================================================

const VOLTAGE_CLASSES = {

```
// =========================================================
// LV
// =========================================================
"lv_cu_sc": {
    label: "0.6/1 kV Cu XLPE single core",
    display_short: "0.6/1 kV Cu 1c",
    service_family: "lv",
    cores: ["single"],
    conductor_material: "Cu",
    conductor_shape: "compacted_round"
},

"lv_cu_3c": {
    label: "0.6/1 kV Cu XLPE 3 core",
    display_short: "0.6/1 kV Cu 3c",
    service_family: "lv",
    cores: ["three"],
    conductor_material: "Cu",
    conductor_shape: "sector_stranded",
    sectorial: true
},

// =========================================================
// BRITISH MV
// =========================================================

"uk_11kv_sc": {
    label: "6.35/11 kV single core XLPE",
    display_short: "11 kV 1c",
    service_family: "mv",
    cores: ["single"],
    conductor_material: "Al",
    conductor_shape: "compacted_round",
    british_system_voltage: "6.35/11 kV",
    standard_basis: "BS 7870-4.10"
},

"uk_11kv_3c": {
    label: "6.35/11 kV 3 core XLPE",
    display_short: "11 kV 3c",
    service_family: "mv",
    cores: ["three"],
    conductor_material: "Cu",
    conductor_shape: "sector_stranded",
    british_system_voltage: "6.35/11 kV",
    standard_basis: "BS 7870-4.10",
    sectorial: true
},

"uk_33kv_sc": {
    label: "19/33 kV single core XLPE",
    display_short: "33 kV 1c",
    service_family: "mv",
    cores: ["single"],
    conductor_material: "Al",
    conductor_shape: "compacted_round",
    british_system_voltage: "19/33 kV"
},

"uk_33kv_3c": {
    label: "19/33 kV 3 core XLPE",
    display_short: "33 kV 3c",
    service_family: "mv",
    cores: ["three"],
    conductor_material: "Cu",
    conductor_shape: "sector_stranded",
    british_system_voltage: "19/33 kV",
    sectorial: true
},

// =========================================================
// IEC HV — TENNET ALIGNED
// =========================================================

"iec_110kv_sc": {
    label: "64/110 kV single core XLPE (IEC 60840 system)",
    display_short: "110 kV 1c IEC",
    service_family: "ehv",
    cores: ["single"],
    conductor_material: "Al",
    conductor_shape: "compacted_round",
    system_type: "IEC 60840",
    grid_reference: "TenneT typical specification",
    locked_csa: 630,
    metallic_screen: 95
},

// =========================================================
// DC — SOLAR PV STRING
// Flexible tinned Cu, installed in air, tray or conduit
// =========================================================

"pv_string": {
    label: "PV string cable flexible Cu (EN 50618 / IEC 62930)",
    display_short: "PV string",
    service_family: "dc",
    cores: ["single"],
    conductor_material: "Cu",
    conductor_shape: "flexible_round",
    system_type: "EN 50618 / IEC 62930",
    dc_type: "solar_string"
},

// =========================================================
// DC — FLEXIBLE HV AC RATED (inverter / high-flex use)
// =========================================================

"flex_hv_ac": {
    label: "Flexible cable — HV AC rated, single core",
    display_short: "Flex HV AC",
    service_family: "dc",
    cores: ["single"],
    conductor_material: "Cu",
    conductor_shape: "flexible_round",
    dc_type: "flexible_ac_rated"
},

"flex_hv_dc": {
    label: "Flexible cable — HV DC rated, single core",
    display_short: "Flex HV DC",
    service_family: "dc",
    cores: ["single"],
    conductor_material: "Cu",
    conductor_shape: "flexible_round",
    dc_type: "flexible_dc_rated"
},

// =========================================================
// DC — ALUMINIUM ARMOURED BURIED (ATA — Al conductor, Al armour)
// Main DC cables: BESS, inverter burial, moisture-blocked
// =========================================================

"al_ata_ac": {
    label: "Al armoured buried cable — AC rated (Al/XLPE/SWA/PE)",
    display_short: "Al ATA AC",
    service_family: "dc",
    cores: ["single"],
    conductor_material: "Al",
    conductor_shape: "compacted_round",
    system_type: "Buried moisture-blocked AC rated",
    dc_type: "buried_armoured_ac"
},

"al_ata_dc": {
    label: "Al armoured buried cable — DC rated (Al/XLPE/SWA/PE)",
    display_short: "Al ATA DC",
    service_family: "dc",
    cores: ["single"],
    conductor_material: "Al",
    conductor_shape: "compacted_round",
    system_type: "Buried moisture-blocked DC rated",
    dc_type: "buried_armoured_dc"
}
```

};

// =============================================================
// CSA RANGES BY VOLTAGE KEY
// =============================================================

const CSA_BY_VOLTAGE_KEY = {

```
"lv_cu_sc":  [50, 70, 95, 120, 150, 185, 240, 300],
"lv_cu_3c":  [50, 70, 95, 120, 150, 185, 240],

"uk_11kv_sc": [70, 95, 120, 150, 185, 240, 300, 400, 500, 630],
"uk_11kv_3c": [70, 95, 120, 150, 185, 240, 300],

"uk_33kv_sc": [95, 120, 150, 185, 240, 300, 400, 500, 630],
"uk_33kv_3c": [95, 120, 150, 185, 240, 300],

"iec_110kv_sc": [630],

"pv_string":  [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240],

"flex_hv_ac": [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185],
"flex_hv_dc": [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185],

"al_ata_ac":  [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630],
"al_ata_dc":  [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630]
```

};

// =============================================================
// VOLTAGE DROPDOWN GROUPS
// =============================================================

const VOLTAGE_DROPDOWN_GROUPS = {

```
lv: [
    {
        label: "Low voltage 0.6/1 kV",
        options: [
            { value: "lv_cu_sc", text: "0.6/1 kV single core Cu XLPE" },
            { value: "lv_cu_3c", text: "0.6/1 kV 3 core Cu XLPE (sector conductors)" }
        ]
    }
],

mv: [
    {
        label: "British medium voltage",
        options: [
            { value: "uk_11kv_sc", text: "6.35/11 kV single core XLPE" },
            { value: "uk_11kv_3c", text: "6.35/11 kV 3 core XLPE (sector conductors)" },
            { value: "uk_33kv_sc", text: "19/33 kV single core XLPE" },
            { value: "uk_33kv_3c", text: "19/33 kV 3 core XLPE (sector conductors)" }
        ]
    }
],

ehv: [
    {
        label: "IEC high voltage transmission",
        options: [
            { value: "iec_110kv_sc", text: "64/110 kV single core XLPE (IEC 60840, TenneT system)" }
        ]
    }
],

dc: [
    {
        label: "Solar PV string",
        options: [
            { value: "pv_string", text: "PV string cable flexible Cu (EN 50618 / IEC 62930)" }
        ]
    },
    {
        label: "Flexible HV rated",
        options: [
            { value: "flex_hv_ac", text: "Flexible single core — HV AC rated" },
            { value: "flex_hv_dc", text: "Flexible single core — HV DC rated" }
        ]
    },
    {
        label: "Buried armoured DC (Al ATA)",
        options: [
            { value: "al_ata_ac", text: "Al armoured buried — AC rated (BESS / inverter)" },
            { value: "al_ata_dc", text: "Al armoured buried — DC rated (BESS / inverter)" }
        ]
    }
]
```

};

// =============================================================
// FORMATION LIBRARY
// Defines which formation options are available per service type.
// Values must match case strings in getGroupGeometry().
// =============================================================

const FORMATION_LIBRARY = {

```
lv: [
    { value: "trefoil_single_row", label: "Trefoil — single core, single row" },
    { value: "flat_single_row",    label: "Flat — single core, single row" },
    { value: "stacked_two_high",   label: "Stacked two high — single core" },
    { value: "multicore_3c",       label: "Multicore 3 core" },
    { value: "multicore_4c",       label: "Multicore 4 core" },
    { value: "multicore_5c",       label: "Multicore 5 core" }
],

mv: [
    { value: "trefoil_single_row", label: "Trefoil — single core, single row" },
    { value: "flat_single_row",    label: "Flat — single core, single row" },
    { value: "stacked_two_high",   label: "Stacked two high — single core" },
    { value: "multicore_3c",       label: "Multicore 3 core" }
],

ehv: [
    { value: "trefoil_single_row", label: "Trefoil — single core, single row" },
    { value: "flat_single_row",    label: "Flat — single core, single row" }
],

dc: [
    { value: "dc_pair_horizontal", label: "DC pair — horizontal" },
    { value: "dc_pair_vertical",   label: "DC pair — vertical" },
    { value: "flat_single_row",    label: "Flat — single core, single row" },
    { value: "trefoil_single_row", label: "Trefoil — single core, single row" }
]
```

};
