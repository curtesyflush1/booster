const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts',
    options: './src/options/options.ts'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/[name].js',
    clean: true
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  
  resolve: {
    extensions: ['.ts', '.js']
  },
  
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        // Copy HTML files
        {
          from: 'src/popup/popup.html',
          to: 'popup/popup.html'
        },
        {
          from: 'src/options/options.html',
          to: 'options/options.html'
        },
        
        // Copy CSS files
        {
          from: 'src/popup/popup.css',
          to: 'popup/popup.css'
        },
        {
          from: 'src/options/options.css',
          to: 'options/options.css'
        },
        {
          from: 'src/content/content.css',
          to: 'content/content.css'
        },
        
        // Copy icons (placeholder - will be created later)
        {
          from: 'icons',
          to: 'icons',
          noErrorOnMissing: true
        }
      ]
    })
  ],
  
  // Development settings
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  
  // Optimization for production
  optimization: {
    minimize: process.env.NODE_ENV === 'production'
  },
  
  // Watch mode settings
  watchOptions: {
    ignored: /node_modules/,
    poll: 1000
  }
};