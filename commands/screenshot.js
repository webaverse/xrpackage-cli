const {screenshotApp} = require('../utils');

module.exports = {
  command: 'screenshot [input]',
  describe: 'generate a screenshot of the package at [input]',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'built package to screenshot (a.wbn)',
        type: 'string',
        default: 'a.wbn',
      });
  },
  handler: async argv => await screenshotApp(argv.input),
};
