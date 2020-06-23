const path = require('path');
const fs = require('fs');

const mkdirp = require('mkdirp');
const wbn = require('wbn');

module.exports = {
  command: 'extract [input]',
  describe: 'extract contents of .wbn file',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: '.wbn file to extract',
      });
  },
  handler: async (argv) => {
    if (argv.input) {
      const d = fs.readFileSync(argv.input);
      const bundle = new wbn.Bundle(d);
      for (const url of bundle.urls) {
        const pathname = new URL(url).pathname.slice(1);
        console.log(pathname);
        const dirname = path.dirname(pathname);
        await mkdirp(dirname);
        fs.writeFileSync(pathname, bundle.getResponse(url).body);
      }
    } else {
      console.warn('missing input file');
    }
  },
};
