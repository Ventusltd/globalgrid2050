# V9.31 - qualified historical daily Prices

Parent V9.30 `202611170147`, tree `95d522e0fa9088d35a4043b2fe129e16d65a6011`.

Replace the Prices tab's opt-in dated workspace frame with a bounded daily historical view. Preserve the V6 cyan/gold/red canvas style and an independent original-workspace link. Defaults use the actual last source date, currently 31 October 2026. Missing or omitted dates break every series; negative prices remain negative, partial dates have hollow markers and empty windows show no invented baseline. Coverage and stored-UTC disagreement remain visible; the summary explicitly uses an unweighted mean of available daily means.

Four byte-identical PR144 runtime files at `78d5360239e1a5fcffa83fcb30d5937c5521acb9` consume accepted data-owner source `cf48c8d6fdd9ab686c4af7261149d81a0129f7fc`. SHA-256, byte bounds and CSS SRI guard the cartridge; annual data loads are lazy and pinned by the 3,616-byte index. Accepted index/pins, cache rows and returned windows are immutable. Failed selection/rendering clears previous results; stale requests and disconnected controllers cannot overwrite a later view. No collector, raw-data copy or new chart framework.

The optional DC and price loaders now share the existing bounded SHA-256 transport within this new edition. The inherited generic layer boot delegates Prices to its explicit reviewed hook. The redundant copied V9.22-default staging harness is omitted from this new edition only: its byte-identical original and all workflows still target immutable `202611151300`. Current formal/data/MAP checks and dedicated browser acceptance remain required. No historical file, data record or source snapshot was removed.

All 7,775 REPD records, 3,604 solar records, ordered Solar-1000, original CSV/MAP and Data Centre identities/actions remain unchanged. Source clocks, the 13 missing/25 partial daily dates and 106,668 inherited UTC disagreements are not repaired or relabelled as realtime data. No independently verified project association, physical connection or available capacity is inferred.
