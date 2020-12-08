const path = require('path');
module.exports = {
  entry: './jit.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts']
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: 'jit.js'
  }
};