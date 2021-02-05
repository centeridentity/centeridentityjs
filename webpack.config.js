const path = require('path');
const UglifyEsPlugin = require('uglify-es-webpack-plugin');

module.exports = {
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'var',
    library: 'CenterIdentity'
  },
  optimization: {
      minimize: false
  },
  mode: 'production'
};
