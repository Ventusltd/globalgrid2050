"""Build a deterministic rank sidecar without changing the existing headline file.

Run: python -m automation.news.build_news_priority --input dist/pipeline_headlines.json
     --output dist/pipeline_headlines.rank.json
Publish both files in one data-branch commit. A sidecar is display guidance, never
source permission, project binding or evidence verification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

from automation.news import news_algorithm as N
from automation.news import pipeline_headlines as P

SCHEMA = "globalgrid2050.news.headline-priority.v1"
MAX_BYTES = 2_000_000
HEADLINE_SCHEMA = json.loads((Path(__file__).parent / "schema/pipeline-headlines.v1.schema.json").read_text(encoding="utf-8"))


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON property")
        result[key] = value
    return result


def _validate(value, rule, root=HEADLINE_SCHEMA):
    """Existing headline schema's small, dependency-free keyword subset."""
    supported = {"$schema", "$id", "$defs", "title", "description", "$ref", "anyOf", "const", "enum", "type",
                 "minLength", "maxLength", "pattern", "minimum", "maxItems", "items", "required",
                 "properties", "additionalProperties", "propertyNames"}
    if set(rule) - supported:
        raise ValueError("unsupported headline schema keyword")
    if "$ref" in rule:
        rule = root["$defs"][rule["$ref"].split("/")[-1]]
    if "anyOf" in rule:
        for option in rule["anyOf"]:
            try:
                _validate(value, option, root)
                return
            except ValueError:
                pass
        raise ValueError("headline schema: no valid variant")
    kind = rule.get("type")
    types = {"object": dict, "array": list, "string": str, "integer": int, "null": type(None)}
    if kind and type(value) is not types[kind]:
        raise ValueError("headline schema: wrong type")
    if "const" in rule and value != rule["const"] or "enum" in rule and value not in rule["enum"]:
        raise ValueError("headline schema: invalid value")
    if isinstance(value, str):
        if not rule.get("minLength", 0) <= len(value) <= rule.get("maxLength", MAX_BYTES):
            raise ValueError("headline schema: text length")
        if "pattern" in rule and not re.search(rule["pattern"], value):
            raise ValueError("headline schema: text pattern")
    if type(value) is int and value < rule.get("minimum", value):
        raise ValueError("headline schema: below minimum")
    if isinstance(value, list):
        if len(value) > rule.get("maxItems", 200):
            raise ValueError("headline schema: too many items")
        for child in value:
            _validate(child, rule.get("items", {}), root)
    if isinstance(value, dict):
        if not set(rule.get("required", ())).issubset(value):
            raise ValueError("headline schema: missing property")
        props, extra = rule.get("properties", {}), rule.get("additionalProperties", True)
        for key, child in value.items():
            if "propertyNames" in rule:
                _validate(key, rule["propertyNames"], root)
            if key in props:
                _validate(child, props[key], root)
            elif extra is False:
                raise ValueError("headline schema: unexpected property")
            elif isinstance(extra, dict):
                _validate(child, extra, root)


def build(raw: bytes) -> dict:
    if not isinstance(raw, bytes) or not 0 < len(raw) <= MAX_BYTES:
        raise ValueError("bounded nonempty headline bytes required")
    doc = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_unique,
                     parse_constant=lambda value: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
    _validate(doc, HEADLINE_SCHEMA)
    if doc["counts"]["items"] != len(doc["items"]):
        raise ValueError("headline item count mismatch")
    as_of = N._clock(doc["generated_at"])
    by_link = {}
    for item in doc["items"]:
        if N._clock(item["first_seen"]) > as_of:
            raise ValueError("first collection occurs after document generation")
        if item["date"] is not None:
            N._clock(item["date"])
        link = N.public_url(item["link"])
        if link in by_link:
            raise ValueError("duplicate canonical headline URL")
        by_link[link] = item
    ranking = N.rank_headlines(doc["items"], as_of=as_of.isoformat())
    entries = []
    for ranked in ranking["items"]:
        original, editorial = by_link[ranked["link"]], ranked["editorial"]
        entries.append({
            "link": original["link"], "source": original["source"], "title": original["title"],
            "rank": editorial["rank"], "source_kind": editorial["source"]["kind"],
            "role": editorial["role"], "topics": editorial["topics"],
            "freshness_state": editorial["freshness"]["state"],
            "uk_context": editorial["components"]["uk_headline_context"] > 0,
            "score": editorial["selection_score"],
            "requires_primary_followup": editorial["requires_primary_followup"],
            "subscription_notice": editorial["source"]["access_notice"] is not None,
        })
    return {"schema": SCHEMA, "input_sha256": hashlib.sha256(raw).hexdigest(),
            "input_bytes": len(raw), "input_generated_at": doc["generated_at"],
            "input_count": len(doc["items"]), "as_of": ranking["as_of"],
            "profile_id": N.PROFILE["id"], "profile_sha256": N.PROFILE_SHA256,
            "entries": entries}


def dumps(document):
    return json.dumps(document, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("sidecar must not overwrite the headline input")
    with args.input.open("rb") as source:
        raw = source.read(MAX_BYTES + 1)
    document = build(raw)
    result = dumps(document).encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(result)
    print(f"priority sidecar: {len(document['entries'])} credited headlines; input bytes unchanged")


if __name__ == "__main__":
    main()
