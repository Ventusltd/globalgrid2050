# Sun and sky (layer pack)

A world layer pack (`world.pack.v1`, kind `sim`) that shows where the sun is for a place and a moment, and what that
means on the ground. Everything it shows is **illustrative**. It assumes a clear sky. It does not model clouds, haze,
nearby objects or the world's own buildings.

## How this helps our 3D worlds

- **Time you can type or scrub.** Type `sun 21 dec 12:00` and the world shows that moment. You can also step with
  `sun +1h` or the keys `Shift+n` and `Shift+m`, jump with `sun rise`, `sun noon` or `sun set`, or play with
  `sun play 60` (60 minutes of sun time per second).
- **The day at a glance.** The pack draws the sun's path over the day on a dome around the viewer, with hour ticks and
  a sun ray. It also draws ground lines towards sunrise, solar noon and sunset.
- **Shadow on real ground.** A grid of points around the viewer is ray cast towards the sun over the world's own
  ground (`heightAt`). Points that a hill or bank hides from the sun are marked. The HUD counts them.
- **Shadow of mounting tables.** Tables given in the world's config are outlined, and their shadow outlines are cast
  onto the terrain for the current moment.
- **Light on a plane.** Clear-sky global, beam and diffuse irradiance, plus irradiance on a plane you set with
  `sun plane 30 180`.
- **Other packs can use it.** The pack emits `sun/position` `{ utcMs, azimuth, elevation, direction, up }` and
  `sun/irradiance` `{ ghi, dni, dhi, poa, tilt, azimuth }`, so a lighting, drone or build pack can follow the sun
  without reading this pack's objects.
- It asks for frames only while playing. When the sun is still and the viewer is still, the world can draw nothing (0 fps).

## Commands and keys

| Typed | Does |
|---|---|
| `sun 21 dec 12:00`, `sun 2026-12-21 09:30`, `sun 14:00`, `sun 3 jun` | Set local date, time or both (the year is kept if not given) |
| `sun +1h`, `sun -30m`, `sun +2d` | Move the time |
| `sun rise`, `sun noon`, `sun set` | Jump to that moment on the current day |
| `sun play 60`, `sun play -10`, `sun stop` | Play at minutes per second (fixed steps), or stop |
| `sun plane <tilt> <azimuth>` | Set the reference plane (degrees; azimuth clockwise from true north, 180 is south) |
| `sun at <lat> <lon>` | Set the place in degrees |
| `sun turbidity <TL>` | Set the Linke turbidity, 1 to 10 (default 3) |
| `sun` | Report the current moment |
| `Shift+n` / `Shift+m` | One hour later / earlier |

## Configuration (from the world's pin)

```json
{ "id": "sun", "from": "./packs/sun/", "version": "1.0.0", "sha256": "<entry hash>",
  "config": { "crs": "EPSG:27700", "timeZone": "<IANA zone>", "elevation": 60, "linkeTurbidity": 3,
              "plane": { "tilt": 30, "azimuth": 180 },
              "tables": [{ "x": 10, "y": 20, "length": 20, "width": 4, "tilt": 20, "azimuth": 180, "height": 0.8 }] } }
```

| Key | Meaning (default) |
|---|---|
| `lat`, `lon` | Place in degrees. If they are not given and `crs` is `EPSG:27700`, the place comes from the world origin (`api.origin()` and `world/origin`). Otherwise 52, 0 is used and the HUD says the place is not set |
| `utcOffset` or `timeZone` | Local time as fixed hours from UTC (0), or an IANA zone name when the host has `Intl` |
| `utcMs` | Starting moment (default 21 June 2026, 12:00 local) |
| `elevation`, `pressure`, `temperature`, `deltaT` | Site altitude m (0), hPa (1010), C (10), Delta T s (from the polynomials) |
| `linkeTurbidity`, `albedo` | Clear-sky turbidity (3) and ground reflectance (0.2) |
| `gridConvergence` | Degrees from true north to the world's +y axis. Computed to first order for `EPSG:27700`, otherwise 0 |
| `shadowGrid`, `shadowSpacing`, `shadowReach` | Shadow grid nodes per side (24, at most 36), spacing m (8), ray length m (400) |
| `tables` | Up to 64 tables `{ x, y, length, width, tilt, azimuth, height }` in local metres and degrees. The long edge runs across the facing azimuth, and `height` is the low edge above the ground |

## Methods and sources

| What | Method |
|---|---|
| Solar position | I. Reda and A. Andreas, *Solar Position Algorithm for Solar Radiation Applications*, NREL/TP-560-34302 (2003, rev. 2008). Written in our own code from the paper's equations and published coefficient tables. The stated uncertainty is 0.0003 degree |
| Delta T | F. Espenak and J. Meeus polynomial expressions (2006) |
| Sunrise and sunset | The time when the topocentric true elevation crosses -0.8333 degree, scanned every 10 min and refined to 1 s. Noon is when the hour angle crosses zero |
| Clear sky | P. Ineichen and R. Perez, Solar Energy 73(3) 151-157 (2002), without the optional high-air-mass term. Air mass from F. Kasten and A. T. Young, Applied Optics 28(22) (1989). Pressure from altitude uses ISO 2533. Solar constant 1361 W/m2 |
| Plane irradiance | Beam plus isotropic sky diffuse plus ground reflection (B. Y. H. Liu and R. C. Jordan, 1963) |
| Grid to latitude and longitude | Transverse Mercator inverse series and a seven-parameter Helmert shift, EPSG:27700 to EPSG:4326, accurate to a few metres |

## What the tests show, and what they do not

- **Checked against published figures.** The paper's worked example (Table A5.1) matches to 1e-5 degree for zenith,
  azimuth and incidence, and to 1e-8 for L, B and R. This shows the coefficient tables were transcribed correctly.
  Sunrise matches the paper within 5 s. The transverse Mercator inverse matches the published worked example to 2e-8 degree.
- **A known gap.** The paper gives sunset for the example as 17:20:19. This pack gives 17:18:51. An independent
  method (the NOAA solar calculator equations) also gives 17:18:50. The paper's rise and set routine interpolates
  over the UT day, and this sunset falls after 00:00 UT. That is our reading of the gap, and it is not proven.
- **Consistency checks only, not validation.** For the clear-sky model, the tests check that global equals beam times
  cos(zenith) plus diffuse, that values stay below the top-of-atmosphere limit, that they vary with turbidity in the
  right direction, and that high-sun values are plausible. They have not been compared with measured irradiance or
  with another implementation.
- **Geometry.** A ridge shades the ground behind it. Flat ground has no shade. The shadow of a flat table is offset by
  height / tan(elevation).

## Files

| Path | What it is |
|---|---|
| `pack.json` | The contract |
| `src/sun.mjs` | The entry: one self-contained module with no imports. Its maths is also exported by name for the tests |
| `tests/sun.test.mjs` | Conformance plus the checks above |
| `tests/_testkit/` | The vendored test kit |
| `catalogue.json` | This pack's entry for the shared catalogue |

## Run the tests

```
node tests/_testkit/stamp.mjs . --check
node --test
```

## Licence

The code is Apache-2.0. The pack holds no third-party data. The published coefficients of the solar position
algorithm are physical constants quoted from the cited report.
