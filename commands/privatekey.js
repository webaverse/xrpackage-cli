const {getKs, printNotLoggedIn} = require('../utils');

module.exports = {
  command: 'privatekey',
  describe: 'export private key menmonic',
  builder: {},
  handler: async () => {
    const ks = await getKs();
    if (ks) {
      const seed = await ks.exportSeed();
      console.log(seed);
    } else {
      printNotLoggedIn();
    }
  },
};
