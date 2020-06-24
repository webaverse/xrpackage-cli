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
