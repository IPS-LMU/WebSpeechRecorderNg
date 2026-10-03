/**
 * Line-oriented JSON source support (D-E, doc/script-editor/implementation-plan.md):
 * `core/validation/json-lines.ts` maps a JSON path to the line it starts on so the source view can
 * draw gutter dots and point a parse error at its line, without pulling in a code-editor
 * dependency. The tokenizer handles escapes, `\t`, CRLF, duplicate keys and unicode, and
 * `serialiseJson` emits a stable, canonical form.
 */

export interface JsonLineError {
  message: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export interface ParsedJsonSource {
  ok: boolean;
  value: unknown;
  error?: JsonLineError;
  /** JSON path → 1-based line where the value starts. */
  lineMap: Map<string, number>;
  /** Paths whose key was repeated in the same object (the later value wins, as `JSON.parse`). */
  duplicates: string[];
  lineOf(path: string): number | null;
}

class JsonSourceError extends Error {
  constructor(message: string, readonly line: number, readonly column: number) {
    super(message);
  }
}

class Tokenizer {
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly text: string, private readonly lineMap: Map<string, number>, private readonly duplicates: string[]) {}

  parse(): unknown {
    const value = this.parseValue('');
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      throw this.fail('Unexpected characters after the JSON value');
    }
    return value;
  }

  private fail(message: string): JsonSourceError {
    return new JsonSourceError(message, this.line, this.column);
  }

  private peek(): string {
    return this.text[this.index] ?? '';
  }

  private advance(): string {
    const char = this.text[this.index++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else if (char === '\r') {
      // A CRLF pair counts as one newline: the following LF performs the increment.
      if (this.text[this.index] === '\n') {
        this.column = 1;
      } else {
        this.line++;
        this.column = 1;
      }
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (this.index < this.text.length) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        this.advance();
      } else {
        return;
      }
    }
  }

  private parseValue(path: string): unknown {
    this.skipWhitespace();
    const line = this.line;
    const char = this.peek();
    let value: unknown;
    if (char === '{') {
      value = this.parseObject(path);
    } else if (char === '[') {
      value = this.parseArray(path);
    } else if (char === '"') {
      value = this.parseString();
    } else if (this.text.startsWith('true', this.index)) {
      this.consumeLiteral('true');
      value = true;
    } else if (this.text.startsWith('false', this.index)) {
      this.consumeLiteral('false');
      value = false;
    } else if (this.text.startsWith('null', this.index)) {
      this.consumeLiteral('null');
      value = null;
    } else {
      value = this.parseNumber();
    }
    this.lineMap.set(path, line);
    return value;
  }

  private consumeLiteral(literal: string): void {
    for (let i = 0; i < literal.length; i++) {
      if (this.advance() !== literal[i]) {
        throw this.fail(`Invalid literal, expected "${literal}"`);
      }
    }
  }

  private parseNumber(): number {
    const start = this.index;
    while (this.index < this.text.length && /[-+0-9.eE]/.test(this.peek())) {
      this.advance();
    }
    const token = this.text.slice(start, this.index);
    const value = token === '' ? Number.NaN : Number(token);
    if (!Number.isFinite(value)) {
      throw this.fail(`Invalid number "${token || this.peek()}"`);
    }
    return value;
  }

  private parseString(): string {
    if (this.advance() !== '"') {
      throw this.fail('Expected a string');
    }
    let out = '';
    while (true) {
      if (this.index >= this.text.length) {
        throw this.fail('Unterminated string');
      }
      const char = this.advance();
      if (char === '"') {
        return out;
      }
      if (char !== '\\') {
        out += char;
        continue;
      }
      const escape = this.advance();
      switch (escape) {
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case '/': out += '/'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'u': {
          const hex = this.text.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw this.fail('Invalid unicode escape');
          }
          for (let i = 0; i < 4; i++) {
            this.advance();
          }
          out += String.fromCharCode(parseInt(hex, 16));
          break;
        }
        default:
          throw this.fail(`Invalid escape "\\${escape}"`);
      }
    }
  }

  private parseObject(path: string): Record<string, unknown> {
    this.advance(); // {
    const object: Record<string, unknown> = {};
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.advance();
      return object;
    }
    while (true) {
      this.skipWhitespace();
      if (this.peek() !== '"') {
        throw this.fail('Expected a property name');
      }
      const key = this.parseString();
      this.skipWhitespace();
      if (this.advance() !== ':') {
        throw this.fail('Expected ":" after the property name');
      }
      const childPath = path === '' ? key : `${path}.${key}`;
      const value = this.parseValue(childPath);
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        this.duplicates.push(childPath);
      }
      object[key] = value;
      this.skipWhitespace();
      const next = this.advance();
      if (next === ',') {
        continue;
      }
      if (next === '}') {
        return object;
      }
      throw this.fail('Expected "," or "}"');
    }
  }

  private parseArray(path: string): unknown[] {
    this.advance(); // [
    const array: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.advance();
      return array;
    }
    let index = 0;
    while (true) {
      array.push(this.parseValue(`${path}[${index}]`));
      index++;
      this.skipWhitespace();
      const next = this.advance();
      if (next === ',') {
        continue;
      }
      if (next === ']') {
        return array;
      }
      throw this.fail('Expected "," or "]"');
    }
  }
}

/** Parses JSON text into its value plus a path → line map. Never throws; a parse error carries the line. */
export function parseJsonSource(text: string): ParsedJsonSource {
  const lineMap = new Map<string, number>();
  const duplicates: string[] = [];
  const result: ParsedJsonSource = {
    ok: true,
    value: undefined,
    lineMap,
    duplicates,
    lineOf: (path) => lineMap.get(path) ?? null,
  };
  if (text.trim() === '') {
    result.ok = false;
    result.error = {message: 'The draft is empty', line: 1, column: 1};
    return result;
  }
  try {
    result.value = new Tokenizer(text, lineMap, duplicates).parse();
  } catch (error) {
    result.ok = false;
    if (error instanceof JsonSourceError) {
      result.error = {message: error.message, line: error.line, column: error.column};
    } else {
      result.error = {message: error instanceof Error ? error.message : 'Invalid JSON', line: 1, column: 1};
    }
  }
  return result;
}

function toJson(value: unknown, indent: string, depth: number, sortKeys: boolean): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  const pad = indent.repeat(depth);
  const padInner = indent.repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const parts = value.map((entry) => toJson(entry, indent, depth + 1, sortKeys));
    return `[\n${parts.map((part) => padInner + part).join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    let keys = Object.keys(record).filter((key) => record[key] !== undefined);
    if (sortKeys) {
      keys = keys.slice().sort();
    }
    if (keys.length === 0) {
      return '{}';
    }
    const parts = keys.map((key) => `${JSON.stringify(key)}: ${toJson(record[key], indent, depth + 1, sortKeys)}`);
    return `{\n${parts.map((part) => padInner + part).join(',\n')}\n${pad}}`;
  }
  return 'null';
}

export interface SerialiseOptions {
  indent?: string;
  /** Sort object keys so the output is canonical; default true. */
  sortKeys?: boolean;
}

/** Serialises a value with a stable key order and 2-space indentation by default. */
export function serialiseJson(value: unknown, options: SerialiseOptions = {}): string {
  const indent = options.indent ?? '  ';
  const sortKeys = options.sortKeys ?? true;
  return toJson(value, indent, 0, sortKeys);
}
