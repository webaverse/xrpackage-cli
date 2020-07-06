const fs = require('fs');

module.exports = {
  command: 'init',
  describe: 'initialize xrpackage with manifest.json',
  builder: {},
  handler: async () => {
    if (fs.existsSync('manifest.json')) {
      console.warn('manifest.json already exists; doing nothing');
    } else {
      fs.writeFileSync('manifest.json', JSON.stringify({
        name: 'My WebXR App',
        description: 'Describe your WebXR application',
        xr_type: 'webxr-site@0.0.1',
        start_url: 'index.html',
      }, null, 2));
      console.log('manifest.json');
    }
  },
};
