import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sizes = [192, 512];
const text = 'ग्रं';
const bgColor = '#0D5C63';
const textColor = '#FFFFFF';

for (const size of sizes) {
	const fontSize = size === 192 ? 96 : 280;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
	<rect width="100%" height="100%" fill="${bgColor}"/>
	<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
		font-family="'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
		font-size="${fontSize}" font-weight="700" fill="${textColor}">${text}</text>
</svg>`;

	const svgPath = path.join(__dirname, `icon-${size}.svg`);
	fs.writeFileSync(svgPath, svg);
	console.log(`Created ${svgPath}`);
}

console.log('SVG icons generated. Install sharp to convert to PNG:');
console.log('  bun add -d sharp  (or npm install --save-dev sharp)');
console.log('Then run: node scripts/convert-icons.js');
