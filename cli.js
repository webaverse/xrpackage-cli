#!/usr/bin/env node
/* eslint-disable no-unused-expressions */

Error.stackTraceLimit = 300;

const yargs = require('yargs');
/* const ethereumjs = {
  Tx: require('ethereumjs-tx').Transaction,
}; */
// const {BigNumber} = require('bignumber.js');

/* loadPromise.then(c => {
  const m = c.methods.mint([1, 1, 1], '0x0', 'hash', 'lol');
  console.log('got c', Object.keys(c), Object.keys(c.methods.mint), Object.keys(m), m.encodeABI());
}); */

/* window.web3.eth.contract(abi).at(address)
window.web3 = new window.Web3(window.ethereum);
try {
  // Request account access if needed
  await window.ethereum.enable();
  // Acccounts now exposed
  // web3.eth.sendTransaction({});

  this.instance = ;
  this.account = window.web3.eth.accounts[0];

  this.promise.accept(this.instance);
} catch (err) {
  // User denied account access...
  console.warn(err);
} */

const handled = false;
yargs
  .scriptName('xrpk')
  .command(require('./commands/whoami'))
  .command(require('./commands/privatekey'))
  .command(require('./commands/login'))
  .command(require('./commands/wallet'))
  .command(require('./commands/upload'))
  .command(require('./commands/publish'))
  .command(require('./commands/unpublish'))
  .command(require('./commands/mint'))
  .command(require('./commands/ls'))
  .command(require('./commands/count'))
  .command(require('./commands/run'))
  .command(require('./commands/inspect'))
  .command(require('./commands/install'))
  .command(require('./commands/init'))
  .command(require('./commands/build'))
  .command(require('./commands/screenshot'))
  .command(require('./commands/volume'))
  .command(require('./commands/model'))
  .command(require('./commands/bake'))
  .command(require('./commands/view'))
  .command(require('./commands/cat'))
  .command(require('./commands/icon'))
  .command(require('./commands/headers'))
  .command(require('./commands/extract'))
  .showHelpOnFail(false)
  .argv;
if (!handled) {
  yargs.showHelp();
}
/* .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  }) */

/* if (argv.ships > 3 && argv.distance < 53.5) {
  console.log('Plunder more riffiwobbles!')
} else {
  console.log('Retreat from the xupptumblers!')
} */
