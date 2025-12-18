// Querystring stub for browser compatibility
const querystring = {
  parse: function(str, sep, eq, options) {
    const result = {};
    if (!str) return result;
    
    const pairs = str.split(sep || '&');
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i].split(eq || '=');
      const key = decodeURIComponent(pair[0] || '');
      const value = decodeURIComponent(pair[1] || '');
      result[key] = value;
    }
    return result;
  },
  
  stringify: function(obj, sep, eq, options) {
    const pairs = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        pairs.push(encodeURIComponent(key) + (eq || '=') + encodeURIComponent(String(value)));
      }
    }
    return pairs.join(sep || '&');
  },
  
  escape: function(str) {
    return encodeURIComponent(str);
  },
  
  unescape: function(str) {
    return decodeURIComponent(str);
  }
};

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = querystring;
  module.exports.default = querystring;
}

// ESM export
export default querystring;
export { querystring };

