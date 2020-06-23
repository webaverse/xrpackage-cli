const path = require('path');
const fs = require('fs');

const mime = require('mime');
const ignoreWalk = require('ignore-walk');
const wbn = require('wbn');

const {screenshotApp} = require('../utils');
const {primaryUrl} = require('../constants');

const _removeUrlTail = u => u.replace(/(?:\?|#).*$/, '');

module.exports = {
  command: 'build [input] [output]',
  describe: 'build xrpackage .wbn from [input] and write to [output]',
  builder: yargs => {
    yargs
      .positional('input', {
        describe: 'input file to build',
      })
      .positional('output', {
        describe: 'output file to write',
      })
      .option('screenshot', {
        alias: 's',
        type: 'boolean',
        description: 'Screenshot package after building',
      });
  },
  handler: async (argv) => {
    if (typeof argv.input !== 'string') {
      argv.input = '.';
    }
    if (typeof argv.output !== 'string') {
      argv.output = 'a.wbn';
    }

    let fileInput, startUrl, xrType, xrDetails, mimeType, name, description, directory;
    const xrTypeToMimeType = {
      'gltf@0.0.1': 'model/gltf+json',
      'vrm@0.0.1': 'application/octet-stream',
      'vox@0.0.1': 'application/octet-stream',
      'webxr-site@0.0.1': 'text/html',
    };
    const _detectType = input => {
      if (/\.gltf$/.test(input)) {
        fileInput = input;
        xrType = 'gltf@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'GLTF JSON model';
        directory = null;
      } else if (/\.glb$/.test(input)) {
        fileInput = input;
        xrType = 'gltf@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'GLTF binary model';
        directory = null;
      } else if (/\.vrm$/.test(input)) {
        fileInput = input;
        xrType = 'vrm@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'VRM model';
        directory = null;
      } else if (/\.vox$/.test(input)) {
        fileInput = input;
        xrType = 'vox@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'VOX model';
        directory = null;
      } else if (/\.html$/.test(input)) {
        fileInput = input;
        xrType = 'webxr-site@0.0.1';
        xrDetails = {};
        startUrl = path.basename(fileInput);
        mimeType = xrTypeToMimeType[xrType];
        name = path.basename(input);
        description = 'WebXR app';
        directory = null;
      } else if (/\.json$/.test(input)) {
        const s = (() => {
          try {
            return fs.readFileSync(input);
          } catch (err) {
            if (err.code === 'ENOENT') {
              return null;
            } else {
              return null;
            }
          }
        })();
        if (s) {
          let error;
          const j = (() => {
            try {
              return JSON.parse(s);
            } catch (err) {
              error = err;
              return null;
            }
          })();
          if (j) {
            const hasXrType = typeof j.xr_type === 'string';
            const hasStartUrl = typeof j.start_url === 'string';
            if (hasXrType && hasStartUrl) {
              xrType = j.xr_type;
              xrDetails = j.xr_details;
              startUrl = j.start_url.replace(/(?:\?|#).*$/, '');
              mimeType = xrTypeToMimeType[xrType] || 'application/octet-stream';
              fileInput = path.join(path.dirname(input), _removeUrlTail(startUrl));
              name = typeof j.name === 'string' ? j.name : path.basename(path.dirname(input));
              description = 'Directory package';
              directory = path.dirname(input);
            } else if (!hasXrType) {
              throw `manifest.json missing xr_type: ${input}`;
            } else if (!hasStartUrl) {
              throw `manifest.json missing start_url: ${input}`;
            }
          } else {
            throw 'failed to parse manifest.json: ' + error.stack;
          }
        } else {
          throw 'missing manifest.json; try xrpk init';
        }
      } else {
        const stats = fs.statSync(input);
        if (stats.isDirectory()) {
          _detectType(path.join(input, 'manifest.json'));
        } else {
          throw `unknown file type: ${argv.input}`;
        }
      }
    };
    _detectType(path.resolve(process.cwd(), argv.input));
    if (fileInput) {
      const fileData = fs.readFileSync(fileInput);
      // console.log('got data', data.length);

      const files = [
        {
          url: '/' + startUrl,
          type: mimeType,
          data: fileData,
        },
        {
          url: '/manifest.json',
          type: 'application/json',
          data: JSON.stringify({
            name,
            description,
            xr_type: xrType,
            start_url: startUrl,
            xr_details: xrDetails,
          }, null, 2),
        },
      ];
      if (directory) {
        const _readdirRecursive = rootDirectory => {
          const result = [];
          const paths = ignoreWalk.sync({
            path: rootDirectory, // root dir to start in. defaults to process.cwd()
            ignoreFiles: ['.gitignore'], // list of filenames. defaults to ['.ignore']
            includeEmpty: false, // true to include empty dirs, default false
            follow: false, // true to follow symlink dirs, default false
          });
          const cwd = process.cwd();
          const outputPathname = path.resolve(cwd, argv.output);
          for (const pathname of paths) {
            const fullPathname = path.resolve(cwd, rootDirectory, pathname);
            if (!/^\.git\//.test(pathname) && fullPathname !== outputPathname) {
              const stats = fs.lstatSync(fullPathname);
              if (stats.isFile()) {
                result.push({
                  fullPathname: fullPathname,
                  pathname: '/' + pathname,
                });
              }
            }
          }
          return result;
        };
        const filenames = _readdirRecursive(directory);
        for (let i = 0; i < filenames.length; i++) {
          const {fullPathname, pathname} = filenames[i];
          if (!files.some(({url}) => url === pathname)) {
            const type = mime.getType(fullPathname) || 'application/octet-stream';
            const data = fs.readFileSync(fullPathname);
            files.push({
              url: pathname,
              type,
              data,
            });
          }
        }
      }

      const builder = new wbn.BundleBuilder(primaryUrl + '/' + startUrl);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const {url, type, data} = file;
        builder.addExchange(primaryUrl + url, 200, {
          'Content-Type': type,
        }, data);
      }
      const uint8Array = builder.createBundle();
      // console.log('got bundle', uint8Array.byteLength);

      fs.writeFileSync(argv.output, uint8Array);

      if (argv.screenshot) {
        await screenshotApp(argv.output);
      }
      console.log(argv.output);
    }
  },
};
