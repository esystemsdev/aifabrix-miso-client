// Crypto stub for browser compatibility
const crypto = {
  createHash: () => ({
    update: () => ({ digest: () => '' }),
  }),
  randomBytes: () => ({ toString: () => '' }),
};

export default crypto;
export { crypto };

// CommonJS exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = crypto;
  module.exports.default = crypto;
}
