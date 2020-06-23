#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

Error.stackTraceLimit = 300;

const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

const mkdirp = require('mkdirp');
const yargs = require('yargs');
const mime = require('mime');
const ignoreWalk = require('ignore-walk');
const wbn = require('wbn');
/* const ethereumjs = {
  Tx: require('ethereumjs-tx').Transaction,
}; */
// const {BigNumber} = require('bignumber.js');
const express = require('express');
const open = require('open');
const {makePromise, getManifestJson, screenshotApp, cloneBundle} = require('./utils');

const {port, primaryUrl} = require('./constants');

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

const _removeUrlTail = u => u.replace(/(?:\?|#).*$/, '');

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
  server.on('connection', c => {
    connections.push(c);
  });
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
const _bakeApp = async output => {
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
  const gifPromise = makePromise();
  gifPromise.then(d => {
    console.warn(`got screenshot (${d.length} bytes)`);
    return d;
  });
  app.put('/screenshot.gif', _readIntoPromise('gif', gifPromise));
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
  server.on('connection', c => {
    connections.push(c);
  });
  server.listen(port, () => {
    open(`https://xrpackage.org/bake.html?srcWbn%3Dhttp://localhost:${port}/a.wbn%26dstGif%3Dhttp://localhost:${port}/screenshot.gif%26dstVolume%3Dhttp://localhost:${port}/volume.glb%26dstAabb%3Dhttp://localhost:${port}/aabb.json`);
  });

  const [gifUint8Array, volumeUint8Array, aabbUint8Array] = await Promise.all([gifPromise, volumePromise, aabbPromise]);
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
  if (gifUint8Array.length > 0) {
    builder.addExchange(primaryUrl + '/xrpackage_icon.gif', 200, {
      'Content-Type': 'image/gif',
    }, gifUint8Array);

    let gifIcon = manifestJson.icons.find(icon => icon.type === 'image/gif');
    if (!gifIcon) {
      gifIcon = {
        src: '',
        type: 'image/gif',
      };
      manifestJson.icons.push(gifIcon);
    }
    gifIcon.src = 'xrpackage_icon.gif';
  }
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

  let modelIcon = manifestJson.icons.find(icon => icon.type === 'model/gltf-binary');
  if (!modelIcon) {
    let modelPath;
    switch (manifestJson.xr_type) {
      case 'gltf@0.0.1':
      case 'vrm@0.0.1':
      {
        /* const res = bundle.getResponse(primaryUrl + '/' + startUrl);
        return res.body; */
        modelPath = manifestJson.start_url;
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
    manifestJson.icons.push(modelIcon);
  }

  builder.addExchange(primaryUrl + '/manifest.json', 200, {
    'Content-Type': 'application/json',
  }, JSON.stringify(manifestJson, null, 2));

  const buffer = builder.createBundle();
  fs.writeFileSync(output, buffer);
};

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
  .command('build [input] [output]', 'build xrpackage .wbn from [input] and write to [output]', yargs => {
    yargs
      .positional('input', {
        describe: 'input file to build',
        // default: 5000
      })
      .positional('output', {
        describe: 'output file to write',
        // default: 5000
      })
      .option('screenshot', {
        alias: 's',
        type: 'boolean',
        description: 'Screenshot package after building',
      });
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = '.';
    }
    if (typeof argv.output !== 'string') {
      argv.output = 'a.wbn';
    }

    let fileInput, startUrl, xrType, xrDetails, mimeType, name, description, directory;
    const xrTypeToMimeType = {
      'gltf@0.0.1': 'model/gltf+json',
      'vrm@0.0.1': 'application/octet-stream',
      'vox@0.0.1': 'application/octet-stream',
      'webxr-site@0.0.1': 'text/html',
    };
    const _detectType = input => {
      if (/\.gltf$/.test(input)) {
        fileInput = input;
        xrType = 'gltf@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'GLTF JSON model';
        directory = null;
      } else if (/\.glb$/.test(input)) {
        fileInput = input;
        xrType = 'gltf@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'GLTF binary model';
        directory = null;
      } else if (/\.vrm$/.test(input)) {
        fileInput = input;
        xrType = 'vrm@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'VRM model';
        directory = null;
      } else if (/\.vox$/.test(input)) {
        fileInput = input;
        xrType = 'vox@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'VOX model';
        directory = null;
      } else if (/\.html$/.test(input)) {
        fileInput = input;
        xrType = 'webxr-site@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'WebXR app';
        directory = null;
      } else if (/\.json$/.test(input)) {
        const s = (() => {
          try {
            return fs.readFileSync(input);
          } catch (err) {
            if (err.code === 'ENOENT') {
              return null;
            } else {
              return null;
            }
          }
        })();
        if (s) {
          let error;
          const j = (() => {
            try {
              return JSON.parse(s);
            } catch (err) {
              error = err;
              return null;
            }
          })();
          if (j) {
            const hasXrType = typeof j.xr_type === 'string';
            const hasStartUrl = typeof j.start_url === 'string';
            if (hasXrType && hasStartUrl) {
              xrType = j.xr_type;
              xrDetails = j.xr_details;
              startUrl = j.start_url.replace(/(?:\?|#).*$/, '');
              mimeType = xrTypeToMimeType[xrType] || 'application/octet-stream';
              fileInput = path.join(path.dirname(input), _removeUrlTail(startUrl));
              name = typeof j.name === 'string' ? j.name : path.basename(path.dirname(input));
              description = 'Directory package';
              directory = path.dirname(input);
            } else if (!hasXrType) {
              throw `manifest.json missing xr_type: ${input}`;
            } else if (!hasStartUrl) {
              throw `manifest.json missing start_url: ${input}`;
            }
          } else {
            throw 'failed to parse manifest.json: ' + error.stack;
          }
        } else {
          throw 'missing manifest.json; try xrpk init';
        }
      } else {
        const stats = fs.statSync(input);
        if (stats.isDirectory()) {
          _detectType(path.join(input, 'manifest.json'));
        } else {
          throw `unknown file type: ${argv.input}`;
        }
      }
    };
    _detectType(path.resolve(process.cwd(), argv.input));
    if (fileInput) {
      const fileData = fs.readFileSync(fileInput);
      // console.log('got data', data.length);

      const files = [
        {
          url: '/' + startUrl,
          type: mimeType,
          data: fileData,
        },
        {
          url: '/manifest.json',
          type: 'application/json',
          data: JSON.stringify({
            name,
            description,
            xr_type: xrType,
            start_url: startUrl,
            xr_details: xrDetails,
          }, null, 2),
        },
      ];
      if (directory) {
        const _readdirRecursive = rootDirectory => {
          const result = [];
          const paths = ignoreWalk.sync({
            path: rootDirectory, // root dir to start in. defaults to process.cwd()
            ignoreFiles: ['.gitignore'], // list of filenames. defaults to ['.ignore']
            includeEmpty: false, // true to include empty dirs, default false
            follow: false, // true to follow symlink dirs, default false
          });
          const cwd = process.cwd();
          const outputPathname = path.resolve(cwd, argv.output);
          for (const pathname of paths) {
            const fullPathname = path.resolve(cwd, rootDirectory, pathname);
            if (!/^\.git\//.test(pathname) && fullPathname !== outputPathname) {
              const stats = fs.lstatSync(fullPathname);
              if (stats.isFile()) {
                result.push({
                  fullPathname: fullPathname,
                  pathname: '/' + pathname,
                });
              }
            }
          }
          return result;
        };
        const filenames = _readdirRecursive(directory);
        for (let i = 0; i < filenames.length; i++) {
          const {fullPathname, pathname} = filenames[i];
          if (!files.some(({url}) => url === pathname)) {
            const type = mime.getType(fullPathname) || 'application/octet-stream';
            const data = fs.readFileSync(fullPathname);
            files.push({
              url: pathname,
              type,
              data,
            });
          }
        }
      }

      const builder = new wbn.BundleBuilder(primaryUrl + '/' + startUrl);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const {url, type, data} = file;
        builder.addExchange(primaryUrl + url, 200, {
          'Content-Type': type,
        }, data);
      }
      const uint8Array = builder.createBundle();
      // console.log('got bundle', uint8Array.byteLength);

      fs.writeFileSync(argv.output, uint8Array);

      if (argv.screenshot) {
        await screenshotApp(argv.output);
      }
      console.log(argv.output);
    }
  })
  .command('screenshot [input]', 'generate a screenshot of the package at [input]', yargs => {
    yargs
      .positional('input', {
        describe: 'built package to screenshot (a.wbn)',
      });
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await screenshotApp(argv.input);
  })
  .command('volume [input]', 'generate a volume of the package at [input]', yargs => {
    yargs
      .positional('input', {
        describe: 'built package to volume (a.wbn)',
      });
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await _volumeApp(argv.input);
  })
  .command('model [input]', 'generate a model of the package at [input]', yargs => {
    yargs
      .positional('input', {
        describe: 'built package to model (a.wbn)',
      });
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await _modelApp(argv.input);
  })
  .command('bake [input]', 'bake screenshot/volume/model of the package at [input]', yargs => {
    yargs
      .positional('input', {
        describe: 'built package to bake (a.wbn)',
      });
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await _bakeApp(argv.input);
  })
  .command('view [input]', 'view contents of input .wbn file', yargs => {
    yargs
      .positional('input', {
        describe: 'input .wbn file to view',
        // default: 5000
      })
      .option('types', {
        alias: 't',
        type: 'boolean',
        description: 'Show file types as well',
      });
  }, async argv => {
    handled = true;

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
  })
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
