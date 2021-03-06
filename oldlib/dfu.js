/**
 ******************************************************************************
 * @file    lib/dfu.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   DFU helper module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */
'use strict';

var _ = require('lodash');

var fs = require('fs');
var when = require('when');
var whenNode = require('when/node');
var utilities = require('./utilities.js');
var child_process = require('child_process');
var settings = require('../settings.js');
var specs = require('./deviceSpecs');
var log = require('./log');

var inquirer = require('inquirer');
var prompt = inquirer.prompt;
var chalk = require('chalk');
var temp = require('temp');
var that = module.exports = {

	_dfuIdsFromDfuOutput: function(stdout) {
		// find DFU devices that match specs
		var dfuIds =
			stdout
				.split('\n')
				.filter(function (line) {
					return (line.indexOf('Found DFU') >= 0);
				})
				.map(function (foundLine) {
					return foundLine.match(/\[(.*:.*)\]/)[1];
				})
				.filter(function (dfuId) {
					return dfuId && specs[dfuId];
				});
		return _.unique(dfuIds);
	},

	dfuId: undefined,
	listDFUDevices: function() {
		var temp = when.defer();

		var failTimer = utilities.timeoutGenerator('listDFUDevices timed out', temp, 6000);
		var cmd = that.getCommand() + ' -l';
		child_process.exec(cmd, function (error, stdout, stderr) {
			clearTimeout(failTimer);
			if (error) {
				return temp.reject(error);
			}
			if (stderr) {
				if (that._missingDevicePermissions(stderr) && that._systemSupportsUdev()) {
					return that._promptInstallUdevRules().then(temp.reject, temp.reject);
				}
			}

			// find DFU devices that match specs
			stdout = stdout || '';
			var dfuIds = that._dfuIdsFromDfuOutput(stdout);
			var dfuDevices = dfuIds.map(function (d) {
				return {
					type: specs[d].productName,
					dfuId: d,
					specs: specs[d]
				};
			});
			temp.resolve(dfuDevices);
		});

		return temp.promise;
	},

	findCompatibleDFU: function (showHelp) {
		showHelp = showHelp !== undefined ? showHelp : true;
		return that.listDFUDevices()
			.then(function (dfuDevices) {
				if (dfuDevices.length > 1) {
					return prompt([{
						type: 'list',
						name: 'device',
						message: 'Which device would you like to select?',
						choices: function () {
							return dfuDevices.map(function (d) {
								return {
									name: d.type,
									value: d.dfuId
								};
							});
						}
					}]).then(function (ans) {
						that.dfuId = ans.device;
						return that.dfuId;
					});
				} else if (dfuDevices.length === 1) {
					that.dfuId = dfuDevices[0].dfuId;
					log.verbose('Found DFU device %s', that.dfuId);
					return that.dfuId;
				} else {
					if (showHelp) {
						that.showDfuModeHelp();
					}
					return when.reject('No DFU device found');
				}
			});
	},

	isDfuUtilInstalled: function() {
		var cmd = that.getCommand() + ' -l';
		var installCheck = utilities.deferredChildProcess(cmd);
		return utilities.replaceDfdResults(installCheck, 'Installed', 'dfu-util is not installed');
	},

	readDfu: function (memoryInterface, destination, firmwareAddress, leave) {
		var prefix = that.getCommand() + ' -d ' + that.dfuId;
		var leaveStr = (leave) ? ':leave' : '';
		var cmd = prefix + ' -a ' + memoryInterface + ' -s ' + firmwareAddress + leaveStr + ' -U ' + destination;

		return utilities.deferredChildProcess(cmd);
	},

	writeDfu: function (memoryInterface, binaryPath, firmwareAddress, leave) {
		var leaveStr = (leave) ? ':leave' : '';
		var args = [
			'-d', that.dfuId,
			'-a', memoryInterface,
			'-i', '0',
			'-s', firmwareAddress + leaveStr,
			'-D', binaryPath
		];
		var cmd = 'dfu-util';
		if (settings.useSudoForDfu) {
			cmd = 'sudo';
			args.unshift('dfu-util');
		}

		var deviceSpecs = specs[that.dfuId] || { };
		that.checkBinaryAlignment(binaryPath, deviceSpecs);
		return utilities.deferredSpawnProcess(cmd, args).then(function(output) {
			return when.resolve(output.stdout.join('\n'));
		}).catch(function(output) {
			// If this line is printed, it actually worked. Ignore other errors.
			if (output.stdout.indexOf('File downloaded successfully') >= 0) {
				return when.resolve(output.stdout.join('\n'));
			}
			return when.reject(output.stderr.join('\n'));
		});
	},

	getCommand: function () {
		if (settings.useSudoForDfu) {
			return 'sudo dfu-util';
		} else {
			return 'dfu-util';
		}
	},

	checkBinaryAlignment: function (filepath, specs) {
		if (specs.writePadding===2) {
			that.appendToEvenBytes(filepath);
		}
	},

	/**
	 * Append to the file until it has an even size
	 * @param  {String} filepath
	 */
	appendToEvenBytes: function (filepath) {
		if (fs.existsSync(filepath)) {
			var stats = fs.statSync(filepath);

			//is the filesize even?
			//console.log(filepath, ' stats are ', stats);
			if ((stats.size % 2) !== 0) {
				var buf = new Buffer(1);
				buf[0] = 0;

				fs.appendFileSync(filepath, buf);
			}
		}
	},

	checkKnownApp: function(appName) {
		if (typeof that._validateKnownApp(appName, 'knownApps') !== 'undefined') {
			return that._validateKnownApp(appName, 'knownApps');
		} else {
			return;
		}
	},

	showDfuModeHelp: function() {
		console.log();
		console.log(chalk.red('!!!'), 'I was unable to detect any devices in DFU mode...');
		console.log();
		console.log(chalk.cyan('>'), 'Your device will blink yellow when in DFU mode.');
		console.log(chalk.cyan('>'), 'If your device is not blinking yellow, please:');
		console.log();
		console.log(
			chalk.bold.white('1)'),
			'Press and hold both the',
			chalk.bold.cyan('RESET/RST'),
			'and',
			chalk.bold.cyan('MODE/SETUP'),
			'buttons simultaneously.'
		);
		console.log();
		console.log(
			chalk.bold.white('2)'),
			'Release only the',
			chalk.bold.cyan('RESET/RST'),
			'button while continuing to hold the',
			chalk.bold.cyan('MODE/SETUP'),
			'button.'
		);
		console.log();
		console.log(
			chalk.bold.white('3)'),
			'Release the',
			chalk.bold.cyan('MODE/SETUP'),
			'button once the device begins to blink yellow.'
		);
		console.log();
	},

	_validateKnownApp: function(appName, segmentName) {
		var segment = that._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('App is unknown: ' + segment.error);
		}
		return segment.specs[appName];
	},

	_validateSegmentSpecs: function(segmentName) {
		var err = null;
		var deviceSpecs = specs[that.dfuId] || { };
		var params = deviceSpecs[segmentName] || undefined;
		if (!segmentName) {
			err = "segmentName required. Don't know where to read/write.";
		} else if (!deviceSpecs) {
			err = "dfuId has no specification. Don't know how to read/write.";
		} else if (!params) {
			err = 'segment ' + segmentName + ' has no specs. Not aware of this segment.';
		}

		if (err) {
			return { error: err, specs: undefined };
		}
		return { error: null, specs: params };
	},
	read: function(destination, segmentName, leave) {

		var address;
		var segment = that._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('dfu.read: ' + segment.error);
		}
		if (segment.specs.size) {
			address = segment.specs.address + ':' + segment.specs.size;
		} else {
			address = segment.specs.address;
		}

		return that.readDfu(
			segment.specs.alt,
			destination,
			address,
			leave
		);
	},
	readBuffer: function(segmentName, leave) {
		var filename = temp.path({ suffix: '.bin' });
		return this.read(filename, segmentName, leave)
			.then(function() {
				return whenNode.lift(fs.readFile)(filename);
			})
			.then(function(buf) {
				return buf;
			})
			.finally(function() {
				fs.unlink(filename, function() {
					// do nothing
				});
			});
	},
	write: function(binaryPath, segmentName, leave) {

		var segment = that._validateSegmentSpecs(segmentName);
		if (segment.error) {
			throw new Error('dfu.write: ' + segment.error);
		}

		return that.writeDfu(
			segment.specs.alt,
			binaryPath,
			segment.specs.address,
			leave
		);
	},
	writeBuffer: function(buffer, segmentName, leave) {
		var filename = temp.path({ suffix: '.bin' });
		var self = this;
		return whenNode.lift(fs.writeFile)(filename, buffer)
			.then(function() {
				return self.write(filename, segmentName, leave)
					.finally(function() {
						fs.unlink(filename, function() {
							// do nothing
						});
					});
			});
	},

	// UDEV rules on Linux allow regular user acess to devices that
	// normally need superuser permissions. Install some UDEV rules for
	// the Particle devices if necessary.

	_udevRulesDir: '/etc/udev/rules.d/',
	_udevRulesFile: '50-particle.rules',

	_missingDevicePermissions: function (stderr) {
		return stderr && stderr.indexOf('Cannot open DFU device') >= 0;
	},

	_systemSupportsUdev: function() {
		return fs.existsSync(that._udevRulesDir);
	},

	_udevRulesInstalled: function() {
		return fs.existsSync(that._udevRulesDir + '/' + that._udevRulesFile);
	},

	_promptInstallUdevRules: function() {
		var temp = when.defer();
		if (that._udevRulesInstalled()) {
			console.log(chalk.bold.red(
				'Physically unplug and reconnect the Particle device and try again.'
			));
			temp.reject('Missing permissions to use DFU');
		} else {
			console.log(chalk.yellow('You are missing the permissions to use DFU without root.'));
			prompt([{
				type: 'confirm',
				name: 'install',
				message: 'Would you like to install a UDEV rules file to get access?',
				default: true
			}]).then(function(ans) {
				that._installUdevChoice(ans, temp);
			});
		}

		return temp.promise;
	},

	_installUdevChoice: function(ans, promise) {
		var message = 'Missing permissions to use DFU';
		if (ans.install) {
			var rules = __dirname + '/' + that._udevRulesFile;
			var cmd = "sudo cp '" + rules + "' '" + that._udevRulesDir + "'";
			console.log(cmd);
			child_process.exec(cmd, function(error, stdout, stderr) {
				if (error) {
					console.error('Could not install UDEV rules');
					promise.reject(message);
				} else {
					console.log('UDEV rules for DFU installed.');
					console.log(chalk.bold.red(
						'Physically unplug and reconnect the Particle device.\n' +
						'Then run the particle command again.'
					));
					promise.resolve(message);
				}
			});
		} else {
			promise.reject(message);
		}
	},

	specsForPlatform: function(platformID) {
		var result = {}
		Object.keys(specs).forEach(function(id) {
			var deviceSpecs = specs[id];
			if (deviceSpecs.productId===platformID) {
				result = deviceSpecs;
			}
		});
		return result;
	}
};
