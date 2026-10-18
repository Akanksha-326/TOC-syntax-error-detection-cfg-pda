/**
 * Lexical Analyzer (Tokenizer) for CFG and PDA
 * Tokenizes arithmetic expressions and assignments, tracking exact line and column positions.
 */

const TokenType = {
  IDENTIFIER: 'IDENTIFIER',
  NUMBER: 'NUMBER',
  ASSIGN: 'ASSIGN',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  PERCENT: 'PERCENT',
  CARET: 'CARET',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  EOF: 'EOF',
  INVALID: 'INVALID'
};

class Token {
  constructor(type, value, startCol, endCol, line = 1) {
    this.type = type;
    this.value = value;
    this.startCol = startCol;
    this.endCol = endCol;
    this.line = line;
  }

  toString() {
    return `${this.type}('${this.value}') [${this.startCol}:${this.endCol}]`;
  }
}

class Lexer {
  constructor(input = '') {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];
  }

  tokenize(input = null) {
    if (input !== null) {
      this.input = input;
    }
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      // Skip whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
        continue;
      }

      // Single-character tokens
      if (ch === '+') {
        this.addToken(TokenType.PLUS, '+', 1);
        continue;
      }
      if (ch === '-') {
        this.addToken(TokenType.MINUS, '-', 1);
        continue;
      }
      if (ch === '*') {
        this.addToken(TokenType.STAR, '*', 1);
        continue;
      }
      if (ch === '/') {
        this.addToken(TokenType.SLASH, '/', 1);
        continue;
      }
      if (ch === '%') {
        this.addToken(TokenType.PERCENT, '%', 1);
        continue;
      }
      if (ch === '^') {
        this.addToken(TokenType.CARET, '^', 1);
        continue;
      }
      if (ch === '=') {
        this.addToken(TokenType.ASSIGN, '=', 1);
        continue;
      }
      if (ch === '(') {
        this.addToken(TokenType.LPAREN, '(', 1);
        continue;
      }
      if (ch === ')') {
        this.addToken(TokenType.RPAREN, ')', 1);
        continue;
      }

      // Identifiers / Variables [a-zA-Z_][a-zA-Z0-9_]*
      if (this.isAlpha(ch)) {
        this.lexIdentifier();
        continue;
      }

      // Numbers [0-9]+(\.[0-9]+)?
      if (this.isDigit(ch)) {
        this.lexNumber();
        continue;
      }

      // Invalid character
      const startCol = this.col;
      this.errors.push({
        type: 'LEXICAL_ERROR',
        char: ch,
        line: this.line,
        col: startCol,
        message: `Invalid character '${ch}' at column ${startCol}.`,
        suggestion: `Remove the character '${ch}' or replace it with a valid operator or operand.`
      });
      this.tokens.push(new Token(TokenType.INVALID, ch, startCol, startCol + 1, this.line));
      this.advance();
    }

    // Append End of File token
    this.tokens.push(new Token(TokenType.EOF, '$', this.col, this.col, this.line));
    return {
      tokens: this.tokens,
      errors: this.errors
    };
  }

  isAlpha(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  isAlphaNumeric(ch) {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  advance() {
    this.pos++;
    this.col++;
  }

  addToken(type, value, length) {
    const startCol = this.col;
    this.tokens.push(new Token(type, value, startCol, startCol + length, this.line));
    for (let i = 0; i < length; i++) {
      this.advance();
    }
  }

  lexIdentifier() {
    const startCol = this.col;
    let value = '';
    while (this.pos < this.input.length && this.isAlphaNumeric(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    this.tokens.push(new Token(TokenType.IDENTIFIER, value, startCol, this.col, this.line));
  }

  lexNumber() {
    const startCol = this.col;
    let value = '';
    let hasDot = false;

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (this.isDigit(ch)) {
        value += ch;
        this.advance();
      } else if (ch === '.' && !hasDot) {
        // Check if next character is digit
        if (this.pos + 1 < this.input.length && this.isDigit(this.input[this.pos + 1])) {
          hasDot = true;
          value += ch;
          this.advance();
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Check if immediately followed by an alpha (e.g., 25a)
    if (this.pos < this.input.length && this.isAlpha(this.input[this.pos])) {
      let malformed = value;
      while (this.pos < this.input.length && this.isAlphaNumeric(this.input[this.pos])) {
        malformed += this.input[this.pos];
        this.advance();
      }
      this.errors.push({
        type: 'LEXICAL_ERROR',
        char: malformed,
        line: this.line,
        col: startCol,
        message: `Malformed token '${malformed}' at column ${startCol}. Identifiers cannot start with a digit.`,
        suggestion: `Separate number and variable (e.g. '${value} * ${malformed.slice(value.length)}') or rename variable.`
      });
      this.tokens.push(new Token(TokenType.INVALID, malformed, startCol, this.col, this.line));
      return;
    }

    this.tokens.push(new Token(TokenType.NUMBER, value, startCol, this.col, this.line));
  }
}

// Export for Node and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Lexer, Token, TokenType };
}
