import { createWriteStream, readFileSync, writeFileSync } from 'fs';
import { get } from 'https';
import { join } from 'path';
import { pipeline } from 'stream';
import { compareVersion, IVersion, parseVersion } from './versions';

/**
 * Post-install script. Downloads the binary for the current Node.js version
 * from the Gitub releases page, if it's available.
 */

const builtPlatforms: { [K in NodeJS.Platform]?: string } = {
  win32: 'windows-latest',
  linux: 'ubuntu-latest',
  darwin: 'macos-latest',
};

const { version } = require('../../package.json');
const repoUrl = process.env.BLAKE3_REPO_URL || 'https://github.com/connor4312/blake3';
const targets = require('../../targets.json');
const bindingPath = join(__dirname, '..', 'native.node');

async function install() {
  const current = parseVersion(process.version);
  const api = getBestAbiVersion(current);
  if (!api) {
    console.error(
      'Your Node.js release is out of LTS and BLAKE3 bindings are not built for it. Update it to use native BLAKE3 bindings.',
    );
    return fallback();
  }

  const platform = builtPlatforms[process.platform];
  if (!platform) {
    console.error(`BLAKE3 bindings are not built for your platform (${process.platform})`);
    return fallback();
  }

  console.log(
    `Retrieving native BLAKE3 bindings for Node ${api.nodeVersion} on ${process.platform}...`,
  );
  await download(`${repoUrl}/releases/download/v${version}/${platform}-${api.abiVersion}.node`);

  try {
    require(bindingPath);
  } catch (e) {
    console.log(`Error trying to import bindings: ${e.message}`);
    return fallback();
  }

  useNativeImport();
  console.log('BLAKE3 bindings retrieved');
}

function getBestAbiVersion(current: IVersion) {
  for (const targetVersion of Object.keys(targets)) {
    const parsed = parseVersion(targetVersion);
    if (compareVersion(current, parsed) >= 0) {
      return { nodeVersion: targetVersion, abiVersion: targets[targetVersion] };
    }
  }

  return undefined;
}

function fallback() {
  console.error('BLAKE3 will use slower WebAssembly bindings when required in Node.js');
}

async function download(url: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const onError = (err: Error) => {
      console.error(`Could not download binding from ${url}: ${err.stack || err.message}`);
      resolve(false);
    };

    const req = get(url, res => {
      if (res.headers.location) {
        resolve(download(res.headers.location));
        return;
      }

      if (!res.statusCode || res.statusCode >= 300) {
        console.error(`Unexpected ${res.statusCode} from ${url}`);
        resolve(false);
        return;
      }

      pipeline(res, createWriteStream(bindingPath), err => (err ? onError(err) : resolve(true)));
    });

    req.on('error', onError);
  });
}

function useNativeImport() {
  const indexFile = join(__dirname, '..', 'index.js');
  const contents = readFileSync(indexFile, 'utf-8');
  writeFileSync(indexFile, contents.replace('"./node"', '"./node-native"'));
}

install().catch(err => {
  console.error(`There was an uncaught error installing native bindings: ${err.stack}`);
  fallback();
});
