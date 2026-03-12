/**
 * dxfWriter.js
 *
 * Generates a minimal DXF R12 (AC1009) file from a structured JSON entity list
 * produced by the VLM conversion pipeline.
 *
 * DXF R12 is chosen for maximum compatibility: it is readable by every version
 * of AutoCAD since Release 12 (1992) and by all major CAD viewers.
 *
 * Supported entity types (VLM schema → DXF entity):
 *   LINE        → LINE
 *   CIRCLE      → CIRCLE
 *   ARC         → ARC
 *   POLYLINE    → POLYLINE + VERTEX + SEQEND
 *   RECTANGLE   → 4 × LINE entities
 *   TEXT        → TEXT
 */

'use strict';

// Layer colour mapping (AutoCAD colour index)
const LAYER_COLOURS = {
  '0':          7,  // white / black
  BORDER:       7,
  WALLS:        1,  // red
  STRUCTURAL:   1,
  EQUIPMENT:    3,  // green
  PIPING:       5,  // blue
  ELECTRICAL:   4,  // cyan
  INSTRUMENTATION: 6, // magenta
  ANNOTATIONS:  2,  // yellow
  DIMENSIONS:   4,
  TEXT:         2,
  HIDDEN:       8,  // grey
  CENTERLINE:   1,
};

/**
 * Round a number to 4 decimal places to keep the DXF compact.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  return Number(n || 0).toFixed(4);
}

/**
 * Build the LAYER TABLE section.
 * @param {Set<string>} layers
 * @returns {string}
 */
function buildLayerTable(layers) {
  let t = `0\nTABLE\n2\nLAYER\n70\n${layers.size}\n`;
  for (const name of layers) {
    const colour = LAYER_COLOURS[name] ?? 7;
    t += `0\nLAYER\n2\n${name}\n70\n64\n62\n${colour}\n6\nCONTINUOUS\n`;
  }
  t += '0\nENDTAB\n';
  return t;
}

/**
 * Serialise a single entity to DXF group codes.
 * @param {object} e
 * @returns {string}
 */
function entityToDxf(e) {
  const L = e.layer || '0';
  switch ((e.type || '').toUpperCase()) {
    case 'LINE':
      return (
        `0\nLINE\n8\n${L}\n` +
        `10\n${fmt(e.x1)}\n20\n${fmt(e.y1)}\n30\n0.0000\n` +
        `11\n${fmt(e.x2)}\n21\n${fmt(e.y2)}\n31\n0.0000\n`
      );

    case 'CIRCLE':
      return (
        `0\nCIRCLE\n8\n${L}\n` +
        `10\n${fmt(e.cx)}\n20\n${fmt(e.cy)}\n30\n0.0000\n` +
        `40\n${fmt(e.radius)}\n`
      );

    case 'ARC':
      return (
        `0\nARC\n8\n${L}\n` +
        `10\n${fmt(e.cx)}\n20\n${fmt(e.cy)}\n30\n0.0000\n` +
        `40\n${fmt(e.radius)}\n` +
        `50\n${fmt(e.start_angle)}\n51\n${fmt(e.end_angle)}\n`
      );

    case 'POLYLINE': {
      const closed = e.closed ? 1 : 0;
      let s = `0\nPOLYLINE\n8\n${L}\n66\n1\n70\n${closed}\n`;
      for (const [x, y] of (e.points || [])) {
        s += `0\nVERTEX\n8\n${L}\n10\n${fmt(x)}\n20\n${fmt(y)}\n30\n0.0000\n`;
      }
      s += '0\nSEQEND\n';
      return s;
    }

    case 'RECTANGLE': {
      const { x = 0, y = 0, width: w = 0, height: h = 0 } = e;
      const [x2, y2] = [x + w, y + h];
      return (
        `0\nLINE\n8\n${L}\n10\n${fmt(x)}\n20\n${fmt(y)}\n30\n0.0000\n11\n${fmt(x2)}\n21\n${fmt(y)}\n31\n0.0000\n` +
        `0\nLINE\n8\n${L}\n10\n${fmt(x2)}\n20\n${fmt(y)}\n30\n0.0000\n11\n${fmt(x2)}\n21\n${fmt(y2)}\n31\n0.0000\n` +
        `0\nLINE\n8\n${L}\n10\n${fmt(x2)}\n20\n${fmt(y2)}\n30\n0.0000\n11\n${fmt(x)}\n21\n${fmt(y2)}\n31\n0.0000\n` +
        `0\nLINE\n8\n${L}\n10\n${fmt(x)}\n20\n${fmt(y2)}\n30\n0.0000\n11\n${fmt(x)}\n21\n${fmt(y)}\n31\n0.0000\n`
      );
    }

    case 'TEXT':
      // Escape backslash and special DXF control characters in text content
      return (
        `0\nTEXT\n8\n${L}\n` +
        `10\n${fmt(e.x)}\n20\n${fmt(e.y)}\n30\n0.0000\n` +
        `40\n${fmt(e.height || 5)}\n` +
        `1\n${String(e.text || '').replace(/\\/g, '\\\\').replace(/\n/g, ' ')}\n`
      );

    default:
      return ''; // Skip unknown entity types
  }
}

