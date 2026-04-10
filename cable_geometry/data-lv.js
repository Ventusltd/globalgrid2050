// =============================================================
// OD_LV — Low Voltage Cable OD and MBR Schedule
// 0.6/1 kV Cu XLPE — single core and 3 core
// Source: Generic UK LV schedule (BS 5467 / BS 6724 basis)
// Fixed installation values only. Verify before design use.
// =============================================================

const OD_LV = {

```
// =========================================================
// 0.6/1 kV Single Core Cu XLPE — compacted round conductor
// Key pattern: sc_cu_lv_{csa}
// MBR basis: 15 x OD (lv_cu_sc mbr_factor)
// =========================================================
"sc_cu_lv_50":  { od: 14.5, mbr: 218, src: "Generic UK LV schedule" },
"sc_cu_lv_70":  { od: 16.5, mbr: 248, src: "Generic UK LV schedule" },
"sc_cu_lv_95":  { od: 18.5, mbr: 278, src: "Generic UK LV schedule" },
"sc_cu_lv_120": { od: 20.5, mbr: 308, src: "Generic UK LV schedule" },
"sc_cu_lv_150": { od: 22.5, mbr: 338, src: "Generic UK LV schedule" },
"sc_cu_lv_185": { od: 25.0, mbr: 375, src: "Generic UK LV schedule" },
"sc_cu_lv_240": { od: 28.0, mbr: 420, src: "Generic UK LV schedule" },
"sc_cu_lv_300": { od: 31.0, mbr: 465, src: "Generic UK LV schedule" },

// =========================================================
// 0.6/1 kV 3 Core Cu XLPE — sector stranded conductor
// Key pattern: 3c_cu_lv_{csa}
// MBR basis: 12 x OD (lv_cu_3c mbr_factor)
// =========================================================
"3c_cu_lv_50":  { od: 34.0, mbr: 408, src: "Generic UK LV schedule" },
"3c_cu_lv_70":  { od: 38.0, mbr: 456, src: "Generic UK LV schedule" },
"3c_cu_lv_95":  { od: 42.5, mbr: 510, src: "Generic UK LV schedule" },
"3c_cu_lv_120": { od: 46.5, mbr: 558, src: "Generic UK LV schedule" },
"3c_cu_lv_150": { od: 50.5, mbr: 606, src: "Generic UK LV schedule" },
"3c_cu_lv_185": { od: 55.5, mbr: 666, src: "Generic UK LV schedule" },
"3c_cu_lv_240": { od: 62.0, mbr: 744, src: "Generic UK LV schedule" }
```

};
