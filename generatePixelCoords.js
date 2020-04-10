const fs = require('fs');
const path = require('path');
const redis = require('redis');
const redisClient = redis.createClient({
	host: '127.0.0.1',
	port: 6379
}).on('error', console.error);

const TILE_SIZE = 512;
// const ZOOM_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // As of 2020, Mapbox' RGB tiles go to zoom level 15
const PIXEL_ORIGIN = { x: 1906658, y: 1325278 }; // From Leaflet, for EPSG:3857 (Applicable to Mapbox)
const LATITUDE_MAX = 85.051128779806604;
const EARTH_RADIUS_M = 6378137;
const DEG2RAD = Math.PI / 180.0;

function getScale (z) {
	return 256 * Math.pow(2, z);
}

function project (lon, lat) {
	lat = Math.max(Math.min(LATITUDE_MAX, lat), -LATITUDE_MAX);
	const sin = Math.sin(lat * DEG2RAD);
	return {
		x: EARTH_RADIUS_M * lon * DEG2RAD,
		y: EARTH_RADIUS_M * Math.log((1 + sin) / (1 - sin)) / 2
	}
}

// https://stackoverflow.com/questions/40986573/project-leaflet-latlng-to-tile-pixel-coordinates
function lonLatToTilePixel (lon, lat, z, tileSize, pixelOrigin) {
	const point = project(lon, lat);

	// Perform affine transformation for EPSG:3857
	const scale = getScale(z);
	const coefficient = 0.5 / (Math.PI * EARTH_RADIUS_M);
	point.x = scale * (coefficient * point.x + 0.5);
	point.y = scale * (-coefficient * point.y + 0.5);

	const tile = {
		x: Math.floor(point.x / tileSize),
		y: Math.floor(point.y / tileSize)
	}

	const tileCorner = {
		x: tile.x * tileSize - pixelOrigin.x,
		y: tile.y * tileSize - pixelOrigin.y
	}

	return {
		tile,
		x: Math.round(point.x - pixelOrigin.x - tileCorner.x),
		y: Math.round(point.y - pixelOrigin.y - tileCorner.y)
	}
}

function drawPolygonBorders (poly) {
	function line(x0, y0, x1, y1, depth) {
		const polyLine = [];

		var dx = Math.abs(x1 - x0);
		var dy = Math.abs(y1 - y0);
		var sx = (x0 < x1) ? 1 : -1;
		var sy = (y0 < y1) ? 1 : -1;
		var err = dx - dy;

		while (true) {
			polyLine.push({
				x: x0,
				y: y0,
				z: depth
			});

			if ((x0 === x1) && (y0 === y1)) {
				break;
			}

			const e2 = 2 * err;
			if (e2 > -dy) {
				err -= dy; x0  += sx;
			}
			if (e2 < dx) {
				err += dx; y0  += sy;
			}
		}

		return polyLine;
	}

	const polyLines = [];

	for (let i = 0; i < poly.length - 1; i++) {
		polyLines.push(line(
			poly[i].x,
			poly[i].y,
			poly[i + 1].x,
			poly[i + 1].y,
			poly[i].z
		));
	}

	return polyLines;
}

// [{x,y,z}]
// note: use trapezoidal decomposition
// https://stackoverflow.com/questions/31799038/filling-a-polygon
function fillPolygon (poly, depth) {
	const insideCoords = [];
	const rows = TILE_SIZE;
	const cols = TILE_SIZE;

	const ys = poly.map(({ y }) => y);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);

	if (minY === maxY) {
		console.log('return early y')
		return insideCoords;
	}

	// second row -> second last row
	for (let r = minY + 1; r < rows - 1; r++) {
		if (r === maxY) {
			return insideCoords;
		}

		const xs = poly.filter(({ y }) => y === r).map(({ x }) => x);
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);

		if (minX === maxX) {
			return insideCoords;
		}

		let z = depth ? depth : poly[r + 1].z;
		let FILLING = true;

		for (let c = minX + 1; c < cols - 1; c++) {
			const cell = poly.find(({ x, y }) => y === r && x === c);

			if (cell) {
				z = cell.z;
			}

			if (c === maxX) {
				break;
			} else if (cell) {
				continue;
			}

			if (!FILLING && cell) {
				FILLING = true;
			}

			if (FILLING) {
				insideCoords.push({
					x: c,
					y: r,
					z: z
				});
			}
		}
	}

	return insideCoords;
}

// const ZOOM_LEVELS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]; // As of 2020, Mapbox' RGB tiles go to zoom level 15
const ZOOM_LEVELS = [13];
const fpath = './util/example-depth-data.geojson';
const { features } = JSON.parse(fs.readFileSync(fpath))
const tilePixelCoordsMap = new Map();

for (let z of ZOOM_LEVELS) {
	for (const ft of features) {
		const depth = -ft.properties.CONTOUR;

		for (const [lon, lat] of ft.geometry.coordinates) {
			// z -1 for 512x512 tiles, see https://wiki.openstreetmap.org/wiki/Zoom_levels
			const { tile, x, y } = lonLatToTilePixel(lon, lat, z-1, TILE_SIZE, PIXEL_ORIGIN);
			const tileCoord = `${z-2}/${tile.x}/${tile.y}`;

			const pixelCoord = {x, y, z: depth};

			let existingTileItem = tilePixelCoordsMap.get(tileCoord);
			if (!existingTileItem) {
				const item = new Map();
				item.set(depth, [pixelCoord]);
				tilePixelCoordsMap.set(tileCoord, item);
			} else {
				if (!existingTileItem.get(depth)) {
					existingTileItem.set(depth, [pixelCoord]);
				} else {
					const existingDepthItem = existingTileItem.get(depth);
					existingTileItem.set(depth, existingDepthItem.concat([pixelCoord]))
				}
				tilePixelCoordsMap.set(tileCoord, existingTileItem)
			}
		}
	}
}

tilePixelCoordsMap.forEach((tileDepthMap, tileCoord) => {
	const k = tileCoord.split('/').join(':');
	const v = [];

	for (const k of [...tileDepthMap.keys()].sort()) {
		let pixelCoords = tileDepthMap.get(k);
		// const polyLines = drawPolygonBorders(pixelCoords);
		// pixelCoords = pixelCoords.concat(polyLines.flat());
		const insideCoords = fillPolygon(pixelCoords, parseInt(k));
		pixelCoords = pixelCoords.concat(insideCoords);
		v.push(pixelCoords);
	}

	redisClient.set(k, JSON.stringify(v.flat()), () => console.log('set', k));
});
