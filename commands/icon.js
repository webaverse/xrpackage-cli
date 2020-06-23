const fs = require('fs');
const url = require('url');

const wbn = require('wbn');

const {getManifestJson} = require('../utils');

module.exports = {
  command: 'icon [input]',
  describe: 'print icons of a package',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'input file to get icons for',
        type: 'string',
        default: 'a.wbn',
      });
  },
  handler: async argv => {
    const dataArrayBuffer = fs.readFileSync(argv.input);
    const bundle = new wbn.Bundle(dataArrayBuffer);
    const manifest = getManifestJson(bundle);
    if (manifest) {
      const {icons} = manifest;
      if (icons) {
        for (const icon of icons) {
          if (icon) {
            const {src, type} = icon;
            const path = '/' + src;
            const bundleUrl = bundle.urls.find(u => new url.URL(u).pathname === path);
            let desc;
            if (bundleUrl) {
              const res = bundle.getResponse(bundleUrl);
              const {body} = res;
              desc = `${body.length}`;
            } else {
              desc = '[missing]';
            }
            console.log(`${src} ${type} ${desc}`);
          }
        }
      } else {
        console.warn('package has no icons');
      }
    } else {
      throw 'failed to load manifest.json';
    }
  },
};
