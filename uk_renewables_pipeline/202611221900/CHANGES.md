# V9.69 — MAP second, A4 last, portrait + full-height overview

- Expanded REPD opens immediately in either orientation, no landscape rotation prompt.
- Expanded title is gone; small floating Close button gives the table all available height.
- Temporary MAP column sits directly after Project and opens the same project URL. A4 stays in the existing far-right last column.
- The unchanged original MAP link remains in its original actions cell for A4 report input; original A4/PDF modules remain byte-identical.
- After closing, the injected MAP cell is removed and the untouched normal 13-column REPD table returns.
- Native cyan/black palette, meaningful sortable headers, horizontal navigation, 100 rows/page, and existing filtered data are retained.
- WebKit/Chromium regression covers portrait/landscape, rotation, sorting, MAP, A4 map href, original table restoration.
