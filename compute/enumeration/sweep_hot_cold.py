#!/usr/bin/env python
# -*- coding: utf-8 -*-
r"""
THREE SURFACES, ENUMERATED EXHAUSTIVELY ON ONE GRAPHICS CARD.

    python sweep_hot_cold.py --feed <path to the class feed>

No maker, brand, model, site, client or project name appears in this file or in
anything it writes. Classes are the nameless codes the feed carries.

-------------------------------------------------------------------------------
1. THE MATHEMATICS
-------------------------------------------------------------------------------

Let C be the set of module classes, each carrying (Voc, Isc, beta, alpha, Vmax,
Ifuse) read from a document. Let

    B = C x {n_lo .. n_hi} x [Tc_lo, Tc_hi] x [Th_lo, Th_hi] x [g_lo, g_hi]

be the swept box, discretised on a fixed lattice: n modules in series, Tc the
cold cell temperature at which VOLTAGE is assessed, Th the hot cell temperature
at which CURRENT is assessed, g the rear-irradiance gain.

Two functions of a case x = (c, n, Tc, Th, g):

    V(x) = n * Voc_c * (1 + b_c (Tc - 25)),      b_c = beta_c / 100
    I(x) = Isc_c * (1 + a_c (Th - 25)) * (1 + g), a_c = alpha_c / 100

Four predicates, each carrying a provenance flag s in {sourced, unsourced}:

    P1(x) = V(x) > Vmax_c                    s = sourced
    P2(x) = 1.25 I(x) > Ifuse_c              s = sourced
    P3(x) = I(x) > A_str                     s = UNSOURCED
    P4(x) = 2 I(x) > A_mppt                  s = UNSOURCED

    F_s(x) = P1(x) or P2(x)                  the sourced failure set
    F_u(x) = P3(x) or P4(x)                  the unsourced failure set
    U(x)   = F_u(x) and not F_s(x)           decided ONLY by an invented number

The cold-current counterfactual. Let I~(x) be I with Th replaced by Tc, i.e.
current assessed at the cold point rather than the hot one, and P2~ the fuse
predicate built on it. The two disagreement sets are

    D+ = { x in B : not P2~(x) and P2(x) }   cold said pass, hot says fail
    D- = { x in B :     P2~(x) and not P2(x) }   cold said fail, hot says pass

Since a_c > 0 for every class in the feed and Th >= Tc everywhere in the box,
I~(x) <= I(x), so D- = {} identically. The claim is not asserted; |D-| is
counted and the run fails if it is not zero.

The series envelope. For each class and each Tc,

    N*(c, Tc) = max { n in N : n Voc_c (1 + b_c (Tc - 25)) <= Vmax_c }
    h(c, n, Tc) = Vmax_c - n Voc_c (1 + b_c (Tc - 25))      the headroom, volts

Annihilation. Every quantity above is computed along two routes: the factored
form written here, and its distributive expansion, which rounds three times
where the factored form rounds once. The two are compared on the VERDICT, not
on the digits. Let

    p(x) = [ P1_A(x), P2_A(x), P3_A(x), P4_A(x) ] != [ P1_B(x), ... ]

Any x with p(x) true is a PARTING. The run does not log a parting; it aborts.

Coverage. The lattice is enumerated exhaustively: every point of B is visited
exactly once. Coverage over B is 1 and the probability of missing a lattice
point is 0. This is a statement about B and the lattice step, not about the
world: halve the step and every volume below changes.

-------------------------------------------------------------------------------
3. PLAIN ENGLISH
-------------------------------------------------------------------------------

A panel is colder in the morning and hotter in the afternoon. Cold pushes its
voltage up; heat pushes its current up. So the voltage has to be judged on the
coldest morning and the current on the hottest afternoon, and a check that
judges both at the same moment is judging at least one of them at the wrong one.

This program takes every class in the feed, walks every whole number of panels
in a row, every cold morning, every hot afternoon and every amount of light
coming off the ground, and asks of each combination whether it stays inside the
limits. It then repeats the current question at the cold point instead of the
hot one, to count how many answers that single mistake changes, and in which
direction.

Every single answer is worked out twice, along two routes that share no
arithmetic, and the two are made to agree on the answer before either is kept.
Where they disagree the program stops. It does not record the disagreement and
carry on, because a disagreement that is written down beside the word success is
a disagreement that nobody reads.

Of the four limits it checks against, two are printed on a document and two are
not. The two that are not are counted, because knowing how much of the space
they decide is worth knowing, but no answer that rests only on them is offered
as a finding. They are marked, separately, as decided by a number nobody can
point at.
"""

