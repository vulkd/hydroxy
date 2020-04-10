const getColorRange = (range, len) => {
	const _rgb = hex => [hex >> 16, (hex & 0x00ff00) >> 8, hex & 0x0000ff];
	const arrStart = _rgb(range[0]);
	const arrDiff = _rgb(range[1] - range[0]);
	return (ic) => {
		let r = arrStart[0] + Math.floor(ic * arrDiff[0] / len);
		let g = arrStart[1] + Math.floor(ic * arrDiff[1] / len);
		let b = arrStart[2] + Math.floor(ic * arrDiff[2] / len);
		// console.log('r g b:', r, g, b);
		return (r << 16) + (g << 8) + b;
	};
};

const getRGBFromHeight = (height) => {
	// Absolute bloody legend: https://gis.stackexchange.com/a/272805
	// max depth -10000 metres
	const min = 65536;
	const max = 100000;
	const dem = height;
	r = Math.floor((max + dem * 10) / min);
	g = Math.floor((max + dem * 10) / 256) - r * 256;
	b = Math.floor(max + dem * 10) - r * min - g * 256;
	return { r, g, b };
}

const getHeightFromRGB = (R, G, B, opts={}) => {
	// at -3449, r channel is 0. (g:255, b:240).
	return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
}

const pixelsToDepth = (pixels, opts={}) => {
	let elevations = [];
	if (pixels) {
		let R,G,B
		let zs = []
		for (let i = 0; i < pixels.data.length; i += 4) {
			R = pixels.data[i];
			G = pixels.data[i + 1];
			B = pixels.data[i + 2];
			const z = getHeightFromRGB(R, G, B);

			// if (z < 0.0) {
				// console.log('HIT', R,G,B, z)
			// }
			// if (R === 1 && G === 134 && B === 60) {
			// if (R === 1 && G === 134 && B === 60) {
			// }

			elevations.push(z);
			zs.push({R,G,B,z});
		}
		zs = zs.slice(0, 20)
	} else {
		if (!opts.size) {
			throw new Error('No pixels - fallback size needed');
		}
		elevations = new Array(opts.size * opts.size).fill(0);
	}

	return elevations;
}

module.exports = {
	pixelsToDepth,
	getHeightFromRGB,
	getColorRange
}
