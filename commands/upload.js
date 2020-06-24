const fs = require('fs');

const {uploadPackage} = require('../utils');
const {apiHost} = require('../constants');

module.exports = {
  command: 'upload [input]',
  describe: 'upload a package without registry',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: '.wbn package to upload',
        type: 'string',
        default: 'a.wbn',
      });
  },
  handler: async argv => {
    const dataArrayBuffer = fs.readFileSync(argv.input);
    const o = await uploadPackage(dataArrayBuffer, argv.input);
    const {metadata, metadataHash} = o;
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
  },
};