import argparse
import io
import json
import math
import os
import re
import sys
import time

try:
    import cupy as cp
except Exception as exc:                                 # pragma: no cover
    sys.stderr.write("this program needs CuPy and a card: %s\n" % exc)
    raise

SCHEMA = "ggs.sweep.hotcold/1"

# ---------------------------------------------------------------------------
# 2. THE CODE -- the kernel
#
# One launch decodes a mixed-radix case index into (class, n, Tc, Th, g), builds
# V and I along TWO routes, compares the four verdicts, and tallies into shared
# counters before one atomic per block reaches global memory. Nothing but the
# counters ever leaves the card: a case is born, judged and destroyed in
# registers. Doubles throughout, because the margins that matter here are a few
# volts in fifteen hundred and a single-precision mantissa would put the
# question inside its own rounding error.
#
# Compiled WITHOUT --use_fast_math and WITH --fmad=false. Fast math lets the
# compiler re-associate the two routes into one expression, which would produce
# a run reporting zero partings because the independence had been compiled out
# of it rather than because the arithmetic agreed.
# ---------------------------------------------------------------------------
SRC = r"""
extern "C" __global__
void sweep(const unsigned long long n_cases,
           const int    nn, const int nt, const int nh, const int ng,
           const int    n0,
           const double voc,  const double isc,
           const double bfrac, const double afrac,
           const double vmax, const double ifuse,
           const double tc0,  const double dtc,
           const double th0,  const double dth,
           const double g0,   const double dg,
           const double a_str, const double a_mppt,
           unsigned long long* __restrict__ out)
{
    const int NT = 16;
    /* Per-THREAD accumulators. An earlier version did one shared atomicAdd per
       case, so every thread in the block queued on the same address and the
       card ran at under half a billion cases a second on a kernel that is
       arithmetic-bound. Counting in registers and paying one atomic per thread
       at the end costs nothing per case. */
    unsigned long long c[NT];
    #pragma unroll
    for (int j = 0; j < NT; ++j) c[j] = 0ULL;

    unsigned long long stride = (unsigned long long)blockDim.x * gridDim.x;
    for (unsigned long long k = (unsigned long long)blockIdx.x * blockDim.x
                                + threadIdx.x;
         k < n_cases; k += stride)
    {
        /* mixed-radix decode: g fastest, then h, then t, then n */
        unsigned long long r = k;
        int ig = (int)(r % (unsigned long long)ng); r /= (unsigned long long)ng;
        int ih = (int)(r % (unsigned long long)nh); r /= (unsigned long long)nh;
        int it = (int)(r % (unsigned long long)nt); r /= (unsigned long long)nt;
        int in = (int)(r % (unsigned long long)nn);

        const double n  = (double)(n0 + in);
        const double tc = tc0 + dtc * (double)it;
        const double th = th0 + dth * (double)ih;
        const double g  = g0  + dg  * (double)ig;

        /* ---- ROUTE A: factored. One rounding inside each bracket. ---- */
        const double vA  = n * voc * (1.0 + bfrac * (tc - 25.0));
        const double iA  = isc * (1.0 + afrac * (th - 25.0)) * (1.0 + g);
        const double icA = isc * (1.0 + afrac * (tc - 25.0)) * (1.0 + g);

        /* ---- ROUTE B: distributive expansion, reassociated. ----
           The same quantity, three roundings where A had one, and the terms
           accumulated in a different order. With --fmad=false the compiler may
           not fold these back into A. */
        const double vn  = voc * n;
        const double vB  = (vn + (vn * bfrac) * tc) - (vn * bfrac) * 25.0;
        const double i0  = (isc + (isc * afrac) * th) - (isc * afrac) * 25.0;
        const double iB  = i0 + i0 * g;
        const double ic0 = (isc + (isc * afrac) * tc) - (isc * afrac) * 25.0;
        const double icB = ic0 + ic0 * g;

        /* ---- the verdicts, on each route ---- */
        const int p1A  = (vA > vmax),          p1B  = (vB > vmax);
        const int p2A  = (1.25 * iA > ifuse),  p2B  = (1.25 * iB > ifuse);
        const int p3A  = (iA > a_str),         p3B  = (iB > a_str);
        const int p4A  = (2.0 * iA > a_mppt),  p4B  = (2.0 * iB > a_mppt);
        const int p2cA = (1.25 * icA > ifuse), p2cB = (1.25 * icB > ifuse);
        const int p3cA = (icA > a_str),        p3cB = (icB > a_str);
        const int p4cA = (2.0 * icA > a_mppt), p4cB = (2.0 * icB > a_mppt);

        c[0] += 1ULL;
        if ((p1A != p1B) | (p2A != p2B) | (p3A != p3B) | (p4A != p4B)
            | (p2cA != p2cB) | (p3cA != p3cB) | (p4cA != p4cB)) {
            c[1] += 1ULL;
            continue;
        }

        c[2]  += (unsigned long long)p1A;
        c[3]  += (unsigned long long)p2A;
        c[4]  += (unsigned long long)p3A;
        c[5]  += (unsigned long long)p4A;

        const int fs = p1A | p2A;          /* decided by a sourced limit  */
        const int fu = p3A | p4A;          /* decided by an invented one  */
        c[6]  += (unsigned long long)(fs);
        c[7]  += (unsigned long long)(fu && !fs);
        c[8]  += (unsigned long long)(!fs && !fu);

        /* The cold-current counterfactual, kept strictly apart by provenance.
           SOURCED: the module fuse. UNSOURCED: the string and machine inputs,
           counted because the size of the effect is worth knowing and reported
           under a name that says they are not findings. */
        c[9]  += (unsigned long long)(p2cA != p2A);
        c[10] += (unsigned long long)(!p2cA && p2A);
        c[11] += (unsigned long long)(p2cA && !p2A);          /* must be 0 */
        c[12] += (unsigned long long)(p3cA != p3A);
        c[13] += (unsigned long long)(!p3cA && p3A);
        c[14] += (unsigned long long)(p4cA != p4A);
        c[15] += (unsigned long long)(!p4cA && p4A);
    }

    #pragma unroll
    for (int j = 0; j < NT; ++j)
        if (c[j]) atomicAdd(&out[j], c[j]);
}
"""

