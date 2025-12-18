// redis-parser stub for browser compatibility
// Redis parser is server-side only

class ParserStub {
  constructor() {
    // Stub parser
  }
  
  parse() {
    return null;
  }
  
  reset() {
    // Stub reset
  }
}

const RedisParser = ParserStub;

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = RedisParser;
  module.exports.default = RedisParser;
  module.exports.Parser = ParserStub;
}

// ESM export
export default RedisParser;
export { RedisParser, ParserStub as Parser };

