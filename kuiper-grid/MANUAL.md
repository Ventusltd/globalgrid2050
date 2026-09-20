> Release 202609202048 (20 September 2026, 20:48 BST). Builds i0073, i0083 to i0091.

# Ten network simulations you can run in the Kuiper

Ventus Ltd

The Kuiper turns energy-system data into interactive engineering drawings. It
is built to explore network topology, local systems and solar electrical
layouts visually, while distinguishing source data from inferred relationships
at every point. It is an exploration and communication environment, not a
substitute for detailed engineering design or network studies.

## How the Kuiper works

The Kuiper is a drawing engine that runs entirely in the browser on a static
page. Nothing is installed, and no data leaves the device.

- **The bar.** A command bar sits at the foot of the screen, labelled *tap
  here for the commands*. Select it, type a command and press Enter.
- **The pop-up.** If you would rather not type, select the bar and choose from
  the list that opens. Each entry fills the bar with a complete, working
  command, so you can see what you have chosen and amend a single value before
  firing it.
- **The pulse.** Every command fires a ring that sweeps outward from the
  centre. The ring is the search: whatever it reaches and retains is left lit,
  and everything it does not retain stays dark. The pulse conveys the scale of
  the result before a word of it is read.
- **The cage.** When the pulse settles, a thin outline is drawn around the
  retained set. The cage is the boundary of the result: inside it is the
  selection, outside it is the remainder of the drawing.
- **The card.** A card opens with the finding, the figures, and a statement of
  how the result was obtained. The card can be moved, reduced or closed
  without losing the drawing.
- **Solid and dashed.** A solid line is drawn from source data. A dashed line
  is inferred: the drawing is showing a join it has assumed rather than read.
  The number of assumptions is printed on the card.

Every simulation below was run on a phone-sized screen, 390 pixels wide.

**Scope and limitations.** The drawing is derived from open map data. It does
not state what any asset can carry, how much of that is already committed, or
what is connected to what at any given moment. Inferred joins are drawn
dashed. A route on this map must not be read as a circuit.

---

## 1. View the complete drawn network

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid
```

**On firing.** The ring sweeps outward and leaves the whole drawn network lit:
approximately 5,800 stations and the links between them, laid out as a
schematic diagram in the manner of a transit map rather than to geographic
scale. The card reads *tap a station, or type a place, to throw the cage
around it.*

**Pulse and cage.** The pulse selects everything here, so no cage is drawn.
This is the starting view that every other grid command narrows.

**Limitations.** The drawing does not state what any part of the network can
carry. It is derived from open map data and does not describe what is
connected. Inferred joins are drawn dashed.

**Screenshot:** `manual-shots/0089-s01-whole-network.png`

---

## 2. Focus on a single station

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation"}
```

**On firing.** The ring sweeps outward from that station, leaves it and its
immediate neighbours lit, draws a cage around them and opens a card: *the cage
is around Minety Substation: 7 stations within 2 hops.*

**Pulse and cage.** Two hops is the default. The pulse walks two stops out
along the drawn network; the cage is the outline of everything it reached.

**If the name is not found,** the card lists the nearest names held in the
data so the query can be repeated. Any name printed in the data will work;
this one is an example.

**Scope.** Topology only: the drawing does not establish whether those seven
stations are electrically connected today. See the scope statement above.

**Screenshot:** `manual-shots/0089-s02-one-station.png`

---

## 3. Extend the search to three hops

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation","hops":3}
```

**On firing.** The same station, but the ring travels one stop further before
it stops, and the cage grows to match. The card names the hop count it used,
so the view being examined is never in doubt.

**Pulse and cage.** Hops are counted along the drawn network, not across the
ground. One, two and three are the permitted range.

**Scope.** Three hops is a path through the drawing, not an established route.
See the scope statement above.

**Screenshot:** `manual-shots/0089-s04-three-hops.png`

---

## 4. Filter to a single voltage class

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation","hops":3,"kv":400}
```

**On firing.** The same sweep, but the ring retains only links drawn at the
class named. The cage contracts, in some cases to a single station, and the
card counts what remains.

**Pulse and cage.** This is the most direct way to see how sparse one class is
in isolation. If a class is named that the drawing does not hold, the card
lists the classes it does hold.

**Scope.** The class is a label carried in the map data, not an operating
voltage.

**Screenshot:** `manual-shots/0089-s05-voltage-class.png`

---

## 5. Draw a region by ground distance

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"view":"region","place":"Minety Substation","km":45}
```

**On firing.** A radius is taken on the ground around the named place, and
every station inside it is laid out as a schematic. The card reads *the region
within 45 km of Minety Substation: 169 stations.*

**Pulse and cage.** This cage is a distance, not a walk. Hops follow the
network; a region disregards it and takes everything within the radius.
Comparing a region against a cage of comparable size is the quickest way to
see how far the drawn network departs from geography. The radius accepts 5 to
120 km.

**A region requires a place.** Without one, the card says so rather than
defaulting silently to the whole network.

**Scope.** A region is a distance on the ground. The drawing does not state
the function of any of those 169 stations.

**Screenshot:** `manual-shots/0089-s03-region.png`

---

## 6. List the documented local systems

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire local
```

