const fs = require('fs');

const {getUserInput} = require('../utils');

module.exports = {
  command: 'init',
  describe: 'initialize xrpackage with manifest.json',
  builder: {},
  handler: async () => {
    if (fs.existsSync('manifest.json')) {
      console.warn('manifest.json already exists; doing nothing');
      return;
    }

    const name = await getUserInput('name: ', {default: 'my-xrpk'});
    const description = await getUserInput('description: ', {default: 'Describe your XRPK'});
    const xrType = await getUserInput('xr type: ', {default: 'webxr-site@0.0.1'});
    const startUrl = await getUserInput('start url: ', {default: 'index.html'});

    fs.writeFileSync('manifest.json', JSON.stringify({
      name,
      description,
      xr_type: xrType,
      start_url: startUrl,
    }, null, 2));
    console.log('wrote to manifest.json');
  },
};
