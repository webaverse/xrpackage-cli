#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

Error.stackTraceLimit = 300;

const path = require('path');
const fs = require('fs');
const url = require('url');

const mkdirp = require('mkdirp');
const yargs = require('yargs');
const wbn = require('wbn');
/* const ethereumjs = {
  Tx: require('ethereumjs-tx').Transaction,
}; */
// const {BigNumber} = require('bignumber.js');
const {getManifestJson} = require('./utils');

/* loadPromise.then(c => {
  const m = c.methods.mint([1, 1, 1], '0x0', 'hash', 'lol');
  console.log('got c', Object.keys(c), Object.keys(c.methods.mint), Object.keys(m), m.encodeABI());
}); */

/* window.web3.eth.contract(abi).at(address)
window.web3 = new window.Web3(window.ethereum);
try {
  // Request account access if needed
  await window.ethereum.enable();
  // Acccounts now exposed
  // web3.eth.sendTransaction({});

  this.instance = ;
  this.account = window.web3.eth.accounts[0];

  this.promise.accept(this.instance);
} catch (err) {
  // User denied account access...
  console.warn(err);
} */

let handled = false;
yargs
  .scriptName('xrpk')
  .command(require('./commands/whoami'))
  .command(require('./commands/privatekey'))
  .command(require('./commands/login'))
  .command(require('./commands/wallet'))
  .command(require('./commands/upload'))
  .command(require('./commands/publish'))
  .command(require('./commands/unpublish'))
  .command(require('./commands/mint'))
  .command(require('./commands/ls'))
  .command(require('./commends/count'))
  .command(require('./commands/run'))
  .command(require('./commands/inspect'))
  .command(require('./commands/install'))
  .command(require('./commands/init'))
  .command(require('./commands/build'))
  .command(require('./commands/screenshot'))
  .command(require('./commands/volume'))
  .command(require('./commands/model'))
  .command(require('./commands/bake'))
  .command(require('./commands/view'))
  .command('cat [input] [path]', 'cat contents of file inside .wbn to stdout', yargs => {
    yargs
      .positional('input', {
        describe: 'input .wbn file',
        // default: 5000
      })
      .positional('path', {
        describe: 'file path inside the .wbn to cat',
        // default: 5000
      });
  }, async argv => {
    handled = true;

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
  })
  .command('icon [input]', 'print icons of a package', yargs => {
    yargs
      .positional('input', {
        describe: 'input file to get icons for',
        // default: 5000
      });
  }, async argv => {
    handled = true;

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
  })
  .command('headers [input] [path]', 'print headers for file inside .wbn to stdout', yargs => {
    yargs
      .positional('input', {
        describe: 'input .wbn file',
        // default: 5000
      })
      .positional('path', {
        describe: 'file path inside the .wbn to print headers for',
        // default: 5000
      });
  }, async argv => {
    handled = true;

    if (argv.input) {
      if (argv.path) {
        const d = fs.readFileSync(argv.input);
        const bundle = new wbn.Bundle(d);
        const p = path.normalize(path.join('/', argv.path));
        const u = bundle.urls.find(u => new url.URL(u).pathname === p);
        if (u) {
          const res = bundle.getResponse(u);
          console.log(JSON.stringify(res.headers, null, 2));
        } else {
          throw `file not found: ${argv.path}`;
        }
      } else {
        throw 'missing path';
      }
    } else {
      throw 'missing input file';
    }
  })
  .command('extract [input]', 'extract contents of .wbn file', yargs => {
    yargs
      .positional('input', {
        describe: '.wbn file to extract',
        // default: 5000
      });
  }, async argv => {
    handled = true;

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
  })
  .showHelpOnFail(false)
  .argv;
if (!handled) {
  yargs.showHelp();
}
/* .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  }) */

/* if (argv.ships > 3 && argv.distance < 53.5) {
  console.log('Plunder more riffiwobbles!')
} else {
  console.log('Retreat from the xupptumblers!')
} */
