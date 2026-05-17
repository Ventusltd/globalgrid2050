from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "solar-bess-topology-v4" / "indexforgis-sld-v4.html"
REPORT = ROOT / "gridbot_reports" / "v4_detailed_disclaimer_below_financial_logic.md"
MARKER = "<h3>Detailed Screening Disclaimer</h3>"
TARGET = '<p>The model deliberately avoids pretending to be a full discounted cash flow model. It is a fast comparison tool for early stage decision making. Real projects still require competent engineering, grid studies, planning review, legal review, tax review, debt sizing, revenue analysis and investment committee approval.</p>'
INSERT = '''

<h3>Detailed Screening Disclaimer</h3>
<p>The VENTUS GIS SLD Sandbox is provided as an early stage screening, learning and project qualification tool. It is intended to help users visualise relationships between land, grid proximity, solar topology, cable route assumptions, module count, inverter architecture, logistics, Battery Energy Storage System (BESS) assumptions, capital cost assumptions, revenue assumptions and indicative project economics.</p>
<p>The sandbox does not create, imply or evidence a grid offer, grid connection approval, point of connection approval, available grid capacity, land right, wayleave, easement, planning consent, EPC price, construction programme, investment recommendation, financial valuation, lending approval or insurance acceptance.</p>
<p>Public substation points, voltage references and grid node markers are reference data only. A visible substation point does not confirm voltage suitability, thermal capacity, fault level headroom, protection compatibility, connection queue status, Gate 2 eligibility, land access, constructability, outage availability, reinforcement cost or acceptance by a Distribution Network Operator (DNO), Transmission Owner (TO), National Energy System Operator (NESO) or any other network party.</p>
<p>User drawn cable routes, pin routes, direct route lines and exported route geometries are indicative routing assumptions only. They do not confirm landowner consent, wayleaves, easements, highway rights, railway crossings, watercourse crossings, third party utility conflicts, environmental constraints, planning acceptability, installation method, cable pulling feasibility, trench design, duct design, joint bay location, thermal rating, voltage drop, losses, protection design, earthing design or final constructability.</p>
<p>All cable lengths, losses and route assumptions must be checked by competent cable engineers using project specific route surveys, cable data sheets, soil thermal resistivity, installation depth, grouping factors, duct factors, cyclic loading, conductor temperature limits, voltage drop limits, short circuit withstand, sheath bonding, earthing design, protection settings and applicable standards before procurement or construction decisions are made.</p>
<p>Solar layout outputs are indicative. Module count, DC capacity, AC capacity, site area, Ground Coverage Ratio (GCR), gross site factor, block layout, inverter count, substation count, access assumptions and container quantities must be verified against manufacturer datasheets, planning drawings, topographical surveys, geotechnical surveys, environmental constraints, drainage strategy, fire access, operations access, EPC scope, grid compliance requirements and final design drawings.</p>
<p>Financial outputs are screening values only. Revenue, capital expenditure, development cost, module cost, EPC cost, owner cost, grid connection cost, operating cost, target exit value, Operating Asset Net Present Value (NPV), development margin and surplus outputs depend on assumptions entered by the user and may change materially with route to market, Contracts for Difference (CfD), Power Purchase Agreement (PPA), merchant exposure, curtailment, grid charges, inflation, interest rates, debt sizing, tax treatment, construction cost, contingencies, warranties, insurance and investor return requirements.</p>
<p>BESS assumptions are indicative only. BESS power, BESS energy, BESS CAPEX, cycles, efficiency and revenue per MWh do not replace battery degradation modelling, augmentation strategy, warranty review, revenue stack modelling, fire safety review, planning review, grid compliance studies, metering design, controls design, availability assumptions, insurance review or safety case preparation.</p>
<p>The GeoJSON export preserves useful context for review and discussion, but exported data is not an Issued for Construction (IFC) drawing, legal boundary plan, grid application pack, cable route schedule, bill of quantities, EPC instruction, investment memorandum or bankable technical due diligence package. Any exported file must be reviewed and validated before being used in external GIS workflows, reports, procurement discussions, investor presentations or professional advice.</p>
<p>Users remain responsible for checking all inputs, outputs, assumptions and exported data. Any real world project should be reviewed by competent engineers, grid specialists, planners, environmental consultants, land agents, legal advisers, tax advisers, insurance advisers, EPC contractors, Owner's Engineers, lenders and investment committee professionals before committing capital, signing contracts, placing orders or making public claims.</p>
<p>The sandbox is designed to make assumptions visible, not to remove professional judgement. It should be used to ask better questions, compare scenarios, identify where deeper work is required and support disciplined early stage decision making.</p>'''


def main():
    if not HTML.exists():
        raise SystemExit(f"Missing target file: {HTML}")

    text = HTML.read_text(encoding="utf-8")
    changed = False

    if MARKER in text:
        changed = False
    elif TARGET in text:
        text = text.replace(TARGET, TARGET + INSERT, 1)
        HTML.write_text(text, encoding="utf-8")
        changed = True
    else:
        raise SystemExit("Could not find Financial Model Logic insertion point")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(f"""# V4 Detailed Disclaimer Below Financial Logic

UTC created: {datetime.now(timezone.utc).isoformat()}

Target file:
solar-bess-topology-v4/indexforgis-sld-v4.html

Action:
Added a Detailed Screening Disclaimer immediately below the Financial Model Logic section inside the existing explainer box.

Scope:
V4 only. V3 remains untouched.

Disclaimer coverage:

- grid reference data limits
- public substation limits
- cable route and pin route limits
- cable engineering verification requirements
- solar layout output limits
- financial screening limits
- BESS assumption limits
- GeoJSON export limits
- professional review requirement

Changed: {changed}
""", encoding="utf-8")


if __name__ == "__main__":
    main()
