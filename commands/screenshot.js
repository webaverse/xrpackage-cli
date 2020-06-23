const {screenshotApp} = require('../utils');

module.exports = {
  command: 'screenshot [input]',
  describe: 'generate a screenshot of the package at [input]',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'built package to screenshot (a.wbn)',
      });
  },
  handler: async (argv) => {
    if (typeof argv.input !== 'string') {
      argv.input = 'a.wbn';
    }

    await screenshotApp(argv.input);
  },
};
