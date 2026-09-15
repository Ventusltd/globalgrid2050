# The Line Wafer — testcode/202609151339

Every line of code in the estate that carries a permanent number, on one surface, at one time.

Open the page: `index.html`. Open the proofs on a phone: `proof/`.

## What it is

250,174 lines are numbered 1 to 342,795. The number is the line's permanent key: it never changes and it is never reused, and numbers missing from the sequence were never issued. This page draws all of them, and draws the gaps as gaps.

A point's position is a pure function of its own number and of nothing else:

```
r = sqrt(key)        theta = key x 2.39996...      (the golden angle)
```

So line 8,285 is in the same place on every device, in every session, for ever. Nothing about a position is stored, fetched or remembered, which is what makes the surface unbounded rather than merely large: when the estate issues line 400,000 tomorrow, the wafer already has somewhere to put it.

## The rule it exists to meet

It must be able to connect any two uniquely numbered lines in the estate. Type two numbers and it answers: the function families that carry both, or a refusal naming which of the two is carried by no family at all. 46,680 of the numbered lines are carried by more than one family; those are the ones that have anything to be joined to.

## What a connection means, and what it does not

A shared line number means two families contain the same line of text. It does not mean one calls the other, and it is not a dependency. The most-shared line in the estate is line 2, an empty line, carried by 2,281 families. Triviality is drawn rather than hidden: a line's connection count is printed, so the meaningless connections look exactly as meaningless as they are.

## Reading the picture

The banding is real and it is not decoration. Bright rings are stretches of consecutive numbers where nearly every line is carried by a function family; dark rings are stretches where nearly none is. Because numbers were issued in order, a ring is a period in the estate's history, and the strata are the record of how it was built.

## Data

Read at run time from `../202609142202/data/`, never typed into the page:

| file | what it carries |
|---|---|
| `all-lines.meta.json` | the numbering's own provenance: source, sha256, counts, built time |
| `all-lines.bin` | 250,174 sorted permanent line numbers |
| `all-lines.len.bin` | characters in each line |
| `all-lines.family.bin` | whether any family carries that line |
| `families.json` | 10,985 function families, each with a range into `lines.bin` |
| `lines.bin` | 664,940 line numbers in family order |

The first four are loaded before the first paint; the last two arrive after it, and until they do the page says so rather than guessing.

## State

The whole of it is in the URL, in permanent numbers only:

```
?line=<n>            fly the beam to that number
?line=<n>&to=<m>     connect two numbers
```

No names and no personal data travel in a link.

## Proofs

`proof/` holds the same checks in two forms, so the claims above can be tested by anyone on any device:

- `proof/index.html` runs them in the browser, against the live data, and prints each one. It is meant to be opened on a phone.
- `proof/wafer.check.mjs` runs them under Node with no browser, for CI.

Both read the same bytes the page reads and compute every number rather than asserting it.

## What is claimed

- Every number drawn is read from the numbered database at run time.
- Every count printed is computed from that data in the browser.
- A line with no family is told it has no family. A number never issued is told it was never issued.

## What is not claimed

- That a shared line is a dependency, a call, or a reuse worth acting on.
- That the arrangement means anything physically. It is an address scheme chosen so that a number is a place.
- Nothing here has been measured on a physical phone. It was built at 430 px and checked at 430 px and 1400 px in a headless browser on one machine.
