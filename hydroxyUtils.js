// https://gis.stackexchange.com/a/272805
// max depth -10000 metres
function heightToRgb (h) {
	const min = 65536;
	const max = 100000;
	const M = (max + h * 10);

	const r = Math.floor(M / min);
	const g = Math.floor(M / 256) - r * 256;
	const b = Math.floor(M) - r * min - g * 256;

	return { r, g, b };
}

// https://docs.mapbox.com/help/troubleshooting/access-elevation-data/#decode-data
// at -3449, r channel is 0 (g is 255, b is 240).
function rgbToHeight (r, g, b) {
	return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

// pixels - int[] with length a multiple of 4
// pixelCoords - {x: double, y: double, z: double}[]
function modifyTilePixels (pixels, pixelCoords, opts={}) {
	opts = {
		tileSize: 512,
		zCutoff: 0.0,
		...opts
	};

	console.log('modifying tile pixels...')
	for (const i in pixelCoords) {
		console.log('pixel', i, '/', pixelCoords.length);

		const { x, y, z } = pixelCoords[i];

		// const row = (opts.tileSize * y) * 4;
		// const col = x * 4;
		// const idx = row + col;
		const idx = ((opts.tileSize * y) + x) * 4;

		const mapboxZ = rgbToHeight(pixels[idx], pixels[idx + 1], pixels[idx + 2]);

		if (mapboxZ <= opts.zCutoff) {
			const { r, g, b } = heightToRgb(z);
			pixels[idx] = r;
			pixels[idx + 1] = g;
			pixels[idx + 2] = b;
		}
	}

	return pixels;
}

module.exports = {
	modifyTilePixels
}
