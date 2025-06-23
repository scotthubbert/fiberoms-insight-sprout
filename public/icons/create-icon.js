// Simple script to create a blue square PNG icon
const canvas = document.createElement('canvas');
canvas.width = 192;
canvas.height = 192;
const ctx = canvas.getContext('2d');

// Fill with primary color
ctx.fillStyle = '#1976d2';
ctx.fillRect(0, 0, 192, 192);

// Add white text
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 96px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('F', 96, 96);

// Convert to data URL
console.log('Copy this base64 data for icon-192.png:');
console.log(canvas.toDataURL('image/png').split(',')[1]);