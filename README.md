# Hydroxy

Proxies Mapbox's RGB-DEM terrain tiles and modifies them with elevation data stored in redis. This isn't polished **at all** but hopefully should be easy enough to run and figure out how it works. See [https://vulkd.com/articles/3d-underwater-maps](https://vulkd.com/articles/3d-underwater-maps) for a full write-up. Hope it's of use to someone!

**Note: util/example-frontend includes a slightly modified [three-geo](https://github.com/w3reality/three-geo).**

## Requirements:
 - Redis or Docker to run Redis
 - Node
 - Ability run local web server (Having Python installed is fine)

## Usage:
 - `docker-compose -p hydroxy up` - Initialize a Redis instance at 127.0.0.1:6379
    - If using docker-compose, Redis Commander is available at [http://127.0.0.1:8081](http://127.0.0.1:8081)
 - `node generatePixelCoords.js` - Process and add util/example-depth-data.geojson to Redis
 - Replace $YOUR_MAPBOX_TOKEN_HERE$ in hydroxy.js
 - `npm i && node hydroxy.js` - Start proxy server
 - `cd util/example-frontend/dist && python3 -m http.server 80"` - Serve example frontend
    - util/example-frontend/config.js contains some variables to play with (restart frontend after changing)
 - [http://127.0.0.1:80](http://127.0.0.1:80)
