import * as path from "path";
import * as express from "express";
import * as webpack from "webpack";
import * as proxyMiddleware from "http-proxy-middleware";
import * as webpackHardDisk from "webpack-dev-middleware-hard-disk";
import * as FriendlyErrorsPlugin from "friendly-errors-webpack-plugin";
import getDefaultConfig from "./config/index";
import getDevWebpackConfig from "./webpack.dev.conf";
import * as merge from "webpack-merge";
import { getH5DevWebpackConfig } from "./webpack.dev.conf";

import {
  addWatchProjectConfig,
  getProjectWebpackConfig,
  getMergedEnvConfig
} from "./utils";

const portfinder = require("portfinder");
const WebpackDevServer = require("webpack-dev-server");

export default function runDevServer(
  config: IDefaultConfig,
  localWebpackConfig: any
): Promise<{ close: Function }> {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV);
  }

  const devWebpackConfig = getDevWebpackConfig(config);
  const webpackConfig = merge(devWebpackConfig, localWebpackConfig);

  return startServer(webpackConfig, config).then(result => {
    let close = result.close;
    let readyPromise = result.readPromise;
    let readyCallback = [];

    addWatchProjectConfig(() => {
      const newLocalWebpackConfig = getProjectWebpackConfig();
      const newConfig = getMergedEnvConfig(getDefaultConfig());
      const newWebpackConfig = merge(devWebpackConfig, newLocalWebpackConfig);
      console.log("close current dev server...");
      close();
      console.log("restart dev server...");
      startServer(newWebpackConfig, newConfig).then(nr => {
        if (!nr) return;
        close = nr.close;
        readyPromise = nr.readPromise;
        console.log("readyPromise", typeof readyPromise);
        readyPromise.then(() => {
          console.log("start success");
          runReadyCallback();
        });
      });
    });
    return {
      close() {
        close();
      },
      async ready(cb) {
        readyCallback.push(cb);
        await readyPromise;
        cb();
      }
    };

    function runReadyCallback() {
      const len = readyCallback.length;
      let index = 0;
      while (index < len) {
        try {
          const fn = readyCallback[index];
          fn();
        } catch (error) {
          console.error();
        }
        index++;
      }
    }
  });
}

function startServer(
  webpackConfig,
  config
): Promise<{ close: Function; readPromise: Promise<any> } | undefined> {
  const proxyTable = config.dev.proxyTable;
  const port = process.env.PORT || config.dev.port;
  const autoOpenBrowser = !!config.dev.autoOpenBrowser;
  const app = express();
  const compiler = webpack(webpackConfig);

  // proxy api requests
  Object.keys(proxyTable).forEach(function(context) {
    let options = proxyTable[context];
    if (typeof options === "string") {
      options = { target: options };
    }
    app.use(proxyMiddleware(options.filter || context, options));
  });

  // handle fallback for HTML5 history API
  app.use(require("connect-history-api-fallback")());

  const staticPath = path.posix.join(
    config.dev.assetsPublicPath,
    config.dev.assetsSubDirectory
  );
  app.use(staticPath, express.static("./static"));

  portfinder.basePort = +port;

  return portfinder
    .getPortPromise()
    .then(newPort => {
      if (port !== newPort) {
        console.log(`${port}端口被占用，开启新端口${newPort}`);
      }
      const server = app.listen(newPort, "localhost");

      // for 小程序的文件保存机制
      const devHardDisk = webpackHardDisk(compiler, {
        publicPath: webpackConfig.output.publicPath,
        quiet: true
      });

      return {
        readyPromise: new Promise(resolve => {
          devHardDisk.waitUntilValid(resolve);
        }),
        close: () => {
          devHardDisk.close();
          server.close();
        }
      };
    })
    .catch(error => {
      console.log("没有找到空闲端口，请打开任务管理器杀死进程端口再试", error);
    });
}

export function runH5DevServer(
  config: IDefaultConfig,
  localWebpackConfig: any
) {
  const devWebpackConfig = getH5DevWebpackConfig(config);
  const webpackConfig = merge(devWebpackConfig, localWebpackConfig);
  return startH5Server(webpackConfig, config);
}

function startH5Server(webpackConfig, config) {
  portfinder.basePort = process.env.PORT || config.dev.port;
  return new Promise((resolve, reject) => {
    portfinder.getPort((err, port) => {
      if (err) {
        reject(err);
      } else {
        // publish the new Port, necessary for e2e tests
        process.env.PORT = port;
        // add port to devServer config
        webpackConfig.devServer.port = port;

        // Add FriendlyErrorsPlugin
        webpackConfig.plugins.push(
          new FriendlyErrorsPlugin({
            compilationSuccessInfo: {
              messages: [
                `Your application is running here: http://${
                  webpackConfig.devServer.host
                }:${port}`
              ]
            },
            onErrors: config.dev.notifyOnErrors
              ? err => console.error(err)
              : undefined
          })
        );

        resolve(webpackConfig);
      }
    });
  }).then((devWebpackConfig: any) => {
    const compiler = webpack(devWebpackConfig);
    const devServerOptions = Object.assign({}, devWebpackConfig.devServer, {
      stats: {
        colors: true
      }
    });
    const server = new WebpackDevServer(compiler, devServerOptions);
    server.listen(devServerOptions.port, "127.0.0.1", () => {
      console.log(`Starting server on http://127.0.0.1:${devServerOptions.port}`);
    });
  });
}