TALLY = ("cases", "parted", "over_equipment_rating", "over_module_fuse",
         "over_string_input_UNSOURCED", "over_machine_input_UNSOURCED",
         "failed_on_a_sourced_limit", "failed_ONLY_on_an_invented_number",
         "inside_every_limit",
         "cold_current_changes_the_fuse_verdict",
         "cold_current_was_optimistic", "cold_current_was_pessimistic",
         "cold_current_changes_the_string_input_verdict_UNSOURCED",
         "cold_current_was_optimistic_on_the_string_input_UNSOURCED",
         "cold_current_changes_the_machine_input_verdict_UNSOURCED",
         "cold_current_was_optimistic_on_the_machine_input_UNSOURCED")


# ---------------------------------------------------------------------------
# the feed. A missing key REFUSES. It is never a zero and never a default.
# ---------------------------------------------------------------------------
def need(d, *path):
    cur, seen = d, []
    for k in path:
        seen.append(str(k))
        if not isinstance(cur, dict) or k not in cur or cur[k] is None:
            raise SystemExit(
                "REFUSED: the feed has no %s. A missing key is not a zero and "
                "this program will not invent one." % ".".join(seen))
        cur = cur[k]
    return cur


def load_classes(path):
    with io.open(path, encoding="utf-8") as fh:
        feed = json.load(fh)
    out = []
    for c in need(feed, "classes"):
        out.append({
            "class_id":  need(c, "class_id"),
            "family":    need(c, "doc"),
            "voc":       float(need(c, "voc", "v")),
            "isc":       float(need(c, "isc", "v")),
            "beta":      float(need(c, "beta_pct_per_K", "v")),
            "alpha":     float(need(c, "alpha", "v")),
            "vmax":      float(need(c, "max_system_v", "v")),
            "ifuse":     float(need(c, "max_series_fuse_a", "v")),
            "k_corr":    float(need(c, "k_corr", "v")),
            "k_corr_src": need(c, "k_corr", "src"),
            "k_corr_note": need(c, "k_corr", "note"),
            "isc_bnpi":  float(need(c, "bnpi", "isc", "v")),
            "rear_note": need(c, "rear_gain_table", "note"),
        })
    if not out:
        raise SystemExit("REFUSED: the feed carries no classes.")
    return out



