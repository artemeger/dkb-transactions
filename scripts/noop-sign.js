#!/usr/bin/env node
// No-op signer for cross-platform builds without code signing
module.exports = async function (options) {
  return Promise.resolve();
};
