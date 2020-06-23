const path = require('path');
const fs = require('fs');

const wbn = require('wbn');

const {primaryUrl, cloneBundle} = require('../constants');

const _modelApp = async output => {
  const bundleBuffer = fs.readFileSync(output);
  const bundle = new wbn.Bundle(bundleBuffer);

  const res = bundle.getResponse('https://xrpackage.org/manifest.json');
  const s = res.body.toString('utf8');
  const manifestJson = JSON.parse(s);
  const {start_url: startUrl, xr_type: xrType} = manifestJson;

  const builder = cloneBundle(bundle, {
    except: ['/manifest.json'],
  });

  let modelIcon = manifestJson.icons && manifestJson.icons.find(icon => icon.type === 'model/gltf-binary');
  if (!modelIcon) {
    let modelPath;
    switch (xrType) {
      case 'gltf@0.0.1':
      case 'vrm@0.0.1':
      {
        /* const res = bundle.getResponse(primaryUrl + '/' + startUrl);
        return res.body; */
        modelPath = startUrl;
        break;
      }
      default: {
        modelPath = 'xrpackage_model.glb';

        const modelUint8Array = fs.readFileSync(path.join(__dirname, 'assets', 'w.glb'));
        builder.addExchange(primaryUrl + '/' + modelPath, 200, {
          'Content-Type': 'model/gltf-binary',
        }, modelUint8Array);
        break;
      }
    }

    modelIcon = {
      src: modelPath,
      type: 'model/gltf-binary',
    };
    if (!Array.isArray(manifestJson.icons)) {
      manifestJson.icons = [];
    }
    manifestJson.icons.push(modelIcon);
  }

  builder.addExchange(primaryUrl + '/manifest.json', 200, {
    'Content-Type': 'application/json',
  }, JSON.stringify(manifestJson, null, 2));

  const buffer = builder.createBundle();
  fs.writeFileSync(output, buffer);
};

module.exports = {
  command: 'model [input]',
  describe: 'generate a model of the package at [input]',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'built package to model (a.wbn)',
      });
  },
  handler: async (argv) => {
    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await _modelApp(argv.input);
  },
};
