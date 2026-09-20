> Release 202609202048 (20 September 2026, 20:48 BST). Builds i0073, i0083 to i0091. Issues as known at this release.

# Issues to fix next week

Ventus Ltd. This is the trail left with the ten published simulations: what we
know is wrong, how to see it for yourself, and what would count as fixed. It is
written from the checks run on the builds that are published here. Most
important first.

---

### 1. The local-system view is drawn from example data

The one-station local view draws an invented site, not a real one. The names
carry the word *(fixture)* so nobody mistakes it, but real data is not wired
into that view at all: the identifiers used by the map have never been matched
to the identifiers used by the local systems.

**See it:** open i0089, type `fire local`. Every name offered ends in
*(fixture)*.

**Done when** the same command lists at least one real station, the view draws
it end to end, and any part that is still an example is labelled on the card.

---

### 2. The open map data at 33 kV is too thin for complete local systems

At the lower voltage the open source carries the voltage label and almost
nothing else: no circuit counts, no cable descriptions across thousands of
spans. Median completeness of a local system built from it is zero. More
processing will not fix this; the input is the limit.

**See it:** open i0089, cage any station and set the voltage class low. The
picture thins out to almost nothing.

**Done when** a decision is written down and acted on: either show the lower
voltage honestly as partial everywhere it appears, or adopt a better source
whose licence has been checked as compatible with publishing a redrawn public
map.

---

### 3. Joining lines to stations still guesses about a quarter of the joins

A station is an area, not a point, and a line that passes near one is not
necessarily joined to it. Roughly a quarter of the joins in the drawing are
inferred rather than read. Hundreds of the touched stations are pass-by only.

**See it:** open i0090, type `fire substation {"site":"Barking"}`. The card
says four of twenty values are assumed.

**Done when** the assumed fraction is printed on every view that uses joins,
the dashed styling is applied consistently, and the fraction itself falls
below one in ten for the stations shown in the published simulations.

---

### 4. The cold-voltage check shows two readings and no pass

The string voltage at the coldest design temperature is computed two ways and
the two do not agree on direction; the temperature allowance was applied the
wrong way round in one of them, and the coefficient behind it has not been
confirmed against a published datasheet clause.

**See it:** open i0091, fire any string preset and read the voltage lines on
the card.

**Done when** the clause is confirmed in writing, one reading is shown, and no
word resembling a pass or a margin appears until it is.

---

### 5. Solar home runs cross module backs on two-row layouts

On layouts two or more modules high, the cables that bring both ends of the
string home are drawn across the backs of modules instead of along the
structure. The drawing is wrong about where the cable physically goes, which is
the one thing the picture exists to show.

**See it:** open i0091, type
`fire string {"mounting":"tracker","modules_high":2,"routing":"serpentine"}`
and follow the two home runs from the far end.

**Done when** both home runs are drawn along the structure on every layout with
more than one row, and a reader who has wired a string says the route is what
they would build.

---

### 6. Voltage colours and phone text wrapping on the substation view

On the substation view the key line and the attribution line each run as one
unwrapped line and are clipped at both edges of a phone screen, so the
share-alike credit is not legible. Several buttons render broken characters, a
text-encoding fault. Voltage colours have no key on some views.

**See it:** open i0090 on a phone-sized screen and read the lines under the
picture.

**Done when** every line on that view wraps and is readable at 390 pixels wide,
the attribution is legible in full, no broken characters appear on any button,
and a colour key is present wherever lines are coloured by voltage.

---

### 7. Outage wording describes the drawing, not the network

Anything that removes a link and reports on what is left is describing a
picture drawn from incomplete open data. Said plainly, it is not an outage
study, and the word must not appear in a command name or a result.

**See it:** open i0090 and type `outage` with a station name. Nothing runs, and
that is currently the only reason the wrong claim is not made.

**Done when** any such feature is named and worded as a property of the drawing,
carries the incompleteness on the same card, and no result uses the words
capacity, headroom, outage or risk.

---

### 8. Tapping a station on the map does not open its card

The map draws and the typed commands cage correctly, but tapping a station on a
phone-sized screen did not complete: the route from a tap to a cage and a card
fails inside the drawing layer. Typing the station name works.

**See it:** open i0089, type `fire grid`, then tap a lit station.

**Done when** a tap on any station on a phone throws the cage and opens the
card, with no error, in the same way typing the name does.

---

### 9. Commands offered in the pop-up that do not exist

The pop-up lists words behind which nothing is registered. Choosing one gets an
honest refusal rather than a wrong picture, but a menu that offers what it
cannot do is a defect.

**See it:** open i0090 and type `neighbours`, or `pulse`. Open i0086 and type
`systems`. Each answers that no such command runs here yet.

**Done when** the pop-up lists only commands that run on the build you are
looking at.

---

### 10. Only 70 of 200 build jobs are green

Of two hundred registered checks across twenty areas, seventy have run green.
Forty-nine ran red. Seventy-nine have never been run at all: the determinism,
guard, refusal and full-run checks. Exactly one area of twenty is green on
every facet it has run. Compiling is not passing.

**See it:** the run report that accompanies each build.

**Done when** every registered check has been run at least once, the never-run
group is empty, and the red list has been triaged into fix, rewrite or retire,
each with a name against it.

---

### 11. The code index cannot see across languages

The index that is supposed to stop us rebuilding what we already own keys on
spelling. A formula rewritten in a different language shares no line with its
original, so the index reports nothing. That is exactly how a proven library
was rebuilt from scratch in another language this week.

