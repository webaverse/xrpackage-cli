const fs = require('fs');
const http = require('http');

const express = require('express');
const open = require('open');
const wbn = require('wbn');

const {makePromise, port} = require('../utils');
const {primaryUrl, cloneBundle} = require('../constants');

const _readIntoPromise = (type, p) => (req, res) => {
  const bs = [];
  req.on('data', d => {
    bs.push(d);
  });
  req.once('end', () => {
    const d = Buffer.concat(bs);
    p.accept(d);
    res.end();
  });
  req.once('error', p.reject);
};

const _volumeApp = async output => {
  const app = express();
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', '*');
    res.set('Access-Control-Allow-Headers', '*');
    next();
  });
  app.get('/a.wbn', (req, res) => {
    fs.createReadStream(output).pipe(res);
  });

  const volumePromise = makePromise();
  volumePromise.then(d => {
    console.warn(`got volume (${d.length} bytes)`);
    return d;
  });
  app.put('/volume.glb', _readIntoPromise('glb', volumePromise));

  const aabbPromise = makePromise();
  aabbPromise.then(d => {
    console.warn(`got aabb (${d.length} bytes)`);
    return d;
  });
  app.put('/aabb.json', _readIntoPromise('json', aabbPromise));

  app.use(express.static(__dirname));
  const server = http.createServer(app);

  const connections = [];
  server.on('connection', c => connections.push(c));
  server.listen(port, () => {
    open(`https://xrpackage.org/volume.html?srcWbn%3Dhttp://localhost:${port}/a.wbn%26dstVolume%3Dhttp://localhost:${port}/volume.glb%26dstAabb%3Dhttp://localhost:${port}/aabb.json`);
  });

  const [volumeUint8Array, aabbUint8Array] = await Promise.all([volumePromise, aabbPromise]);
  server.close();
  for (let i = 0; i < connections.length; i++) {
    connections[i].destroy();
  }

  const bundleBuffer = fs.readFileSync(output);
  const bundle = new wbn.Bundle(bundleBuffer);

  const res = bundle.getResponse('https://xrpackage.org/manifest.json');
  const s = res.body.toString('utf8');
  const manifestJson = JSON.parse(s);

  const builder = cloneBundle(bundle, {
    except: ['/manifest.json'],
  });

  manifestJson.icons = Array.isArray(manifestJson.icons) ? manifestJson.icons : [];
  if (volumeUint8Array.length > 0) {
    builder.addExchange(primaryUrl + '/xrpackage_volume.glb', 200, {
      'Content-Type': 'model/gltf-binary+preview',
    }, volumeUint8Array);

    let volumeIcon = manifestJson.icons.find(icon => icon.type === 'model/gltf-binary+preview');
    if (!volumeIcon) {
      volumeIcon = {
        src: '',
        type: 'model/gltf-binary+preview',
      };
      manifestJson.icons.push(volumeIcon);
    }
    volumeIcon.src = 'xrpackage_volume.glb';
  }

  if (aabbUint8Array.length > 0) {
    const aabb = JSON.parse(aabbUint8Array.toString('utf8'));
    let xrDetails = manifestJson.xr_details;
    if (!xrDetails) {
      xrDetails = manifestJson.xr_details = {};
    }
    xrDetails.aabb = aabb;
  }

  builder.addExchange(primaryUrl + '/manifest.json', 200, {
    'Content-Type': 'application/json',
  }, JSON.stringify(manifestJson, null, 2));

  const buffer = builder.createBundle();
  fs.writeFileSync(output, buffer);
};

module.exports = {
  command: 'volume [input]',
  describe: 'generate a volume of the package at [input]',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'built package to volume (a.wbn)',
      });
  },
  handler: async (argv) => {
    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await _volumeApp(argv.input);
  },
};
