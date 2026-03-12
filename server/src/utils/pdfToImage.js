/**
 * pdfToImage.js
 *
 * Converts the first page of a PDF file to a base64-encoded PNG image using
 * Ghostscript (gs), which is available on the deployment server.
 *
 * Install on Ubuntu/Debian: apt-get install -y ghostscript
 * Install on RHEL/CentOS:   yum install -y ghostscript
 */

'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Render the first page of a PDF to a base64-encoded PNG.
 *
 * @param {string} pdfPath  Absolute path to the source PDF file.
 * @param {number} [dpi=150] Resolution for rasterisation (higher = better quality but larger image).
 * @returns {Promise<string>} Base64-encoded PNG string (no data-URI prefix).
 * @throws If Ghostscript is not installed or the PDF cannot be rendered.
 */
async function pdfPageToBase64(pdfPath, dpi = 150) {
  // Validate the source file exists
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Write output to a deterministic temp path
  const tmpDir = os.tmpdir();
  const outputPng = path.join(tmpDir, `dms_convert_${Date.now()}_${process.pid}.png`);

  try {
    await execFileAsync('gs', [
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-sDEVICE=png16m',
      `-r${dpi}`,
      '-dFirstPage=1',
      '-dLastPage=1',
      `-sOutputFile=${outputPng}`,
      pdfPath,
    ], {
      timeout: 30_000, // 30 s cap for rasterisation
    });

    if (!fs.existsSync(outputPng)) {
      throw new Error('Ghostscript did not produce an output file.');
    }

    const buffer = fs.readFileSync(outputPng);
    return buffer.toString('base64');
  } finally {
    // Always clean up temp file
    try { fs.unlinkSync(outputPng); } catch { /* ignore */ }
  }
}

module.exports = { pdfPageToBase64 };
