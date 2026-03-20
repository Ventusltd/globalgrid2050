# Maximum Conductor Resistance Table

## Scope

This table applies to stranded circular compacted conductors (Class 2), including aluminium.  
Solid conductors (Class 1) have higher permissible resistance and must be verified separately against IEC 60228 Table 1.  

Sectorial, Milliken or other non-circular conductor geometries are not directly represented and may vary significantly.

---

## Basis

20°C values align with IEC 60228 limits.  

Values at 90°C are consistent with manufacturer published DC resistance at maximum operating temperature and reflect typical operating behaviour of conductors under load.  

Manufacturer and utility datasheets confirm that conductor resistance at maximum operating temperature, approximately 90°C, is typically approximately **1.27 to 1.28 times** the resistance at 20°C.  

The values presented here represent **DC resistance only**.

---

## Conductor Resistance and Diameter

- Copper temperature factor from 20°C to 90°C: **1.2751**  
- Aluminium temperature factor from 20°C to 90°C: **1.2821**  

| Nominal Area (mm²) | Typical Conductor Diameter (mm)\* | Copper @ 20°C (Ω/km) | Copper @ 90°C (Ω/km) | Aluminium @ 20°C (Ω/km) | Aluminium @ 90°C (Ω/km) |
|--------------------|-----------------------------------|----------------------|----------------------|--------------------------|--------------------------|
| 0.5 | — | 36.0 | 45.9036 | — | — |
| 0.75 | — | 24.5 | 31.2399 | — | — |
| 1.0 | — | 18.1 | 23.0793 | — | — |
| 1.5 | — | 12.1 | 15.4287 | — | — |
| 2.5 | — | 7.41 | 9.4485 | — | — |
| 4 | — | 4.61 | 5.8782 | — | — |
| 6 | — | 3.08 | 3.9273 | — | — |
| 10 | — | 1.83 | 2.3334 | 3.08 | 3.9489 |
| 16 | — | 1.15 | 1.4664 | 1.91 | 2.4488 |
| 25 | — | 0.727 | 0.9270 | 1.20 | 1.5385 |
| 35 | — | 0.524 | 0.6682 | 0.868 | 1.1129 |
| 50 | 8.2 | 0.387 | 0.4935 | 0.641 | 0.8218 |
| 70 | 9.9 | 0.268 | 0.3417 | 0.443 | 0.5680 |
| 95 | 11.4 | 0.193 | 0.2461 | 0.320 | 0.4103 |
| 120 | 12.9 | 0.153 | 0.1951 | 0.253 | 0.3244 |
| 150 | 14.0 | 0.124 | 0.1581 | 0.206 | 0.2641 |
| 185 | 16.4 | 0.0991 | 0.1264 | 0.164 | 0.2103 |
| 240 | 18.0 | 0.0754 | 0.0961 | 0.125 | 0.1603 |
| 300 | 20.5 | 0.0601 | 0.0766 | 0.100 | 0.1282 |
| 400 | 23.7 | 0.0470 | 0.0599 | 0.0778 | 0.0997 |
| 500 | 26.4 | 0.0366 | 0.0467 | 0.0605 | 0.0776 |
| 630 | 30.1 | 0.0283 | 0.0361 | 0.0469 | 0.0601 |
| 800 | — | 0.0221 | 0.0282 | 0.0367 | 0.0471 |
| 1000 | — | 0.0176 | 0.0224 | 0.0291 | 0.0373 |
| 1200 | — | 0.0151 | 0.0193 | 0.0247 | 0.0317 |
| 1400 | — | 0.0129 | 0.0164 | 0.0212 | 0.0272 |
| 1600 | — | 0.0113 | 0.0144 | 0.0186 | 0.0238 |
| 1800 | — | 0.0101 | 0.0129 | 0.0165 | 0.0212 |
| 2000 | — | 0.0090 | 0.0115 | 0.0149 | 0.0191 |
| 2500 | — | 0.0072 | 0.0092 | 0.0127 | 0.0163 |

\* Typical conductor diameters shown only where manufacturer data has been directly checked.  
For all other sizes, actual conductor diameter must be taken from the specific manufacturer datasheet for the exact conductor construction.

---

## Technical Notes

- Aluminium conductors: minimum **10 mm²** in IEC 60228  
- Base temperature: **20°C**  
- 90°C values represent conductor resistance at maximum continuous operating temperature  
- Actual operating temperature varies depending on installation method, grouping and loading  
- Resistance at operating temperature is used implicitly in voltage drop and current rating calculations  
- Manufacturer data at 90°C may also be expressed as AC resistance including additional effects such as skin and proximity  
- Temperature correction is based on material behaviour referenced at 20°C  

---

## Conductor Geometry and Application Limits

- Conductor diameters must always be verified against actual manufacturer datasheets prior to design or installation  
- Sectorial, compacted, shaped or Milliken conductors may differ significantly from circular assumptions  
- Large conductors, typically **1000 mm² and above**, are commonly of Milliken or segmented construction  
- Incorrect geometric assumptions can result in termination failure, overheating and fire risk  

---

## Terminations and Installation Risk

- Always confirm compatibility of lugs, glands and accessories with both cable manufacturer and accessory manufacturer  
- Aluminium conductors require **bimetallic terminations** to reduce galvanic risk  
- Shear bolt connectors and lugs should be:
  - type tested
  - suitable for conductor construction
  - compliant with relevant distribution network operator requirements

- Crimping aluminium conductors carries elevated risk due to:
  - oxide layer formation
  - incorrect tooling
  - poor compression control

- Sectorial and Milliken conductors further increase termination risk and require specialist handling and design validation  

---

## Disclaimer

The values presented in this table are **DC conductor resistance values only** and are provided for general technical reference.

They do not represent AC resistance, reactance, impedance or full system electrical behaviour.  
AC electrical parameters must be determined separately using proven calculation software, validated manufacturer data and project specific installation conditions.

All values must be independently verified against applicable standards, manufacturer data and by appropriately qualified professionals prior to use.

Where required by project risk, contract, insurer or regulation, manufacturer confirmation and sign off by a suitably qualified Chartered Electrical Engineer should be obtained. Records of calculations, design responsibility, approvals and relevant professional indemnity insurance should be retained as part of the project documentation.

This table has been cross checked against manufacturer datasheets and utility documentation, including UK Power Networks technical schedules. However, no liability is accepted for the correctness, completeness or application of the data.

---

<sub>Reference basis: IEC 60228 conductor resistance values at 20°C, checked against manufacturer and utility documentation where available.</sub>
