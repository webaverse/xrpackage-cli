# xrpackage-cli

CLI for XRPackage.

## Usage

```bash
xrpk [command]

Commands:
  xrpk bake [input]            bake screenshot/volume/model of the package at [input]
  xrpk build [input] [output]  build xrpackage .wbn from [input] and write to [output]
  xrpk cat [input] [path]      cat contents of file inside .wbn to stdout
  xrpk count                   get count of minted packages
  xrpk extract [input]         extract contents of .wbn file
  xrpk headers [input] [path]  print headers for file inside .wbn to stdout
  xrpk icon [input]            print icons of a package
  xrpk init                    initialize xrpackage with manifest.json
  xrpk inspect [id]            inspect a package in browser
  xrpk install [id]            install package with given id
  xrpk login                   log in to web registry
  xrpk ls                      list wallet inventory
  xrpk mint [input]            mint a package on ethereum
  xrpk model [input]           generate a model of the package at [input]
  xrpk privatekey              export private key menmonic
  xrpk publish [input]         publish a package to ipfs
  xrpk run [id]                run a package in browser
  xrpk screenshot [input]      generate a screenshot of the package at [input]
  xrpk unpublish [input]       unpublish a package from ipfs
  xrpk upload [input]          upload a package without registry
  xrpk view [input]            view contents of input .wbn file
  xrpk volume [input]          generate a volume of the package at [input]
  xrpk wallet                  set up blockchain wallet
  xrpk whoami                  print logged in address

Options:
  --help     Show help            [boolean]
  --version  Show version number  [boolean]
```

## Notes

For interacting with Ethereum, the `xrpk` CLI tool uses the [`eth-lightwallet`](https://github.com/ConsenSys/eth-lightwallet/) package, however that generally requires a native build. Therefore, this repo includes the [`./eth-lightwallet.js`](./eth-lightwallet.js) file, which is the `eth-lightwallet` module bundled using [Browserify](http://browserify.org/).

In case a new version is needed to be built, perform the following steps (or use the [`gen-eth-lightwallet`](./gen-eth-lightwallet) script):

```bash
npm install eth-lightwallet # Temporarily install & build eth-lightwallet locally
cd node_modules/eth-lightwallet
browserify index.js -o eth-lightwallet.js --node --standalone ethlightwallet # Bundle the module
mv eth-lightwallet.js ../../eth-lightwallet.js # Replace the repo's eth-lightwallet.js file
cd ../../
# Optionally uninstall temp version of eth-lightwallet:
# npm remove eth-lightwallet
```

Ideally, we also update any uses of `new Buffer(...)` to the new Node `Buffer` API which needs to be done manually. This can be done by doing a search in the new `eth-lightwallet.js` file for `new Buffer` and `buffer.Buffer` -- for each of these uses, determine the correct new API to use (it will likely be either `Buffer.from` for strings/objects, or `Buffer.alloc` for numbers). See [this commit](https://github.com/webaverse/xrpackage-cli/pull/29/commits/a7232ac5813d489ae5244df5b0c67b0a8e802bc8) for an example diff after performing this process.

See https://github.com/webaverse/xrpackage-cli/issues/20 for further background.

## Testing

This CLI tool uses [AVA](https://github.com/avajs/ava) as a test runner. Tests are in the [`./tests`](./tests) directory, with utility/helper files in [`./tests/utils`](./tests/utils).

See the AVA config file at [`./ava.config.js`](./ava.config.js).

Tests usually use the `runCommand(command: string, params?: [string])` helper function in [`./tests/utils/helpers.js`](./tests/utils/helpers.js) file, which runs commands with the current working directory set to `tests`. A simple test can look like:

```js
const test = require('ava');

const {runCommand} = require('./utils/helpers');

test('view', async t => {
  const {stdout} = await runCommand('view', ['assets/w.glb.wbn']); // i.e. ./tests/assets/w.glb.wbn
  t.is(stdout, 'https://xrpackage.org/w.glb\nhttps://xrpackage.org/manifest.json\n');
});
```

Running `npm run test` will automatically run all the tests in the `tests` directory.
