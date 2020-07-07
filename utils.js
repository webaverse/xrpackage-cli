const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const os = require('os');

const express = require('express');
const read = require('read');
const fetch = require('node-fetch');
const wbn = require('wbn');
const open = require('open');

const Web3 = require('./web3');
const lightwallet = require('./eth-lightwallet');

const {rpcUrl, port, primaryUrl, apiHost, contractsUrl} = require('./constants');
const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));

const hdPathString = 'm/44\'/60\'/0\'/0';
const packageNameRegex = /^[a-z0-9][a-z0-9-._~]*$/;

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

async function getUserInput(prompt, options = {}) {
  options.prompt = prompt;
  const p = makePromise();
  read(options, function(er, input) {
    if (!er) p.accept(input);
    else p.reject(er);
  });
  return p;
}

const createKeystore = async (seedPhrase, password) => {
  const p = makePromise();
  lightwallet.keystore.createVault({
    password,
    seedPhrase, // Optionally provide a 12-word seed phrase
    // salt: fixture.salt,     // Optionally provide a salt.
    // A unique salt will be generated otherwise.
    hdPathString, // Optional custom HD Path String
  },
  (err, ks) => {
    if (!err) {
      ks.keyFromPassword(password, function(err, pwDerivedKey) {
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
  ks.exportSeed = _exportSeed.bind(null, ks, password);
  ks.signTx = _signTx.bind(null, ks, password);
  ks.getPrivateKey = _getPrivateKey.bind(null, ks, password);
  return ks;
};

async function getKs() {
  const ksString = (() => {
    try {
      return fs.readFileSync(path.join(os.homedir(), '.xrpackage-wallet'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      } else {
        throw err;
      }
    }
  })();
  if (ksString) {
    const passwordPromise = makePromise();
    read({prompt: 'password: ', silent: true}, function(er, password) {
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

const getManifestJson = bundle => {
  if (bundle.urls.includes('https://xrpackage.org/manifest.json')) {
    const response = bundle.getResponse('https://xrpackage.org/manifest.json');
    const s = response.body.toString('utf8');
    const j = JSON.parse(s);
    return j;
  } else {
    return null;
  }
};

const uploadPackage = async (dataArrayBuffer, xrpkName) => {
  const bundle = new wbn.Bundle(dataArrayBuffer);
  const j = getManifestJson(bundle);
  if (j) {
    if (_isNamed(bundle)) {
      if (_isBaked(bundle)) {
        const {name, description, xr_type: xrType, xr_details: xrDetails = {}, icons = []} = j;

        const iconObjects = [];
        for (let i = 0; i < icons.length; i++) {
          const icon = icons[i];
          const {src, type} = icon;
          console.warn(`uploading icon "${type}" (${i + 1}/${icons.length})...`);
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

        const objectName = typeof name === 'string' ? name : path.basename(xrpkName);
        const objectDescription = typeof description === 'string' ? description : `Package for ${path.basename(xrpkName)}`;

        console.warn('uploading data...');
        const dataHash = await fetch(`${apiHost}/`, {
          method: 'PUT',
          body: dataArrayBuffer,
        })
          .then(res => res.json())
          .then(j => j.hash);

        let contractAddress;
        if (xrDetails.contract) {
          console.warn('uploading contract...');
          const response = bundle.getResponse(`https://xrpackage.org/${xrDetails.contract}`);
          contractAddress = await fetch(`${contractsUrl}/${dataHash}`, {
            method: 'PUT',
            body: response.body,
          })
            .then(res => res.json())
            .then(j => j.address);
        } else {
          contractAddress = null;
        }

        console.warn('uploading metadata...');
        const metadata = {
          name: objectName,
          description: objectDescription,
          type: xrType,
          icons: iconObjects,
          dataHash,
          contractAddress,
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
        throw 'package is not baked or icons are missing; try xrpk bake';
      }
    } else {
      throw `package does not have a valid "name" in manifest.json (${packageNameRegex.toString()})`;
    }
  } else {
    throw 'no manifest.json in package';
  }
};

const getContract = Promise.all([
  fetch('https://contracts.webaverse.com/address.js').then(res => res.text()).then(s => s.replace(/^export default `(.+?)`[\s\S]*$/, '$1')),
  fetch('https://contracts.webaverse.com/abi.js').then(res => res.text()).then(s => JSON.parse(s.replace(/^export default /, ''))),
]).then(([address, abi]) => {
  // console.log('got address + abi', {address, abi});
  return new web3.eth.Contract(abi, address);
});

const cloneBundle = (bundle, options = {}) => {
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

const screenshotApp = async output => {
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

  builder.addExchange(primaryUrl + '/manifest.json', 200, {
    'Content-Type': 'application/json',
  }, JSON.stringify(manifestJson, null, 2));

  const buffer = builder.createBundle();
  fs.writeFileSync(output, buffer);
};

const printNotLoggedIn = () => console.warn('not logged in; use xrpk login');

async function _exportSeed(ks, password) {
  const p = makePromise();
  ks.keyFromPassword(password, function(err, pwDerivedKey) {
    if (!err) {
      const seed = ks.getSeed(pwDerivedKey);
      p.accept(seed);
    } else {
      p.reject(err);
    }
  });
  return await p;
}

async function _signTx(ks, password, rawTx) {
  const p = makePromise();
  ks.keyFromPassword(password, function(err, pwDerivedKey) {
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

async function _getPrivateKey(ks, password) {
  const p = makePromise();
  ks.keyFromPassword(password, function(err, pwDerivedKey) {
    if (!err) {
      const privateKey = ks.exportPrivateKey(ks.addresses[0], pwDerivedKey);
      p.accept(privateKey);
    } else {
      p.reject(err);
    }
  });
  return await p;
}

const _importKeyStore = async (s, password) => {
  const ks = lightwallet.keystore.deserialize(s);

  const p = makePromise();
  ks.keyFromPassword(password, function(err, pwDerivedKey) {
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
  ks.exportSeed = _exportSeed.bind(null, ks, password);
  ks.signTx = _signTx.bind(null, ks, password);
  ks.getPrivateKey = _getPrivateKey.bind(null, ks, password);
  return ks;
};

const _isValidPackageName = name => packageNameRegex.test(name);

const _isNamed = bundle => {
  const j = getManifestJson(bundle);
  return !!j && typeof j.name === 'string' && _isValidPackageName(j.name);
};

const _isBaked = bundle => {
  const j = getManifestJson(bundle);
  if (!j) return false;

  const {icons} = j;
  if (!Array.isArray(icons)) return false;

  const iconTypes = ['image/gif', 'model/gltf-binary', 'model/gltf-binary+preview'];
  if (!iconTypes.every(type => icons.some(i => i && i.type === type))) return false;

  // Ensure the icons are actually present in the wbn
  return icons.every(i => {
    const p = path.normalize(path.join('/', i.src)).replace(/\\/g, '/');
    const u = bundle.urls.find(u => new url.URL(u).pathname === p);
    return !!bundle.getResponse(u);
  });
};

module.exports = {
  makePromise,
  getUserInput,
  createKeystore,
  getKs,
  printNotLoggedIn,
  getManifestJson,
  uploadPackage,
  getContract,
  screenshotApp,
  cloneBundle,

  web3,
};
