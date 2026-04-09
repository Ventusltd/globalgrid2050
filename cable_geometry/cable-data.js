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

/* ── OD lookup database ─────────────────────────────────────────────────── */
const OD_A = 21.408, OD_B = 1.3736, OD_C = 0.353;

const OD_CONFIRMED = {
    // UKPN 66kV (Uo=38)
    "sc_38_300":  { od: 59,   mbr: 885,  src: "UKPN schedule" },
    "sc_38_400":  { od: 62,   mbr: 930,  src: "UKPN schedule" },
    // UKPN 132kV (Uo=76)
    "sc_76_300":  { od: 72,   mbr: 1080, src: "UKPN schedule" },
    "sc_76_630":  { od: 83,   mbr: 1245, src: "UKPN schedule" },
    "sc_76_1000": { od: 91,   mbr: 1365, src: "UKPN schedule" },
    "sc_76_1200": { od: 97,   mbr: 1455, src: "UKPN schedule" },
    "sc_76_1600": { od: 104,  mbr: 1560, src: "UKPN schedule" },
    // TF Kable 110kV (Uo=64)
    "sc_64_630":  { od: 76.4, mbr: 1910, src: "TF Kable datasheet" },
    
    // HES 33kV single core (Uo=18) — catalogue values
    "sc_18_35":   { od: 36.5, mbr: 548,  src: "HES catalogue" },
    "sc_18_50":   { od: 37.5, mbr: 563,  src: "HES catalogue" },
    "sc_18_70":   { od: 39.5, mbr: 593,  src: "HES catalogue" },
    "sc_18_95":   { od: 41.0, mbr: 615,  src: "HES catalogue" },
    "sc_18_120":  { od: 43.0, mbr: 645,  src: "HES catalogue" },
    "sc_18_150":  { od: 44.5, mbr: 668,  src: "HES catalogue" },
    "sc_18_185":  { od: 46.5, mbr: 698,  src: "HES catalogue" },
    "sc_18_240":  { od: 49.5, mbr: 743,  src: "HES catalogue" },
    "sc_18_300":  { od: 51.5, mbr: 773,  src: "HES catalogue" },
    "sc_18_400":  { od: 55.0, mbr: 825,  src: "HES catalogue" },
    "sc_18_500":  { od: 58.0, mbr: 870,  src: "HES catalogue" },
    "sc_18_630":  { od: 62.0, mbr: 930,  src: "HES catalogue" },
    
    // HES 33kV three core ALUMINIUM unarmoured (Uo=18) — catalogue values
    "3c_18_35":   { od: 42.0, mbr: 630,  src: "HES catalogue" },
    "3c_18_50":   { od: 45.0, mbr: 675,  src: "HES catalogue" },
    "3c_18_70":   { od: 48.5, mbr: 728,  src: "HES catalogue" },
    "3c_18_95":   { od: 53.0, mbr: 795,  src: "HES catalogue" },
    "3c_18_120":  { od: 57.0, mbr: 855,  src: "HES catalogue" },
    "3c_18_150":  { od: 60.5, mbr: 908,  src: "HES catalogue" },
    "3c_18_185":  { od: 64.5, mbr: 968,  src: "HES catalogue" },
    "3c_18_240":  { od: 71.0, mbr: 1065, src: "HES catalogue" },
    "3c_18_300":  { od: 77.5, mbr: 1163, src: "HES catalogue" },
    "3c_18_400":  { od: 86.0, mbr: 1290, src: "HES catalogue" },
    
    // HES 33kV three core COPPER unarmoured (N2XSEY, Uo=18)
    "3c_cu18_35":   { od: 68.0,  mbr: 1020, src: "HES catalogue Cu" },
    "3c_cu18_50":   { od: 71.5,  mbr: 1073, src: "HES catalogue Cu" },
    "3c_cu18_70":   { od: 75.0,  mbr: 1125, src: "HES catalogue Cu" },
    "3c_cu18_95":   { od: 79.0,  mbr: 1185, src: "HES catalogue Cu" },
    "3c_cu18_120":  { od: 83.0,  mbr: 1245, src: "HES catalogue Cu" },
    "3c_cu18_150":  { od: 86.0,  mbr: 1290, src: "HES catalogue Cu" },
    "3c_cu18_185":  { od: 90.0,  mbr: 1350, src: "HES catalogue Cu" },
    "3c_cu18_240":  { od: 97.0,  mbr: 1455, src: "HES catalogue Cu" },
    "3c_cu18_300":  { od: 102.0, mbr: 1530, src: "HES catalogue Cu" },
    "3c_cu18_400":  { od: 110.0, mbr: 1650, src: "HES catalogue Cu" },

    // ── LV POWER 0.6/1kV XLPE ──
    "sc_cu_lv_1.5":  { od:  8.2, mbr: 123, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_2.5":  { od:  8.7, mbr: 131, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_4":    { od:  9.3, mbr: 140, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_6":    { od:  9.9, mbr: 149, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_10":   { od: 11.2, mbr: 168, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_16":   { od: 12.3, mbr: 185, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_25":   { od: 14.0, mbr: 210, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_35":   { od: 15.3, mbr: 230, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_50":   { od: 17.0, mbr: 255, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_70":   { od: 19.3, mbr: 290, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_95":   { od: 21.5, mbr: 323, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_120":  { od: 23.5, mbr: 353, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_150":  { od: 25.7, mbr: 386, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_185":  { od: 28.2, mbr: 423, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_240":  { od: 31.5, mbr: 473, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_300":  { od: 34.5, mbr: 518, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_400":  { od: 38.5, mbr: 578, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_500":  { od: 42.5, mbr: 638, src: "Prysmian/Draka catalogue model" },
    "sc_cu_lv_630":  { od: 47.5, mbr: 713, src: "Prysmian/Draka catalogue model" },
    
    "sc_al_lv_16":   { od: 11.5, mbr: 173, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_25":   { od: 13.0, mbr: 195, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_35":   { od: 14.3, mbr: 215, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_50":   { od: 15.8, mbr: 237, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_70":   { od: 18.0, mbr: 270, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_95":   { od: 20.0, mbr: 300, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_120":  { od: 22.0, mbr: 330, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_150":  { od: 24.0, mbr: 360, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_185":  { od: 26.5, mbr: 398, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_240":  { od: 29.5, mbr: 443, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_300":  { od: 32.5, mbr: 488, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_400":  { od: 36.5, mbr: 548, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_500":  { od: 40.5, mbr: 608, src: "Prysmian/Draka catalogue model" },
    "sc_al_lv_630":  { od: 45.5, mbr: 683, src: "Prysmian/Draka catalogue model" },
    
    "2c_cu_lv_1.5":  { od: 15.5, mbr: 186, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_2.5":  { od: 16.5, mbr: 198, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_4":    { od: 18.0, mbr: 216, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_6":    { od: 19.5, mbr: 234, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_10":   { od: 22.5, mbr: 270, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_16":   { od: 25.5, mbr: 306, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_25":   { od: 29.5, mbr: 354, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_35":   { od: 32.5, mbr: 390, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_50":   { od: 36.5, mbr: 438, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_70":   { od: 42.0, mbr: 504, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_95":   { od: 47.0, mbr: 564, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_120":  { od: 52.0, mbr: 624, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_150":  { od: 57.0, mbr: 684, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_185":  { od: 63.0, mbr: 756, src: "Prysmian/Draka catalogue model" },
    "2c_cu_lv_240":  { od: 71.0, mbr: 852, src: "Prysmian/Draka catalogue model" },
    
    "3c_cu_lv_1.5":  { od: 16.5, mbr: 198, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_2.5":  { od: 18.0, mbr: 216, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_4":    { od: 19.5, mbr: 234, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_6":    { od: 21.5, mbr: 258, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_10":   { od: 25.0, mbr: 300, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_16":   { od: 28.5, mbr: 342, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_25":   { od: 33.5, mbr: 402, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_35":   { od: 37.0, mbr: 444, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_50":   { od: 42.0, mbr: 504, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_70":   { od: 48.5, mbr: 582, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_95":   { od: 55.0, mbr: 660, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_120":  { od: 60.5, mbr: 726, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_150":  { od: 66.5, mbr: 798, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_185":  { od: 73.5, mbr: 882, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_240":  { od: 83.0, mbr: 996, src: "Prysmian/Draka catalogue model" },
    "3c_cu_lv_300":  { od: 91.0, mbr:1092, src: "Prysmian/Draka catalogue model" },
    
    "4c_cu_lv_1.5":  { od: 18.0, mbr: 216, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_2.5":  { od: 19.5, mbr: 234, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_4":    { od: 21.5, mbr: 258, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_6":    { od: 23.5, mbr: 282, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_10":   { od: 27.5, mbr: 330, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_16":   { od: 31.5, mbr: 378, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_25":   { od: 37.0, mbr: 444, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_35":   { od: 41.0, mbr: 492, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_50":   { od: 46.5, mbr: 558, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_70":   { od: 54.0, mbr: 648, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_95":   { od: 61.0, mbr: 732, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_120":  { od: 67.5, mbr: 810, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_150":  { od: 74.5, mbr: 894, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_185":  { od: 82.5, mbr: 990, src: "Prysmian/Draka catalogue model" },
    "4c_cu_lv_240":  { od: 93.5, mbr:1122, src: "Prysmian/Draka catalogue model" },
    
    "5c_cu_lv_1.5":  { od: 20.0, mbr: 240, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_2.5":  { od: 21.5, mbr: 258, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_4":    { od: 23.5, mbr: 282, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_6":    { od: 26.0, mbr: 312, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_10":   { od: 30.5, mbr: 366, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_16":   { od: 35.0, mbr: 420, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_25":   { od: 41.5, mbr: 498, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_35":   { od: 46.0, mbr: 552, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_50":   { od: 52.5, mbr: 630, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_70":   { od: 60.5, mbr: 726, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_95":   { od: 68.5, mbr: 822, src: "Prysmian/Draka catalogue model" },
    "5c_cu_lv_120":  { od: 76.0, mbr: 912, src: "Prysmian/Draka catalogue model" },
    
    "3c_al_lv_16":   { od: 27.0, mbr: 324, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_25":   { od: 31.0, mbr: 372, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_35":   { od: 34.5, mbr: 414, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_50":   { od: 39.0, mbr: 468, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_70":   { od: 45.5, mbr: 546, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_95":   { od: 51.5, mbr: 618, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_120":  { od: 57.0, mbr: 684, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_150":  { od: 63.0, mbr: 756, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_185":  { od: 69.5, mbr: 834, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_240":  { od: 78.5, mbr: 942, src: "Prysmian/Draka catalogue model" },
    "3c_al_lv_300":  { od: 86.5, mbr:1038, src: "Prysmian/Draka catalogue model" },
    
    "4c_al_lv_16":   { od: 29.5, mbr: 354, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_25":   { od: 34.5, mbr: 414, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_35":   { od: 38.5, mbr: 462, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_50":   { od: 43.5, mbr: 522, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_70":   { od: 50.5, mbr: 606, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_95":   { od: 57.5, mbr: 690, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_120":  { od: 63.5, mbr: 762, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_150":  { od: 70.0, mbr: 840, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_185":  { od: 77.5, mbr: 930, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_240":  { od: 87.5, mbr:1050, src: "Prysmian/Draka catalogue model" },
    "4c_al_lv_300":  { od: 96.5, mbr:1158, src: "Prysmian/Draka catalogue model" },
    
    "5c_al_lv_16":   { od: 33.0, mbr: 396, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_25":   { od: 38.5, mbr: 462, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_35":   { od: 43.0, mbr: 516, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_50":   { od: 49.0, mbr: 588, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_70":   { od: 57.0, mbr: 684, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_95":   { od: 64.5, mbr: 774, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_120":  { od: 71.5, mbr: 858, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_150":  { od: 79.0, mbr: 948, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_185":  { od: 87.5, mbr:1050, src: "Prysmian/Draka catalogue model" },
    "5c_al_lv_240":  { od: 99.0, mbr:1188, src: "Prysmian/Draka catalogue model" },
    
    // LV 0.6/1kV 3-core — Helukabel H07RN-F Ed.27
    "3c_lv3_1.5": { od: 10.6, mbr: 53,  src: "Helukabel H07RN-F" },
    "3c_lv3_2.5": { od: 12.4, mbr: 62,  src: "Helukabel H07RN-F" },
    "3c_lv3_4":   { od: 14.4, mbr: 72,  src: "Helukabel H07RN-F" },
    "3c_lv3_6":   { od: 16.1, mbr: 80,  src: "Helukabel H07RN-F" },
    "3c_lv3_10":  { od: 21.6, mbr: 108, src: "Helukabel H07RN-F" },
    "3c_lv3_16":  { od: 24.7, mbr: 124, src: "Helukabel H07RN-F" },
    "3c_lv3_25":  { od: 29.6, mbr: 148, src: "Helukabel H07RN-F" },
    "3c_lv3_35":  { od: 33.2, mbr: 166, src: "Helukabel H07RN-F" },
    "3c_lv3_50":  { od: 38.5, mbr: 193, src: "Helukabel H07RN-F" },
    "3c_lv3_70":  { od: 43.3, mbr: 217, src: "Helukabel H07RN-F" },
    "3c_lv3_95":  { od: 48.6, mbr: 243, src: "Helukabel H07RN-F" },
    "3c_lv3_120": { od: 53.7, mbr: 269, src: "Helukabel H07RN-F" },
    "3c_lv3_150": { od: 59.0, mbr: 295, src: "Helukabel H07RN-F" },
    "3c_lv3_185": { od: 64.5, mbr: 323, src: "Helukabel H07RN-F" },
    "3c_lv3_240": { od: 73.5, mbr: 368, src: "Helukabel H07RN-F" },
    
    // PV DC STRING — BS EN 50618 H1Z2Z2-K
    "sc_pv_string_1.5": { od:  4.0, mbr:  16, src: "BS EN 50618 (typical)" },
    "sc_pv_string_2.5": { od:  4.7, mbr:  19, src: "BS EN 50618 (typical)" },
    "sc_pv_string_4":   { od:  5.4, mbr:  22, src: "BS EN 50618 (typical)" },
    "sc_pv_string_6":   { od:  6.2, mbr:  25, src: "BS EN 50618 (typical)" },
    "sc_pv_string_10":  { od:  7.5, mbr:  30, src: "BS EN 50618 (typical)" },
    "sc_pv_string_16":  { od:  9.0, mbr:  36, src: "BS EN 50618 (typical)" },
    "sc_pv_string_25":  { od: 10.8, mbr:  43, src: "BS EN 50618 (typical)" },
    "sc_pv_string_35":  { od: 12.3, mbr:  49, src: "BS EN 50618 (typical)" },
    "sc_pv_string_50":  { od: 14.2, mbr:  57, src: "BS EN 50618 (typical)" },
    "sc_pv_string_70":  { od: 16.8, mbr:  67, src: "BS EN 50618 (typical)" },
    "sc_pv_string_95":  { od: 19.2, mbr:  77, src: "BS EN 50618 (typical)" },
    "sc_pv_string_120": { od: 21.2, mbr:  85, src: "BS EN 50618 (typical)" },
    "sc_pv_string_150": { od: 23.5, mbr:  94, src: "BS EN 50618 (typical)" },
    "sc_pv_string_185": { od: 26.1, mbr: 104, src: "BS EN 50618 (typical)" },
    "sc_pv_string_240": { od: 29.5, mbr: 118, src: "BS EN 50618 (typical)" },
    
    // ── FLEXIBLE SCREENED SOLAR MV ──
    "sc_flex_hv_ac_4":   { od:  4.90, mbr:  15, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_6":   { od:  5.80, mbr:  17, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_10":  { od:  7.80, mbr:  23, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_16":  { od:  9.30, mbr:  28, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_25":  { od: 11.00, mbr:  33, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_35":  { od: 12.90, mbr:  39, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_50":  { od: 14.90, mbr:  45, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_70":  { od: 17.00, mbr:  51, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_95":  { od: 19.50, mbr:  59, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_120": { od: 22.60, mbr:  68, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_150": { od: 25.00, mbr:  75, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_ac_185": { od: 26.60, mbr:  80, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_4":   { od:  4.90, mbr:  15, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_6":   { od:  5.80, mbr:  17, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_10":  { od:  7.80, mbr:  23, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_16":  { od:  9.30, mbr:  28, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_25":  { od: 11.00, mbr:  33, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_35":  { od: 12.90, mbr:  39, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_50":  { od: 14.90, mbr:  45, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_70":  { od: 17.00, mbr:  51, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_95":  { od: 19.50, mbr:  59, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_120": { od: 22.60, mbr:  68, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_150": { od: 25.00, mbr:  75, src: "Studer BETAtron T150 (0001050 V05)" },
    "sc_flex_hv_dc_185": { od: 26.60, mbr:  80, src: "Studer BETAtron T150 (0001050 V05)" },
    
    // RIGID AL SOLAR — Alu-ATA XS 
    "sc_al_ata_ac_50":  { od: 17.10, mbr: 205, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_70":  { od: 18.80, mbr: 226, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_95":  { od: 20.90, mbr: 251, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_120": { od: 22.40, mbr: 269, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_150": { od: 24.10, mbr: 289, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_185": { od: 27.70, mbr: 332, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_240": { od: 29.90, mbr: 359, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_300": { od: 33.00, mbr: 396, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_400": { od: 37.40, mbr: 449, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_500": { od: 40.10, mbr: 481, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_ac_630": { od: 44.80, mbr: 538, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_50":  { od: 17.10, mbr: 205, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_70":  { od: 18.80, mbr: 226, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_95":  { od: 20.90, mbr: 251, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_120": { od: 22.40, mbr: 269, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_150": { od: 24.10, mbr: 289, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_185": { od: 27.70, mbr: 332, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_240": { od: 29.90, mbr: 359, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_300": { od: 33.00, mbr: 396, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_400": { od: 37.40, mbr: 449, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_500": { od: 40.10, mbr: 481, src: "Studer Alu-ATA XS (0000007 V1)" },
    "sc_al_ata_dc_630": { od: 44.80, mbr: 538, src: "Studer Alu-ATA XS (0000007 V1)" }
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
const SC_CSAS_LV_CU_PWR = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const SC_CSAS_LV_AL_PWR = [16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];
const MC2_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const MC_CSAS_CU_LV     = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
const MC5_CSAS_CU_LV    = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
const MC_CSAS_AL_LV     = [16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
const MC5_CSAS_AL_LV    = [16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const SC_CSAS = [...new Set([...SC_CSAS_LV, ...SC_CSAS_MV, ...SC_CSAS_HV])];
const TC_CSAS = TC_CSAS_MV;
