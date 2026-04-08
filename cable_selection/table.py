from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except Exception as exc:  # pragma: no cover
    raise RuntimeError("Tkinter is required to run this app skeleton.") from exc


APP_TITLE = "Cable Selection Skeleton"
DATA_FILE = Path("cable_selector_data.json")


@dataclass
class CableRecord:
    record_id: str
    generic_type: str
    voltage_class: str
    current_type: str
    construction: str
    conductor_material: str
    conductor_size_mm2: Optional[float]
    insulation: str
    screen: str
    armour: str
    sheath: str
    standard_reference: str
    application_note: str
    outer_diameter_mm: Optional[float]
    minimum_bend_radius_mm: Optional[float]
    minimum_bend_radius_rule: str
    source_family: str
    source_document: str
    verified: bool = False
    notes: str = ""


@dataclass
class CableDatabase:
    records: List[CableRecord] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps([asdict(record) for record in self.records], indent=4)

    @classmethod
    def from_file(cls, path: Path) -> "CableDatabase":
        if not path.exists():
            return cls(records=seed_records())

        raw = json.loads(path.read_text(encoding="utf-8"))
        return cls(records=[CableRecord(**item) for item in raw])

    def save(self, path: Path) -> None:
        path.write_text(self.to_json(), encoding="utf-8")

    def filter_records(
        self,
        voltage_class: str = "All",
        armour: str = "All",
        source_family: str = "All",
        text_query: str = "",
    ) -> List[CableRecord]:
        query = text_query.strip().lower()
        filtered = []

        for record in self.records:
            if voltage_class != "All" and record.voltage_class != voltage_class:
                continue
            if armour != "All" and record.armour != armour:
                continue
            if source_family != "All" and record.source_family != source_family:
                continue

            haystack = " ".join(
                [
                    record.record_id,
                    record.generic_type,
                    record.standard_reference,
                    record.application_note,
                    record.source_document,
                    record.notes,
                ]
            ).lower()
            if query and query not in haystack:
                continue

            filtered.append(record)

        return filtered


def seed_records() -> List[CableRecord]:
    return [
        CableRecord(
            record_id="UKPN-132-1C-300-AL-HDPE",
            generic_type="Single core screened MV or HV utility cable",
            voltage_class="132kV",
            current_type="AC",
            construction="Single core",
            conductor_material="Aluminium",
            conductor_size_mm2=300,
            insulation="XLPE",
            screen="Aluminium wire plus laminate",
            armour="Unarmoured",
            sheath="HDPE",
            standard_reference="UKPN schedule of technical particulars",
            application_note="Utility network cable record placeholder",
            outer_diameter_mm=72,
            minimum_bend_radius_mm=1080,
            minimum_bend_radius_rule="Schedule value",
            source_family="UKPN",
            source_document="Uploaded UKPN 1x300 132 kV HDPE schedule",
            verified=True,
            notes="Skeleton seed from uploaded schedule."
        ),
        CableRecord(
            record_id="UKPN-66-1C-400-AL-LSZH",
            generic_type="Single core screened MV utility cable",
            voltage_class="66kV",
            current_type="AC",
            construction="Single core",
            conductor_material="Aluminium",
            conductor_size_mm2=400,
            insulation="XLPE",
            screen="Aluminium wire plus laminate",
            armour="Unarmoured",
            sheath="LSZH",
            standard_reference="UKPN schedule of technical particulars",
            application_note="Utility network cable record placeholder",
            outer_diameter_mm=62,
            minimum_bend_radius_mm=930,
            minimum_bend_radius_rule="Schedule value",
            source_family="UKPN",
            source_document="Uploaded UKPN 1x400 66 kV LSZH schedule",
            verified=True,
            notes="Skeleton seed from uploaded schedule."
        ),
        CableRecord(
            record_id="BS7870-4.10-MV-AWA-PLACEHOLDER",
            generic_type="Single core armoured MV cable",
            voltage_class="MV",
            current_type="AC",
            construction="Single core",
            conductor_material="Aluminium",
            conductor_size_mm2=None,
            insulation="XLPE",
            screen="Metallic screen",
            armour="AWA",
            sheath="PVC or PE",
            standard_reference="BS 7870-4.10",
            application_note="Placeholder family for BS 7870-4.10 aligned entries",
            outer_diameter_mm=None,
            minimum_bend_radius_mm=None,
            minimum_bend_radius_rule="To be entered from datasheet or schedule",
            source_family="BS7870-4.10",
            source_document="Standards led placeholder",
            verified=False,
            notes="Use this as a family shell only until datasheet values are entered."
        ),
        CableRecord(
            record_id="GENERIC-LV-3C-SWA-PLACEHOLDER",
            generic_type="Low voltage armoured power cable",
            voltage_class="LV",
            current_type="AC",
            construction="Three core",
            conductor_material="Copper",
            conductor_size_mm2=None,
            insulation="XLPE",
            screen="Unscreened",
            armour="SWA",
            sheath="PVC",
            standard_reference="BS 5467 or project datasheet",
            application_note="Generic LV SWA placeholder",
            outer_diameter_mm=None,
            minimum_bend_radius_mm=None,
            minimum_bend_radius_rule="To be entered from datasheet or manufacturer guidance",
            source_family="SWA",
            source_document="Standards led placeholder",
            verified=False,
            notes="Useful as a starter shell for LV feeder families."
        ),
        CableRecord(
            record_id="GENERIC-LV-1C-AWA-PLACEHOLDER",
            generic_type="Low voltage single core armoured power cable",
            voltage_class="LV",
            current_type="AC",
            construction="Single core",
            conductor_material="Aluminium",
            conductor_size_mm2=None,
            insulation="XLPE",
            screen="Unscreened",
            armour="AWA",
            sheath="PVC",
            standard_reference="BS 5467 or project datasheet",
            application_note="Generic LV AWA placeholder",
            outer_diameter_mm=None,
            minimum_bend_radius_mm=None,
            minimum_bend_radius_rule="To be entered from datasheet or manufacturer guidance",
            source_family="AWA",
            source_document="Standards led placeholder",
            verified=False,
            notes="Useful as a starter shell for single core armour families."
        ),
    ]


