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

// ESM export
export default RedisParser;
export { RedisParser, ParserStub as Parser };
