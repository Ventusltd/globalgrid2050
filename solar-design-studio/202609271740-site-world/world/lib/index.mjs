// lib/index.mjs: the shared world library as one object, and its version.
// LIB_VERSION goes up whenever a lib file changes what it returns or takes. tools/world-manifest.mjs writes it and
// each lib file's SHA-256 into the manifest; a layer declares the version it was written for (export const
// LIB_VERSION) and the substrate refuses a layer whose version is not the one it serves. The substrate serves the
// lib files it has hash-checked (layers.mjs); this static copy is for cartridges' tests and for makeApi's default.
import * as tiles from './tiles.mjs';
import * as drape from './drape.mjs';
import * as earthworks from './earthworks.mjs';

export const LIB_VERSION = 1;
export const LIB_FILES = Object.freeze(['tiles', 'drape', 'earthworks']);   // web/world/lib/<id>.mjs, hashed in the manifest

export default Object.freeze({ version: LIB_VERSION, tiles, drape, earthworks });
