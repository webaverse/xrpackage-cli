const fs = require('fs');
const path = require('path');
const os = require('os');

const read = require('read');

const lightwallet = require('./eth-lightwallet');

const hdPathString = 'm/44\'/60\'/0\'/0';

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

module.exports = {
  makePromise,
  createKeystore,
  getKs,
  printNotLoggedIn,
};
