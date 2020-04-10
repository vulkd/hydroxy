import uniq from 'uniq';

// :::      .::..,::::::   .,-:::::::::::::::::   ...    :::::::..
// ';;,   ,;;;' ;;;;'''' ,;;;'````';;;;;;;;''''.;;;;;;;. ;;;;``;;;;
//  \[[  .[[/    [[cccc  [[[            [[    ,[[     \[[,[[[,/[[['
//   Y$c.$$"     $$""""  $$$            $$    $$$,     $$$$$$$$$c
//    Y88P       888oo,__`88bo,__,o,    88,   "888,_ _,88P888b "88bo,
//     MP        """"YUMMM "YUMMMMMP"   MMM     "YMMMMMP" MMMM   "W"
const getContours = (eleList, geojson, polygon, maxArea) => {
	let contours = [];

	// iterate through elevations, and merge polys of the same elevation
	for (let x = 0; x < eleList.length; x++) {
		// console.log(`getContours(): ${x}/${eleList.length}`);
		let currentElevation = eleList[x];
		let elevationPolys = geojson.features.filter((feature) => {
			return feature.properties.ele === currentElevation;
		});

		try { // merge between tiles
			let feats = turfHelpers.featureCollection(elevationPolys).features;
			// console.log(currentElevation, feats.length, feats);
			// feats.forEach(feat => { console.log('type:', feat.geometry.type); }); // 'Polygon'

			let mergedElevationPoly = feats.reduce(((accm, feat) => turfUnion(accm, feat)), feats[0]);
			// console.log('@@@', mergedElevationPoly, currentElevation);

			if (0) { // trim to desired search area
				mergedElevationPoly = turfIntersect(polygon, mergedElevationPoly);
			}

			// console.log('@@@mergedElevationPoly:', mergedElevationPoly);
			if (mergedElevationPoly) {
				// console.log('@@@merge success', currentElevation);
				let contourArea = turfArea(mergedElevationPoly.geometry);
				// L.mapbox.featureLayer().setGeoJSON(mergedElevationPoly).addTo(map);

				contours.push({
					'geometry': mergedElevationPoly,
					'ele': currentElevation,
					'area': contourArea,
				});
			}
		} catch (error) {
			// on merge fail, insert the previous contour again and skip
			console.log('merge failed at elevation '+ currentElevation, error);
		}
	}

	// remove contour undercuts
	if (0) {
		for (let m = contours.length-2; m >= 0; m--) {
			let currContour = contours[m];
			let prevContour = contours[m+1];
			if (currContour.area >= maxArea && prevContour.area >= maxArea) {
				console.log('max area reached! ele, area:', currContour.ele, currContour.area);
				contours = contours.slice(m+1);
				break;
			}
		}
	}

	return contours;
}

const buildSliceGeometry = (coords, iContour, color, contours, nw, se, radius) => {
	const shadedContour = new THREE.Shape();
	const wireframeContours = [new THREE.Geometry()];

	const h = iContour;
	const unitsPerMeter = getUnitsPerMeter(this.constUnitsSide, radius);
	const pz = - contours[h].ele * unitsPerMeter;

	// iterate through vertices per shape
	// console.log('coords[0]:', coords[0]);
	coords[0].forEach((coord, index) => {
		let [px, py] = this._projectCoord(coord, nw, se);
		wireframeContours[0].vertices.push(new THREE.Vector3(-px, py, pz));
		if (index === 0) {
			shadedContour.moveTo(-px, py);
		} else {
			shadedContour.lineTo(-px, py);
		}
	});

	// carve out holes (if none, would automatically skip this)
	for (let k = 1; k < coords.length; k++) {
		// console.log('holes');
		let holePath = new THREE.Path();
		wireframeContours.push(new THREE.Geometry());

		// iterate through hole path vertices
		for (let j = 0; j < coords[k].length; j++) {
			let [px, py] = this._projectCoord(coords[k][j], nw, se);
			wireframeContours[k].vertices.push(new THREE.Vector3(-px, py, pz));
			if (j === 0) {
				holePath.moveTo(-px, py);
			} else {
				holePath.lineTo(-px, py);
			}
		}
		shadedContour.holes.push(holePath);
	}

	const lines = [];
	wireframeContours.forEach((_loop, _index) => {
		let line = new THREE.Line(
			wireframeContours[0],
			new THREE.LineBasicMaterial({ color: 0xcccccc }));

		//======== align x-y : east-north
		line.rotation.y = Math.PI;
		line.name = `dem-vec-line-${contours[h].ele}-${line.uuid}`;

		// line.visible = false;
		lines.push(line);
	});

	let extrudeGeom = new THREE.ExtrudeGeometry(shadedContour, {
		depth: contours[h+1] ?
		unitsPerMeter * (contours[h+1].ele - contours[h].ele) :
		unitsPerMeter * (contours[h].ele - contours[h-1].ele),
		bevelEnabled: false,
	});
	let extrudeShade = new THREE.Mesh(extrudeGeom, new THREE.MeshBasicMaterial({
		color: color,
		wireframe: false,
		// wireframe: true,
	}));

	//======== align x-y : east-north
	extrudeShade.rotation.y = Math.PI;
	extrudeShade.position.z = -pz;
	extrudeShade.name = `dem-vec-shade-${contours[h].ele}-${extrudeShade.uuid}`;

	return [lines, extrudeShade];
}

