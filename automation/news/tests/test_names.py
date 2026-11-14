from automation.news import names


def test_distinctive_stem_strips_addresses_and_boilerplate():
    assert names.distinctive_stem("Springwell, Lincoln - Springwell Solar Farm & Battery Storage") == "springwell"
    assert names.distinctive_stem("West Burton Power Station, North Road - Battery Storage") == "west burton"
    assert names.distinctive_stem("The Tween Bridge Solar Farm ") == "tween bridge"
    assert names.distinctive_stem("Green Hill Solar Farm & Battery Storage") == "green hill"


def test_generic_and_address_only_names_give_no_stem():
    assert names.distinctive_stem("The Grange") == ""
    assert names.distinctive_stem("Country Lane - Solar Farm") == ""
    assert names.distinctive_stem("New Road Solar Farm") == ""


def test_aliases_trailing_and_places():
    a = names.name_aliases("Moray Firth - Caledonia North Offshore Wind Farm")
    assert a == {"primary": "moray firth", "trailing": "caledonia north", "places": []}
    a = names.name_aliases("Engine Lane, Grimethorpe - Solar Farm")
    assert a["primary"] == "engine lane" and a["places"] == ["grimethorpe"]


def test_operator_key_ignores_connectors_case_and_suffixes():
    assert names.operator_key("Photovolt Development Partners / SolarFive") == \
        names.operator_key("PHOTOVOLT DEVELOPMENT PARTNERS & SolarFive Ltd")
    assert names.operator_key("Old Owner Ltd") != names.operator_key("New Owner Plc")


def test_descriptor_adjacency_for_one_word_names():
    assert names.descriptor_adjacent(names.padded("Qair buys Hessay Solar project"), "hessay")
    assert not names.descriptor_adjacent(names.padded("Hessay village fete"), "hessay")
    assert not names.descriptor_adjacent(names.padded("plans at the hessay solar"), "hessay")


def test_tech_context_and_family():
    assert names.tech_context(names.padded("500MW/1GWh BESS and solar PV")) == {"battery", "solar"}
    assert names.tech_family("Solar Photovoltaics") == "solar"
    assert names.tech_family("Liquid Air Energy Storage") == "battery"
    assert names.tech_family("Wind Offshore") == "wind"
    assert names.tech_family("Biomass (dedicated)") == "other"