class CableSelectorApp:
    def __init__(self, root: tk.Tk, db: CableDatabase) -> None:
        self.root = root
        self.db = db
        self.root.title(APP_TITLE)
        self.root.geometry("1280x760")

        self.voltage_var = tk.StringVar(value="All")
        self.armour_var = tk.StringVar(value="All")
        self.family_var = tk.StringVar(value="All")
        self.search_var = tk.StringVar(value="")

        self.selected_record: Optional[CableRecord] = None

        self._build_layout()
        self._populate_filters()
        self._refresh_table()

    def _build_layout(self) -> None:
        outer = ttk.Frame(self.root, padding=12)
        outer.pack(fill="both", expand=True)

        filter_frame = ttk.LabelFrame(outer, text="Filters", padding=10)
        filter_frame.pack(fill="x", pady=(0, 10))

        ttk.Label(filter_frame, text="Voltage Class").grid(row=0, column=0, sticky="w", padx=(0, 8))
        self.voltage_combo = ttk.Combobox(filter_frame, textvariable=self.voltage_var, state="readonly", width=18)
        self.voltage_combo.grid(row=0, column=1, sticky="w", padx=(0, 16))

        ttk.Label(filter_frame, text="Armour").grid(row=0, column=2, sticky="w", padx=(0, 8))
        self.armour_combo = ttk.Combobox(filter_frame, textvariable=self.armour_var, state="readonly", width=18)
        self.armour_combo.grid(row=0, column=3, sticky="w", padx=(0, 16))

        ttk.Label(filter_frame, text="Source Family").grid(row=0, column=4, sticky="w", padx=(0, 8))
        self.family_combo = ttk.Combobox(filter_frame, textvariable=self.family_var, state="readonly", width=22)
        self.family_combo.grid(row=0, column=5, sticky="w", padx=(0, 16))

        ttk.Label(filter_frame, text="Search").grid(row=0, column=6, sticky="w", padx=(0, 8))
        search_entry = ttk.Entry(filter_frame, textvariable=self.search_var, width=32)
        search_entry.grid(row=0, column=7, sticky="we")

        ttk.Button(filter_frame, text="Apply", command=self._refresh_table).grid(row=0, column=8, padx=(10, 0))
        ttk.Button(filter_frame, text="Save", command=self._save_database).grid(row=0, column=9, padx=(10, 0))
        filter_frame.columnconfigure(7, weight=1)

        body = ttk.PanedWindow(outer, orient="horizontal")
        body.pack(fill="both", expand=True)

        left = ttk.Frame(body, padding=4)
        right = ttk.Frame(body, padding=4)
        body.add(left, weight=3)
        body.add(right, weight=2)

        self.tree = ttk.Treeview(
            left,
            columns=(
                "record_id",
                "generic_type",
                "voltage_class",
                "armour",
                "od",
                "bend",
                "verified",
            ),
            show="headings",
            height=24,
        )
        self.tree.heading("record_id", text="Record ID")
        self.tree.heading("generic_type", text="Generic Type")
        self.tree.heading("voltage_class", text="Voltage")
        self.tree.heading("armour", text="Armour")
        self.tree.heading("od", text="OD mm")
        self.tree.heading("bend", text="Min Bend mm")
        self.tree.heading("verified", text="Verified")

        self.tree.column("record_id", width=220)
        self.tree.column("generic_type", width=260)
        self.tree.column("voltage_class", width=80)
        self.tree.column("armour", width=80)
        self.tree.column("od", width=80, anchor="e")
        self.tree.column("bend", width=100, anchor="e")
        self.tree.column("verified", width=70, anchor="center")

        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        detail_frame = ttk.LabelFrame(right, text="Record Detail", padding=10)
        detail_frame.pack(fill="both", expand=True)

        self.detail_text = tk.Text(detail_frame, wrap="word", height=32)
        self.detail_text.pack(fill="both", expand=True)

        button_frame = ttk.Frame(right)
        button_frame.pack(fill="x", pady=(10, 0))

        ttk.Button(button_frame, text="Add Placeholder", command=self._add_placeholder).pack(side="left")
        ttk.Button(button_frame, text="Export Selected JSON", command=self._export_selected_json).pack(side="left", padx=(8, 0))

        self.voltage_combo.bind("<<ComboboxSelected>>", lambda _event: self._refresh_table())
        self.armour_combo.bind("<<ComboboxSelected>>", lambda _event: self._refresh_table())
        self.family_combo.bind("<<ComboboxSelected>>", lambda _event: self._refresh_table())
        search_entry.bind("<Return>", lambda _event: self._refresh_table())

    def _populate_filters(self) -> None:
        voltage_values = ["All"] + sorted({record.voltage_class for record in self.db.records})
        armour_values = ["All"] + sorted({record.armour for record in self.db.records})
        family_values = ["All"] + sorted({record.source_family for record in self.db.records})

        self.voltage_combo["values"] = voltage_values
        self.armour_combo["values"] = armour_values
        self.family_combo["values"] = family_values

    def _refresh_table(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)

        filtered = self.db.filter_records(
            voltage_class=self.voltage_var.get(),
            armour=self.armour_var.get(),
            source_family=self.family_var.get(),
            text_query=self.search_var.get(),
        )

        for record in filtered:
            self.tree.insert(
                "",
                "end",
                iid=record.record_id,
                values=(
                    record.record_id,
                    record.generic_type,
                    record.voltage_class,
                    record.armour,
                    "" if record.outer_diameter_mm is None else record.outer_diameter_mm,
                    "" if record.minimum_bend_radius_mm is None else record.minimum_bend_radius_mm,
                    "Yes" if record.verified else "No",
                ),
            )

        if filtered:
            first_id = filtered[0].record_id
            self.tree.selection_set(first_id)
            self._show_detail(filtered[0])
        else:
            self.detail_text.delete("1.0", tk.END)
            self.detail_text.insert(tk.END, "No records match the current filter.")
            self.selected_record = None

    def _on_select(self, _event: Any) -> None:
        selected = self.tree.selection()
        if not selected:
            return
        record_id = selected[0]
        for record in self.db.records:
            if record.record_id == record_id:
                self._show_detail(record)
                return

    def _show_detail(self, record: CableRecord) -> None:
        self.selected_record = record
        self.detail_text.delete("1.0", tk.END)
        self.detail_text.insert(tk.END, json.dumps(asdict(record), indent=4))

    def _save_database(self) -> None:
        self.db.save(DATA_FILE)
        messagebox.showinfo(APP_TITLE, f"Database saved to {DATA_FILE.resolve()}")

    def _add_placeholder(self) -> None:
        new_record = CableRecord(
            record_id=f"PLACEHOLDER-{len(self.db.records) + 1:04d}",
            generic_type="New cable type placeholder",
            voltage_class="TBD",
            current_type="AC",
            construction="TBD",
            conductor_material="TBD",
            conductor_size_mm2=None,
            insulation="TBD",
            screen="TBD",
            armour="TBD",
            sheath="TBD",
            standard_reference="TBD",
            application_note="Fill from one datasheet only",
            outer_diameter_mm=None,
            minimum_bend_radius_mm=None,
            minimum_bend_radius_rule="TBD",
            source_family="Manual",
            source_document="Manual placeholder",
            verified=False,
            notes="Populate this record from a single datasheet and then mark verified."
        )
        self.db.records.append(new_record)
        self._populate_filters()
        self._refresh_table()
        self.tree.selection_set(new_record.record_id)
        self._show_detail(new_record)

    def _export_selected_json(self) -> None:
        if self.selected_record is None:
            messagebox.showwarning(APP_TITLE, "No record selected.")
            return

        export_path = Path(f"{self.selected_record.record_id}.json")
        export_path.write_text(json.dumps(asdict(self.selected_record), indent=4), encoding="utf-8")
        messagebox.showinfo(APP_TITLE, f"Exported {export_path.resolve()}")


def main() -> None:
    db = CableDatabase.from_file(DATA_FILE)
    root = tk.Tk()
    app = CableSelectorApp(root, db)
    root.mainloop()


if __name__ == "__main__":
    main()

