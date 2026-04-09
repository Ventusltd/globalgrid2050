const OD_MV_HV = {
    // =========================
    // BRITISH MV
    // =========================

    // 6.35/11 kV single core
    "sc_6.35_70":  { od: 29.0, mbr: 435, src: "Generic UK MV schedule" },
    "sc_6.35_95":  { od: 31.0, mbr: 465, src: "Generic UK MV schedule" },
    "sc_6.35_120": { od: 32.5, mbr: 488, src: "Generic UK MV schedule" },
    "sc_6.35_150": { od: 34.0, mbr: 510, src: "Generic UK MV schedule" },
    "sc_6.35_185": { od: 36.0, mbr: 540, src: "Generic UK MV schedule" },
    "sc_6.35_240": { od: 39.0, mbr: 585, src: "Generic UK MV schedule" },
    "sc_6.35_300": { od: 42.0, mbr: 630, src: "Generic UK MV schedule" },
    "sc_6.35_400": { od: 45.0, mbr: 675, src: "Generic UK MV schedule" },
    "sc_6.35_500": { od: 49.0, mbr: 735, src: "Generic UK MV schedule" },
    "sc_6.35_630": { od: 54.0, mbr: 810, src: "Generic UK MV schedule" },

    // 6.35/11 kV 3 core Cu
    "3c_6.35_70":  { od: 49.0, mbr: 735,  src: "Generic UK MV schedule" },
    "3c_6.35_95":  { od: 53.0, mbr: 795,  src: "Generic UK MV schedule" },
    "3c_6.35_120": { od: 57.0, mbr: 855,  src: "Generic UK MV schedule" },
    "3c_6.35_150": { od: 60.0, mbr: 900,  src: "Generic UK MV schedule" },
    "3c_6.35_185": { od: 64.0, mbr: 960,  src: "Generic UK MV schedule" },
    "3c_6.35_240": { od: 70.0, mbr: 1050, src: "Generic UK MV schedule" },
    "3c_6.35_300": { od: 76.0, mbr: 1140, src: "Generic UK MV schedule" },

    // 19/33 kV single core
    "sc_19_95":  { od: 41.0, mbr: 615, src: "Generic UK MV schedule" },
    "sc_19_120": { od: 43.0, mbr: 645, src: "Generic UK MV schedule" },
    "sc_19_150": { od: 45.0, mbr: 675, src: "Generic UK MV schedule" },
    "sc_19_185": { od: 47.0, mbr: 705, src: "Generic UK MV schedule" },
    "sc_19_240": { od: 50.0, mbr: 750, src: "Generic UK MV schedule" },
    "sc_19_300": { od: 52.0, mbr: 780, src: "Generic UK MV schedule" },
    "sc_19_400": { od: 56.0, mbr: 840, src: "Generic UK MV schedule" },
    "sc_19_500": { od: 59.0, mbr: 885, src: "Generic UK MV schedule" },
    "sc_19_630": { od: 63.0, mbr: 945, src: "Generic UK MV schedule" },

    // 19/33 kV 3 core Cu
    "3c_cu18_95":  { od: 79.0,  mbr: 1185, src: "Generic UK MV schedule" },
    "3c_cu18_120": { od: 83.0,  mbr: 1245, src: "Generic UK MV schedule" },
    "3c_cu18_150": { od: 86.0,  mbr: 1290, src: "Generic UK MV schedule" },
    "3c_cu18_185": { od: 90.0,  mbr: 1350, src: "Generic UK MV schedule" },
    "3c_cu18_240": { od: 97.0,  mbr: 1455, src: "Generic UK MV schedule" },
    "3c_cu18_300": { od: 102.0, mbr: 1530, src: "Generic UK MV schedule" },

    // =========================
    // IEC 64/110 kV — TenneT aligned
    // Attached spec basis
    // =========================
    "sc_64_630": {
        od: 76.4,
        mbr: 1910,
        src: "IEC 60840 64/110 kV attached specification"
    }
};
