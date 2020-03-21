const path = require('path');

module.exports = {
  entry: './centeridentity.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development'
};