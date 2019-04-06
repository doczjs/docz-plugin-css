import { createPlugin } from 'docz-core'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import merge from 'deepmerge'

import { getLocalIdent } from './get-local-ident'

/**
 * Tests
 */

type PreProcessor = 'postcss' | 'sass' | 'less' | 'stylus'
const tests: Record<PreProcessor, RegExp> = {
  postcss: /(\.module)?\.css$/,
  sass: /(\.module)?\.s(a|c)ss$/,
  less: /(\.module)?\.less$/,
  stylus: /(\.module)?\.styl(us)?$/,
}

/**
 * Loaders
 */

export interface Opts {
  [key: string]: any
}

const getStyleLoaders = (loader: any, opts: Opts) => (
  cssopts: any,
  dev: boolean
) => {
  return [
    {
      loader: dev
        ? require.resolve('style-loader')
        : MiniCssExtractPlugin.loader,
    },
    {
      loader: require.resolve('css-loader'),
      options: cssopts,
    },
    {
      loader,
      options: opts,
    },
  ]
}

const loaders = {
  postcss: (opts: Opts = { plugins: [] }) =>
    getStyleLoaders(
      require.resolve('postcss-loader'),
      merge(opts, {
        plugins: () => {
          const defaultPlugins = [
            require('postcss-flexbugs-fixes'),
            require('autoprefixer')({
              flexbox: 'no-2009',
            }),
          ]

          return opts && opts.plugins && Array.isArray(opts.plugins)
            ? opts.plugins.concat(defaultPlugins)
            : defaultPlugins
        },
      })
    ),

  sass: (opts: Opts = {}) =>
    getStyleLoaders(
      require.resolve('sass-loader'),
      merge(opts, { indentedSyntax: false })
    ),

  less: (opts: Opts = {}) =>
    getStyleLoaders(require.resolve('less-loader'), opts),

  stylus: (opts: Opts = {}) =>
    getStyleLoaders(
      require.resolve('stylus-loader'),
      merge(opts, { preferPathResolver: 'webpack' })
    ),
}

/**
 * Rules
 */

const applyRule = (
  opts: CSSPluginOptions,
  cssmodules: boolean | undefined, // if cssmodules === undefined, then let webpack decide whether to use CSS modules by itself
  dev: boolean
) => {
  const { preprocessor, cssOpts, loaderOpts, ruleOpts } = opts

  const loaderfn = loaders[preprocessor as PreProcessor]
  const loader = loaderfn(loaderOpts)
  const cssoptions = merge(
    cssOpts,
    {
      importLoaders: 1,
      sourceMap: !dev,
      ...(cssmodules && { getLocalIdent }),
      ...(typeof cssmodules === 'boolean' ? { modules: cssmodules } : {})
    }
  )

  return {
    test: tests[preprocessor as PreProcessor],
    use: loader(cssoptions, dev),
    ...ruleOpts,
  }
}

export interface CSSPluginOptions {
  preprocessor?: 'postcss' | 'sass' | 'less' | 'stylus'
  cssmodules?: boolean
  loaderOpts?: Opts
  cssOpts?: Opts
  ruleOpts?: Opts
}

const defaultOpts: Record<string, any> = {
  preprocessor: 'postcss',
  cssmodules: undefined,
  loadersOpts: {},
  cssOpts: {},
  ruleOpts: {},
}

export const css = (opts: CSSPluginOptions = defaultOpts) =>
  createPlugin({
    modifyBundlerConfig: (config, dev) => {
      config.module.rules.push(applyRule(opts, opts.cssmodules, dev))

      if (!dev) {
        const test = tests[opts.preprocessor || ('postcss' as PreProcessor)]
        const minimizer = config.optimization.minimizer || []
        const splitChunks = { ...config.optimization.splitChunks }

        config.optimization.minimizer = minimizer.concat([
          new OptimizeCSSAssetsPlugin({}),
        ])

        config.optimization.splitChunks = merge(splitChunks, {
          cacheGroups: {
            styles: {
              test: (m: any) => test.test(m.type),
              name: 'styles',
              chunks: 'all',
              enforce: true,
            },
          },
        })

        config.plugins.push(
          new MiniCssExtractPlugin({
            filename: 'static/css/[name].[hash].css',
          })
        )
      }

      return config
    },
  })
