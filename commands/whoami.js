const {getKs, printNotLoggedIn} = require('../utils');

module.exports = {
  command: 'whoami',
  describe: 'print logged in address',
  builder: {},
  handler: async () => {
    const ks = await getKs();
    if (ks) {
      console.log(`0x${ks.addresses[0]}`);
    } else {
      printNotLoggedIn();
    }
  },
};
