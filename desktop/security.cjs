'use strict';

const API_PATHS = new Set(['/api/status', '/api/verify', '/api/osint']);
function validKey(value) {
  return typeof value === 'string' && value.trim().length >= 16 && value.trim().length <= 1024 && !/\s/.test(value.trim());
}
function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function panelBounds(workArea) {
  const width = Math.min(460, Math.max(350, Math.round(workArea.width / 4)));
  const height = Math.min(840, workArea.height - 32);
  return {x: workArea.x + workArea.width - width - 16, y: workArea.y + workArea.height - height - 16, width, height};
}
function bubbleBounds(workArea) {
  return {x: workArea.x + workArea.width - 106, y: workArea.y + workArea.height - 106, width: 90, height: 90};
}
module.exports = {API_PATHS, validKey, externalUrl, panelBounds, bubbleBounds};
