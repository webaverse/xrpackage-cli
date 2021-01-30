const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const runCommand = async (command, params = []) => {
  if (!command) throw new Error('No command provided');

  for (let i = 0; i < params.length; i++) {
    // Ensure params are alphanumeric/slashes/periods
    if (!params[i].match(/^[a-z0-9/.]+$/i)) {
      throw new Error('Invalid params');
    }
  }

  const args = [command, ...params].join(' ');
  const {stdout, stderr} = await exec(`node ../cli.js ${args}`, {
    cwd: path.join(__dirname, '../'),
  });
  return {stdout, stderr};
};

module.exports = {runCommand};
