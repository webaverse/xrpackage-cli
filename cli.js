#!/usr/bin/env node

Error.stackTraceLimit = 300;

const path = require('path');
const fs = require('fs');
const http = require('http');
const {Writable} = require('stream');
const url = require('url');
const os = require('os');

const read = require('read');
const mkdirp = require('mkdirp');
const yargs = require('yargs');
const fetch = require('node-fetch');
const mime = require('mime');
const ignoreWalk = require('ignore-walk')
const wbn = require('wbn');
/* const ethereumjs = {
  Tx: require('ethereumjs-tx').Transaction,
}; */
// const {BigNumber} = require('bignumber.js');
const lightwallet = require('./eth-lightwallet');
const Web3 = require('./web3');
const express = require('express');
const open = require('open');

const apiHost = `https://ipfs.exokit.org/ipfs`;
const packagesEndpoint = 'https://packages.exokit.org'
const tokenHost = `https://tokens.webaverse.com`;
const network = 'rinkeby';
const infuraApiKey = '4fb939301ec543a0969f3019d74f80c2';
const rpcUrl = `https://${network}.infura.io/v3/${infuraApiKey}`;
const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
const port = 9999;

const getContract = Promise.all([
  fetch(`https://contracts.webaverse.com/address.js`).then(res => res.text()).then(s => s.replace(/^export default `(.+?)`[\s\S]*$/, '$1')),
  fetch(`https://contracts.webaverse.com/abi.js`).then(res => res.text()).then(s => JSON.parse(s.replace(/^export default /, ''))),
]).then(([address, abi]) => {
  // console.log('got address + abi', {address, abi});
  return new web3.eth.Contract(abi, address);
});

const primaryUrl = 'https://xrpackage.org';
const loginEndpoint = 'https://login.exokit.org';

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

