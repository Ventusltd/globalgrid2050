<script>
async function fetchFX() {
  try {
    // Free FX API (no key)
    const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=GBP,EUR");
    const data = await res.json();

    // Convert to your format
    let gbp_usd = 1 / data.rates.GBP;
    let eur_usd = 1 / data.rates.EUR;

    document.getElementById("fx_gbp").value = gbp_usd.toFixed(4);
    document.getElementById("fx_eur").value = eur_usd.toFixed(4);

  } catch (e) {
    console.warn("FX fetch failed, using manual values");
  }
}

function calc() {

  let cu = parseFloat(document.getElementById("cu").value);
  let al = parseFloat(document.getElementById("al").value);
  let fx_gbp = parseFloat(document.getElementById("fx_gbp").value);
  let fx_eur = parseFloat(document.getElementById("fx_eur").value);
  let currency = document.getElementById("currency").value;

  // Cross rates (AUTO)
  let gbp_eur = fx_gbp / fx_eur;
  let eur_gbp = fx_eur / fx_gbp;

  document.getElementById("gbp_eur").innerHTML = gbp_eur.toFixed(4);
  document.getElementById("eur_gbp").innerHTML = eur_gbp.toFixed(4);

  let cu_price, al_price, symbol;

  if (currency === "GBP") {
    cu_price = cu / fx_gbp;
    al_price = al / fx_gbp;
    symbol = "£";
  } else if (currency === "EUR") {
    cu_price = cu / fx_eur;
    al_price = al / fx_eur;
    symbol = "€";
  } else {
    cu_price = cu;
    al_price = al;
    symbol = "$";
  }

  let cables = [
    [120,35],[150,35],[185,35],[240,35],[300,35],
    [400,35],[500,35],[630,35],[800,50],[1000,50],
    [1200,50],[1400,50],[1600,50],[1800,50],[2000,50],[2500,50]
  ];

  let tbody = document.querySelector("#liveTbl tbody");
  tbody.innerHTML = "";

  cables.forEach(c => {

    let cond = c[0];
    let cws = c[1];

    let al_kg = cond * 2.92;
    let cu_kg = cws * 9.6;

    let al_cost = al_kg * (al_price / 1000);
    let cu_cost = cu_kg * (cu_price / 1000);

    let total = al_cost + cu_cost;
    let net = total / 0.3;

    let row = `<tr>
      <td>${cond}</td>
      <td>${al_kg.toFixed(0)}</td>
      <td>${cu_kg.toFixed(0)}</td>
      <td>${symbol}${total.toFixed(0)}</td>
      <td>${symbol}${net.toFixed(0)}</td>
    </tr>`;

    tbody.innerHTML += row;

  });
}

// SAFE AUTO FLOW (DO NOT BREAK)
document.addEventListener("DOMContentLoaded", async function () {

  // 1. Fetch FX (auto)
  await fetchFX();

  // 2. Run calculation AFTER FX loads
  calc();

});
</script>
