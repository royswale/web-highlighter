const path = require('path');
const {examplePath, staticPath} = require('./paths.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const merge = require('webpack-merge');
const baseConfig = require('./base.config');

const config = {
    entry: [
        path.resolve(examplePath, 'src/index.js')
    ],
    module: {
        rules: [{
            test: /\.css/,
            use: ['style-loader', 'css-loader']
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(examplePath, 'src/index.html')
        })
    ],
    output: {
        path: staticPath,
        filename: 'index.js'
    }
};

module.exports = merge(baseConfig, config);