function makePromise() {
  let accept, reject;
  const p = new Promise((a, r) => {
    accept = a;
    reject = r;
  });
  p.accept = accept;
  p.reject = reject;
  return p;
}
const packageNameRegex = /^[a-z0-9][a-z0-9-._~]*$/;
const _isValidPackageName = name => packageNameRegex.test(name);
const _removeUrlTail = u => u.replace(/(?:\?|\#).*$/, '');
async function getKs() {
  const ksString = (() => {
    try {
      return fs.readFileSync(path.join(os.homedir(), '.xrpackage-wallet'));
    } catch(err) {
      if (err.code === 'ENOENT') {
        return null;
      } else {
        throw err;
      }
    }
  })();
  if (ksString) {
    const passwordPromise = makePromise();
    read({ prompt: 'password: ', silent: true }, function(er, password) {
      if (!er) {
        passwordPromise.accept(password);
      } else {
        passwordPromise.reject(er);
      }
    });
    const password = await passwordPromise;
    const ks = await _importKeyStore(ksString, password);
    return ks;
  } else {
    return null;
  }
}
const hdPathString = `m/44'/60'/0'/0`;
async function exportSeed(ks, password) {
  const p = makePromise();
  ks.keyFromPassword(password, function (err, pwDerivedKey) {
    if (!err) {
      const seed = ks.getSeed(pwDerivedKey);
      p.accept(seed);
    } else {
      p.reject(err);
    }
  });
  return await p;
}
async function signTx(ks, password, rawTx) {
  const p = makePromise();
  ks.keyFromPassword(password, function (err, pwDerivedKey) {
    if (!err) {
      const address = ks.addresses[0];
      console.log('sign tx', ks, pwDerivedKey, rawTx, address, hdPathString);
      const signed = lightwallet.signing.signTx(ks, pwDerivedKey, rawTx, `0x${address}`, hdPathString);
      p.accept(signed);
    } else {
      p.reject(err);
    }
  });
  return await p;
}
async function getPrivateKey(ks, password) {
  const p = makePromise();
  ks.keyFromPassword(password, function (err, pwDerivedKey) {
    if (!err) {
      const privateKey = ks.exportPrivateKey(ks.addresses[0], pwDerivedKey);
      p.accept(privateKey);
    } else {
      p.reject(err);
    }
  });
  return await p;
}
const _createKeystore = async (seedPhrase, password) => {
  const p = makePromise();
  lightwallet.keystore.createVault({
    password,
    seedPhrase, // Optionally provide a 12-word seed phrase
    // salt: fixture.salt,     // Optionally provide a salt.
                               // A unique salt will be generated otherwise.
    hdPathString,    // Optional custom HD Path String
  },
  (err, ks) => {
    if (!err) {
      ks.keyFromPassword(password, function (err, pwDerivedKey) {
        if (!err) {
          ks.generateNewAddress(pwDerivedKey, 1);

          p.accept(ks);
        } else {
          p.reject(err);
        }
      });
    } else {
      p.reject(err);
    }
  });
  const ks = await p;
  ks.exportSeed = exportSeed.bind(null, ks, password);
  ks.signTx = signTx.bind(null, ks, password);
  ks.getPrivateKey = getPrivateKey.bind(null, ks, password);
  return ks;
};
const _exportKeyStore = ks => ks.serialize();
const _importKeyStore = async (s, password) => {
  const ks = lightwallet.keystore.deserialize(s);

  const p = makePromise();
  ks.keyFromPassword(password, function (err, pwDerivedKey) {
    if (!err) {
      if (ks.isDerivedKeyCorrect(pwDerivedKey)) {
        p.accept();
      } else {
        p.reject(new Error('invalid password'));
      }
    } else {
      p.reject(err);
    }
  });
  await p;
  ks.exportSeed = exportSeed.bind(null, ks, password);
  ks.signTx = signTx.bind(null, ks, password);
  ks.getPrivateKey = getPrivateKey.bind(null, ks, password);
  return ks;
};
const _printNotLoggedIn = () => {
  console.warn('not logged in; use xrpk login');
};
const _cloneBundle = (bundle, options = {}) => {
  const except = options.except || [];
  const urlSpec = new url.URL(bundle.primaryURL);
  const primaryUrl = urlSpec.origin;
  const startUrl = urlSpec.pathname.replace(/^\//, '');
  const builder = new wbn.BundleBuilder(primaryUrl + '/' + startUrl);
  for (const u of bundle.urls) {
    const {pathname} = new url.URL(u);
    if (!except.includes(pathname)) {
      const res = bundle.getResponse(u);
      const type = res.headers['content-type'];
      const data = res.body;
      builder.addExchange(primaryUrl + pathname, 200, {
        'Content-Type': type,
      }, data);
    }
  }
  return builder;
};
const _getManifestJson = bundle => {
  if (bundle.urls.includes('https://xrpackage.org/manifest.json')) {
    const response = bundle.getResponse('https://xrpackage.org/manifest.json');
    const s = response.body.toString('utf8');
    const j = JSON.parse(s);
    return j;
  } else {
    return null;
  }
};
const _isNamed = bundle => {
  const j = _getManifestJson(bundle);
  return !!j && typeof j.name === 'string' && _isValidPackageName(j.name);
};
const _isBaked = bundle => {
  const j = _getManifestJson(bundle);
  if (j) {
    const {icons} = j;
    if (Array.isArray(icons)) {
      return ['image/gif', 'model/gltf-binary', 'model/gltf-binary+preview'].every(type => icons.some(i => i && i.type === type));
    } else {
      return false;
    }
  } else {
    return false;
  }
};
const _uploadPackage = async dataArrayBuffer => {
  const bundle = new wbn.Bundle(dataArrayBuffer);
  const j = _getManifestJson(bundle);
  if (j) {
    if (_isNamed(bundle)) {
      if (_isBaked(bundle)) {
        const {name, description, icons = []} = j;

        const iconObjects = [];
        for (let i = 0; i < icons.length; i++) {
          const icon = icons[i];
          const {src, type} = icon;
          console.warn(`uploading icon "${type}" (${i+1}/${icons.length})...`);
          const response = bundle.getResponse(`https://xrpackage.org/${src}`);
          const hash = await fetch(`${apiHost}/`, {
            method: 'PUT',
            body: response.body,
          })
            .then(res => res.json())
            .then(j => j.hash);
          iconObjects.push({
            hash,
            type,
          });
        }

        const objectName = typeof name === 'string' ? name : path.basename(argv.input);
        const objectDescription = typeof description === 'string' ? description : `Package for ${path.basename(argv.input)}`;

        console.warn('uploading data...');
        const dataHash = await fetch(`${apiHost}/`, {
          method: 'PUT',
          body: dataArrayBuffer,
        })
          .then(res => res.json())
          .then(j => j.hash);

        console.warn('uploading metadata...');
        const metadata = {
          name: objectName,
          description: objectDescription,
          icons: iconObjects,
          dataHash,
        };
        const metadataHash = await fetch(`${apiHost}/`, {
          method: 'PUT',
          body: JSON.stringify(metadata),
        })
          .then(res => res.json())
          .then(j => j.hash);

        return {
          metadata,
          metadataHash,
        };
      } else {
        throw 'package is not baked; try xrpk bake';
      }
    } else {
      throw `package does not have a valid "name" in manifest.json (${packageNameRegex.toString()})`;
    }
  } else {
    throw 'no manifest.json in package';
  }
};
const _screenshotApp = async output => {
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
    // console.log(`got ${type} request`);

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
  app.use(express.static(__dirname));
  const server = http.createServer(app);
  const connections = [];
  server.on('connection', c => {
    connections.push(c);
  });
  server.listen(port, () => {
    open(`https://xrpackage.org/screenshot.html?srcWbn%3Dhttp://localhost:${port}/a.wbn%26dstGif%3Dhttp://localhost:${port}/screenshot.gif`);
  });

  const [gifUint8Array] = await Promise.all([gifPromise]);
  server.close();
  for (let i = 0; i < connections.length; i++) {
    connections[i].destroy();
  }

  const bundleBuffer = fs.readFileSync(output);
  const bundle = new wbn.Bundle(bundleBuffer);

  const res = bundle.getResponse('https://xrpackage.org/manifest.json');
  const s = res.body.toString('utf8');
  const manifestJson = JSON.parse(s);
  const {start_url: startUrl} = manifestJson;

  const builder = _cloneBundle(bundle, {
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

  builder.addExchange(primaryUrl + '/manifest.json', 200, {
    'Content-Type': 'application/json',
  }, JSON.stringify(manifestJson, null, 2));

  const buffer = builder.createBundle();
  fs.writeFileSync(output, buffer);
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

  const builder = _cloneBundle(bundle, {
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

  const builder = _cloneBundle(bundle, {
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

  const builder = _cloneBundle(bundle, {
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
  .command('whoami', 'print logged in address', yargs => {
    yargs
      /* .positional('input', {
        describe: 'input file to build',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const ks = await getKs();
    if (ks) {
      console.log(`0x${ks.addresses[0]}`);
    } else {
      _printNotLoggedIn();
    }
  })
  .command('privatekey', 'export private key menmonic', yargs => {
    yargs
      /* .positional('input', {
        describe: 'input file to build',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const ks = await getKs();
    if (ks) {
      const seed = await ks.exportSeed();
      console.log(seed);
    } else {
      _printNotLoggedIn();
    }
  })
  .command('login', 'log in to web registry', yargs => {
    yargs
      /* .positional('input', {
        describe: 'input file to build',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const p = makePromise();
    read({ prompt: 'email: ' }, function(er, seedPhrase) {
      if (!er) {
        p.accept(seedPhrase);
      } else {
        p.reject(er);
      }
    });
    const email = await p;

    const res = await fetch(loginEndpoint + `?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    });
    if (res.status >= 200 && res.status < 300) {
      await res.json();

      const p2 = makePromise();
      read({ prompt: 'login code (check your email!): ' }, function(er, code) {
        if (!er) {
          p2.accept(code);
        } else {
          p2.reject(er);
        }
      });
      const code = await p2;

      const res2 = await fetch(loginEndpoint + `?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
        method: 'POST',
      });
      if (res2.status >= 200 && res2.status < 300) {
        const loginToken = await res2.json();

        const p3 = makePromise();
        await mkdirp(os.homedir());
        fs.writeFile(path.join(os.homedir(), '.xrpackage-login'), JSON.stringify(loginToken), err => {
          if (!err) {
            p3.accept();
          } else {
            p3.reject(err);
          }
        });
        await p3;

        console.log(`logged in as ${loginToken.name}`);
      } else {
        console.warn(`invalid status code: ${res2.status}`);
      }
    } else {
      console.warn(`invalid status code: ${res2.status}`);
    }
  })
  .command('wallet', 'set up blockchain wallet', yargs => {
    yargs
      /* .positional('input', {
        describe: 'input file to build',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const mutableStdout = new Writable({
      write: function(chunk, encoding, callback) {
        if (!this.muted)
          process.stdout.write(chunk, encoding);
        callback();
      }
    });
    mutableStdout.muted = false;

    const p = makePromise();
    read({ prompt: 'seed phrase (BIP39 format, default: auto): ', silent: true }, function(er, seedPhrase) {
      if (!er) {
        p.accept(seedPhrase);
      } else {
        p.reject(er);
      }
    });
    let seedPhrase = await p;
    if (seedPhrase) {
      if (!lightwallet.keystore.isSeedValid(seedPhrase)) {
        throw 'seed phrase is invalid; must be BIP39 format';
      }
    } else {
      seedPhrase = lightwallet.keystore.generateRandomSeed();
      console.log(seedPhrase);
      console.log('☝️ this is your autogenerated seed phrase; write it down');
    }

    const p2 = makePromise();
    read({ prompt: 'password (used to encrypt seed phrase): ', silent: true }, function(er, password) {
      if (!er) {
        p2.accept(password);
      } else {
        p2.reject(er);
      }
    });
    const password = await p2;

    const p3 = makePromise();
    if (password) {
      const ks = await _createKeystore(seedPhrase, password);
      await mkdirp(os.homedir());
      fs.writeFile(path.join(os.homedir(), '.xrpackage-wallet'), _exportKeyStore(ks), err => {
        if (!err) {
          p3.accept();
        } else {
          p3.reject(err);
        }
      });
      console.log(`0x${ks.addresses[0]}`);
    } else {
      p3.reject(new Error('password is required'));
    }
    await p3;
  })
  .command('upload [input]', 'upload a package without registry', yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to upload',
        // default: 5000
      })
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    const dataArrayBuffer = fs.readFileSync(input);
    const o = await _uploadPackage(dataArrayBuffer);
    const {metadata, metadataHash} = o;
    console.log('Name:', metadata.name);
    console.log('Description:', metadata.description);
    if (metadata.icons.length > 0) {
      console.log('Icons:');
      for (const o of metadata.icons) {
        console.log(`  ${apiHost}/${o.hash} ${o.type}`);
      }
    }
    console.log('Data:', `${apiHost}/${metadata.dataHash}.wbn`);
    console.log('Metadata:', `${apiHost}/${metadataHash}.json`);
  })
  .command('publish [input]', 'publish a package to ipfs', yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to publish',
        // default: 5000
      })
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    const dataArrayBuffer = fs.readFileSync(argv.input);
    const bundle = new wbn.Bundle(dataArrayBuffer);
    const j = _getManifestJson(bundle);
    if (j) {
      const {name} = j;
      const o = await _uploadPackage(dataArrayBuffer);
      const {metadata, metadataHash} = o;
      console.log('Name:', metadata.name);
      console.log('Description:', metadata.description);
      if (metadata.icons.length > 0) {
        console.log('Icons:');
        for (const o of metadata.icons) {
          console.log(`  ${apiHost}/${o.hash} ${o.type}`);
        }
      }
      console.log('Data:', `${apiHost}/${metadata.dataHash}.wbn`);
      console.log('Metadata:', `${apiHost}/${metadataHash}.json`);

      const u = packagesEndpoint + '/' + name;
      const res = await fetch(u, {
        method: 'PUT',
        body: JSON.stringify(metadata),
      });
      if (res.ok) {
        await res.json();
        console.log(`https://xrpackage.org/inspect.html?p=${name}`);
      } else {
        console.warn('invalid status code: ' + res.status);
      }
    } else {
      console.warn('no manifest.json in package');
    }
  })
  .command('unpublish [name]', 'unpublish a package from ipfs', yargs => {
    yargs
      .positional('name', {
        describe: 'package name to unpublish',
        // default: 5000
      })
  }, async argv => {
    handled = true;

    const {name} = argv;
    if (name) {
      const u = packagesEndpoint + '/' + name;
      const res = await fetch(u, {
        method: 'DELETE',
      });
      if (res.ok) {
        await res.json();
        console.log(u);
      } else {
        console.warn('invalid status code: ' + res.status);
      }
    } else {
      throw 'must provide a package name';
    }
  })
  .command('mint [input]', 'mint a package on ethereum', yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to mint',
        // default: 5000
      })
  }, async argv => {
    handled = true;

    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    const ks = await getKs();
    if (ks) {
      const dataArrayBuffer = fs.readFileSync(argv.input);
      const bundle = new wbn.Bundle(dataArrayBuffer);
      if (bundle.urls.includes('https://xrpackage.org/manifest.json')) {
        const screenshotBlob = fs.readFileSync(argv.input + '.gif');
        const modelBlob = fs.readFileSync(argv.input + '.glb');

        const response = bundle.getResponse('https://xrpackage.org/manifest.json');
        const s = response.body.toString('utf8');
        const j = JSON.parse(s);
        const {name, description} = j;

        const objectName = typeof name === 'string' ? name : path.basename(argv.input);
        const objectDescription = typeof description === 'string' ? description : `Package for ${path.basename(argv.input)}`;

        console.log('Name:', objectName);
        console.log('Description:', objectDescription);

        console.log('uploading...');
        const [
          dataHash,
          screenshotHash,
          modelHash,
        ] = await Promise.all([
          fetch(`${apiHost}/`, {
            method: 'PUT',
            body: dataArrayBuffer,
          })
            .then(res => res.json())
            .then(j => j.hash),
          fetch(`${apiHost}/`, {
            method: 'PUT',
            body: screenshotBlob,
          })
            .then(res => res.json())
            .then(j => j.hash),
          fetch(`${apiHost}/`, {
            method: 'PUT',
            body: modelBlob,
          })
            .then(res => res.json())
            .then(j => j.hash),
        ]);
        const metadataHash = await fetch(`${apiHost}/`, {
          method: 'PUT',
          body: JSON.stringify({
            objectName,
            objectDescription,
            dataHash,
            screenshotHash,
            modelHash,
          }),
        })
          .then(res => res.json())
          .then(j => j.hash);

        console.log(`${apiHost}/${dataHash}.wbn`);
        console.log(`${apiHost}/${screenshotHash}.gif`);
        console.log(`${apiHost}/${modelHash}.glb`);
        console.log(`${apiHost}/${metadataHash}.json`);

        console.log('minting...');
        const contract = await getContract;
        const address = `0x${ks.addresses[0]}`;
        const privateKey = await ks.getPrivateKey();
        const account = web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
        web3.eth.accounts.wallet.add(account);

        const nonce = await web3.eth.getTransactionCount(address);
        const gasPrice = await web3.eth.getGasPrice();
        // const value = '10000000000000000'; // 0.01 ETH

        const m = contract.methods.mint(1, 'hash', metadataHash);
        const o = {
          gas: 0,
          from: address,
          nonce,
          // value,
        };
        o.gas = await m.estimateGas(o);
        const receipt = await m.send(o);
        const id = parseInt(receipt.events.URI.returnValues[1], 10);
        console.log(`${tokenHost}/${id}`);
        console.log(`https://${network}.opensea.io/assets/${contract._address}/${id}`);
      } else {
        console.warn('no manifest.json in package');
      }
    } else {
      _printNotLoggedIn();
    }
  })
  .command('ls', 'list wallet inventory', yargs => {
    yargs
      /* .positional('id', {
        describe: 'id of package to install',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const ks = await getKs();
    if (ks) {
      const contract = await getContract;
      const owner = '0x' + ks.addresses[0];
      const owners = Array(100);
      const ids = Array(owners.length);
      for (let i = 0; i < ids.length; i++) {
        owners[i] = owner;
        ids[i] = i+1;
      }
      const balances = await contract.methods.balanceOfBatch(owners, ids).call();
      const ownedIds = balances.map((balance, id) => {
        balance = parseInt(balance, 10);
        if (balance > 0) {
          return id;
        } else {
          return null;
        }
      }).filter(id => id !== null);
      const objects = [];
      for (let i = 0; i < ownedIds.length; i++) {
        const id = ownedIds[i];
        const metadataHash = await contract.methods.getMetadata(id, 'hash').call();
        const metadata = await fetch(`${apiHost}/${metadataHash}`)
          .then(res => res.json());
        const {objectName, dataHash} = metadata;
        objects.push({
          id,
          objectName,
          dataHash,
        });
      }
      for (let i = 0; i < ownedIds.length; i++) {
        const object = objects[i];
        console.log(object.id + ' ' + JSON.stringify(object.objectName) + ' ' + `${apiHost}/${object.dataHash}.wbn`);
      }
      /* const nonce = await contract.methods.getNonce().call();
      console.log(nonce); */
    } else {
      _printNotLoggedIn();
    }
  })
  .command('count', 'get count of minted packages', yargs => {
    yargs
      /* .positional('id', {
        describe: 'id of package to install',
        // default: 5000
      }) */
  }, async argv => {
    handled = true;

    const contract = await getContract;
    const nonce = await contract.methods.getNonce().call();
    console.log(nonce);
  })
  .command('run [id]', 'run a package in browser', yargs => {
    yargs
      .option('path', {
        alias: 'p',
        type: 'string',
        description: 'Use local xrpackage path for runtime'
      })
  }, async argv => {
    handled = true;

    const app = express();
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', '*');
      res.set('Access-Control-Allow-Headers', '*');
      next();
    });

    const _getRunUrl = o => {
      let url;
      let servePath;
      if (o.path) {
        url = `http://localhost:${port}/run.html`;
        servePath = o.path;
      } else {
        url = `https://xrpackage.org/run.html`;
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
  })
  .command('inspect [id]', 'inspect a package in browser', yargs => {
    yargs
      .option('path', {
        alias: 'p',
        type: 'string',
        description: 'Use local xrpackage path for runtime'
      })
  }, async argv => {
    handled = true;

    const app = express();
    app.use((req, res, next) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', '*');
      res.set('Access-Control-Allow-Headers', '*');
      next();
    });

    const _getRunUrl = o => {
      let url;
      let servePath;
      if (o.path) {
        url = `http://localhost:${port}/inspect.html`;
        servePath = o.path;
      } else {
        url = `https://xrpackage.org/inspect.html`;
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
  })
  .command('install [id]', 'install package with given id', yargs => {
    yargs
      .positional('id', {
        describe: 'id of package to install',
        // default: 5000
      })
  }, async argv => {
    handled = true;

    const contract = await getContract;

    const metadataHash = await contract.methods.getMetadata(parseInt(argv.id, 10), 'hash').call();
    const metadata = await fetch(`${apiHost}/${metadataHash}`)
      .then(res => res.json());
    // console.log(metadata);
    const {dataHash, screenshotHash, modelHash} = metadata;

    console.log('downloading...');
    await Promise.all([
      fetch(`${apiHost}/${dataHash}`)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => {
          fs.writeFileSync('a.wbn', Buffer.from(arrayBuffer));
        }),
      fetch(`${apiHost}/${screenshotHash}`)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => {
          fs.writeFileSync('a.wbn.gif', Buffer.from(arrayBuffer));
        }),
      fetch(`${apiHost}/${modelHash}`)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => {
          fs.writeFileSync('a.wbn.glb', Buffer.from(arrayBuffer));
        }),
    ]);

    console.log('a.wbn');
  })
  .command('init', 'initialize xrpackage with manifest.json', yargs => {
    yargs
      .positional('input', {
        describe: 'input file to build',
        // default: 5000
      })
      .positional('output', {
        describe: 'output file to write',
        // default: 5000
      });
  }, async argv => {
    handled = true;

    if (fs.existsSync('manifest.json')) {
      console.warn('manifest.json already exists; doing nothing');
    } else {
      fs.writeFileSync('manifest.json', JSON.stringify({
        name: "My WebXR App",
        description: "Describe your WebXR application",
        xr_type: 'webxr-site@0.0.1',
        start_url: 'index.html',
      }, null, 2));
      console.log('manifest.json');
    }
  })
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
        description: 'Screenshot package after building'
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
              startUrl = j.start_url.replace(/(?:\?|\#).*$/, '');
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
        await _screenshotApp(argv.output);
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

    await _screenshotApp(argv.input);
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
        description: 'Show file types as well'
      })
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
    const j = _getManifestJson(bundle);
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
              desc = '[missing]'
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
      const files = [];
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