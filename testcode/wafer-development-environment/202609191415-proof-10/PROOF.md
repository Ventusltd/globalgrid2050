# Proof 10: the cable database keys a law that was written from memory

Law L15 says a cable bent inside its minimum radius is already damaged. Its key read "about 12 to 15 times the diameter, quoted from memory", which is a candidate, not a key. The estate already holds the evidence: the cable geometry visualiser (live at https://globalgrid2050.com/solar-bess-topology-v5/cable-geometry-visualiser-v5.html) carries a table of **225 cables**, each with an overall diameter, a minimum bending radius and its own stated source. Parsed from that page, not retyped, and the ratio computed for every row:

| source given in the data | cables | bending radius as a multiple of overall diameter |
|---|---|---|
| BS EN 50618 (typical) | 13 | 4x (13) |
| Generic catalogue | 22 | 15x (22) |
| Generic catalogue Cu | 10 | 15x (10) |
| Generic catalogue model | 113 | 12x (82), 15x (31) |
| H07RN-F type | 13 | 5x (13) |
| Manufacturer datasheet | 47 | 3x (24), 12x (22), 25x (1) |
| Utility schedule | 7 | 15x (7) |

So the law is not "12 to 15". Read the table: that is what the data says, by source. Checked by hand before trusting the parser: 132 kV 1600 mm2 is 104 mm and 1560 mm, which is 15.0; 33 kV 35 mm2 is 36.5 and 548, which is 15.0; 110 kV 630 mm2 from a manufacturer datasheet is 76.4 and 1910, which is 25.0.

This is the first CABLES CARTRIDGE for the engine: every row already carries its key, so nothing has to be taken on trust. No customer, project, price or order appears in it; its sources are generic. The next step, in the plan, is to let conductor.html draw each of these to scale with its bending radius as an arc.

Provided as is, without warranty of any kind; a chart, not a design.
