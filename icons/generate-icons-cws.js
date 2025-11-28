/**
 * Chrome Web Store Icon Generator
 * Follows official guidelines: https://developer.chrome.com/docs/webstore/images#icons
 * - 128x128px total size
 * - 96x96px artwork area (centered)
 * - 16px transparent padding on all sides
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const AMBER = '#f59e0b';
const AMBER_LIGHT = '#fbbf24';
const ICON_TEXT = '#1a1a1a';

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Scale factor (128px is the base)
  const scale = size / 128;
  const padding = 16 * scale;
  const artworkSize = 96 * scale;
  const cornerRadius = 18 * scale;
  
  // Artwork area coordinates
  const x = padding;
  const y = padding;
  const w = artworkSize;
  const h = artworkSize;
  const r = cornerRadius;
  
  // Draw rounded rectangle background
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  
  // Gradient fill for depth
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, AMBER_LIGHT);
  gradient.addColorStop(1, AMBER);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw the "?" symbol
  const centerX = size / 2;
  const centerY = size / 2;
  const fontSize = Math.round(64 * scale);
  
  ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text shadow for depth
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillText('?', centerX + 1 * scale, centerY + 2 * scale);
  
  // Main text
  ctx.fillStyle = ICON_TEXT;
  ctx.fillText('?', centerX, centerY);
  
  return canvas;
}

// Generate all sizes
const sizes = [16, 48, 128];
const outputDir = __dirname;

sizes.forEach(size => {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(outputDir, `icon${size}.png`);
  
  fs.writeFileSync(filename, buffer);
  console.log(`✓ Generated ${filename}`);
});

console.log('\nAll icons generated successfully!');
console.log('Icons follow Chrome Web Store guidelines:');
console.log('  - 128x128px total with 96x96px artwork');
console.log('  - 16px transparent padding');
console.log('  - Works on light & dark backgrounds');

