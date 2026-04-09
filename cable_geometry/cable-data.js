/* ── constants ──────────────────────────────────────────────────────────── */
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

/* ── OD lookup database ───────────────────────────────────────────────────
     * Single-core: model OD = 21.408 + 1.3736·√CSA + 0.3530·Uo  (RMSE 0.64mm)
     * Anchored on: Utility 66kV (300,400mm²), Utility 132kV (300,630,1000,1200,1600mm²),
     * Manufacturer 110kV (630mm²), Catalogue 6kV-33kV full series.
     * All values indicative for routing/civils planning only.
     * Verify against manufacturer datasheet before any design or procurement.
     */

const OD_A = 21.408, OD_B = 1.3736, OD_C = 0.353;

const OD_CONFIRMED = {
    // ── EHV 66kV to 132kV ──
    "sc_38_300":  { od: 59.0, mbr: 885,  src: "Utility schedule" },
    "sc_38_400":  { od: 62.0, mbr: 930,  src: "Utility schedule" },
    "sc_64_630":  { od: 76.4, mbr: 1910, src: "Manufacturer datasheet" },
    "sc_76_300":  { od: 72.0, mbr: 1080, src: "Utility schedule" },
    "sc_76_630":  { od: 83.0, mbr: 1245, src: "Utility schedule" },
    "sc_76_1000": { od: 91.0, mbr: 1365, src: "Utility schedule" },
    "sc_76_1200": { od: 97.0, mbr: 1455, src: "Utility schedule" },
    "sc_76_1600": { od: 104.0,mbr: 1560, src: "Utility schedule" },

    // ── MV POWER 6kV (Uo=3.6) ──
    "sc_3.6_35":  { od: 22.0, mbr: 330, src: "Generic catalogue" },
    "sc_3.6_50":  { od: 23.0, mbr: 345, src: "Generic catalogue" },
    "sc_3.6_70":  { od: 25.0, mbr: 375, src: "Generic catalogue" },
    "sc_3.6_95":  { od: 27.0, mbr: 405, src: "Generic catalogue" },
    "sc_3.6_120": { od: 28.0, mbr: 420, src: "Generic catalogue" },
    "sc_3.6_150": { od: 30.0, mbr: 450, src: "Generic catalogue" },
    "sc_3.6_185": { od: 32.0, mbr: 480, src: "Generic catalogue" },
    "sc_3.6_240": { od: 34.0, mbr: 510, src: "Generic catalogue" },
    "sc_3.6_300": { od: 37.0, mbr: 555, src: "Generic catalogue" },
    "sc_3.6_400": { od: 40.0, mbr: 600, src: "Generic catalogue" },
    "sc_3.6_500": { od: 43.0, mbr: 645, src: "Generic catalogue" },
    "sc_3.6_630": { od: 48.0, mbr: 720, src: "Generic catalogue" },

    // ── MV POWER 10kV (Uo=5.8) ──
    "sc_5.8_35":  { od: 24.0, mbr: 360, src: "Generic catalogue" },
    "sc_5.8_50":  { od: 25.0, mbr: 375, src: "Generic catalogue" },
    "sc_5.8_70":  { od: 27.0, mbr: 405, src: "Generic catalogue" },
    "sc_5.8_95":  { od: 29.0, mbr: 435, src: "Generic catalogue" },
    "sc_5.8_120": { od: 30.0, mbr: 450, src: "Generic catalogue" },
    "sc_5.8_150": { od: 32.0, mbr: 480, src: "Generic catalogue" },
    "sc_5.8_185": { od: 34.0, mbr: 510, src: "Generic catalogue" },
    "sc_5.8_240": { od: 36.0, mbr: 540, src: "Generic catalogue" },
    "sc_5.8_300": { od: 39.0, mbr: 585, src: "Generic catalogue" },
    "sc_5.8_400": { od: 42.0, mbr: 630, src: "Generic catalogue" },
    "sc_5.8_500": { od: 45.0, mbr: 675, src: "Generic catalogue" },
    "sc_5.8_630": { od: 50.0, mbr: 750, src: "Generic catalogue" },

    // ── MV POWER 15kV (Uo=8.7) ──
    "sc_8.7_35":  { od: 26.0, mbr: 390, src: "Generic catalogue" },
    "sc_8.7_50":  { od: 27.0, mbr: 405, src: "Generic catalogue" },
    "sc_8.7_70":  { od: 29.0, mbr: 435, src: "Generic catalogue" },
    "sc_8.7_95":  { od: 31.0, mbr: 465, src: "Generic catalogue" },
    "sc_8.7_120": { od: 32.0, mbr: 480, src: "Generic catalogue" },
    "sc_8.7_150": { od: 34.0, mbr: 510, src: "Generic catalogue" },
    "sc_8.7_185": { od: 36.0, mbr: 540, src: "Generic catalogue" },
    "sc_8.7_240": { od: 38.0, mbr: 570, src: "Generic catalogue" },
    "sc_8.7_300": { od: 41.0, mbr: 615, src: "Generic catalogue" },
    "sc_8.7_400": { od: 44.0, mbr: 660, src: "Generic catalogue" },
    "sc_8.7_500": { od: 47.0, mbr: 705, src: "Generic catalogue" },
    "sc_8.7_630": { od: 52.0, mbr: 780, src: "Generic catalogue" },

    // ── MV POWER 20kV (Uo=12) ──
    "sc_12_35":   { od: 28.0, mbr: 420, src: "Generic catalogue" },
    "sc_12_50":   { od: 29.0, mbr: 435, src: "Generic catalogue" },
    "sc_12_70":   { od: 31.0, mbr: 465, src: "Generic catalogue" },
    "sc_12_95":   { od: 33.0, mbr: 495, src: "Generic catalogue" },
    "sc_12_120":  { od: 35.0, mbr: 525, src: "Generic catalogue" },
    "sc_12_150":  { od: 36.0, mbr: 540, src: "Generic catalogue" },
    "sc_12_185":  { od: 38.0, mbr: 570, src: "Generic catalogue" },
    "sc_12_240":  { od: 41.0, mbr: 615, src: "Generic catalogue" },
    "sc_12_300":  { od: 43.0, mbr: 645, src: "Generic catalogue" },
    "sc_12_400":  { od: 46.0, mbr: 690, src: "Generic catalogue" },
    "sc_12_500":  { od: 49.0, mbr: 735, src: "Generic catalogue" },
    "sc_12_630":  { od: 54.0, mbr: 810, src: "Generic catalogue" },

    // ── MV POWER 33kV Single Core (Uo=18) ──
    "sc_18_35":   { od: 36.5, mbr: 548, src: "Generic catalogue" },
    "sc_18_50":   { od: 37.5, mbr: 563, src: "Generic catalogue" },
    "sc_18_70":   { od: 39.5, mbr: 593, src: "Generic catalogue" },
    "sc_18_95":   { od: 41.0, mbr: 615, src: "Generic catalogue" },
    "sc_18_120":  { od: 43.0, mbr: 645, src: "Generic catalogue" },
    "sc_18_150":  { od: 44.5, mbr: 668, src: "Generic catalogue" },
    "sc_18_185":  { od: 46.5, mbr: 698, src: "Generic catalogue" },
    "sc_18_240":  { od: 49.5, mbr: 743, src: "Generic catalogue" },
    "sc_18_300":  { od: 51.5, mbr: 773, src: "Generic catalogue" },
    "sc_18_400":  { od: 55.0, mbr: 825, src: "Generic catalogue" },
    "sc_18_500":  { od: 58.0, mbr: 870, src: "Generic catalogue" },
    "sc_18_630":  { od: 62.0, mbr: 930, src: "Generic catalogue" },
    
    // ── MV POWER 33kV Three Core (Uo=18) ──
    "3c_18_35":   { od: 42.0, mbr: 630,  src: "Generic catalogue" },
    "3c_18_50":   { od: 45.0, mbr: 675,  src: "Generic catalogue" },
    "3c_18_70":   { od: 48.5, mbr: 728,  src: "Generic catalogue" },
    "3c_18_95":   { od: 53.0, mbr: 795,  src: "Generic catalogue" },
    "3c_18_120":  { od: 57.0, mbr: 855,  src: "Generic catalogue" },
    "3c_18_150":  { od: 60.5, mbr: 908,  src: "Generic catalogue" },
    "3c_18_185":  { od: 64.5, mbr: 968,  src: "Generic catalogue" },
    "3c_18_240":  { od: 71.0, mbr: 1065, src: "Generic catalogue" },
    "3c_18_300":  { od: 77.5, mbr: 1163, src: "Generic catalogue" },
    "3c_18_400":  { od: 86.0, mbr: 1290, src: "Generic catalogue" },
    "3c_cu18_35": { od: 68.0, mbr: 1020, src: "Generic catalogue Cu" },
    "3c_cu18_50": { od: 71.5, mbr: 1073, src: "Generic catalogue Cu" },
    "3c_cu18_70": { od: 75.0, mbr: 1125, src: "Generic catalogue Cu" },
    "3c_cu18_95": { od: 79.0, mbr: 1185, src: "Generic catalogue Cu" },
    "3c_cu18_120":{ od: 83.0, mbr: 1245, src: "Generic catalogue Cu" },
    "3c_cu18_150":{ od: 86.0, mbr: 1290, src: "Generic catalogue Cu" },
    "3c_cu18_185":{ od: 90.0, mbr: 1350, src: "Generic catalogue Cu" },
    "3c_cu18_240":{ od: 97.0, mbr: 1455, src: "Generic catalogue Cu" },
    "3c_cu18_300":{ od: 102.0,mbr: 1530, src: "Generic catalogue Cu" },
    "3c_cu18_400":{ od: 110.0,mbr: 1650, src: "Generic catalogue Cu" },

    // ── LV POWER 0.6/1kV SWA/AWA (Generic BS 5467 standard values) ──
    "sc_cu_lv_50":   { od: 17.5, mbr: 263, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_70":   { od: 20.2, mbr: 303, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_95":   { od: 22.3, mbr: 335, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_120":  { od: 24.2, mbr: 363, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_150":  { od: 27.4, mbr: 411, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_185":  { od: 30.0, mbr: 450, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_240":  { od: 32.8, mbr: 492, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_300":  { od: 35.6, mbr: 534, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_400":  { od: 40.4, mbr: 606, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_500":  { od: 44.2, mbr: 663, src: "Standard BS 5467 dataset" },
    "sc_cu_lv_630":  { od: 48.8, mbr: 732, src: "Standard BS 5467 dataset" },
    
    "sc_al_lv_50":   { od: 17.5, mbr: 263, src: "Standard BS 5467 dataset" },
    "sc_al_lv_70":   { od: 20.2, mbr: 303, src: "Standard BS 5467 dataset" },
    "sc_al_lv_95":   { od: 22.3, mbr: 335, src: "Standard BS 5467 dataset" },
    "sc_al_lv_120":  { od: 24.2, mbr: 363, src: "Standard BS 5467 dataset" },
    "sc_al_lv_150":  { od: 27.4, mbr: 411, src: "Standard BS 5467 dataset" },
    "sc_al_lv_185":  { od: 30.0, mbr: 450, src: "Standard BS 5467 dataset" },
    "sc_al_lv_240":  { od: 32.8, mbr: 492, src: "Standard BS 5467 dataset" },
    "sc_al_lv_300":  { od: 35.6, mbr: 534, src: "Standard BS 5467 dataset" },
    "sc_al_lv_400":  { od: 40.4, mbr: 606, src: "Standard BS 5467 dataset" },
    "sc_al_lv_500":  { od: 44.2, mbr: 663, src: "Standard BS 5467 dataset" },
    "sc_al_lv_630":  { od: 48.8, mbr: 732, src: "Standard BS 5467 dataset" },

    "2c_cu_lv_1.5":  { od: 12.3, mbr: 148, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_2.5":  { od: 13.6, mbr: 163, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_4":    { od: 14.8, mbr: 178, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_6":    { od: 16.1, mbr: 193, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_10":   { od: 18.1, mbr: 217, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_16":   { od: 20.4, mbr: 245, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_25":   { od: 23.8, mbr: 286, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_35":   { od: 26.5, mbr: 318, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_50":   { od: 28.8, mbr: 346, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_70":   { od: 32.2, mbr: 386, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_95":   { od: 37.0, mbr: 444, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_120":  { od: 40.3, mbr: 484, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_150":  { od: 43.9, mbr: 527, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_185":  { od: 48.1, mbr: 577, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_240":  { od: 53.6, mbr: 643, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_300":  { od: 58.2, mbr: 698, src: "Standard BS 5467 dataset" },
    "2c_cu_lv_400":  { od: 64.6, mbr: 775, src: "Standard BS 5467 dataset" },

    "3c_cu_lv_1.5":  { od: 12.7, mbr: 152, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_2.5":  { od: 14.2, mbr: 170, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_4":    { od: 15.5, mbr: 186, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_6":    { od: 16.9, mbr: 203, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_10":   { od: 19.1, mbr: 229, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_16":   { od: 21.6, mbr: 259, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_25":   { od: 25.5, mbr: 306, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_35":   { od: 28.0, mbr: 336, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_50":   { od: 31.5, mbr: 378, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_70":   { od: 35.8, mbr: 430, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_95":   { od: 40.1, mbr: 481, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_120":  { od: 44.2, mbr: 530, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_150":  { od: 48.0, mbr: 576, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_185":  { od: 52.6, mbr: 631, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_240":  { od: 59.0, mbr: 708, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_300":  { od: 64.2, mbr: 770, src: "Standard BS 5467 dataset" },
    "3c_cu_lv_400":  { od: 71.5, mbr: 858, src: "Standard BS 5467 dataset" },

    "4c_cu_lv_1.5":  { od: 13.5, mbr: 162, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_2.5":  { od: 15.1, mbr: 181, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_4":    { od: 16.6, mbr: 199, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_6":    { od: 18.3, mbr: 220, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_10":   { od: 20.8, mbr: 250, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_16":   { od: 23.4, mbr: 281, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_25":   { od: 28.1, mbr: 337, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_35":   { od: 31.0, mbr: 372, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_50":   { od: 35.6, mbr: 427, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_70":   { od: 40.4, mbr: 485, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_95":   { od: 45.6, mbr: 547, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_120":  { od: 50.6, mbr: 607, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_150":  { od: 55.4, mbr: 665, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_185":  { od: 60.8, mbr: 730, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_240":  { od: 68.6, mbr: 823, src: "Standard BS 5467 dataset" },
    "4c_cu_lv_300":  { od: 74.6, mbr: 895, src: "Standard BS 5467 dataset" },

    "5c_cu_lv_1.5":  { od: 14.4, mbr: 173, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_2.5":  { od: 16.3, mbr: 196, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_4":    { od: 18.1, mbr: 217, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_6":    { od: 20.0, mbr: 240, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_10":   { od: 22.7, mbr: 272, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_16":   { od: 25.5, mbr: 306, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_25":   { od: 31.2, mbr: 374, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_35":   { od: 34.6, mbr: 415, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_50":   { od: 39.8, mbr: 478, src: "Standard BS 5467 dataset" },
    "5c_cu_lv_70":   { od: 45.4, mbr: 545, src: "Standard BS 5467 dataset" },

    // LV 3-Core AL SWA
    "3c_al_lv_35":   { od: 28.0, mbr: 336, src: "Standard BS 5467 dataset" },
    "3c_al_lv_50":   { od: 31.5, mbr: 378, src: "Standard BS 5467 dataset" },
    "3c_al_lv_70":   { od: 35.8, mbr: 430, src: "Standard BS 5467 dataset" },
    "3c_al_lv_95":   { od: 40.1, mbr: 481, src: "Standard BS 5467 dataset" },
    "3c_al_lv_120":  { od: 44.2, mbr: 530, src: "Standard BS 5467 dataset" },
    "3c_al_lv_150":  { od: 48.0, mbr: 576, src: "Standard BS 5467 dataset" },
    "3c_al_lv_185":  { od: 52.6, mbr: 631, src: "Standard BS 5467 dataset" },
    "3c_al_lv_240":  { od: 59.0, mbr: 708, src: "Standard BS 5467 dataset" },
    "3c_al_lv_300":  { od: 64.2, mbr: 770, src: "Standard BS 5467 dataset" },

    // LV 4-Core AL SWA
    "4c_al_lv_35":   { od: 31.0, mbr: 372, src: "Standard BS 5467 dataset" },
    "4c_al_lv_50":   { od: 35.6, mbr: 427, src: "Standard BS 5467 dataset" },
    "4c_al_lv_70":   { od: 40.4, mbr: 485, src: "Standard BS 5467 dataset" },
    "4c_al_lv_95":   { od: 45.6, mbr: 547, src: "Standard BS 5467 dataset" },
    "4c_al_lv_120":  { od: 50.6, mbr: 607, src: "Standard BS 5467 dataset" },
    "4c_al_lv_150":  { od: 55.4, mbr: 665, src: "Standard BS 5467 dataset" },
    "4c_al_lv_185":  { od: 60.8, mbr: 730, src: "Standard BS 5467 dataset" },
    "4c_al_lv_240":  { od: 68.6, mbr: 823, src: "Standard BS 5467 dataset" },
    "4c_al_lv_300":  { od: 74.6, mbr: 895, src: "Standard BS 5467 dataset" },

    // ── LV Flexible Multicore (0.6/1kV) ──
    "3c_lv3_1.5": { od: 10.6, mbr: 53,  src: "Generic Flexible type" },
    "3c_lv3_2.5": { od: 12.4, mbr: 62,  src: "Generic Flexible type" },
    "3c_lv3_4":   { od: 14.4, mbr: 72,  src: "Generic Flexible type" },
    "3c_lv3_6":   { od: 16.1, mbr: 80,  src: "Generic Flexible type" },
    "3c_lv3_10":  { od: 21.6, mbr: 108, src: "Generic Flexible type" },
    "3c_lv3_16":  { od: 24.7, mbr: 124, src: "Generic Flexible type" },
    "3c_lv3_25":  { od: 29.6, mbr: 148, src: "Generic Flexible type" },
    "3c_lv3_35":  { od: 33.2, mbr: 166, src: "Generic Flexible type" },
    "3c_lv3_50":  { od: 38.5, mbr: 193, src: "Generic Flexible type" },
    "3c_lv3_70":  { od: 43.3, mbr: 217, src: "Generic Flexible type" },
    "3c_lv3_95":  { od: 48.6, mbr: 243, src: "Generic Flexible type" },
    "3c_lv3_120": { od: 53.7, mbr: 269, src: "Generic Flexible type" },
    "3c_lv3_150": { od: 59.0, mbr: 295, src: "Generic Flexible type" },
    "3c_lv3_185": { od: 64.5, mbr: 323, src: "Generic Flexible type" },
    "3c_lv3_240": { od: 73.5, mbr: 368, src: "Generic Flexible type" },
    
    // ── PV DC STRING ──
    "sc_pv_string_1.5": { od:  4.0, mbr:  16, src: "Standard PV specification" },
    "sc_pv_string_2.5": { od:  4.7, mbr:  19, src: "Standard PV specification" },
    "sc_pv_string_4":   { od:  5.4, mbr:  22, src: "Standard PV specification" },
    "sc_pv_string_6":   { od:  6.2, mbr:  25, src: "Standard PV specification" },
    "sc_pv_string_10":  { od:  7.5, mbr:  30, src: "Standard PV specification" },
    "sc_pv_string_16":  { od:  9.0, mbr:  36, src: "Standard PV specification" },
    "sc_pv_string_25":  { od: 10.8, mbr:  43, src: "Standard PV specification" },
    "sc_pv_string_35":  { od: 12.3, mbr:  49, src: "Standard PV specification" },
    "sc_pv_string_50":  { od: 14.2, mbr:  57, src: "Standard PV specification" },
    "sc_pv_string_70":  { od: 16.8, mbr:  67, src: "Standard PV specification" },
    "sc_pv_string_95":  { od: 19.2, mbr:  77, src: "Standard PV specification" },
    "sc_pv_string_120": { od: 21.2, mbr:  85, src: "Standard PV specification" },
    "sc_pv_string_150": { od: 23.5, mbr:  94, src: "Standard PV specification" },
    "sc_pv_string_185": { od: 26.1, mbr: 104, src: "Standard PV specification" },
    "sc_pv_string_240": { od: 29.5, mbr: 118, src: "Standard PV specification" },
    
    // ── FLEXIBLE SCREENED SOLAR MV ──
    "sc_flex_hv_ac_4":   { od:  4.90, mbr:  15, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_6":   { od:  5.80, mbr:  17, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_10":  { od:  7.80, mbr:  23, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_16":  { od:  9.30, mbr:  28, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_25":  { od: 11.00, mbr:  33, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_35":  { od: 12.90, mbr:  39, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_50":  { od: 14.90, mbr:  45, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_70":  { od: 17.00, mbr:  51, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_95":  { od: 19.50, mbr:  59, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_120": { od: 22.60, mbr:  68, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_150": { od: 25.00, mbr:  75, src: "Manufacturer datasheet" },
    "sc_flex_hv_ac_185": { od: 26.60, mbr:  80, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_4":   { od:  4.90, mbr:  15, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_6":   { od:  5.80, mbr:  17, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_10":  { od:  7.80, mbr:  23, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_16":  { od:  9.30, mbr:  28, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_25":  { od: 11.00, mbr:  33, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_35":  { od: 12.90, mbr:  39, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_50":  { od: 14.90, mbr:  45, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_70":  { od: 17.00, mbr:  51, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_95":  { od: 19.50, mbr:  59, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_120": { od: 22.60, mbr:  68, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_150": { od: 25.00, mbr:  75, src: "Manufacturer datasheet" },
    "sc_flex_hv_dc_185": { od: 26.60, mbr:  80, src: "Manufacturer datasheet" },
    
    // ── RIGID AL SOLAR ──
    "sc_al_ata_ac_50":  { od: 17.10, mbr: 205, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_70":  { od: 18.80, mbr: 226, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_95":  { od: 20.90, mbr: 251, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_120": { od: 22.40, mbr: 269, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_150": { od: 24.10, mbr: 289, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_185": { od: 27.70, mbr: 332, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_240": { od: 29.90, mbr: 359, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_300": { od: 33.00, mbr: 396, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_400": { od: 37.40, mbr: 449, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_500": { od: 40.10, mbr: 481, src: "Manufacturer datasheet" },
    "sc_al_ata_ac_630": { od: 44.80, mbr: 538, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_50":  { od: 17.10, mbr: 205, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_70":  { od: 18.80, mbr: 226, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_95":  { od: 20.90, mbr: 251, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_120": { od: 22.40, mbr: 269, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_150": { od: 24.10, mbr: 289, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_185": { od: 27.70, mbr: 332, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_240": { od: 29.90, mbr: 359, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_300": { od: 33.00, mbr: 396, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_400": { od: 37.40, mbr: 449, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_500": { od: 40.10, mbr: 481, src: "Manufacturer datasheet" },
    "sc_al_ata_dc_630": { od: 44.80, mbr: 538, src: "Manufacturer datasheet" },
};

// Voltage class definitions
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
    
    "lv3": { label: "LV 0.6/1kV 3-core (fixed install.)",                    Uo: 0, mbr_factor: 5,  cores: ["three"]  },
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

// LV power cable CSA ranges 
const SC_CSAS_LV_CU_PWR = [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const SC_CSAS_LV_AL_PWR = [50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const MC2_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
const MC_CSAS_CU_LV     = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400];
const MC5_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70];
const MC_CSAS_AL_LV     = [35, 50, 70, 95, 120, 150, 185, 240, 300];
const MC5_CSAS_AL_LV    = [35, 50, 70, 95, 120, 150, 185, 240];

const SC_CSAS = [...new Set([...SC_CSAS_LV, ...SC_CSAS_MV, ...SC_CSAS_HV])];
const TC_CSAS = TC_CSAS_MV;
