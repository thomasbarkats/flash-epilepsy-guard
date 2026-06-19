const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    main: './src/EpilepsyGuard.ts',
    background: './src/background.ts',
    popup: './src/popup.ts',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'package'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "icons", to: "icons" },
        { from: "_locales", to: "_locales" },
        { from: "popup.html", to: "popup.html" },
        { from: "manifest.json", to: "manifest.json" },
      ],
    }),
  ],
};
