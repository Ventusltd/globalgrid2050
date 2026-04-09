const DEFAULT_BURIAL_DEPTHS = { lv: 900, mv: 900, ehv: 900, dc: 900 };
const MIN_BURIAL_DEPTHS     = { lv: 450, mv: 900, ehv: 900, dc: 600 };

const FORMATION_LIBRARY = {
    lv:  [
        { value: "trefoil_single_row",  label: "Trefoil Single Row (1c×3ph)" },
        { value: "flat_single_row",     label: "Flat Single Row (1c×3ph)" },
        { value: "stacked_two_high",    label: "Stacked 2 High (1c×3ph)" },
        { value: "multicore_3c",        label: "Three Core Cable (3c)" },
        { value: "multicore_4c",        label: "Four Core Cable (4c)" },
        { value: "multicore_5c",        label: "Five Core Cable (5c)" }
    ],
    mv:  [
        { value: "trefoil_single_row",  label: "Trefoil Single Row (1c×3ph)" },
        { value: "flat_single_row",     label: "Flat Single Row (1c×3ph)" },
        { value: "stacked_two_high",    label: "Stacked 2 High (1c×3ph)" },
        { value: "multicore_3c",        label: "Three Core Cable (3c)" },
        { value: "multicore_4c",        label: "Four Core Cable (4c)" },
        { value: "multicore_5c",        label: "Five Core Cable (5c)" }
    ],
    ehv: [
        { value: "trefoil_single_row",  label: "Trefoil Single Row (1c×3ph)" },
        { value: "flat_single_row",     label: "Flat Single Row (1c×3ph)" }
    ],
    dc:  [
        { value: "dc_pair_horizontal",  label: "DC Pair Horizontal" },
        { value: "dc_pair_vertical",    label: "DC Pair Vertical" }
    ]
};

const VOLTAGE_CLASSES = {
    "lv_cu_sc": { label: "0.6/1kV Cu XLPE single core (fixed install.)", Uo: 0, mbr_factor: 15, cores: ["single"] },
    "lv_al_sc": { label: "0.6/1kV Al XLPE single core (fixed install.)", Uo: 0, mbr_factor: 15, cores: ["single"] },
    "lv_cu_2c": { label: "0.6/1kV Cu XLPE 2-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["two"]    },
    "lv_cu_3c": { label: "0.6/1kV Cu XLPE 3-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["three"]  },
    "lv_cu_4c": { label: "0.6/1kV Cu XLPE 4-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["four"]   },
    "lv_cu_5c": { label: "0.6/1kV Cu XLPE 5-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["five"]   },
    "lv_al_3c": { label: "0.6/1kV Al XLPE 3-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["three"]  },
    "lv_al_4c": { label: "0.6/1kV Al XLPE 4-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["four"]   },
    "lv_al_5c": { label: "0.6/1kV Al XLPE 5-core SWA (fixed install.)",  Uo: 0, mbr_factor: 12, cores: ["five"]   },
    "lv3": { label: "LV Power 0.6/1kV 3-core (fixed install.)",          Uo: 0, mbr_factor: 5,  cores: ["three"]  },
    "pv_string": { label: "PV DC string — 1500V DC, Class II (flexible, fixed install.)", Uo: 0, mbr_factor: 4, cores: ["single"] },
    "flex_hv_ac": { label: "Flexible screened — 1000/1000V AC, IT system (fixed/occasional)", Uo: 0, mbr_factor: 3, cores: ["single"] },
    "flex_hv_dc": { label: "Flexible screened — 1500V DC (Um=1800V, fixed/occasional)",           Uo: 0, mbr_factor: 3, cores: ["single"] },
    "al_ata_ac": { label: "Rigid Al solar — 1000/1000V AC, Al tube armour (non-mag, fixed)", Uo: 0, mbr_factor: 12, cores: ["single"] },
    "al_ata_dc": { label: "Rigid Al solar — 1500/1500V DC (Um=1800V), Al tube armour (fixed)",    Uo: 0, mbr_factor: 12, cores: ["single"] },
    "6":   { label: "6 kV (3.6/6 kV)",   Uo: 3.6,  mbr_factor: 15, cores: ["single","three"] },
    "10":  { label: "10 kV (5.8/10 kV)",  Uo: 5.8,  mbr_factor: 15, cores: ["single","three"] },
    "15":  { label: "15 kV (8.7/15 kV)",  Uo: 8.7,  mbr_factor: 15, cores: ["single","three"] },
    "20":  { label: "20 kV (12/20 kV)",   Uo: 12,   mbr_factor: 15, cores: ["single","three"] },
    "33":  { label: "33 kV (19/33 kV) — Al", Uo: 18, mbr_factor: 15, cores: ["single","three"] },
    "33cu": { label: "33 kV (19/33 kV) — Cu 3-core", Uo: 18, mbr_factor: 15, cores: ["three"] },
    "66":  { label: "66 kV (38/66 kV) ★",   Uo: 38,  mbr_factor: 15, cores: ["single"] },
    "110": { label: "110 kV (64/110 kV) ★",  Uo: 64,  mbr_factor: 25, cores: ["single"] },
    "132": { label: "132 kV (76/132 kV) ★",  Uo: 76,  mbr_factor: 15, cores: ["single"] },
};

const SC_CSAS_LV  = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const TC_CSAS_LV  = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const SC_CSAS_STR = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const SC_CSAS_FLX = [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185];
const SC_CSAS_ATA = [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const SC_CSAS_MV  = [35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const TC_CSAS_MV  = [35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
const SC_CSAS_HV  = [300, 400, 500, 630, 800, 1000, 1200, 1600, 2000];

const SC_CSAS_LV_CU_PWR = [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const SC_CSAS_LV_AL_PWR = [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const MC2_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
const MC_CSAS_CU_LV     = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
const MC5_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];
const MC_CSAS_AL_LV     = [35, 50, 70, 95, 120, 150, 185, 240, 300];
const MC5_CSAS_AL_LV    = [35, 50, 70, 95, 120, 150, 185, 240];

const SC_CSAS = [...new Set([...SC_CSAS_LV, ...SC_CSAS_MV, ...SC_CSAS_HV])];
const TC_CSAS = TC_CSAS_MV;

const OD_A = 21.408, OD_B = 1.3736, OD_C = 0.353;
