"""Create a candidate project renderer from the selected version, without editing its input."""
import argparse
from pathlib import Path

IMPORT = 'import { legalEvidenceAction } from "../../../../automation/pipeline_legal_evidence/link.mjs";'
MARKER = '<div><b>PROJECT NAME</b><span>${escapeHtml(project.name)}</span></div>'


def patch(source):
    if source.count(MARKER) != 1 or IMPORT in source:
        raise ValueError("Expected one unmodified REPD project-detail template")
    return IMPORT + "\n" + source.replace(MARKER, MARKER + "${legalEvidenceAction(project)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path, help="new file; existing files are protected")
    args = parser.parse_args()
    result = patch(args.source.read_text(encoding="utf-8"))
    with args.output.open("x", encoding="utf-8") as output:
        output.write(result)
