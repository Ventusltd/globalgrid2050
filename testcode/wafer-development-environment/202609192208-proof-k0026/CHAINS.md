# Chains: what the substrate must carry next

This is a contract, not engineering. It says how a real world chain plugs into the engine, so that
the engineering can be added later by people who know it, one cartridge at a time, without anyone
touching the engine again.

## The idea

A LINE is any countable, ordered unit with an address. The engine needs two things from anything
it draws, a count and an order, and nothing else. So each of these is a cartridge:

| chain | from | to |
|---|---|---|
| light | the Sun | a carrier collected in a solar cell |
| power | the solar cell | the 400 kV grid |
| silicon | a grain of sand | the processor this was written on |
| copper | ore and cathode | fine stranded tinned 6 mm2 solar cable, IEC 60228 class 5, and class 6 above it |
| aluminium | bauxite | circular compacted stranded conductor, IEC 60228 class 2 |
| code | the first commit | the next line ever written (this one exists: the wafer) |

Every rung of a chain is a LEVEL. A level declares four things and the engine refuses a cartridge
that leaves one out:

    count      how many, and where the number came from (its key)
    order      what comes before what: time, position along a route, step in a process
    law        how it is placed (see below). Fixed by the object's own symmetry, never by taste.
    view       how it is drawn (see below).

## Placement laws (Ventusltd/grid, law L5: the law is fixed by the object)

| law | for | status |
|---|---|---|
| `wafer` | anything ordered by one number with no direction: r = sqrt(key) | built, kuiper-belt index.html |
| `explicit` | positions that were measured: a stepper's dies, a substation's coordinates | built, cosmic |
| `grid` | a fixed pitch clipped to a boundary: dies on a wafer, modules in a table | built, cosmic |
| `hex` | circles packed as tightly as circles pack: the wires of a stranded conductor, 1, 7, 19, 37, 61, 91 (law L6) | NOT BUILT. The conductor cartridges need it first |
| `route` | things along a line: cable along a trench, joints along a circuit | NOT BUILT |
| `graph` | a network whose connectivity is stored, with coordinates from the ground | NOT BUILT. GridAtlas is this |

## Views: the three things asked for

| view | what it is | rule |
|---|---|---|
| `section` | AN ENGINEERING DRAWING. Outlines, hatching by material to ISO 128, dimensions with units, a title block naming the standard and the clause | every dimension carries a key or is marked candidate. Built in part: cosmic draws wafer sections; the 33 kV and 132 kV cable sections exist on the site |
| `xray` | THE RECORD. Grey blue dust or shade, where a shade is a stated, invertible count (law L20) | built |
| `material` | THE REAL THING, when a real image exists: satellite imagery of a solar farm, a micrograph of a die, a photograph of a conductor end | NOT BUILT. Only ever a real, attributed, licensed image placed at its true scale and position. Never a texture made to look like one. Where no real image exists the view is refused and the section is shown instead |

Colour is never free. It follows PALETTE.md: grey is the record, cyan the instrument, green
energised, amber attention, magenta selected. Materials in a `section` are told apart by hatch, not
by colour, exactly as on a drawing, so that colour stays available to mean state.

## What joins the chains

One pulse. A query selects a set of key ranges and the engine lights them (proof 3 lights new
code, proof 4 lights a month). Today the pulse is a period of time through code. With a `graph`
cartridge the same pulse is a fault current through a network, and with the power chain it is a
photon's energy followed from the cell to the 400 kV busbar. The abstraction is a set of key
ranges and it does not change.

## Order of work

1. `hex` law and the `section` view for ONE conductor: IEC 60228 class 2 circular compacted
   aluminium, from the standard's own numbers, every dimension keyed. It is the smallest complete
   example of drawing, colour and material rule together, and the owner of this estate can check
   it against twenty two years of the real thing.
2. `material` view, proven on one solar farm whose satellite image is already shown in GridAtlas.
3. `graph` law, so GridAtlas becomes a cartridge rather than a separate application.
4. Only then the chains, rung by rung, each rung with its keys.

Nothing in this file is a design. Provided as is, without warranty of any kind.
