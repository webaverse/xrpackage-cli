const fetch = require('node-fetch');

const {apiHost} = require('../constants');
const {getKs, printNotLoggedIn, getContract} = require('../utils');

module.exports = {
  command: 'ls',
  describe: 'list wallet inventory',
  builder: {},
  handler: async () => {
    const ks = await getKs();
    if (ks) {
      const contract = await getContract;
      const owner = '0x' + ks.addresses[0];
      const owners = Array(100);
      const ids = Array(owners.length);
      for (let i = 0; i < ids.length; i++) {
        owners[i] = owner;
        ids[i] = i + 1;
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
      printNotLoggedIn();
    }
  },
};
