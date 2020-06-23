const fs = require('fs');

const fetch = require('node-fetch');
const wbn = require('wbn');

const {uploadPackage, getManifestJson} = require('../utils');
const {apiHost, packagesEndpoint} = require('../constants');

module.exports = {
  command: 'publish [input]',
  describe: 'publish a package to ipfs',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to publish',
      });
  },
  handler: async argv => {
    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    const dataArrayBuffer = fs.readFileSync(argv.input);
    const bundle = new wbn.Bundle(dataArrayBuffer);

    const manifest = getManifestJson(bundle);
    if (!manifest) return console.warn('no manifest.json in package');

    const {name} = manifest;
    const uploadedPackage = await uploadPackage(dataArrayBuffer, argv.input);
    const {metadata, metadataHash} = uploadedPackage;
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
  },
};
