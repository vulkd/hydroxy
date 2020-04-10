import xhr from 'xhr';
import getPixels from 'get-pixels';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const dumpBufferAsBlob = (buffer, name) => {
	// https://discourse.threejs.org/t/how-to-create-a-new-file-and-save-it-with-arraybuffer-content/628/2
	let file = new Blob([buffer], {type: "application/octet-stream"});
	let anc = document.createElement("a");
	anc.href = URL.createObjectURL(file);
	anc.download = name;
	document.body.appendChild(anc);
	anc.click();
}

const blobToBuffer = (blob, cb) => {
	// https://stackoverflow.com/questions/15341912/how-to-go-from-blob-to-arraybuffer
	let fr = new FileReader();
	fr.onload = (e) => {
		let buffer = e.target.result;
		cb(buffer);
	};
	fr.readAsArrayBuffer(blob);
}

const getUriOffline = (api, zoompos) => {
	return `${api}-${zoompos.join('-')}.blob`;
}

const getUriMapbox = (token, api, zoompos) => {
	let prefix, res;
	switch (api) {
		case 'mapbox-terrain-vector':
		prefix = 'https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2';
		res = '.vector.pbf';
		break;

		case 'mapbox-terrain-rgb':
		prefix = `https://api.mapbox.com/v4/mapbox.terrain-rgb`;
		res = '@2x.pngraw';
		break;

		case 'mapbox-satellite':
		prefix = `https://api.mapbox.com/v4/mapbox.streets-satellite`;
		// https://www.mapbox.com/api-documentation/#retrieve-tiles
		// mapbox-satellite-14-3072-6420.blob
		// res = '@2x.png'; // 176813 (will get a jpg by spec)
		// res = '@2x.jpg90'; // 132759
		// res = '@2x.jpg80';
		// 72828
		res = '@2x.jpg70';
		break;

		default:
		console.error('unsupported api:', api);
		return '';
	}
	return `${prefix}/${zoompos.join('/')}${res}?access_token=${token}`;
}

const isAjaxSuccessful = (stat) => {
	return stat >= 200 && stat < 300 || stat === 304;
}

const processTilesVector = (isOnline, dumpBlobForDebug, uri, api, zoompos) => {
	return new Promise((resolve, reject) => {
		if (isOnline) {
			if (dumpBlobForDebug) {
				xhrDumpBlob(uri, api, zoompos);
			}

			xhr({uri: uri, responseType: 'arraybuffer'}, (error, response, buffer) => {
				if (error || !isAjaxSuccessful(response.statusCode)) {
					reject(error);
				}

				cb(new VectorTile(new Pbf(buffer)));
			});
		} else {
			xhr({uri: uri, responseType: 'blob'}, (error, response, blob) => {
				if (error || !isAjaxSuccessful(response.statusCode)) {
					reject(error);
				}

				blobToBuffer(blob, (buffer) => {
					try {
						let pbf = new Pbf(buffer);
						resolve(new VectorTile(pbf));
					} catch (err) {
						reject(err)
					}
				});
			});
		}
	})
};

const processTilesSatellite = (shouldDumpBlob, uri, api, zoompos) => {
	return new Promise((resolve, reject) => {
		if (shouldDumpBlob) {
			xhrDumpBlob(uri, api, zoompos);
		}

		// uri = uri.split('satellite/').slice(-1)[0].split('/');
		// const z = uri.shift()
		// const x = uri.shift()
		// const y = uri.shift().split('@')[0]
		// const tileUri = `${z}/${y}/${x}`
		// uri = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/${tileUri}`
		// uri = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tileUri}`

		getPixels(uri, (err, pixels) => {
			if (err) {
				reject('Bad image uri:', uri, err);
			}
			resolve(pixels);
		});
	});
}

const processTilesTerrain = (shouldDumpBlob, uri, api, zoompos) => {
	return new Promise((resolve, reject) => {
		if (shouldDumpBlob) {
			xhrDumpBlob(uri, api, zoompos);
		}

		// if (uri.includes('1861/1294')) {
		// 	uri = 'http://127.0.0.1:5555/2 copy.png'
		// }

		// uri = `http://127.0.0.1:3000/${zoompos.join('/')}?recache=true`
		uri = `http://127.0.0.1:3000/${zoompos.join('/')}`

		getPixels(uri, (err, pixels) => {
			if (err) {
				reject('Bad image uri:', uri, err);
			}
			resolve(pixels);
		});
	});
};

const fetchTile = (zoompos, api, token) => {
	return new Promise(async (resolve, reject) => {
		const isOnline = api.startsWith('mapbox-');
		const uri = isOnline ? getUriMapbox(token, api, zoompos) : getUriOffline(api, zoompos);

		const xhrDumpBlob = (uri, api, zoompos) => {
			xhr({uri: uri, responseType: 'arraybuffer'}, (error, response, buffer) => {
				if (error || !isAjaxSuccessful(response.statusCode)) {
					return;
				}

				let name = `${api}-${zoompos.join('-')}.blob`;
				dumpBufferAsBlob(buffer, name);
			});
		};
		const dumpBlobForDebug = 0;

		const shouldDumpBlob = isOnline && dumpBlobForDebug;

		if (api.includes('mapbox-terrain-vector')) {
			resolve(await processTilesVector(isOnline, dumpBlobForDebug, uri, api, zoompos));
		} else if (api.includes('mapbox-satellite')) {
			resolve(await processTilesSatellite(shouldDumpBlob, uri, api, zoompos));
		} else if (api.includes('mapbox-terrain-rgb')) {
			resolve(await processTilesTerrain(shouldDumpBlob, uri, api, zoompos));
		} else {
			reject('API not supported');
		}
	})
};


module.exports = {
	dumpBufferAsBlob,
	blobToBuffer,
	getUriOffline,
	getUriMapbox,
	isAjaxSuccessful,
	fetchTile
};