**On firing.** The card names each local system that has been documented and
prompts for one to be named. It is the index for simulation 7.

**Pulse and cage.** No cage is thrown at this stage: this is a question about
the drawing, not a selection within it.

**Limitations.** Nothing here refers to a real site. The systems listed are
**example fixtures**, written to exercise the drawing. Real data is not yet
connected to this view.

**Screenshot:** `manual-shots/0089-s06-local.png`

---

## 7. Open a single local system

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire local {"station":"Hartmoor (fixture)"}
```

**On firing.** The view drops from the national schematic to one station's own
system: its incomers, its outgoers, and the destination of each. The card
states what it had to infer, in plain terms: *1 of 5 outgoers end at the edge
of the map; 1 join is guessed.*

**Pulse and cage.** The cage here is the boundary of the local system itself.
An outgoer that leaves the cage is drawn running off the edge rather than
invented.

**Limitations.** Nothing here refers to a real place. **The data behind this
view is an example fixture**, which is why the word *(fixture)* appears in the
name. Inferred joins are drawn dashed and counted on the card.

**Screenshot:** `manual-shots/0089-s07-local-one.png`

---

## 8. One substation and each connection out of it

**Open:** `kuiper-grid/i0090/`

**Type:**

```
fire substation {"site":"Barking"}
```

**On firing.** One substation is drawn with every connection out of it. The
card reads *Barking: 4 ways out, 6 circuits, 400 kV*, followed, unprompted, by
*4 of 20 values assumed (far end identity)*.

**Pulse and cage.** The pulse gathers the connections one at a time; the cage
is the substation's own boundary, with each outgoer crossing it. Inferred far
ends are drawn dashed.

**To return** to the previous view, type:

```
back
```

**Limitations.** The drawing does not state what those circuits carry or
whether they are in service. It is derived from open map data and does not
describe what is connected. One in five of the values on this card is
inferred, and the card states as much.

**Screenshot:** `manual-shots/0090-s09-substation.png`

---

## 9. Wire a single solar string

**Open:** `kuiper-grid/i0091/`

**Type:**

```
fire string {"mounting":"fixed","modules_high":1,"routing":"leapfrog"}
```

Alternatively, select the bar and choose a preset such as **1P leapfrog** or
**2P sequential**. Twelve presets are supplied; each fills the bar with the
command it ran, so a single value can be amended and the command fired again.

**On firing.** A row of modules is drawn with the string cable threaded
through it: leapfrog wiring runs out along alternate modules and returns
through the ones it skipped. The card opens with the finding, the drawing's
own figures, and the standing statement *Not real cable or array sizing —
consult a design engineer.*

**Pulse and cage.** The pulse runs along the string in the order the cable
does, so the route is shown being made rather than described. The cage is the
string.

**Amending one value:** `"routing":"one-after-another"` draws the same row
wired in sequence, and the long return cable from the far end becomes visible.
That single cable is the case for leapfrog, shown rather than asserted.

**Limitations.** Nothing here constitutes a specification for procurement. No
figure on this card is taken from a physical test; each is an estimate
produced by a model, and every card states this.

**Screenshot:** `manual-shots/0091-s16-string-leapfrog.png`

---

## 10. Draw a complete inverter block

**Open:** `kuiper-grid/i0091/`

**Type:**

```
fire block {}
```

**On firing.** Not a single string but every string on one inverter:
twenty-four in total, each drawn with its own pair of home runs landing on its
own named inverter input. This is the most detailed drawing in the set and
takes the longest to settle.

**Pulse and cage.** The pulse fills the block string by string. The cage is
the block boundary; the inverter inputs sit on it, named, so any one string
can be followed from module to terminal.

**Limitations.** The drawing does not establish whether the block is
buildable. No figure here is taken from a physical test. The same standing
statement — *Not real cable or array sizing* — appears on this card.

**Screenshot:** `manual-shots/0091-s18-block.png`

---

## Functions under development

The following are not available in this release:

- **Opening a station's card by tapping it on the map** — the map draws and
  the typed commands cage correctly, but a tap did not complete on a
  phone-sized screen. Use simulation 2 instead.
- **`neighbours` and `pulse` typed on i0090** — both are offered in the pop-up
  list, but no command of either name is registered yet. The card states this
  plainly rather than drawing something incorrect.
- **Link-removal wording typed on i0090** — no such command is registered; the
  bar falls through to a text search and returns nothing. Any future feature
  of this kind will be named and worded as a property of the drawing, not of
  the network.
- **`systems` and `system single line diagrams` typed on i0086** — the terms
  appear in the pop-up list, but nothing is registered behind them yet.

These items, and everything else known to be unfinished at this release, are
recorded in the validation register held by Ventus Ltd. Each simulation above
states its own limitations on the page and on the card.

---

## Attribution and licence

Contains open map data (c) OpenStreetMap contributors, available under the
Open Database License (ODbL) v1.0; any derived database is shared alike.
https://www.openstreetmap.org/copyright

Code: Apache-2.0. No warranty is given.
