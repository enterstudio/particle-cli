[![npm](https://img.shields.io/npm/v/particle-cli.svg?style=flat-square)](https://www.npmjs.com/package/particle-cli)[![Build Status](https://img.shields.io/travis/spark/particle-cli.svg?style=flat-square)](https://travis-ci.org/spark/particle-cli)[![Code Coverage](https://img.shields.io/coveralls/spark/particle-cli.svg?style=flat-square)](https://coveralls.io/github/spark/particle-cli)[![License](https://img.shields.io/badge/license-LGPL-blue.svg?style=flat-square)](https://github.com/particle-iot/particle-cli/blob/master/LICENSE)

Particle's full-stack Internet of Things (IoT) device platform
gives you everything you need to securely and reliably connect
your IoT devices to the web. For more details please visit [www.particle.io](http:/www.particle.io).

# Particle CLI

The Particle CLI is a powerful tool for interacting with your IoT devices and the Particle Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux.  It's also [open source](https://github.com/particle-iot/particle-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!

## Known Issues
* The Wireless Photon Setup Wizard will only automatically switch networks on OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi. You will be prompted during the wizard when this is required.

## Installing

#### If you've previously installed the old version of this package,```spark-cli```, please uninstall it before continuing.
#### Simply type: ```npm uninstall -g spark-cli``` into the command line.

For the most up-to-date installation instructions, including Windows installer, see [CLI - Installation](https://docs.particle.io/guide/tools-and-features/cli/photon/#installing) on our documentation site.

## Updating

To make sure you are running the latest version of particle-cli, type the following command:

```npm update -g particle-cli```

## Running from source (advanced)

To grab the CLI source and play with it locally

```sh
git clone git@github.com:spark/particle-cli.git
cd particle-cli
npm install
node bin/particle help
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

  - [Getting Started](#getting-started)
    - [particle setup](#particle-setup)
    - [particle help](#particle-help)
  - [Updating Firmware](#updating-firmware)
    - [Photon/P1/Electron](#photonp1electron)
      - [particle update](#particle-update)
  - [Command Reference](#command-reference)
- [Development](#development)
  - [Releasing a new version](#releasing-a-new-version)
  - [Updating system firmware](#updating-system-firmware)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Getting Started

  These next two commands are all you need to get started setting up an account, claiming a device, and discovering new features.

### particle setup

  Guides you through creating a new account, and claiming your device!

```sh
$ particle setup
```

### particle help

  Shows you what commands are available, and how to use them.  You can also give the name of a command for detailed help.

```sh
$ particle help
$ particle help keys
```

## Updating Firmware

### Photon/P1/Electron

#### particle update

If you wish to easily update the system firmware running on your device to a later version, you can use the `particle update` command. For the exact version it will update to, check the version of the files in the [updates folder](https://github.com/particle-iot/particle-cli/tree/master/updates).

1. Make sure you have [DFU-util](http://dfu-util.sourceforge.net/) installed.
1. Connect your device via USB, and put it into [DFU mode](https://docs.particle.io/guide/getting-started/modes/#dfu-mode-device-firmware-upgrade-).
1. Run `particle update`.


## Command Reference

For the full list of commands, please see the [CLI command reference](https://docs.particle.io/reference/cli/).


# Development

## Releasing a new version

- `npm version <major | minor | patch>`

This increments the major, minor or patch version respectively. Before
the command finishes, update `CHANGELOG.md`.

- `git push && git push --tag`

- `npm publish`

- Create a release on GitHub with the notes from the `CHANGELOG.md`

## Updating system firmware

- `npm run update-firmware-binaries <version>`
  where `<version>` is the newly released system firmware version like 0.6.0

- Test on each platform by doing
```
# Check old firmware version
bin/particle.js serial inspect
# Flash new system firmware
bin/particle.js update
# Verify new firmware version
bin/particle.js serial inspect
```

- Commit and release a new CLI version.
