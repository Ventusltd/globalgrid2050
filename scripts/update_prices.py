from pathlib import Path
import re
from datetime import datetime

FILE = Path("33kv_uk_dap_price_estimator/index.md")

# generate a timestamp just to prove automation works
timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

text = FILE.read_text()

text = re.sub(
r"FX rate .*",
f"FX rate test update {timestamp}",
text
)

FILE.write_text(text)

print("Automation test successful")
