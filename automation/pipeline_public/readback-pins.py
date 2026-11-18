"""Read-only public source-pin validation; no retries or product writes."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import urllib.request

manifest = json.loads(Path(os.environ["PN_SOURCE_PIN_MANIFEST"]).read_text(encoding="utf-8"))
assert manifest["head"] == "169fe4e196741971c3cb380ddb49344977026b82"
assert manifest["edition"] == "202611180633"
output = Path(os.environ["PN_PUBLIC_OUT"])
output.mkdir(parents=True, exist_ok=True)
receipt = output / "source-byte-pins.json"
assert not receipt.exists(), "Use a fresh output directory and preserve earlier receipts"

def check(pin):
    path = pin["path"]
    assert path and not path.startswith("/") and ".." not in path.split("/")
    try:
        with urllib.request.urlopen("https://globalgrid2050.com/" + path, timeout=60) as response:
            body, status = response.read(), response.status
        digest = hashlib.sha256(body).hexdigest()
        return {**pin, "actual_bytes": len(body), "actual_sha256": digest, "status": status,
                "pass": status == 200 and len(body) == pin["bytes"] and digest == pin["sha256"]}
    except Exception as error:
        return {**pin, "pass": False, "error": type(error).__name__ + ": " + str(error)}

with ThreadPoolExecutor(max_workers=4) as executor:
    checks = list(executor.map(check, manifest["source_blob_pins"]))
report = {"checked_utc": datetime.now(timezone.utc).isoformat(), "source_head": manifest["head"],
          "edition": manifest["edition"], "scope": "39 explicit public source/runtime blob pins", "checks": checks,
          "pass": all(item["pass"] for item in checks)}
receipt.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"checks": len(checks), "pass": report["pass"], "receipt": str(receipt)}))
assert report["pass"], "Actual served source bytes differ; preserve the failed receipt"
