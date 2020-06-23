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
      });
  },
  handler: async (argv) => {
    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    const dataArrayBuffer = fs.readFileSync(argv.input);
    const bundle = new wbn.Bundle(dataArrayBuffer);
    const j = getManifestJson(bundle);
    if (j) {
      const {icons} = j;
      if (icons) {
        for (const icon of icons) {
          if (icon) {
            const {src, type} = icon;
            const p = '/' + src;
            const u = bundle.urls.find(u => new url.URL(u).pathname === p);
            let desc;
            if (u) {
              const res = bundle.getResponse(u);
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
