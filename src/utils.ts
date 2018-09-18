import * as path from "path";
import * as fs from "fs";
import * as ExtractTextPlugin from "extract-text-webpack-plugin";
import * as merge from "webpack-merge";
import * as webpack from "webpack";

const chokidar = require("chokidar");

export const currentCli = process.cwd();

export const resolve = filePath => path.resolve(currentCli, filePath);

export const isH5Platform = process.env.PLATFORM_ENV === "h5";

const watchProjectConfigHandles: Array<Function> = [];
let watcher;

/**
 * 创建打包vendor的配置
 */
export const createWebpackVenderPlugins = () => {
  return [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      minChunks: function(module, count) {
        // any required modules inside node_modules are extracted to vendor
        if (!module.resource) return;
        return count >= 2;
      }
    }),
    // extract webpack runtime and module manifest to its own file in order to
    // prevent vendor hash from being updated whenever app bundle is updated
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      chunks: ["vendor"]
    })
  ];
};

/**
 * 获取项目中对webpack-miniapp-vue的配置
 * filename: wmv.config.js
 */
export const getProjectConfig = (isH5 = false) => {
  const configName = isH5 ? "wmv.config.h5.js" : "wmv.config.js";
  const filePath = path.resolve(currentCli, configName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`can't find ${configName}: ${filePath}`);
  }
  if (!watcher && process.env.WMV_WATCH_MODE === "true") {
    watcher = chokidar.watch(filePath);
    watcher.on("change", () => {
      console.log(`changing ${configName}`);
      watchProjectConfigHandles.forEach(handle => {
        try {
          handle();
        } catch (err) {
          console.error(err);
        }
      });
    });
  }
  return require(filePath);
};

export const addWatchProjectConfig = (handle: Function) => {
  watchProjectConfigHandles.push(handle);
};

/**
 * 获取配置文件中webpack的配置
 */
export const getProjectWebpackConfig = (isH5 = false) => {
  const projectConfig = getProjectConfig(isH5);
  return projectConfig.webpack || {};
};

/**
 * 获取配置文件中config的配置
 */
export const getProjectEnvConfig = (isH5 = false) => {
  const envConfig = getProjectConfig(isH5);
  return envConfig.config || {};
};

/**
 * 合并wmv.config.js中config配置 与 defaultConfig
 */
export const getMergedEnvConfig = (
  defaultConfig: IDefaultConfig,
  isH5 = false
) => {
  return merge(defaultConfig, getProjectEnvConfig(isH5));
};

export const assetsPath = (_path: string, config: IDefaultConfig) => {
  const assetsSubDirectory =
    process.env.NODE_ENV === "production"
      ? config.build.assetsSubDirectory
      : config.dev.assetsSubDirectory;
  return path.posix.join(assetsSubDirectory, _path);
};

export const htmlLoaders = () => {
  return {
    test: isH5Platform ? /\.html$/ : /\.(html|wxml|axml)$/,
    loader: resolveLocalModule("html-loader"),
    options:
      process.env.NODE_ENV === "production"
        ? {
            minimize: true,
            removeComments: true,
            collapseWhitespace: true
          }
        : {}
  };
};

export const cssLoaders = (options: any = {}) => {
  const cssLoader = {
    loader: "css-loader",
    options: {
      minimize: process.env.NODE_ENV === "production",
      sourceMap: options.sourceMap
    }
  };

  const postcssLoader = {
    loader: "postcss-loader",
    options: {
      sourceMap: true
    }
  };

  const px2rpxLoader = {
    loader: "px2rpx-loader",
    options: {
      baseDpr: 1,
      rpxUnit: 0.5
    }
  };

  // generate loader string to be used with extract text plugin
  function generateLoaders(loader?: any, loaderOptions?: any) {
    const loaders = [cssLoader, postcssLoader, px2rpxLoader];
    if (loader) {
      loaders.push({
        loader: resolveLocalModule(loader + "-loader"),
        options: Object.assign({}, loaderOptions, {
          sourceMap: options.sourceMap
        })
      });
    }

    // Extract CSS when that option is specified
    // (which is the case during production build)
    if (options.extract) {
      return ExtractTextPlugin.extract({
        use: loaders,
        fallback: "vue-style-loader"
      });
    } else {
      const vueLoader: any[] = ["vue-style-loader"];
      return vueLoader.concat(loaders);
    }
  }

  // https://vue-loader.vuejs.org/en/configurations/extract-css.html
  return {
    css: generateLoaders(),
    wxss: generateLoaders(),
    acss: generateLoaders(),
    postcss: generateLoaders(),
    less: generateLoaders("less"),
    sass: generateLoaders("sass", { indentedSyntax: true }),
    scss: generateLoaders("sass"),
    stylus: generateLoaders("stylus"),
    styl: generateLoaders("stylus")
  };
};

export const cssH5Loader = (options: any = {}) => {
  const cssLoader = {
    loader: "css-loader",
    options: {
      minimize: process.env.NODE_ENV === "production",
      sourceMap: options.sourceMap
    }
  };

  const postcssLoader = {
    loader: "postcss-loader",
    options: {
      sourceMap: true
    }
  };

  // generate loader string to be used with extract text plugin
  function generateLoaders(loader?: any, loaderOptions?: any) {
    const loaders = [cssLoader, postcssLoader];
    if (loader) {
      loaders.push({
        loader: resolveLocalModule(loader + "-loader"),
        options: Object.assign({}, loaderOptions, {
          sourceMap: options.sourceMap
        })
      });
    }

    // Extract CSS when that option is specified
    // (which is the case during production build)
    if (options.extract) {
      return ExtractTextPlugin.extract({
        use: loaders,
        fallback: "vue-style-loader"
      });
    } else {
      const vueLoader: any[] = ["vue-style-loader"];
      return vueLoader.concat(loaders);
    }
  }

  // https://vue-loader.vuejs.org/en/configurations/extract-css.html
  return {
    css: generateLoaders(),
    postcss: generateLoaders(),
    less: generateLoaders("less"),
    sass: generateLoaders("sass", { indentedSyntax: true }),
    scss: generateLoaders("sass"),
    stylus: generateLoaders("stylus"),
    styl: generateLoaders("stylus")
  };
};

export const ownDir = (...args) => path.join(__dirname, "..", ...args);

export const h5StyleLoaders = function(options) {};

// Generate loaders for standalone style files (outside of .vue)
export const styleLoaders = function(options) {
  const output = [];
  const cssLoader = isH5Platform ? cssH5Loader : cssLoaders;
  const loaders = cssLoader(options);
  for (const extension in loaders) {
    const loader = loaders[extension];
    output.push({
      test: new RegExp("\\." + extension + "$"),
      use: loader
    });
  }
  return output;
};

export const readPkgConfig = () => {
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "package.json"), {
      encoding: "utf-8"
    })
  );
  return config;
};

export function resolveLocalModule(name) {
  return require.resolve(name);
}

export function isFileExist(filePath: any) {
  return fs.existsSync(filePath);
}

export function isPackageInDependencies(pkgName) {
  const pkgConfig = readPkgConfig();
  const devDependencies = pkgConfig.devDependencies || {};
  const dependencies = pkgConfig.dependencies || {};
  return pkgName in devDependencies || pkgName in dependencies;
}
