/* Existing, immutable GridAtlas products; no new collector or copied archive. */
const GRID = 'https://raw.githubusercontent.com/Ventusltd/gridatlas/1de35f9eca360a5d80d81542230fef546917f5c5/';
export const catalogue = {
  schema: 'globalgrid2050.pipeline-layers.v1',
  sourceComposition: 'gridatlas/202611161720',
  layers: [
    {id: 'substations', label: 'Substations', group: 'Grid', owner: 'Ventusltd/gridatlas', renderer: 'assets', kind: 'substation',
      sourceLabel: 'GridAtlas substation snapshot · OpenStreetMap contributors · ODbL 1.0',
      data: {url: GRID + 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson', sha256: '87976435766a58ddf19c99540b58cd7f18a224148af42ba55075d8851f9e6251', maxBytes: 1500000, rows: 5800, schema: 'geojson.FeatureCollection'}},
    {id: 'grid-projects', label: 'Grid Projects', group: 'Grid', owner: 'Ventusltd/globalgrid2050', renderer: 'grid-projects',
      sourceLabel: 'Existing Ventus News Engine · independently reviewed project associations only'},
    {id: 'offtakers', label: 'Offtakers', group: 'Offtakers', owner: 'Ventusltd/gridatlas', renderer: 'assets', kind: 'offtaker',
      sourceLabel: 'Existing GridAtlas filtered offtaker snapshot · per-record attribution and licences retained',
      data: {url: GRID + 'data/offtakers_filtered_202610292000.geojson', sha256: '16dca56003e7a222e7a74025b9b61db3c1929ac7e34adc38daeb343074e68139', maxBytes: 2600000, rows: 1568, schema: 'geojson.FeatureCollection'}},
    {id: 'prices', label: 'Electricity Prices', group: 'Prices', owner: 'Ventusltd/globalgrid2050', renderer: 'prices',
      sourceLabel: 'Original Electricity Market Intelligence workspace; graphs and data ownership unchanged', url: 'https://globalgrid2050.com/uk_energy_tracking_v6/'}
  ]
};
