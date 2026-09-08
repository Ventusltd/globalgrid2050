# Geography and grid

V7 will restore coordinates from the official REPD record and emit canonical GeoJSON keyed by REPD Ref and GlobalGrid project ID. The unversioned legacy GeoJSON cannot be joined safely because it lacks those identities.

Grid evidence has two classes. A confirmed project grid event requires an explicit site, connection, substation or queue relationship. A regional NESO, National Grid or DNO issue may be shown as grid context, but proximity alone must never be represented as a confirmed impact or connection.
