const observers = [];

function parseDisplayNumber(value) {
  const numeric = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatWholeMwV9_3(value) {
  const numeric = parseDisplayNumber(value);
  return (numeric ?? 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function applyGaugeValue() {
  const element = document.getElementById("v1");
  if (!element) return;
  const numeric = parseDisplayNumber(element.textContent);
  if (numeric === null) return;
  const formatted = formatWholeMwV9_3(numeric);
  if (element.textContent !== formatted) element.textContent = formatted;
  element.setAttribute("aria-label", `${formatted} megawatts filtered capacity`);
}

function applyResultsSummary() {
  const element = document.getElementById("resultsMeta");
  if (!element) return;
  const current = element.textContent || "";
  const formatted = current.replace(
    /(\d[\d,]*(?:\.\d+)?) MW · largest/,
    (_match, capacity) => `${formatWholeMwV9_3(capacity)} MW · largest`,
  );
  if (formatted !== current) element.textContent = formatted;
}

export function applyWholeMwPresentationV9_3() {
  applyGaugeValue();
  applyResultsSummary();
}

function observe(element) {
  if (!element) return;
  const observer = new MutationObserver(applyWholeMwPresentationV9_3);
  observer.observe(element, { childList: true, characterData: true, subtree: true });
  observers.push(observer);
}

function initialiseWholeMwPresentationV9_3() {
  observers.splice(0).forEach((observer) => observer.disconnect());
  applyWholeMwPresentationV9_3();
  observe(document.getElementById("v1"));
  observe(document.getElementById("resultsMeta"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialiseWholeMwPresentationV9_3, { once: true });
} else {
  initialiseWholeMwPresentationV9_3();
}
