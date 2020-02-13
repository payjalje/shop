'use strict'

const devMode = process.env.NODE_ENV !== 'production'
const path = require('path')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const output = {
  library: '__storefrontTwbs',
  libraryTarget: 'umd',
  path: path.resolve(__dirname, 'dist'),
  filename: 'storefront-twbs.min.js'
}

const webpackConfig = {
  mode: devMode ? 'development' : 'production',
  entry: [
    path.resolve(__dirname, 'scss/styles.scss'),
    path.resolve(__dirname, 'src/index.js')
  ],
  output,

  devServer: {
    contentBase: path.resolve(__dirname, '__tests__'),
    port: 3376,
    open: true
  },
  stats: {
    colors: true,
    children: false
  },
  devtool: 'source-map',
  performance: {
    hints: devMode ? false : 'warning',
    maxEntrypointSize: 500000,
    maxAssetSize: 500000
  },

  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: 'storefront-twbs.min.css'
    })
  ],

  module: {
    rules: [
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              ident: 'postcss',
              minimize: !devMode,
              plugins: [
                require('autoprefixer')(),
                require('cssnano')({ preset: 'default' })
              ]
            }
          },
          'sass-loader'
        ]
      }
    ]
  },

  resolve: {
    alias: {
      jquery$: 'jquery/dist/jquery.slim',
      '@ecomplus/storefront-twbs': __dirname
    }
  }
}

module.exports = [
  {
    ...webpackConfig,
    entry: path.resolve(__dirname, 'src/index.js'),
    output: {
      ...output,
      libraryTarget: 'var',
      filename: output.filename.replace('.min.js', '.var.min.js'),
      path: path.resolve(output.path, 'public')
    }
  },

  webpackConfig
]