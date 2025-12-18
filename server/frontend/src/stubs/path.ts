// Path stub for browser compatibility
const path = {
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
  dirname: () => '',
  basename: () => '',
  extname: () => '',
};

export default path;
export { path };
