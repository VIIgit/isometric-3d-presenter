const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: {
    'isometric-3d': './src/isometric-3d.js',
    'scroll-sync': './src/scroll-sync.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].min.js',
    library: {
      name: '[name]',
      type: 'umd',
      export: 'default'
    },
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: /@license/i
          }
        },
        extractComments: false
      })
    ]
  },
  resolve: {
    extensions: ['.js', '.css']
  }
};