/**
 * Generate a complete DXF R12 document.
 *
 * @param {object} data  Parsed VLM output.
 * @param {object[]} [data.entities=[]]    List of entity objects.
 * @param {object}   [data.canvas={}]      { width, height } in mm.
 * @param {object}   [data.title_block={}] Title block metadata.
 * @param {string}   [data.drawing_type=''] Drawing type label.
 * @returns {string} DXF file content as a string.
 */
function generateDXF(data = {}) {
  const {
    entities = [],
    canvas   = {},
    title_block = {},
    drawing_type = '',
  } = data;

  const width  = Number(canvas.width)  || 420;
  const height = Number(canvas.height) || 297;

  // Collect all layer names used
  const layers = new Set(['0']);
  for (const e of entities) {
    if (e.layer) layers.add(String(e.layer).toUpperCase());
  }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  let dxf = '';
  dxf += '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1009\n';                               // DXF R12
  dxf += '9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n';
  dxf += `9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0\n`;
  dxf += `9\n$EXTMAX\n10\n${fmt(width)}\n20\n${fmt(height)}\n30\n0.0\n`;
  dxf += `9\n$LIMMIN\n10\n0.0\n20\n0.0\n`;
  dxf += `9\n$LIMMAX\n10\n${fmt(width)}\n20\n${fmt(height)}\n`;
  dxf += '9\n$MEASUREMENT\n70\n1\n';                               // metric
  dxf += '0\nENDSEC\n';

  // ── TABLES ──────────────────────────────────────────────────────────────────
  dxf += '0\nSECTION\n2\nTABLES\n';

  // LTYPE table (minimal — just CONTINUOUS)
  dxf += (
    '0\nTABLE\n2\nLTYPE\n70\n1\n' +
    '0\nLTYPE\n2\nCONTINUOUS\n70\n64\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n' +
    '0\nENDTAB\n'
  );

  // LAYER table
  dxf += buildLayerTable(layers);

  // STYLE table (one standard text style)
  dxf += (
    '0\nTABLE\n2\nSTYLE\n70\n1\n' +
    '0\nSTYLE\n2\nSTANDARD\n70\n64\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n0.2\n3\ntxt\n4\n\n' +
    '0\nENDTAB\n'
  );

  dxf += '0\nENDSEC\n';

  // ── BLOCKS ──────────────────────────────────────────────────────────────────
  dxf += (
    '0\nSECTION\n2\nBLOCKS\n' +
    '0\nBLOCK\n8\n0\n2\n$MODEL_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n$MODEL_SPACE\n1\n\n' +
    '0\nENDBLK\n' +
    '0\nENDSEC\n'
  );

  // ── ENTITIES ────────────────────────────────────────────────────────────────
  dxf += '0\nSECTION\n2\nENTITIES\n';

  // Add a comment TEXT entity in the title area if title block info is present
  if (title_block.title) {
    dxf += entityToDxf({
      type: 'TEXT',
      x: 10, y: height - 15,
      text: title_block.title,
      height: 7,
      layer: 'TEXT',
    });
  }
  if (title_block.drawing_number) {
    dxf += entityToDxf({
      type: 'TEXT',
      x: 10, y: height - 25,
      text: `DWG: ${title_block.drawing_number}  REV: ${title_block.revision || '-'}`,
      height: 5,
      layer: 'TEXT',
    });
  }
  if (drawing_type) {
    dxf += entityToDxf({
      type: 'TEXT',
      x: 10, y: height - 35,
      text: `Type: ${drawing_type}`,
      height: 4,
      layer: 'TEXT',
    });
  }

  // Serialise all entities from VLM output
  for (const entity of entities) {
    const chunk = entityToDxf(entity);
    if (chunk) dxf += chunk;
  }

  dxf += '0\nENDSEC\n';
  dxf += '0\nEOF\n';

  return dxf;
}

module.exports = { generateDXF };
