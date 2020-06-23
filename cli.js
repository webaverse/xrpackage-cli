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

let handled = false;
yargs
  .scriptName('xrpk')
  .middleware([() => { handled = true; }])
  .commandDir('./commands', {
    recurse: false,
    extensions: ['js'],
  })
  .showHelpOnFail(false)
  .argv;

if (!handled) yargs.showHelp();
