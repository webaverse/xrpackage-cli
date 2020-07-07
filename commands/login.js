const path = require('path');
const fs = require('fs');
const os = require('os');

const mkdirp = require('mkdirp');
const fetch = require('node-fetch');

const {makePromise, getUserInput} = require('../utils');
const loginEndpoint = 'https://login.exokit.org';

module.exports = {
  command: 'login',
  describe: 'log in to web registry',
  builder: {},
  handler: async () => {
    const email = await getUserInput('email: ');
    const res = await fetch(loginEndpoint + `?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    });
    if (res.status >= 200 && res.status < 300) {
      await res.json();
      const code = await getUserInput('login code (check your email!): ');
      const res2 = await fetch(loginEndpoint + `?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`, {
        method: 'POST',
      });
      if (res2.status >= 200 && res2.status < 300) {
        const loginToken = await res2.json();

        const p3 = makePromise();
        await mkdirp(os.homedir());
        fs.writeFile(path.join(os.homedir(), '.xrpackage-login'), JSON.stringify(loginToken), err => {
          if (!err) {
            p3.accept();
          } else {
            p3.reject(err);
          }
        });
        await p3;

        console.log(`logged in as ${loginToken.name}`);
      } else {
        console.warn(`invalid status code: ${res2.status}`);
      }
    } else {
      console.warn(`invalid status code: ${res.status}`);
    }
  },
};
