> Release 202609202048 (20 September 2026, 20:48 BST). Builds i0073, i0083 to i0091.

# Ten network simulations you can run in the Kuiper

Ventus Ltd

## How the Kuiper works in one minute

The Kuiper is a drawing engine on a static page. Nothing is installed and nothing
is sent anywhere: the page draws.

- **The bar.** At the bottom of the screen there is a command bar. It says
  *tap here for the commands*. Tap it, type a command, press Enter.
- **The pop-up.** If you would rather not type, tap the bar and pick a command
  from the list that opens. The list fills the bar with a working command, so
  you can see what you just chose and change one number in it.
- **The pulse.** Every command fires a ring that sweeps out from the middle.
  The ring is the search: whatever it touches and keeps is left lit, and
  everything it did not keep stays dark. The pulse is how the page shows you
  the size of the answer before you read a word of it.
- **The cage.** When the pulse settles, a thin outline is drawn around the set
  it kept. The cage is the boundary of the answer: inside it is what the
  command selected, outside it is the rest of the drawing.
- **The card.** A card opens with the sentence, the numbers, and a line saying
  how the answer was got. You can drag the card, shrink it, or close it and
  keep the picture.
- **Solid and dashed.** A solid line is drawn from data. A dashed line is
  assumed: the drawing is showing you a join it inferred rather than read.
  Counts of assumptions are printed on the card.

Everything below was run on a phone-sized screen, 390 pixels wide.

**What none of it tells you.** The map is drawn from open map data. It says
nothing about capacity, nothing about headroom, and nothing about what is
actually connected to what at any moment. Assumed things are drawn dashed. Do
not read a route on this map as a circuit.

---

## 1. Look at the whole network

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid
```

**First five seconds.** The ring sweeps out and leaves the whole drawn network
lit: about 5,800 stations and the links between them, laid out as an
Underground-style map rather than as geography. The card says *tap a station,
or type a place, to throw the cage around it.*

**Pulse and cage.** The pulse here selects everything, so no cage is drawn.
This is the starting picture that every other grid command narrows down.

**It does not tell you** what any of it can carry. The map is drawn from open
map data and says nothing about capacity, headroom or what is connected.
Assumed things are drawn dashed.

**Screenshot:** `manual-shots/0089-s01-whole-network.png`

---

## 2. Order a ticket to one station

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation"}
```

**First five seconds.** The ring sweeps out from that station, leaves it and
its immediate neighbours lit, draws a cage around them and opens a card:
*the cage is around Minety Substation: 7 stations within 2 hops.*

**Pulse and cage.** Two hops is the default. The pulse walks two stops out
along the drawn network; the cage is the outline of everything it reached.

**If the name is not found** the card lists the nearest names in the data, so
you can try again. Any name printed in the data works; this one is an example.

**It does not tell you** whether those seven are electrically connected today.
The map is drawn from open map data and says nothing about capacity, headroom
or what is connected. Assumed things are drawn dashed.

**Screenshot:** `manual-shots/0089-s02-one-station.png`

---

## 3. Reach three stops out instead of two

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation","hops":3}
```

**First five seconds.** The same station, but the ring travels one stop
further before it stops. The cage grows to match. The card names the hop count
it used so you always know which picture you are looking at.

**Pulse and cage.** Hops are counted along the drawn network, not across the
ground. One, two and three are the range.

**It does not tell you** that three hops is a route anyone could use. The map
is drawn from open map data and says nothing about capacity, headroom or what
is connected. Assumed things are drawn dashed.

**Screenshot:** `manual-shots/0089-s04-three-hops.png`

---

## 4. Keep one voltage class only

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"place":"Minety Substation","hops":3,"kv":400}
```

**First five seconds.** The same sweep, but the ring only keeps links drawn at
the class you named. The cage shrinks, sometimes to a single station, and the
card counts what survived.

**Pulse and cage.** This is the cheapest way to see how thin one class is on
its own. If you name a class the drawing does not hold, the card lists the
classes it does hold.

**It does not tell you** the operating voltage of anything. The class is a
label in the map data. The map says nothing about capacity, headroom or what
is connected. Assumed things are drawn dashed.

**Screenshot:** `manual-shots/0089-s05-voltage-class.png`

---

## 5. Draw a region measured on the ground

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire grid {"view":"region","place":"Minety Substation","km":45}
```

**First five seconds.** A circle is measured on the ground around the named
place, and every station inside it is laid out as a tube map. The card reads
*the region within 45 km of Minety Substation: 169 stations.*

**Pulse and cage.** This cage is a distance, not a walk. Hops follow the
network; a region ignores it and takes everything within the radius. Comparing
a region with a cage of the same size is the quickest way to see how little the
network follows the map. The radius runs from 5 to 120 km.

**A region needs a place.** Without one the card says so rather than quietly
drawing the whole network instead.

**It does not tell you** what any of those 169 stations do. The map is drawn
from open map data and says nothing about capacity, headroom or what is
connected. Assumed things are drawn dashed.

**Screenshot:** `manual-shots/0089-s03-region.png`

---

## 6. List the local systems that have been written up

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire local
```