**See it:** search the index for an engineering term written in one language
and note that the equivalent module in another does not come back.

**Done when** one flat index lists every module in every language with its
name, inputs, outputs and its proof file, and one search on an engineering term
finds all of them.

---

### 12. Distance was rewritten three times in one week

Great-circle distance was written afresh in three separate places while working
implementations already existed in the shared library. Only a tiny fraction of
the new grid code echoes anything already owned.

**See it:** compare the distance helpers in the grid code against the shared
library.

**Done when** the duplicates are deleted and every caller uses the one proven
implementation.

---

### 13. The line data contains a duplicated copy of itself

Close to a quarter of the spans in the open line data are nudged copies of
other spans: over seven thousand spans, roughly fourteen thousand kilometres.
Every count taken over the raw data is inflated by that much.

**See it:** any count of total line length taken before de-duplication.

**Done when** one copy is kept whole, the other dropped whole, the rule is
written down, and every published count is taken after the drop.

---

### 14. A line's name is a hint, not a join

Where a span is named as running between two places, only about one in nine has
both of its ends anywhere near the two stations named. Reading names as joins
would invent connections.

**See it:** compare the named ends of a span against the positions of the
stations it names.

**Done when** names are used only as a hint to be confirmed, never as evidence
of a join, and the code says so where it is used.

---

### 15. A check that reached nothing reported a perfect result

A resilience check reported a flawless result over the whole estate while
actually seeing zero load points. It was withdrawn by the person who wrote it.
The code still does not refuse when it is handed nothing.

**See it:** run any such check against an empty selection and read the result.

**Done when** every check refuses loudly on an empty input instead of returning
a pass, and a test proves it.

---

### 16. Outcome sampling is not finished

A run of thirty thousand cases produced only a couple of hundred distinct
outcomes, and the only rule anyone could state about them is that they are not
all the same. That is not a finished analysis and must not be quoted as one.

**See it:** the distinct-outcome count printed alongside the case count.

**Done when** either the sampling is finished and the outcome space is
described, or the work is parked and nothing quotes its numbers.

---

### 17. One honest local system, end to end

Of the primaries in the data, only a small minority trace all the way back to a
source. The right next step is one of them, drawn completely, rather than eight
hundred shaky ones.

**See it:** the completeness figure printed for a local system.

**Done when** one real local system is drawn source to ticket, photographed on
a phone, and a non-engineer can say where the power comes from; every other
system carries the plain label *data incomplete* rather than a guess.

---

### 18. Station names are cut with dots on phone screens

On the local and substation views, station and outgoer names are truncated with
ellipses, and captions overlap the boxes they belong to. Names must be set on
two lines rather than clipped.

**See it:** open i0089 on a phone, type
`fire local {"station":"Hartmoor (fixture)"}`, and read the outgoer names.

**Done when** no name on any published view is truncated at 390 pixels wide.

---

### 19. Chips from one subject appear on pages of another

Preset chips belonging to the solar cartridge appear along the top of grid
pages, where they mean nothing and fire commands the page does not explain.

**See it:** open i0086 or i0090 and read the chips along the top.

**Done when** each page shows only the presets of the cartridge it is running.

---

### 20. The menu build leads to pages that have not passed

A menu that offers routes into views which have not themselves passed their own
checks inherits their status. Until each destination passes, the menu cannot be
called ready.

**See it:** open i0086 and follow any route out of it.

**Done when** every destination reachable from the menu has passed its checks,
and the menu hides the ones that have not.

---

### 21. Build numbers changed without the builds changing

Two published build numbers were issued whose change lists are empty: they are
earlier builds under new numbers. A number that does not mean a change makes
the whole trail untrustworthy.

**See it:** compare the change list attached to each build number.

**Done when** a build number is only issued for a real change, and the change
list is published with it.

---

### 22. A development banner is covered by a chip

On at least one view the red development banner, which is the honest warning
that the page is not a design tool, is partly covered by a preset chip on its
second line.

**See it:** open the local view on a phone and look at the top left.

**Done when** nothing overlaps the banner on any screen width and both lines
read in full.

---

### 23. Nothing about the engine's speed is published, and should not be

Timings taken on one machine, on one browser, on one set of example data, are
not properties of the engine. They must not appear on a public card.

**See it:** read any card for a number describing how long something took.

**Done when** no public view quotes a timing, or quotes one only with the
conditions it was taken under printed beside it.

---

### 24. The published word list is not enforced automatically

The rule that certain words must not appear in public text — capacity,
headroom, outage, risk, measured — is currently checked by reading. It needs to
be a check that runs before anything is published.

**See it:** read any published page and look for those words.

**Done when** a check refuses to publish a page containing them, and the check
is part of the ordinary publishing route.

---

### 25. The attribution must survive every layout

The open map data credit and the share-alike condition are a licence
obligation, not decoration. On at least one view they are clipped at both edges
of a phone screen, which means the obligation is not met on that view.

**See it:** open i0090 on a phone and read the credit line.

**Done when** the credit and the share-alike sentence are complete, wrapped and
legible on every published view at 390 pixels wide, and a check enforces it.

---

Contains open map data (c) OpenStreetMap contributors, available under the Open
Database License (ODbL) v1.0; any derived database is shared alike.
https://www.openstreetmap.org/copyright

Code: Apache-2.0. No warranty is given.
