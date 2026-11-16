"""Conservative exact project matching, with no verification or event inference."""
from __future__ import annotations

from collections import Counter
import re
import unicodedata


def normalise_name(value):
    return " ".join(re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", value).casefold(), re.UNICODE))


def match_articles(articles, projects):
    """Match explicit REPD identifiers or a complete, unambiguous project name.

    Bare digits are not IDs (they can be years or capacities). Short one-word
    names and names duplicated in the queue require an explicit REPD ID.
    """
    names = Counter(normalise_name(p["name"]) for p in projects)
    matches = {}
    for article in articles:
        raw = article["title"] + "\n" + article.get("content", "")
        text = " " + normalise_name(raw) + " "
        explicit = set(re.findall(r"\brepd\s*(?:(?:ref(?:erence)?\s*)?(?:id\s*)?)[:#-]?\s*(\d+)\b", raw, flags=re.I))
        for project in projects:
            ref = str(project["id"])
            name = normalise_name(project["name"])
            method = None
            if ref in explicit:
                method = "repd_id"
            elif (not project.get("name_ambiguous", False) and len(name.split()) >= 2
                  and len(name) >= 8 and names[name] == 1 and " " + name + " " in text):
                method = "exact_name"
            if method:
                matches[(ref, article["url"])] = {"project_id": ref, "article_url": article["url"],
                                                "status": "PROVISIONAL", "match_method": method}
    return list(matches.values())
