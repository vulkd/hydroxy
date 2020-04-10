// config for webpack 4
const webpack = require('webpack');
const path = require('path');
const env = require('yargs').argv.env;
const pkg = require('./package.json');

const sourcePath = path.join(__dirname, './src');
const outputPath = path.join(__dirname, './dist');

let plugins = [], outputFile, minimize;

if (env === 'build') {
	minimize = true;
	outputFile = "[name].min.js";
} else {
	minimize = false;
	outputFile = "[name].js";
}

module.exports = {
	entry: {
		'app': sourcePath + "/index.js",
	},
	output: {
		path: outputPath,
		filename: outputFile,
	},
	module: {
		rules: [
			{
				test: /(\.jsx|\.js)$/,
				loader: 'babel-loader',
				exclude: /(node_modules)/
			}
		]
	},
	resolve: {
		modules: [
			path.resolve('./node_modules'),
			path.resolve('./src'),
			path.resolve('./threegeo'),
		],
		extensions: ['.json', '.js']
	},
	plugins: plugins
};
