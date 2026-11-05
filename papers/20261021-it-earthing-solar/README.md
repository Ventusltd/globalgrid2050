# Earthing, inverter topology and protection in utility-scale solar

**Status: RESEARCH DRAFT — UNREVIEWED / NOT ENGINEERING APPROVAL**

Research date: **21 October 2026**. Archived: **30 October 2026**. Owner: Ventus Ltd.

## Scope

A 134-page independent, exploratory report evaluating a hypothesis about transformerless string inverters, shared unearthed (IT) AC collection networks, first- and second-earth-fault behaviour, insulation monitoring, anti-PID voltage offsets, cable insulation stresses, protection coordination and commissioning evidence.

The report distinguishes **confirmed**, **reasonably inferred**, **disputed**, **unverified** and **unknown** findings. Its case study is anonymised. It is a research record, not proof of a field incident, regulatory breach or plant-wide failure mechanism.

## Preserved research copy

- [Full 134-page extracted text, preserving PDF page boundaries](./REPORT_TEXT_EXTRACT.md)
- Original owner-supplied file: `Earthing, inverter topology and protection in utility-scale solar.pdf`
- Original PDF size: **3,001,096 bytes**
- Original PDF SHA-256: `e7c0600e9a383cd3d1745330473f7a25ceee23b177892555f1155cce3fb43df7`
- Original PDF pages: **134**
- PDF file itself: **not included** in this Git commit. The GitHub connection could write UTF-8 source text, but did not support transferring the uploaded binary PDF. Add the original file unchanged in a future change to achieve byte-for-byte preservation.

**Fidelity caveat:** The text is a machine extraction from the supplied PDF, not a complete reproduction of PDF layout, diagrams, tables, links or page artwork. Consult the original PDF before quoting formatted tables or drawings.

## Publication and safety gates

**Do not treat this research draft as verified electrical-design guidance or publish it as a conclusive finding.** The report itself identifies matters requiring independent checking, including:

1. Exact wording/numbering in the licensed **BS 7671:2018+A4:2026** text, especially IT-system insulation-monitoring requirements.
2. Manufacturer instructions and the electrical withstand/anti-PID assumptions for the equipment actually selected.
3. Review of transformer impedance, ACB/MCCB certificates, protection settings, cable and protective-conductor routes, and second-fault/disconnection calculations.
4. Verification of whether winding-level IMDs exist, are functional and are appropriately commissioned; field data on actual alarm and failure modes.
5. Clear separation of source-confirmed claims, calculations, hypotheses and unknown outcomes.

The 21 October report states that no published investigation it located conclusively attributed a string-inverter IT-network fire/injury to the proposed mechanism. Its open questions and roadmap must accompany any later publication.

## Repository boundaries

This belongs in **GlobalGrid2050 technical research** and can be cross-referenced by the solar electrical topology engine and employer-requirements material. It is **not** part of the Lightning optical-flash collector, and does not change production GridAtlas or GlobalGrid2050 app code.

## Release policy

Research archive only. No automatic publication on the website, no changes to application release pointers and no assertion of independent peer review. Review and correct before merging into any outward-facing guidance.
