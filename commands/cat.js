const path = require('path');
const fs = require('fs');
const url = require('url');

const wbn = require('wbn');

module.exports = {
  command: 'cat [input] [path]',
  describe: 'cat contents of file inside .wbn to stdout',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'input .wbn file',
      })
      .positional('path', {
        describe: 'file path inside the .wbn to cat',
      });
  },
  handler: async (argv) => {
    if (argv.input) {
      if (argv.path) {
        const d = fs.readFileSync(argv.input);
        const bundle = new wbn.Bundle(d);
        const p = path.normalize(path.join('/', argv.path)).replace(/\\/g, '/');
        const u = bundle.urls.find(u => new url.URL(u).pathname === p);
        if (u) {
          const res = bundle.getResponse(u);
          process.stdout.write(res.body);
        } else {
          throw `file not found: ${argv.path}`;
        }
      } else {
        throw 'missing path';
      }
    } else {
      throw 'missing input file';
    }
  },
};
