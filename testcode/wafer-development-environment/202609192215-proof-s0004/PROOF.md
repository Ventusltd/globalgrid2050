# Iteration 0004

# 0004 — the page says what it is, in plain words

INTERIM. Six faults of eight are fixed, and this iteration carries 0001, 0002 and 0003. Not yet a page
to hand to a stranger on a phone: the buttons are still about half the size a finger needs, and on a
phone the card and the menu still take the room the drawing should have.

## What this surface is

Twelve views drawn from public network data: the grid at 400 kV and 132 kV, substations, a solar farm
connection, an underground route, a cable trench, the British Isles, the world, and a fault study.
Every view is drawn at the moment you ask for it; nothing on the screen is typed in by hand.

## What changed here

Every view now opens with a card that says, in three short sentences, what you are looking at, what
it is for, and what it is not:

> **The grid.** Britain’s 400 kV and 132 kV lines and its substations, drawn from public data. See
> what runs near a site and where it could connect. An estimate from public data, not a study.

> **A fault study.** The fault current paths in a published example network. See which lines carry
> the most current when a fault happens. An estimate from public data, not a study.

Before this, all twelve views opened with a folded frame, a title cut off mid word, and not one
sentence under it. The words now go up before the drawing assembles, not after it, because they are
what a reader came for. Whoever published the data is credited on the card.

## What is still wrong on this page

- On a phone the credit line sits below the fold of the card: it is there, and you have to scroll the
  card to reach it. On a desktop it is in plain sight.
- Buttons are about half the size a finger needs.
- On a phone the drawing uses about a third of the screen.

## What it is not

Provided as is, without warranty of any kind; a chart, not a design. An estimate from public data, not
a study. Check every claim on the page itself.

## Tested unattended before publishing

Score 6 of 6, checked in 24 views at two screen widths on 19 September 2026 at 22:49.

- `F1`: the line saying what this is not can be read in every view, on a desktop and on a phone
- `F4`: the page says one plain sentence about what it is doing, in a box, never wider than the screen
- `F2`: every button, box and chooser can be pressed where a reader presses it
- `F3`: on a phone nothing at the top of the screen is written over anything else
- `F8`: nothing is on the page that a reader cannot see and cannot reach
- `F5`: the card says in plain sentences what this is, what it is for and what it is not

Built and tested locally, published by a Python timer with no assistant in the loop.
Provided as is, without warranty of any kind; a chart, not a design.
