const fetch = require('node-fetch');

const {packagesEndpoint} = require('../constants');

module.exports = {
  command: 'unpublish [input]',
  describe: 'unpublish a package from ipfs',
  builder: yargs => {
    yargs
      .positional('name', {
        describe: 'package name to unpublish',
      });
  },
  handler: async argv => {
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
  },
};
