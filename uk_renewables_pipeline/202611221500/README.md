# Pipeline News V9.66 — fast-action Expanded REPD View

Owner screenshot acceptance brief, 22 November 2026. Expanded-only presentation of the exact original V9.65 REPD register.

- The expanded workspace uses the original ticker red `#f33` as its dominant accent. Original dashboard, three gauges and green MW figures remain unchanged.
- Hide Machine Read Notes and the former MAP column in expanded mode only; all notes and original REPD data remain in the DOM and the normal dashboard.
- Move (do not clone) each existing tested MAP link and A4 report button into the Operator cell. Their original event handlers and source-specific URLs remain intact.
- Operator column reduced from 96px to 52px (approximately 46% narrower), with two-line wrapping, full name in the title attribute and in project details/A4 report.
- Retain 100 rows per page, sorting and header filters, technology selector and horizontal/vertical swipe scrolling. No frozen first column.
- Restore the original 50-row, 13-column register on closing the expanded view; original A4 HTML/PDF, MAP, Machine Notes, REPD records, news and every prior release remain byte-identical.

Publication requires dedicated Chromium/WebKit portrait + landscape regression and owner visual acceptance. Independent live served-byte verification required.