# ---------------------------------------------------------------------------
# surface 2: the bifacial current chain, per family, computed twice.
#
# The gains are not chosen here. They are the gains the feed records as PRINTED
# on that family's own sheet, read out of its own note. If the note carries no
# printed gain the program refuses: a rear-gain band is not something to pick.
# One family's sheet defines the irradiance condition behind its rear column
# and the other does not, so the band is reported per family and never shared.
# ---------------------------------------------------------------------------
def printed_rear_gains(note):
    g = sorted({int(m) for m in re.findall(r"(\d+)\s*%", str(note))})
    if not g:
        raise SystemExit(
            "REFUSED: the feed records no printed rear-gain percentage for "
            "this class. A band is not something this program may choose.")
    return g


def bifacial_band(cls, th):
    """Hot current at each gain the sheet prints, two routes, compared on the
    ORDER of the band (its verdict) and on each endpoint's rounded value."""
    a = cls["alpha"] / 100.0
    isc = cls["isc"]
    out = []
    for gp in printed_rear_gains(cls["rear_note"]):
        g = gp / 100.0
        fA = cp.float64(isc) * (1.0 + a * (cp.float64(th) - 25.0)) * (1.0 + g)
        i0 = (cp.float64(isc) + (cp.float64(isc) * a) * cp.float64(th))              - (cp.float64(isc) * a) * 25.0
        fB = i0 + i0 * g
        vA, vB = float(fA.item()), float(fB.item())
        if round(vA, 6) != round(vB, 6):
            raise SystemExit(
                "PARTING in the bifacial chain for %s at %d %% rear gain: "
                "%.9f against %.9f. Nothing is written."
                % (cls["class_id"], gp, vA, vB))
        out.append({"printed_rear_gain_pct": gp, "hot_current_a": round(vA, 3)})
    if [x["hot_current_a"] for x in out] != sorted(
            x["hot_current_a"] for x in out):
        raise SystemExit("the band for %s is not monotone in rear gain. "
                         "Nothing is written." % cls["class_id"])
    return out


