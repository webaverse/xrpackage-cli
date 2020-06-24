const fs = require('fs');

const fetch = require('node-fetch');

const {getContract} = require('../utils');
const {apiHost} = require('../constants');

module.exports = {
  command: 'install [id]',
  describe: 'install package with given id',
  builder: yargs => {
    yargs
      .positional('id', {
        describe: 'id of package to install',
      });
  },
  handler: async argv => {
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
  },
};
