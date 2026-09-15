# Generator device review — 15 September 2026

## Decision

**Full device acceptance remains open.** All 12 measured lens/viewport cases, both selected-key coordination runs and the compose recipe checks completed with zero console/page errors and no horizontal overflow. Two requirements fail:

- Every 430 px case has a 96 × 32 px root breadcrumb; the grammar requires 44 px targets.
- Forcing WebGL2 unavailable raises `G.setLit is not a function` before the fallback paints.

These failures are recorded in `assessment.json` with `pass: false`. The owner script has no native pass field. The portable wrapper adds functional assertions; `proof/bench.json` reports only that narrower functional result as true. This review does not change the Generator.

## Source and measurement

Source commit: `7edc6fbd7f2d19397c6106371e3ce8de0f8c8a5d`.
Owner harness: `testcode/202609142225/proof/bench.mjs`, SHA256 `ecf835fba11e293d5aac82c18a3eac38db77def617ae4b0d7a20325f55a9f5e0`.
Started: **2026-09-15T05:03:12.168Z**.
Chrome: **153.0.8010.37**.
Renderer: **ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)**.

1440 × 900 uses DPR1 and mouse interaction. 430 × 900 uses DPR2 and desktop touch emulation. Each row samples requestAnimationFrame for four seconds idle and four seconds during drags/taps; p95 is the 95th percentile of frame intervals. First GL draw ranged from 74.8 to 576.9 ms. These are short desktop measurements, not a physical phone, sustained thermal or 1 GB device test.

| Lens | Width | Idle FPS | Idle p95 ms | Active FPS | Active p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| ring | 1440 | 168.6 | 6.1 | 168.9 | 6.1 |
| particle | 1440 | 169.6 | 6.1 | 169.4 | 6.1 |
| chord | 1440 | 169.6 | 6.1 | 171.3 | 6.1 |
| river | 1440 | 169.2 | 6.1 | 168.7 | 6.1 |
| table | 1440 | 168.6 | 6.1 | 166.5 | 6.1 |
| column | 1440 | 168.8 | 6.1 | 169.2 | 6.1 |
| ring | 430 | 169.6 | 6.1 | 168.9 | 6.1 |
| particle | 430 | 169.2 | 6.1 | 168.7 | 6.1 |
| chord | 430 | 168.5 | 6.1 | 169.2 | 6.1 |
| river | 430 | 169 | 6.1 | 169 | 6.1 |
| table | 430 | 168.1 | 6.1 | 166.5 | 6.1 |
| column | 430 | 168.7 | 6.1 | 167.8 | 6.1 |

The original harness also samples an NVIDIA GPU. That is a different device from the Intel renderer, so those utilisation figures cannot describe renderer utilisation.

## Publication and limits

The current served Generator grammar matches committed SHA256 `53a290e62c1f47b5d621899623b0c048a29d45d77d6f7464bfc757900eb79ecb`.
[Night tests 34931327051](https://github.com/Ventusltd/globalgrid2050/actions/runs/34931327051) passed 54 checks with no warnings or skips after the relevant deployment finished. This does not cover physical-device or no-WebGL2 acceptance.

See [README](README.md) for reproducible commands and [assessment.json](assessment.json) for the combined gate. The measurements retain the owner's calculations; configuration paths and output ownership are supplied through environment variables.
