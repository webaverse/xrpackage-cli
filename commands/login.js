const path = require('path');
const fs = require('fs');
const os = require('os');

const read = require('read');
const mkdirp = require('mkdirp');
const fetch = require('node-fetch');

const {makePromise} = require('../utils');

const loginEndpoint = 'https://login.exokit.org';
module.exports = {
  command: 'login',
  describe: 'log in to web registry',
  builder: {},
  handler: async () => {
    const p = makePromise();
    read({prompt: 'email: '}, function(er, seedPhrase) {
      if (!er) {
        p.accept(seedPhrase);
      } else {
        p.reject(er);
      }
    });
    const email = await p;

    const res = await fetch(loginEndpoint + `?email=${encodeURIComponent(email)}`, {
      method: 'POST',
    });
    if (res.status >= 200 && res.status < 300) {
      await res.json();

      const p2 = makePromise();
      read({prompt: 'login code (check your email!): '}, function(er, code) {
        if (!er) {
          p2.accept(code);
        } else {
          p2.reject(er);
        }
      });
      const code = await p2;

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
