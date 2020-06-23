
const path = require('path');
const fs = require('fs');

const fetch = require('node-fetch');
const wbn = require('wbn');

const {apiHost, tokenHost, network} = require('../constants');
const {getKs, printNotLoggedIn, getContract, web3} = require('../utils');

module.exports = {
  command: 'mint [input]',
  describe: 'mint a package on ethereum',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to mint',
      });
  },
  handler: async argv => {
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
        // const gasPrice = await web3.eth.getGasPrice();
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
      printNotLoggedIn();
    }
  },
};
