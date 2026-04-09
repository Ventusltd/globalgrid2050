const DEFAULT_BURIAL_DEPTHS = { lv: 900, mv: 900, ehv: 900, dc: 900 };

// Removed enforced minimums — system will not block lower or higher values
const MIN_BURIAL_DEPTHS = null;

const CONDUCTOR_SHAPE_LABELS = {
    circular_stranded: "Stranded circular conductor",
    sector_stranded:   "Stranded sector conductor",
    compacted_round:   "Compacted round conductor",
    solid_round:       "Solid round conductor",
    flexible_round:    "Flexible round conductor"
};

const VOLTAGE_CLASSES = {

    // =========================
    // LV
    // =========================
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

    // =========================
    // BRITISH MV ONLY
    // =========================

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

    // =========================
    // IEC HV — TENNET ALIGNED
    // =========================

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
    }
};

// =========================
// CSA LOCKING
// =========================

const CSA_BY_VOLTAGE_KEY = {

    "lv_cu_sc":  [50, 70, 95, 120, 150, 185, 240, 300],
    "lv_cu_3c":  [50, 70, 95, 120, 150, 185, 240],

    "uk_11kv_sc": [70, 95, 120, 150, 185, 240, 300, 400, 500, 630],
    "uk_11kv_3c": [70, 95, 120, 150, 185, 240, 300],

    "uk_33kv_sc": [95, 120, 150, 185, 240, 300, 400, 500, 630],
    "uk_33kv_3c": [95, 120, 150, 185, 240, 300],

    "iec_110kv_sc": [630]
};

// =========================
// DROPDOWN
// =========================

const VOLTAGE_DROPDOWN_GROUPS = {

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
    ]
};
