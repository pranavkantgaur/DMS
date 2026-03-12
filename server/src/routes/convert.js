/**
 * convert.js — Express route for PDF → AutoCAD DXF conversion
 *
 * POST /api/drawings/:id/convert
 *
 * Pipeline:
 *   1. Fetch drawing record from the database.
 *   2. Resolve and validate the stored PDF path (path-traversal guard).
 *   3. Rasterise page 1 of the PDF to PNG via Ghostscript (pdfToImage).
 *   4. Send the PNG to an on-premise vllm server (vllmClient).
 *      The VLM analyses the drawing and returns structured JSON entities.
 *   5. Generate a DXF R12 file from the entity list (dxfWriter).
 *   6. Stream the DXF file as a download response.
 *
 * Authentication: JWT token required (all authenticated roles may convert).
 * Rate limit: enforced by the dedicated convertLimiter in app.js.
 */

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { pdfPageToBase64 }   = require('../utils/pdfToImage');
const { extractDrawingEntities } = require('../utils/vllmClient');
const { generateDXF }       = require('../utils/dxfWriter');

const router   = express.Router();
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

/**
 * Validates that the resolved path is inside the upload directory
 * to prevent path-traversal attacks.
 */
function resolveUploadPath(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return null;
  }
  return resolved;
}

/**
 * POST /api/drawings/:id/convert
 *
 * Convert a stored drawing PDF to an AutoCAD DXF file and stream it as a
 * file download.
 */
router.post('/:id/convert', authenticateToken, async (req, res) => {
  const drawingId = parseInt(req.params.id, 10);
  if (!Number.isFinite(drawingId)) {
    return res.status(400).json({ error: 'Invalid drawing ID' });
  }

  // ── 1. Look up the drawing ────────────────────────────────────────────────
  let drawing;
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, drawing_number, revision, file_path, file_name FROM drawings WHERE id = ?',
      [drawingId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Drawing not found' });
    }
    drawing = rows[0];
  } catch (err) {
    console.error('[convert] DB lookup failed:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  // ── 2. Resolve & guard the file path ─────────────────────────────────────
  const safePath = resolveUploadPath(drawing.file_path);
  if (!safePath) {
    return res.status(403).json({ error: 'Invalid file path' });
  }
  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'PDF file not found on server' });
  }

  // ── 3. Rasterise PDF → PNG ────────────────────────────────────────────────
  let base64Png;
  try {
    base64Png = await pdfPageToBase64(safePath, 150);
  } catch (err) {
    console.error('[convert] PDF rasterisation failed:', err.message);
    return res.status(500).json({
      error: 'Failed to rasterise PDF. Ensure Ghostscript (gs) is installed on the server.',
      detail: err.message,
    });
  }

  // ── 4. Ask vllm to extract drawing entities ───────────────────────────────
  let entityData;
  try {
    entityData = await extractDrawingEntities(base64Png);
  } catch (err) {
    console.error('[convert] VLM extraction failed:', err.message);
    return res.status(502).json({
      error: 'Failed to extract drawing entities from VLM.',
      detail: err.message,
      hint: 'Check VLLM_BASE_URL, VLLM_MODEL and that the vllm server is running.',
    });
  }

  // ── 5. Generate DXF ───────────────────────────────────────────────────────
  let dxfContent;
  try {
    // Merge title block metadata from the database record if the VLM left fields blank
    if (!entityData.title_block) entityData.title_block = {};
    entityData.title_block.title          ||= drawing.title;
    entityData.title_block.drawing_number ||= drawing.drawing_number || '';
    entityData.title_block.revision       ||= drawing.revision || 'A';

    dxfContent = generateDXF(entityData);
  } catch (err) {
    console.error('[convert] DXF generation failed:', err.message);
    return res.status(500).json({ error: 'Failed to generate DXF file', detail: err.message });
  }

  // ── 6. Stream DXF to client ───────────────────────────────────────────────
  const baseName    = drawing.drawing_number || drawing.title || `drawing_${drawing.id}`;
  const safeName    = baseName.replace(/[^\w.\-]/g, '_');
  const dxfFileName = `${safeName}_Rev${drawing.revision || 'A'}.dxf`;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${dxfFileName}"`);
  res.setHeader('X-Drawing-Id',   String(drawing.id));
  res.setHeader('X-Drawing-Type', entityData.drawing_type || 'unknown');
  res.setHeader('X-Entity-Count', String((entityData.entities || []).length));

  return res.send(dxfContent);
});

module.exports = router;