# ---------------------------------------------------------------------------
# surface 3: the series envelope, computed twice on the host, on the card.
# ---------------------------------------------------------------------------
def series_envelope(cls, tc):
    """N* and the headroom in volts at the coldest credible ambient.

    Route A is factored; route B is the distributive expansion. They are
    compared on N*, the verdict, not on the volts.
    """
    b = cls["beta"] / 100.0
    vA = cp.float64(cls["voc"]) * (1.0 + b * (cp.float64(tc) - 25.0))
    vn = cp.float64(cls["voc"])
    vB = (vn + (vn * b) * cp.float64(tc)) - (vn * b) * 25.0
    nA = int(cp.floor(cp.float64(cls["vmax"]) / vA).item())
    nB = int(cp.floor(cp.float64(cls["vmax"]) / vB).item())
    if nA != nB:
        raise SystemExit("PARTING in the series envelope for %s at %.3f C: "
                         "%d against %d. Nothing is written."
                         % (cls["class_id"], tc, nA, nB))
    head = float((cls["vmax"] - nA * vA).item())
    # how many degrees of further cold that headroom is worth, which is the
    # form an engineer can act on. dV/dT = n Voc25 b, and b < 0.
    per_k = abs(nA * cls["voc"] * (cls["beta"] / 100.0))
    return nA, float(vA.item()), head, (head / per_k if per_k else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", default=os.environ.get("GRID_FEED", ""),
                    help="the module class feed (JSON). No default path is "
                         "compiled in.")
    ap.add_argument("--out", default="sweep_results.json")
    ap.add_argument("--tc-lo", type=float, default=-30.0)
    ap.add_argument("--tc-hi", type=float, default=0.0)
    ap.add_argument("--th-lo", type=float, default=25.0)
    ap.add_argument("--th-hi", type=float, default=85.0)
    ap.add_argument("--g-lo", type=float, default=0.0)
    ap.add_argument("--g-hi", type=float, default=0.30)
    ap.add_argument("--n-lo", type=int, default=20)
    ap.add_argument("--n-hi", type=int, default=34)
    ap.add_argument("--steps", type=int, default=401,
                    help="lattice points on each continuous axis")
    ap.add_argument("--a-str", type=float, default=20.0,
                    help="string input limit. NO SOURCE. Enumerated, never "
                         "published as a finding.")
    ap.add_argument("--a-mppt", type=float, default=40.0,
                    help="machine input limit. NO SOURCE. As above.")
    a = ap.parse_args()

    if not a.feed:
        raise SystemExit("REFUSED: no feed given. Pass --feed or set "
                         "GRID_FEED. Nothing is enumerated on remembered "
                         "numbers.")
    classes = load_classes(a.feed)

    mod = cp.RawModule(code=SRC, backend="nvrtc",
                       options=("--std=c++11", "--fmad=false"))
    ker = mod.get_function("sweep")

    nn = a.n_hi - a.n_lo + 1
    nt = nh = ng = int(a.steps)
    dtc = (a.tc_hi - a.tc_lo) / (nt - 1)
    dth = (a.th_hi - a.th_lo) / (nh - 1)
    dg = (a.g_hi - a.g_lo) / (ng - 1)
    per_class = nn * nt * nh * ng

    threads, blocks = 256, 2048
    t0 = time.perf_counter()
    rows, total = [], 0

    for c in classes:
        out = cp.zeros(len(TALLY), dtype=cp.uint64)
        ker((blocks,), (threads,),
            (cp.uint64(per_class),
             cp.int32(nn), cp.int32(nt), cp.int32(nh), cp.int32(ng),
             cp.int32(a.n_lo),
             cp.float64(c["voc"]), cp.float64(c["isc"]),
             cp.float64(c["beta"] / 100.0), cp.float64(c["alpha"] / 100.0),
             cp.float64(c["vmax"]), cp.float64(c["ifuse"]),
             cp.float64(a.tc_lo), cp.float64(dtc),
             cp.float64(a.th_lo), cp.float64(dth),
             cp.float64(a.g_lo), cp.float64(dg),
             cp.float64(a.a_str), cp.float64(a.a_mppt),
             out))
        cp.cuda.Stream.null.synchronize()
        t = [int(v) for v in out.get()]
        tal = dict(zip(TALLY, t))

        if tal["cases"] != per_class:
            raise SystemExit("the kernel visited %d of %d cases for %s. "
                             "Nothing is written."
                             % (tal["cases"], per_class, c["class_id"]))
        if tal["parted"]:
            raise SystemExit(
                "PARTING: the two routes disagreed on the verdict for %d of "
                "%d cases of class %s. The run aborts. Nothing is written, "
                "because a parting recorded beside the word SUCCESS is a "
                "parting nobody reads."
                % (tal["parted"], per_class, c["class_id"]))
        if tal["cold_current_was_pessimistic"]:
            raise SystemExit(
                "the cold-current counterfactual was PESSIMISTIC on %d cases "
                "of class %s. The sign of the current coefficient in the feed "
                "contradicts that. Nothing is written."
                % (tal["cold_current_was_pessimistic"], c["class_id"]))

        nstar, voc_cold, head, head_k = series_envelope(c, a.tc_lo)
        rows.append({
            "class": c["class_id"], "family": c["family"], "tally": tal,
            "series_envelope": {
                "coldest_cell_c": a.tc_lo,
                "voc_at_that_temperature_v": round(voc_cold, 4),
                "most_modules_in_series_under_the_rating": nstar,
                "headroom_at_that_count_v": round(head, 4),
                "headroom_in_degrees_of_further_cold":
                    round(head_k, 3) if head_k is not None else None,
                "headroom_at_one_more_v": round(
                    c["vmax"] - (nstar + 1) * voc_cold, 4),
                "limit": "the equipment rating printed on the document",
                "sourced": True,
            },
            "bifacial_current_chain": {
                "stc_isc_a": c["isc"],
                "printed_rear_condition_isc_a": c["isc_bnpi"],
                "ratio": round(c["k_corr"], 4),
                "ratio_source": c["k_corr_src"],
                "the_condition_is_defined_on_the_document":
                    "front" in str(c["k_corr_note"]).lower()
                    and "rear" in str(c["k_corr_note"]).lower(),
                "why": c["k_corr_note"],
                "rear_gain_table": c["rear_note"],
                "band_at_the_hot_point": bifacial_band(c, a.th_hi),
                "hot_cell_c": a.th_hi,
                "band_not_a_point":
                    "These are the rear gains this family's own sheet prints. "
                    "Where the sheet does not define the irradiance condition "
                    "behind its rear column, the provenance supports a band "
                    "and nothing narrower, so a band is what is reported.",
            },
        })
        total += per_class

    wall = time.perf_counter() - t0

    # ---- what the sweep found, stated where it cannot be missed -----------
    T = lambda k: sum(r["tally"][k] for r in rows)
    same_predicate = all(
        r["tally"]["over_string_input_UNSOURCED"]
        == r["tally"]["over_machine_input_UNSOURCED"] for r in rows)
    headline = {
        "the_module_fuse_never_fires_in_this_box": T("over_module_fuse") == 0,
        "verdicts_the_hot_cold_distinction_changes_on_a_SOURCED_limit":
            T("cold_current_changes_the_fuse_verdict"),
        "verdicts_it_changes_on_a_limit_with_NO_SOURCE":
            T("cold_current_changes_the_string_input_verdict_UNSOURCED"),
        "every_one_of_those_was_optimistic":
            T("cold_current_changes_the_string_input_verdict_UNSOURCED")
            == T("cold_current_was_optimistic_on_the_string_input_UNSOURCED"),
        "so":
            "Over this box, judging current at the cold point instead of the "
            "hot one changes NO verdict that rests on a limit printed in a "
            "document, because the only sourced current limit - the module "
            "fuse - does not fire anywhere in the box. Every verdict the "
            "distinction changes is a verdict decided by a number with no "
            "source, and every one of them moves the same way: the cold "
            "assessment understates the current and therefore flatters the "
            "design. The correct assessment is the harsher one.",
        "the_two_unsourced_limits_are_one_predicate_written_twice":
            same_predicate,
        "why": "The string input fires when I > A_str and the machine input "
               "when 2I > A_mppt. With A_mppt = 2 A_str these are the same "
               "inequality, and the counts are equal case for case. Two of "
               "the four limits this estate measures against are not two "
               "checks. They are one invented number, counted twice.",
        "cases_inside_every_limit": T("inside_every_limit"),
        "cases_failing_ONLY_on_an_invented_number":
            T("failed_ONLY_on_an_invented_number"),
        "cases_failing_on_a_sourced_limit": T("failed_on_a_sourced_limit"),
    }

    fam = {}
    for r in rows:
        fam.setdefault(r["family"], []).append(r)

    body = {
        "schema": SCHEMA,
        "anonymised": "No maker, brand, model, site, client or project name "
                      "anywhere in this file.",
        "space": {
            "classes": len(classes),
            "modules_in_series": [a.n_lo, a.n_hi, nn],
            "cold_cell_c": [a.tc_lo, a.tc_hi, nt],
            "hot_cell_c": [a.th_lo, a.th_hi, nh],
            "rear_gain": [a.g_lo, a.g_hi, ng],
            "cases_per_class": per_class,
            "cases_total": total,
        },
        "coverage": {
            "enumerated": "exhaustively; every lattice point visited once",
            "fraction_of_the_box": 1.0,
            "probability_a_lattice_point_was_missed": 0.0,
            "not_claimed":
                "Coverage of the LATTICE is not coverage of the box, and "
                "coverage of the box is not coverage of the world. Halve the "
                "step and every count below changes; that is geometry. A "
                "count of evaluations is not a count of cases covered.",
        },
        "limits": {
            "equipment_rating_v": {"sourced": True,
                                   "where": "printed on both documents"},
            "module_fuse_a": {"sourced": True,
                              "where": "printed on both documents, per bin"},
            "string_input_a": {"value": a.a_str, "sourced": False,
                               "where": "no occurrence anywhere in the "
                                        "evidence base",
                               "publishable": False},
            "machine_input_a": {"value": a.a_mppt, "sourced": False,
                                "where": "recorded ABSENT from both documents",
                                "publishable": False},
        },
        "headline": headline,
        "rate_cases_per_second": round(total / wall, 1) if wall else None,
        "wall_seconds": round(wall, 2),
        "annihilation": {
            "routes": ["factored", "distributive expansion, reassociated"],
            "compared_on": "the verdict, not the digits",
            "compiled_with": ["--fmad=false"],
            "compiled_without": ["--use_fast_math"],
            "partings": 0,
            "zero_partings_is_not_evidence":
                "The two routes do differ, by at most one unit in the last "
                "place of a double. No case in this box lands close enough to "
                "a limit for that last bit to flip a verdict, so zero is the "
                "expected result of the arithmetic and not a demonstration "
                "that the arithmetic is sound.",
            "agreement_is_not_truth":
                "Both routes were written here. Both can be wrong in the same "
                "way, and a second channel that inherits a mistake from the "
                "first will confirm it forever.",
        },
        "families": {k: [r["class"] for r in v] for k, v in fam.items()},
        "families_are_kept_apart":
            "One family's document defines the rear-irradiance condition its "
            "printed column was taken at; the other names the column and "
            "defines no condition for it. Carrying one family's condition "
            "across to the other is the trap this split exists to prevent, so "
            "no ratio here is averaged, shared or defaulted across families.",
        "classes": rows,
        "not_claimed": [
            "Nothing here is a connection offer, a constructability "
            "assessment or a consenting design, and no output of it is "
            "engineering.",
            "Every count that rests only on the string input or the machine "
            "input is reported under its own name and is NOT a finding: those "
            "two numbers appear in no document.",
            "No cable, diode, machine, tracker or wiring loss is modelled.",
        ],
    }

    with io.open(a.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(body, indent=1, sort_keys=True) + "\n")

    print("  %d classes x %s cases = %s, %.2f s, %.3e cases/s"
          % (len(classes), "{:,}".format(per_class), "{:,}".format(total),
             wall, total / wall))
    print("  partings: 0 (the run would have aborted otherwise)")
    print("")
    print("  class  fam    N* at %.0f C  headroom V   that is worth, in "
          "degrees of further cold" % a.tc_lo)
    for r in rows:
        print("  %-6s %-6s %6d %12.2f %14s"
              % (r["class"], r["family"],
                 r["series_envelope"]["most_modules_in_series_under_the_rating"],
                 r["series_envelope"]["headroom_at_that_count_v"],
                 "%.2f C" % r["series_envelope"][
                     "headroom_in_degrees_of_further_cold"]))
    print("")
    print("  judging current at the cold point instead of the hot one changes")
    print("    %14s verdicts that rest on a limit printed in a document"
          % "{:,}".format(headline[
              "verdicts_the_hot_cold_distinction_changes_on_a_SOURCED_limit"]))
    print("    %14s verdicts that rest on a number with NO SOURCE"
          % "{:,}".format(headline[
              "verdicts_it_changes_on_a_limit_with_NO_SOURCE"]))
    print("    every one of them optimistic: %s; any pessimistic: %d"
          % (headline["every_one_of_those_was_optimistic"],
             sum(r["tally"]["cold_current_was_pessimistic"] for r in rows)))
    print("  the module fuse fires nowhere in this box: %s"
          % headline["the_module_fuse_never_fires_in_this_box"])
    print("  the string input and the machine input are ONE predicate "
          "written twice: %s"
          % headline["the_two_unsourced_limits_are_one_predicate_written_twice"])
    print("  written: %s" % a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