const getVectorDem = (contours, northWest, southEast, radius) => {
	// console.log('_getVectorDem():', contours, northWest, southEast, radius);
	const colorRange = getColorRange([0x231918, 0xed6356], contours.length);

	const objs = [];
	const addSlice = (coords, ic) => {
		// console.log('coords:', coords);
		let [lines, extrudeShade] = this.buildSliceGeometry(
			coords, ic, colorRange(ic),
			contours, northWest, southEast, radius);
		lines.forEach((line) => { objs.push(line); });
		objs.push(extrudeShade);
	};

	// iterate through elevations
	for (let ic = 0; ic < contours.length; ic++) {
		let level = contours[ic].geometry.geometry;
		// if (ic !== 110) continue; // debug

		// console.log('level.type:', level.type);
		if (level.type === 'Polygon') {
			addSlice(level.coordinates, ic);
		} else if (level.type === 'MultiPolygon') {
			// iterate through shapes per elevation
			for (let i = 0; i < level.coordinates.length; i++) {
				addSlice(level.coordinates[i], ic);
			}
		}
	}
	return objs;
}

const processVectorTile = (tile, zoompos, geojson, bottomTiles) => {
	const contour = tile.layers.contour;
		// zoom <= 8
	if (!contour) {
		console.log(`processVectorTile(): no contours! (zoom=${zoompos[0]})`);
		return;
	}

		//populate geoJSON
		// convert each feature (within #population) into a geoJSON polygon,
		// and push it into our variable
	for (let i = 0; i < tile.layers.contour.length; i++) {
		let feature = tile.layers.contour.feature(i)
		.toGeoJSON(zoompos[1], zoompos[2], zoompos[0]);
		if (i === 0) {
			bottomTiles.push(feature);
		}

			// break multigons into multiple polygons
		if (feature.geometry.type === 'MultiPolygon') {
			feature.geometry.coordinates.forEach((polygon) => {
				let feat = {
					type: 'Feature',
					properties: {ele: feature.properties.ele},
					geometry: {type: 'Polygon', coordinates: polygon},
				};
				geojson.features.push(feat);
			});
		} else {
			// single polygons can be pushed in as-is
			geojson.features.push(feature);
		}
	}
}

const getEleList = (geojson) => {
	return uniq(geojson.features.map(feat => feat.properties.ele)).sort((a, b) => a - b);
}

const addBottomEle = (geojson, bottomTiles, eleList) => {
	bottomTiles.forEach((bottom) => {
		const tileBottomEle = bottom.properties.ele;
		for (let _ele = eleList[0]; _ele < tileBottomEle; _ele += 10) {
			// console.log('k:', k);
			geojson.features.push({
				type: "Feature",
				geometry: bottom.geometry,
				properties: {ele: _ele},
			});
		}
	});
}

const processVectorGeojson = (geojson, bottomTiles, polygon, radius) => {
		// console.log('polygon:', polygon);
		// console.log('bottomTiles:', bottomTiles);
	let eleList = getEleList(geojson);
		// console.log('eleList:', eleList);
	addBottomEle(geojson, bottomTiles, eleList);
		// console.log('geojson:', geojson);

	let maxArea = radius * radius * 2 * 1000000; // (r * sqrt2 * 1000)**2
	let contours = getContours(eleList, geojson, polygon, maxArea);
	// console.log('contours:', contours);
	return contours;
}


module.exports = {
	getVectorDem,
	processVectorGeojson,
	processVectorTile
}
