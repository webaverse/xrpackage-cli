const test = require('ava');

const {runCommand} = require('./utils/helpers');

test('view', async t => {
  const {stdout} = await runCommand('view', ['assets/w.glb.wbn']);
  t.is(stdout, 'https://xrpackage.org/w.glb\nhttps://xrpackage.org/manifest.json\n');
});
