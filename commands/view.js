const fs = require('fs');

const wbn = require('wbn');

module.exports = {
  command: 'view [input]',
  describe: 'view contents of input .wbn file',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'input .wbn file to view',
      })
      .option('types', {
        alias: 't',
        type: 'boolean',
        description: 'Show file types as well',
      });
  },
  handler: async argv => {
    if (argv.input) {
      const d = fs.readFileSync(argv.input);
      const bundle = new wbn.Bundle(d);
      for (const url of bundle.urls) {
        const res = bundle.getResponse(url);
        let s = url;
        if (argv.types) {
          s += ' ';
          s += res.headers['content-type'] || 'unknown';
        }
        console.log(s);
      }
    } else {
      console.warn('missing input file');
    }
  },
};