**First five seconds.** The card names each local system that has been written
up and tells you to name one. It is the index for simulation 7.

**Pulse and cage.** No cage is thrown yet: this is a question about the
drawing, not a selection inside it.

**It does not tell you** anything about real sites. The systems listed here are
**example fixtures**, written to exercise the drawing. Real data is not wired
in yet.

**Screenshot:** `manual-shots/0089-s06-local.png`

---

## 7. Open one local system

**Open:** `kuiper-grid/i0089/`

**Type:**

```
fire local {"station":"Hartmoor (fixture)"}
```

**First five seconds.** The view drops from the national tube map to one
station's own system: its incomers, its outgoers, and where each one goes. The
card counts what it had to assume, in plain words: *1 of 5 outgoers end at the
edge of the map; 1 join is guessed.*

**Pulse and cage.** The cage here is the boundary of the local system itself.
An outgoer that leaves the cage is drawn running off the edge, not invented.

**It does not tell you** anything about a real place. **This view's data is an
example fixture.** The word *(fixture)* is in the name for that reason.
Assumed joins are drawn dashed and counted on the card.

**Screenshot:** `manual-shots/0089-s07-local-one.png`

---

## 8. One substation and every way out of it

**Open:** `kuiper-grid/i0090/`

**Type:**

```
fire substation {"site":"Barking"}
```

**First five seconds.** One substation is drawn with every way out of it. The
card reads *Barking: 4 ways out, 6 circuits, 400 kV*, and then, without being
asked, *4 of 20 values assumed (far end identity)*.

**Pulse and cage.** The pulse gathers the ways out one at a time; the cage is
the substation's own boundary, with each outgoer crossing it. Assumed far ends
are dashed.

**To go back** to the previous picture, type:

```
back
```

**It does not tell you** what those circuits carry or whether they are in
service. The map is drawn from open map data and says nothing about capacity,
headroom or what is connected. A quarter of the values on this card are
assumptions, and the card says so.

**Screenshot:** `manual-shots/0090-s09-substation.png`

---

## 9. Wire one solar string and see the cable

**Open:** `kuiper-grid/i0091/`

**Type:**

```
fire string {"mounting":"fixed","modules_high":1,"routing":"leapfrog"}
```

or tap the bar and choose a preset such as **1P leapfrog** or **2P sequential**.
Twelve presets are supplied; each one fills the bar with the command it ran, so
you can change one number and fire it again.

**First five seconds.** A row of modules is drawn with the string cable
threaded through it: leapfrog wiring goes out along every other module and
comes back through the ones it skipped. The card opens with the sentence, the
picture's own numbers, and the standing line *Not real cable or array sizing —
consult a design engineer.*

**Pulse and cage.** The pulse runs along the string in the order the cable
does, so you watch the route being made rather than being told about it. The
cage is the string.

**Try changing one thing:** `"routing":"one-after-another"` draws the same row
wired in order, and the long cable that has to come back from the far end
appears. That single cable is the whole argument for leapfrog, drawn rather
than argued.

**It does not tell you** what to buy. Nothing here is measured; the numbers are
estimates from a model, and the page says so on every card.

**Screenshot:** `manual-shots/0091-s16-string-leapfrog.png`

---

## 10. Draw a whole inverter block

**Open:** `kuiper-grid/i0091/`

**Type:**

```
fire block {}
```

**First five seconds.** Not one string but every string on one inverter:
twenty-four of them, each drawn with its own pair of home runs landing on its
own named inverter input. This is the richest picture in the set and takes the
longest to settle.

**Pulse and cage.** The pulse fills the block string by string. The cage is the
block boundary; the inverter inputs sit on it, named, so you can follow any one
string from module to terminal.

**It does not tell you** whether the block is buildable. Nothing here is
measured. The same standing line — *Not real cable or array sizing* — is on
this card too.

**Screenshot:** `manual-shots/0091-s18-block.png`

---

## Tried and not working yet

Honest list, from the same run:

- **Tapping a station on the map to open its card** — the map draws and the
  typed commands cage correctly, but opening a station's card by tapping it did
  not complete on the phone-sized screen. Use simulation 2 instead.
- **`neighbours` and `pulse` typed on i0090** — offered in the pop-up list, but
  no command of that name runs yet. The card says so plainly rather than
  drawing something wrong.
- **`outage <station>` typed on i0090** — no outage command runs yet; the bar
  falls through to a text search and finds nothing.
- **`systems` and `system single line diagrams` typed on i0086** — the words
  appear in the pop-up list but nothing is registered behind them yet.

These, and everything else known to be unfinished, are written up in
`ISSUES-NEXT-WEEK.md` alongside this manual.

---

## Attribution and licence

Contains open map data (c) OpenStreetMap contributors, available under the Open
Database License (ODbL) v1.0; any derived database is shared alike.
https://www.openstreetmap.org/copyright

Code: Apache-2.0. No warranty is given.
