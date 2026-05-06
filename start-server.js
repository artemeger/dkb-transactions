#!/usr/bin/env node
// Simple wrapper to start Express server with tsx support

const { spawn } = require('child_process');
const path = require('path');

const cwd = process.cwd();
const child = spawn('npx', ['tsx', 'server/src/index.ts'], {
  cwd,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  child.kill();
  process.exit(0);
});
