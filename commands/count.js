const {getContract} = require('../utils');

module.exports = {
  command: 'count',
  describe: 'get count of minted packages',
  builder: {},
  handler: async () => {
    const contract = await getContract;
    const nonce = await contract.methods.getNonce().call();
    console.log(nonce);
  },
};
