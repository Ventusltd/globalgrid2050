function exportJson() {
        if (!appState.snapshotText) return;
        const base = (byId("route_name").value.trim() || "geometry_capture").replace(/[^a-z0-9_]/gi, "_");
        const blob = new Blob([appState.snapshotText], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = `${base}_geometry_capture_NOT_FOR_CONSTRUCTION.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function copySnapshot() {
        const btn = byId("copy_btn");
        if (!appState.snapshotText) return;
        try {
            await navigator.clipboard.writeText(appState.snapshotText);
            btn.textContent = "Copied";
            setTimeout(() => { btn.textContent = "Copy Snapshot"; }, 1000);
        } catch (_) {
            btn.textContent = "Copy Failed";
            setTimeout(() => { btn.textContent = "Copy Snapshot"; }, 1200);
        }
    }

    