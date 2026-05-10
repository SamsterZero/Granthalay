import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, '..', 'static');

const sizes = [192, 512];

for (const size of sizes) {
	const svgPath = path.join(__dirname, `icon-${size}.svg`);
	const pngPath = path.join(staticDir, `icon-${size}.png`);

	const svgBuffer = fs.readFileSync(svgPath);
	await sharp(svgBuffer)
		.resize(size, size)
		.png()
		.toFile(pngPath);

	console.log(`Created ${pngPath}`);
}

console.log('Done!');
