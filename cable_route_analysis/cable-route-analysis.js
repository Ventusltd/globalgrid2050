const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let width, height;

function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener("resize", resize);
resize();

/* -----------------------------
STATE
----------------------------- */

let state = {
    fault: "normal",
    drag: null,
    points: {
        posA: { x: 200, y: 200 },
        posB: { x: 500, y: 200 },
        negA: { x: 200, y: 350 },
        negB: { x: 500, y: 350 },
        inverter: { x: 800, y: 275 },
        earth: { x: 700, y: 550 }
    }
};

/* -----------------------------
UTIL
----------------------------- */

function dist(a, b) {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/* -----------------------------
DRAG
----------------------------- */

canvas.onmousedown = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let k in state.points) {
        let p = state.points[k];
        if (dist(p, { x: mx, y: my }) < 15) {
            state.drag = k;
        }
    }
};

canvas.onmousemove = e => {
    if (!state.drag) return;

    const rect = canvas.getBoundingClientRect();
    state.points[state.drag].x = e.clientX - rect.left;
    state.points[state.drag].y = e.clientY - rect.top;
};

canvas.onmouseup = () => state.drag = null;

/* -----------------------------
METRICS
----------------------------- */

function compute() {
    let sep = dist(state.points.posA, state.points.negA);
    let length = dist(state.points.posA, state.points.posB);

    let loop = sep * length;
    let inductance = loop / 1000;
    let capacitance = length / (sep + 1);

    let leakage = capacitance * 0.3;

    if (state.fault === "leak") leakage *= 2;
    if (state.fault === "arc") inductance *= 1.5;

    let risk = "NORMAL";
    if (loop > 50000) risk = "ELEVATED";
    if (loop > 100000 || state.fault !== "normal") risk = "HIGH";

    return { loop, inductance, capacitance, leakage, risk };
}

/* -----------------------------
DRAW
----------------------------- */

function drawPoint(p, color) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawLine(a, b, color) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
}

function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    let p = state.points;

    drawLine(p.posA, p.posB, "red");
    drawLine(p.negA, p.negB, "blue");

    drawLine(p.posB, p.inverter, "#00ff99");
    drawLine(p.negB, p.inverter, "#00ff99");

    drawLine(p.inverter, p.earth, "purple");

    drawPoint(p.posA, "red");
    drawPoint(p.posB, "red");
    drawPoint(p.negA, "blue");
    drawPoint(p.negB, "blue");
    drawPoint(p.inverter, "#00ff99");
    drawPoint(p.earth, "purple");

    let m = compute();

    ctx.fillStyle = "#00ff99";
    ctx.fillText("Loop: " + m.loop.toFixed(0), 20, 20);
    ctx.fillText("L: " + m.inductance.toFixed(1), 20, 40);
    ctx.fillText("C: " + m.capacitance.toFixed(1), 20, 60);
    ctx.fillText("Leak: " + m.leakage.toFixed(1), 20, 80);
    ctx.fillText("Risk: " + m.risk, 20, 100);
}

/* -----------------------------
LOOP
----------------------------- */

function loop() {
    draw();
    requestAnimationFrame(loop);
}
loop();

/* -----------------------------
FAULT BUTTONS
----------------------------- */

document.getElementById("faultNone").onclick = () => state.fault = "normal";
document.getElementById("faultOpen").onclick = () => state.fault = "open";
document.getElementById("faultLeak").onclick = () => state.fault = "leak";
document.getElementById("faultArc").onclick = () => state.fault = "arc";

/* -----------------------------
EXPORT
----------------------------- */

document.getElementById("exportJson").onclick = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "topology.json";
    a.click();
};
