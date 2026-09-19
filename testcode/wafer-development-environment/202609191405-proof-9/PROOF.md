# Proof 9: the night bench. A hundred iterations locally, tested with nobody watching

`tools/iterate.py new | test | rank`. An iteration lives on a local drive and nowhere else until it has earned its place: it is served from its own folder, its self tests run in headless Chrome, its data is re-summed, every file is checked against the private digests and every script is parsed. The score is made only of things that passed or failed. There is no point for looking good: eyes are for the ten that survive, not for the hundred. Nothing in the iteration folder is ever committed.

## Measured

- Headless Chrome ran the WebGL period self test unattended: `selftest PASS` in about one second.
- The baseline iteration, the engine exactly as published, scores **4 of 5**, not 5. The period test passes; the new-code test never finishes headless, because it waits on real animation frames that virtual time does not advance. The bench gave it nothing, which is correct, and that is the first job for whoever runs the bench tonight: in self test mode, skip the animation and evaluate at once.

A bench that flatters its baseline is worth nothing. This one failed its own engine on the first run.

Provided as is, without warranty of any kind; a chart, not a design.
