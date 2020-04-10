const path = require('path');
const { createWriteStream } = require('fs');
const { access } = require('fs').promises;

const cors = require('cors');
const mkdirp = require('mkdirp');
const express = require('express');
const request = require('request');
const PNG = require('pngjs').PNG;
const redis = require('redis');

const { modifyTilePixels } = require('./hydroxyUtils');

const MAPBOX_ACCESS_TOKEN = '$YOUR_MAPBOX_TOKEN_HERE$';

const redisClient = redis.createClient({
	host: '127.0.0.1',
	port: 6379
}).on('error', console.error);

function cacheTile (x, y, z, tilePath, res) {
	const resolution = '@2x';
	const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${y}/${x}${resolution}.pngraw?access_token=${MAPBOX_ACCESS_TOKEN}`;

	redisClient.get(`${z}:${y}:${x}`, (err, reply) => {
		// on unreliable mobile network, just cache everything:
		// console.log(`caching ${z}:${y}:${x}...`);
		// request({ url, method: 'GET', encoding: null })
		// 	.pipe(new PNG({ filterType: 4 }))
		// 	.on('parsed', function () {
		// 		if (reply) this.data = modifyTilePixels(this.data, JSON.parse(reply));
		// 		this.pack().pipe(createWriteStream(tilePath).on('finish', () => {
		// 			console.log('done', tilePath)
		// 			res.sendFile(tilePath)
		// 		}));
		// 	});

		if (err) {
			throw err;
		} else if (!reply) {
			// Return the mapbox tile if no data to modify it with
			console.log(`no geometry found for ${z}:${y}:${x}, returning from url...`);
			try {
				request(url).pipe(res);
			} catch (err) {
				console.log(err)
			}
		} else {
			console.log(`caching ${z}:${y}:${x}...`);
			request({ url, method: 'GET', encoding: null })
				.pipe(new PNG({ filterType: 4 }))
				.on('parsed', function () {
					this.data = modifyTilePixels(this.data, JSON.parse(reply));
					this.pack().pipe(createWriteStream(tilePath).on('finish', () => {
						console.log(tilePath)
						res.sendFile(tilePath)
					}));
				});
		}
	});
}

const app = express();

app.use(cors({
	origin: 'http://127.0.0.1'
}));

app.use('/cache', express.static(path.join(__dirname, 'hydroxy-cache')));

app.use('/:z/:y/:x', async (req, res) => {
	const { x, y, z } = req.params;
	const shouldRecacheTile = !!req.query.recache;
	const tileDir = path.join(__dirname, 'hydroxy-cache', z, y);
	const tilePath = path.join(tileDir, `${x}.png`);

	console.log('client requested', z, y, x);
	await mkdirp(tileDir);

	if (shouldRecacheTile) {
		console.log('recache forced');
		await cacheTile(x, y, z, tilePath, res);
	} else {
		try {
			await access(tilePath);
			console.log(`returning ${z}:${y}:${x} from cache`);
			res.sendFile(tilePath);
		} catch (err) {
			if (err.code !== 'ENOENT') {
				throw err;
			}

			await cacheTile(x, y, z, tilePath, res);
		}
	}
});

app.listen(3000, () => console.log('hydroxy listening on port 3000'));
