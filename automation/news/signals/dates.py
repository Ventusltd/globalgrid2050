#!/usr/bin/env python3
"""Project signals: one date rule shared by the three collectors and the combiner.

  day(value, today=None) -> "YYYY-MM-DD" or None

The day is the publisher's own calendar day: the date as written, not shifted to UTC (a story stamped
00:30 +01:00 on the 15th is dated the 15th by every collector). A missing or unknown time zone costs the time,
never the date. Impossible dates (30 February), placeholder dates (1970, year 26), dates before 2005 and, when
`today` is given, dates later than the day after it are None: an undated item, never a recent one.

  url_day(link) -> "YYYY-MM-DD" or None       a full date written in the link's path (/2026/11/10/, /10112026/)
  url_year(link) -> int or None               a year written in the link's path (/2026/, /uploads/2023/12/)
"""
from __future__ import annotations

import datetime as dt
import re

MONTHS = {m: n for n, names in enumerate((
    ("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"),
    ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"), ("oct", "october"), ("nov", "november"),
    ("dec", "december")), 1) for m in names}
FIRST_YEAR = 2005                 # before any utility-scale solar news in Great Britain

ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])")
BASIC_RE = re.compile(r"^(\d{4})(\d{2})(\d{2})(?:$|T\d{6}Z?$)")
WORDS_RE = re.compile(r"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?[ \-]([A-Za-z]{3,9})\.?,?[ \-](\d{4}|\d{2})(?!\d)")
US_WORDS_RE = re.compile(r"\b([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})(?!\d)")
NUMERIC_RE = re.compile(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?:$|[ T])")


def _make(year, month, day_, today=None):
    try:
        short = len(str(year)) <= 2
        year, month, day_ = int(year), int(month), int(day_)
        if short:
            year += 2000
        made = dt.date(year, month, day_)
    except (TypeError, ValueError):
        return None
    if made.year < FIRST_YEAR:
        return None
    if today is not None and made > today + dt.timedelta(days=1):
        return None
    return made.isoformat()


def day(value, today=None, month_first=False):
    """The calendar day a source wrote, or None. Accepts ISO dates and timestamps (with or without a zone), RFC 822
    dates with any or no zone name, "14 November 2026", "Nov 14, 2026", 14/11/2026, 14.11.2026, 20261114."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    found = ISO_RE.match(text) or BASIC_RE.match(text)
    if found:
        return _make(found.group(1), found.group(2), found.group(3), today)
    found = WORDS_RE.search(text)
    if found and found.group(2).lower() in MONTHS:
        return _make(found.group(3), MONTHS[found.group(2).lower()], found.group(1), today)
    found = US_WORDS_RE.search(text)
    if found and found.group(1).lower() in MONTHS:
        return _make(found.group(3), MONTHS[found.group(1).lower()], found.group(2), today)
    found = NUMERIC_RE.match(text)
    if found:
        first, second = found.group(1), found.group(2)
        if month_first or int(second) > 12 >= int(first):
            first, second = second, first
        return _make(found.group(3), second, first, today)
    return None


URL_DAY_RES = (re.compile(r"/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:/|-|$)"),
               re.compile(r"/(\d{2})(\d{2})(20\d{2})/"))
URL_YEAR_RE = re.compile(r"/(20\d{2})(?:/|$)")


def url_day(link, today=None):
    if not isinstance(link, str):
        return None
    path = link.split("?")[0]
    found = URL_DAY_RES[0].search(path)
    if found:
        return _make(found.group(1), found.group(2), found.group(3), today)
    found = URL_DAY_RES[1].search(path)
    if found:
        return _make(found.group(3), found.group(2), found.group(1), today)
    return None


def url_year(link, today=None):
    if not isinstance(link, str):
        return None
    found = URL_YEAR_RE.search(link.split("?")[0])
    if not found:
        return None
    year = int(found.group(1))
    if year < FIRST_YEAR or (today is not None and year > today.year):
        return None
    return year
