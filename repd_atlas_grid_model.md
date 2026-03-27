                        // DYNAMIC SPATIAL QUERY & VOLTAGE ROUTING ON CLICK
                        m.on('click', function() {
                            connectionLines.clearLayers();
                            const allSubFeatures = getVisibleSubstations();
                            
                            let html = `<div style="font-family: Courier, monospace; min-width: 220px;">
                                <b>${row['Site Name']}</b><br><span style="font-size:12px; color:#555;">${operator}</span><hr style="margin:4px 0;">
                                ${row['Technology Type']}<br><b>${cap} MW</b><br>${stat}<hr style="margin:4px 0;">`;
                            
                            if (allSubFeatures.length > 0) {
                                // 1. Apply Electrical Reality (Voltage Matching Rules)
                                const viableSubs = allSubFeatures.filter(sub => {
                                    const v = sub.properties.voltage || "";
                                    if (!v || v === "Unknown") return true; // Include if we don't know the voltage
                                    
                                    if (cap < 50) {
                                        return v.includes("33000") || v.includes("66000") || v.includes("132000");
                                    } else if (cap >= 50 && cap < 150) {
                                        return v.includes("132000") || v.includes("275000");
                                    } else {
                                        return v.includes("275000") || v.includes("400000");
                                    }
                                });

                                if (viableSubs.length > 0) {
                                    const projectPt = turf.point([lon, lat]);
                                    const subCollection = turf.featureCollection(viableSubs);
                                    const nearest = turf.nearestPoint(projectPt, subCollection);
                                    const distKm = turf.distance(projectPt, nearest).toFixed(2);
                                    
                                    html += `<strong style="color:#00cc00;">Constraint Analysis:</strong><br>
                                             Required Grid: <b>${cap < 50 ? '33kV - 132kV' : (cap < 150 ? '132kV - 275kV' : '275kV - 400kV')}</b><br>
                                             Nearest Viable Node: <b>${nearest.properties.name || "Substation"}</b><br>
                                             Distance: <b>${distKm} km</b><br>
                                             <i style="font-size:10px; color:#888;">*Straight-line distance only.</i></div>`;
                                             
                                    L.polyline([ [lat, lon], [nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]] ], 
                                        {color: '#00f2ff', weight: 2, dashArray: '5, 5'}).addTo(connectionLines);
                                } else {
                                    html += `<strong style="color:#ff3333;">Constraint Analysis:</strong><br>
                                             No viable substations found for a <b>${cap} MW</b> connection in active layers.<br>
                                             <i>Try turning on Major Substations.</i></div>`;
                                }
                            } else {
                                html += `<strong style="color:#ff9900;">Constraint Analysis:</strong><br>
                                         <i>Enable a Substation layer below to calculate grid distance.</i></div>`;
                            }
                            L.popup().setLatLng([lat, lon]).setContent(html).openOn(map);
                        });
