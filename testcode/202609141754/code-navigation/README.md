# Code navigation prototype

A read-only web page for following one block into its function families, their relationships and the exact source lines at a pinned commit, with deep links and browser Back support.

- Derived from: `testcode/202609141423/` (code navigation prototype 11). Behaviour and layout are unchanged; `journey.css` and `journey.js` are published here as `navigation.css` and `navigation.js`, and the on-screen wording was rewritten in plain engineering language.
- Wording: every data-derived string passes through `../corporate.js` (via `say()`, `sayType()` and `pageLink()` in `core.js`).
- Data: `https://ventusltd.github.io/stars/` (`blocks/`, `code/`) and `raw.githubusercontent.com`, read live when the page opens.
- Not included: the internal review notes and build record of the origin folder.
