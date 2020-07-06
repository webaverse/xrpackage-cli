const fs = require('fs');
const {execSync} = require('child_process');

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

    let repository;
    try {
      repository = execSync('git config --get remote.origin.url').toString().replace(/(\r\n|\r|\n)/, '');
    } catch (err) {
      // git not installed/not a repo/etc.
      repository = '';
    }
    repository = await getUserInput('repository: ', {default: repository});

    const name = await getUserInput('name: ', {default: 'my-xrpk'});
    const description = await getUserInput('description: ', {default: 'Describe your XRPK'});
    const xrType = await getUserInput('xr type: ', {default: 'webxr-site@0.0.1'});
    const startUrl = await getUserInput('start url: ', {default: 'index.html'});

    fs.writeFileSync('manifest.json', JSON.stringify({
      name,
      repository,
      description,
      xr_type: xrType,
      start_url: startUrl,
    }, null, 2));
    console.log('wrote to manifest.json');
  },
};
