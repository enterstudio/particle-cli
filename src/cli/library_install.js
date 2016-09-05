import {LibraryInstallCommand, LibraryInstallCommandSite} from '../cmd/library_install';
import {convertApiError} from '../cmd/api';
const settings = require('../../settings');

export class CLILibraryInstallCommandSite extends LibraryInstallCommandSite {

	constructor(argv, dir) {
		super();
		this.argv = argv;
		this.dir = dir;
	}

	isVendored() {
		return this.argv.vendored;
	}

	isAdaptersRequired() {
		return this.argv.adapter;
	}

	libraryName() {
		const params = this.argv.params;
		return params && params.name;
	}

	targetDirectory() {
		return this.dir;
	}

	accessToken() {
		return settings.access_token;
	}

	error(error) {
		throw convertApiError(error);
	}

	notifyIncorrectLayout(actualLayout, expectedLayout, libName, targetDir) {
		return this.promiseLog(`Cannot install library: directory '${targetDir}' is a '${actualLayout}' format project, please change to a '${expectedLayout}' format.`);
	}

	notifyCheckingLibrary(libName) {
		return this.promiseLog(`Checking library '${libName}'...`);
	}

	notifyFetchingLibrary(lib, targetDir) {
		return this.promiseLog(`Installing library '${lib.name} ${lib.version}' to '${targetDir}' ...`);
	}

	notifyInstalledLibrary(lib, targetDir) {
		return this.promiseLog(`Library '${lib.name} ${lib.version}' installed.`);
	}

	promiseLog(msg) {
		return Promise.resolve().then(() => console.log(msg));
	}
}

export default ({lib, factory}) => {
	factory.createCommand(lib, 'install', 'installs a library', {
		options: {
			'vendored': {
				required: false,
				boolean: true,
				description: 'install the library as the vendored library in the given directory.'
			},
			'adapter': {
				required: false,
				boolean: true,
				description: 'add include file adapters to support v1-style includes "library/library.h"'
			},
			'confirm': {
				required: false,
				boolean: true,
				alias: 'y'
			}
		},
		params: '[name]',
		handler: function LibraryInstallHandler(argv) {
			const site = new CLILibraryInstallCommandSite(argv, process.cwd());
			const cmd = new LibraryInstallCommand();
			return site.run(cmd);
		}
	});
};
