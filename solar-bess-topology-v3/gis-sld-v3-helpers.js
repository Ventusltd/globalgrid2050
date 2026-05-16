"use strict";

// GIS SLD Financial Sandbox V3
// Helpers extracted by GridBot feature 003.
// Must load after gis-sld-v3-config.js and before the inline app script.

const $ = (id) => document.getElementById(id);

const num = (id) => {
    const el = $(id);
    return el ? (parseFloat(el.value) || 0) : 0;
};

const intVal = (id, fallback = 0) => {
    const el = $(id);
    return el ? (parseInt(el.value, 10) || fallback) : fallback;
};

const checked = (id) => {
    const el = $(id);
    return el ? !!el.checked : false;
};

const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
};

const setClass = (id, cls) => {
    const el = $(id);
    if (el) el.className = cls;
};

function money(v) {
    const rounded = Math.round(v);
    if (rounded < 0) return "-£" + Math.abs(rounded).toLocaleString();
    return "£" + rounded.toLocaleString();
}

function debounce(fn, ms) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

function isValidLngLat(c) {
    return Array.isArray(c) && c.length >= 2
        && Number.isFinite(+c[0]) && Number.isFinite(+c[1])
        && +c[0] >= -180 && +c[0] <= 180 && +c[1] >= -90 && +c[1] <= 90;
}

function pickProp(obj, keys, fallback = null) {
    for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
    }
    return fallback;
}

function setFetchStatus(msg, isError) {
    const el = $("fetch_status");
    if (!el) return;

    if (!msg) {
        el.style.display = "none";
        el.textContent = "";
        el.classList.remove("error");
        return;
    }

    el.textContent = msg;
    el.style.display = "block";
    el.classList.toggle("error", !!isError);
}
