"""REPD release descriptor: one JSON file per quarterly DESNZ publication.

A descriptor replaces the July values that were hard-coded in
scripts/repd_sources_v6.py (CSV_URL, XLSX_URL, PUBLICATION_DATE, DATASET_TITLE,
EXPECTED_*) and scripts/repd_updater.py (CURRENT_Q2_2026_*).

Descriptors live in automation/repd/releases/<release_id>.json, e.g. 2026q3.json.
Every descriptor's pinned sha256 values form a registry of "bytes that belong to a
known release", which fetch.py uses to refuse labelling one quarter's bytes as
another (the GOV.UK replaced-attachment redirect trap).

Standard library only.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

SCHEMA = "globalgrid2050.repd-release-descriptor.v1"
SOURCE_PAGE = "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
CONTENT_API = "https://www.gov.uk/api/content/government/publications/renewable-energy-planning-database-quarterly-extract"
RELEASES_DIR = Path(__file__).resolve().parent / "releases"

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], start=1)}
# DESNZ convention: the release named after a month covers the quarter that ended
# just before it (July 2026 = Q2 2026, October 2026 = Q3 2026, January 2027 = Q4 2026).
RELEASE_MONTH_TO_QUARTER = {1: 4, 4: 1, 7: 2, 10: 3}
_SHA = re.compile(r"^[0-9a-f]{64}$")


class DescriptorError(ValueError):
    pass


def quarter_from_filename(name: str) -> Optional[tuple[int, int]]:
    """'REPD_Publication_Q3_2026.csv' -> (2026, 3); 'repd-q2-jul-2025.csv' -> (2025, 2)."""
    base = name.rsplit("/", 1)[-1].lower()
    m = re.search(r"q([1-4])[^0-9]{0,8}?(20\d\d)", base)
    if m:
        return int(m.group(2)), int(m.group(1))
    m = re.search(r"(20\d\d)[^0-9]{0,3}q([1-4])", base)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None


def quarter_from_label(label: str) -> Optional[tuple[int, int]]:
    """'October 2026' / 'REPD: July 2026 (CSV)' -> (2026, 3) / (2026, 2)."""
    m = re.search(r"(january|april|july|october)\s+(20\d\d)", label or "", re.I)
    if not m:
        return None
    month, year = MONTHS[m.group(1).lower()], int(m.group(2))
    q = RELEASE_MONTH_TO_QUARTER[month]
    return (year - 1, q) if q == 4 else (year, q)


def release_id_for(year: int, q: int) -> str:
    return f"{year}q{q}"


def quarter_text(year: int, q: int) -> str:
    return f"Q{q} {year}"


@dataclass
class Expected:
    csv_sha256: Optional[str] = None
    xlsx_sha256: Optional[str] = None
    csv_bytes: Optional[int] = None
    xlsx_bytes: Optional[int] = None
    csv_rows: Optional[int] = None
    unique_refs: Optional[int] = None
    duplicate_refs: list = field(default_factory=list)
    solar_gt_1mw: Optional[int] = None
    bess_gt_100mw: Optional[int] = None


@dataclass
class ReleaseDescriptor:
    release_id: str               # "2026q3" (used as file-name suffix)
    label: str                    # "October 2026"
    quarter: str                  # "Q3 2026"
    csv_url: str
    xlsx_url: str
    page_last_updated: Optional[str] = None   # YYYY-MM-DD as shown on the GOV.UK page
    govuk_public_updated_at: Optional[str] = None
    dataset_title: Optional[str] = None
    source_page: str = SOURCE_PAGE
    previous_release_id: Optional[str] = None
    baseline_path: Optional[str] = None       # previous-release cleaned file, for row-floor and diff
    expected: Expected = field(default_factory=Expected)
    provenance: list = field(default_factory=list)
    schema: str = SCHEMA

    # ---- validation -------------------------------------------------------
    def validate(self) -> "ReleaseDescriptor":
        problems = []
        m = re.fullmatch(r"(20\d\d)q([1-4])", self.release_id or "")
        if not m:
            problems.append(f"release_id {self.release_id!r} is not like 2026q3")
        else:
            yq = (int(m.group(1)), int(m.group(2)))
            if self.quarter != quarter_text(*yq):
                problems.append(f"quarter {self.quarter!r} != {quarter_text(*yq)!r} implied by release_id")
            if quarter_from_label(self.label) != yq:
                problems.append(f"label {self.label!r} does not name the release month of {self.quarter}")
            for role in ("csv", "xlsx"):
                url = getattr(self, f"{role}_url")
                if not url.startswith("https://"):
                    problems.append(f"{role}_url must be https: {url!r}")
                if not url.lower().endswith("." + role):
                    problems.append(f"{role}_url does not end in .{role}: {url!r}")
                fq = quarter_from_filename(url)
                if fq is not None and fq != yq:
                    problems.append(f"{role}_url file name names {quarter_text(*fq)}, descriptor says {self.quarter}")
        for role in ("csv", "xlsx"):
            sha = getattr(self.expected, f"{role}_sha256")
            if sha is not None and not _SHA.match(sha):
                problems.append(f"expected.{role}_sha256 is not 64 lowercase hex chars")
        if self.page_last_updated and not re.fullmatch(r"\d{4}-\d\d-\d\d", self.page_last_updated):
            problems.append("page_last_updated must be YYYY-MM-DD")
        if problems:
            raise DescriptorError("invalid release descriptor: " + "; ".join(problems))
        return self

    # ---- (de)serialisation ------------------------------------------------
    def to_dict(self) -> dict:
        d = asdict(self)
        return {"schema": d.pop("schema"), **d}

    @classmethod
    def from_dict(cls, d: dict) -> "ReleaseDescriptor":
        d = dict(d)
        if d.get("schema", SCHEMA) != SCHEMA:
            raise DescriptorError(f"unknown descriptor schema {d.get('schema')!r}")
        exp = Expected(**(d.pop("expected", None) or {}))
        known = set(cls.__dataclass_fields__)
        unknown = set(d) - known
        if unknown:
            raise DescriptorError(f"unknown descriptor fields: {sorted(unknown)}")
        return cls(expected=exp, **d).validate()


def load(path) -> ReleaseDescriptor:
    return ReleaseDescriptor.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def dump(desc: ReleaseDescriptor, path) -> None:
    desc.validate()
    Path(path).write_text(json.dumps(desc.to_dict(), indent=2) + "\n", encoding="utf-8")


def load_all(directory=RELEASES_DIR) -> dict[str, ReleaseDescriptor]:
    out = {}
    for p in sorted(Path(directory).glob("*.json")):
        d = load(p)
        if d.release_id in out:
            raise DescriptorError(f"duplicate release_id {d.release_id} in {directory}")
        out[d.release_id] = d
    return out


def known_hashes(descriptors) -> dict[str, tuple[str, str]]:
    """sha256 -> (release_id, role) over every pinned hash. Fails if one hash is
    pinned to two different releases (that would make labelling ambiguous)."""
    reg: dict[str, tuple[str, str]] = {}
    for d in (descriptors.values() if isinstance(descriptors, dict) else descriptors):
        for role in ("csv", "xlsx"):
            sha = getattr(d.expected, f"{role}_sha256")
            if not sha:
                continue
            if sha in reg and reg[sha][0] != d.release_id:
                raise DescriptorError(f"sha256 {sha[:12]} pinned to both {reg[sha][0]} and {d.release_id}")
            reg[sha] = (d.release_id, role)
    return reg
