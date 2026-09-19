import { BootstrapError } from "./types";

/** Reject duplicate object members before JSON.parse can silently replace them. */
export function parseBrokerJson(input: string): unknown {
  const tokens =
    input.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|[^\s{}[\]:,]+/g) || [];
  const stack: Array<Set<string> | null> = [];
  tokens.forEach((token, index) => {
    if (token === "{") stack.push(new Set());
    else if (token === "[") stack.push(null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ":") {
      const keys = stack[stack.length - 1];
      const key = JSON.parse(token) as string;
      if (!keys || keys.has(key)) throw new BootstrapError("protocol-error");
      keys.add(key);
    }
  });
  return JSON.parse(input);
}
