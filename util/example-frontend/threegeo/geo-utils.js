import Utils from './Utils.js';
import turfDestination from '@turf/destination';
import cover from '@mapbox/tile-cover';
import * as turfHelpers from '@turf/helpers';

const originRadiusToBbox  = (origin, radius) => {
	const _swap = ll => [ll[1], ll[0]];
	const [w, n] = turfDestination(turfHelpers.point(_swap(origin)), radius, -45, {units: 'kilometers'}).geometry.coordinates;
	const [e, s] = turfDestination(turfHelpers.point(_swap(origin)), radius, 135, {units: 'kilometers'}).geometry.coordinates;
	return [w, s, e, n];
}

// module.exports = {
// 	originRadiusToBbox,
// 	getBbox,
// 	getProjection,
// 	getZoomposCovered,
// getUnitsPerMeter
// }

const getBbox = (origin, radius) => {
	const testPolygon = {"type": "FeatureCollection","features": [{"type": "Feature","properties": {},"geometry": {"type": "Polygon","coordinates": [[]]}}]};
	const polygon = testPolygon.features[0];
	const [w, s, e, n] = originRadiusToBbox(origin, radius);
	const nw = [w, n], se = [e, s];
	polygon.geometry.coordinates[0] = [
		nw,
		[se[0], nw[1]],
		se,
		[nw[0], se[1]],
		nw
	];
	return {
		feature: polygon,
		northWest: nw,
		southEast: se,
	};
}

const getUnitsPerMeter = (unitsSide, radius) => {
	return unitsSide / (radius * Math.pow(2, 0.5) * 1000);
}

const projectCoordStatic = (coord, nw, se, unitsSide) => {
	// lng, lat -> px, py
	return [
		unitsSide * (-0.5 + (coord[0] - nw[0]) / (se[0] - nw[0])),
		unitsSide * (-0.5 - (coord[1] - se[1]) / (se[1] - nw[1]))
	];
}

module.exports = {
	originRadiusToBbox,
	getBbox,
	getUnitsPerMeter,
	projectCoordStatic
}


