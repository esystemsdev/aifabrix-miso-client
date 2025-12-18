// Zlib stub for browser compatibility
const zlib = {
  deflate: function(buffer, callback) {
    if (callback) {
      setTimeout(() => callback(null, buffer), 0);
    }
    return buffer;
  },
  
  deflateSync: function(buffer) {
    return buffer;
  },
  
  inflate: function(buffer, callback) {
    if (callback) {
      setTimeout(() => callback(null, buffer), 0);
    }
    return buffer;
  },
  
  inflateSync: function(buffer) {
    return buffer;
  },
  
  gzip: function(buffer, callback) {
    if (callback) {
      setTimeout(() => callback(null, buffer), 0);
    }
    return buffer;
  },
  
  gzipSync: function(buffer) {
    return buffer;
  },
  
  gunzip: function(buffer, callback) {
    if (callback) {
      setTimeout(() => callback(null, buffer), 0);
    }
    return buffer;
  },
  
  gunzipSync: function(buffer) {
    return buffer;
  }
};

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = zlib;
  module.exports.default = zlib;
}

// ESM export
export default zlib;
export { zlib };

