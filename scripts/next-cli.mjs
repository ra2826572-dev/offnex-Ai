import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const rawArgs = process.argv.slice(2);
const subcommand = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : 'dev';
const cliArgs = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs.slice(1) : rawArgs;

let port = process.env.PORT || '3000';
let hostname = '0.0.0.0';
const passthroughArgs = [];

for (let i = 0; i < cliArgs.length; i += 1) {
  const arg = cliArgs[i];

  if (arg === '--host' || arg === '-H' || arg === '--hostname') {
    const nextVal = cliArgs[i + 1];
    if (nextVal && !nextVal.startsWith('-')) {
      hostname = nextVal;
      i += 1;
    }
    continue;
  }

  if (arg.startsWith('--host=') || arg.startsWith('--hostname=') || arg.startsWith('-H=')) {
    const value = arg.slice(arg.indexOf('=') + 1);
    if (value) {
      hostname = value;
    }
    continue;
  }

  if (arg === '--port' || arg === '-p') {
    const nextVal = cliArgs[i + 1];
    if (nextVal && !nextVal.startsWith('-')) {
      port = nextVal;
      i += 1;
    }
    continue;
  }

  if (arg.startsWith('--port=') || arg.startsWith('-p=')) {
    const value = arg.slice(arg.indexOf('=') + 1);
    if (value) {
      port = value;
    }
    continue;
  }

  passthroughArgs.push(arg);
}

const finalArgs = [subcommand, '-p', port, '-H', hostname, ...passthroughArgs];

const child = spawn(process.execPath, [nextBin, ...finalArgs], {
  stdio: 'inherit',
  env: process.env,
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
