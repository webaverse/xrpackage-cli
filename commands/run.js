const fs = require('fs');
const http = require('http');

const express = require('express');
const open = require('open');

const {port} = require('../constants');

const _getRunUrl = o => {
  let url;
  let servePath;
  if (o.path) {
    url = `http://localhost:${port}/run.html`;
    servePath = o.path;
  } else {
    url = 'https://xrpackage.org/run.html';
    servePath = null;
  }
  if (o.id) {
    url += `?i=${o.id}`;
  } else if (o.url) {
    url += `?u=${o.url}`;
  }
  return {
    url,
    servePath,
  };
};

module.exports = {
  command: 'run [id]',
  describe: 'run a package in browser',
  builder: yargs => {
    yargs
      .option('path', {
        alias: 'p',
        type: 'string',
        description: 'Use local xrpackage path for runtime',
      });
  },
  handler: async argv => {
    const app = express();
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', '*');
      res.set('Access-Control-Allow-Headers', '*');
      next();
    });

    let runSpec;
    if (!isNaN(parseInt(argv.id, 10))) {
      runSpec = _getRunUrl({
        path: argv.path,
        id: argv.id,
      });
    } else {
      runSpec = _getRunUrl({
        path: argv.path,
        url: `http://localhost:${port}/a.wbn`,
      });
      app.get('/a.wbn', (req, res) => {
        const rs = fs.createReadStream(argv.id);
        rs.pipe(res);
        rs.once('error', err => {
          res.statusCode = 500;
          res.end(err.stack);
        });
      });
    }
    const {url, servePath} = runSpec;
    if (servePath) {
      app.use(express.static(servePath));
    }

    const server = http.createServer(app);
    server.listen(port, () => {
      open(url);
    });
  },
};
