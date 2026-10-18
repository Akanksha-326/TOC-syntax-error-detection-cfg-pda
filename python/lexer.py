"""
Lexical Analyzer (Tokenizer) in Python for CFG & PDA.
Splits arithmetic expressions into tokens while tracking line/column locations.
"""

from enum import Enum
from typing import List, Optional, Tuple

class TokenType(Enum):
    IDENTIFIER = "IDENTIFIER"
    NUMBER = "NUMBER"
    ASSIGN = "ASSIGN"
    PLUS = "PLUS"
    MINUS = "MINUS"
    STAR = "STAR"
    SLASH = "SLASH"
    PERCENT = "PERCENT"
    CARET = "CARET"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    EOF = "EOF"
    INVALID = "INVALID"

class Token:
    def __init__(self, token_type: TokenType, value: str, start_col: int, end_col: int, line: int = 1):
        self.type = token_type
        self.value = value
        self.start_col = start_col
        self.end_col = end_col
        self.line = line

    def __repr__(self) -> str:
        return f"{self.type.value}('{self.value}', col={self.start_col})"

class LexicalError:
    def __init__(self, message: str, char: str, line: int, col: int, suggestion: str):
        self.message = message
        self.char = char
        self.line = line
        self.col = col
        self.suggestion = suggestion

    def __repr__(self) -> str:
        return f"LexicalError({self.message} at line {self.line}, col {self.col})"

class Lexer:
    def __init__(self, text: str = ""):
        self.text = text
        self.pos = 0
        self.line = 1
        self.col = 1
        self.tokens: List[Token] = []
        self.errors: List[LexicalError] = []

    def tokenize(self, text: Optional[str] = None) -> Tuple[List[Token], List[LexicalError]]:
        if text is not None:
            self.text = text
        self.pos = 0
        self.line = 1
        self.col = 1
        self.tokens = []
        self.errors = []

        while self.pos < len(self.text):
            ch = self.text[self.pos]

            if ch in (' ', '\t', '\r'):
                self._advance()
                continue

            if ch == '\n':
                self.line += 1
                self.col = 1
                self.pos += 1
                continue

            # Operators and punctuation
            single_tokens = {
                '+': TokenType.PLUS,
                '-': TokenType.MINUS,
                '*': TokenType.STAR,
                '/': TokenType.SLASH,
                '%': TokenType.PERCENT,
                '^': TokenType.CARET,
                '=': TokenType.ASSIGN,
                '(': TokenType.LPAREN,
                ')': TokenType.RPAREN,
            }

            if ch in single_tokens:
                start_c = self.col
                self.tokens.append(Token(single_tokens[ch], ch, start_c, start_c + 1, self.line))
                self._advance()
                continue

            # Identifiers
            if ch.isalpha() or ch == '_':
                self._lex_identifier()
                continue

            # Numbers
            if ch.isdigit():
                self._lex_number()
                continue

            # Invalid character
            start_c = self.col
            err = LexicalError(
                message=f"Invalid character '{ch}' at column {start_c}.",
                char=ch,
                line=self.line,
                col=start_c,
                suggestion=f"Remove character '{ch}' or replace with valid operator/operand."
            )
            self.errors.append(err)
            self.tokens.append(Token(TokenType.INVALID, ch, start_c, start_c + 1, self.line))
            self._advance()

        self.tokens.append(Token(TokenType.EOF, "$", self.col, self.col, self.line))
        return self.tokens, self.errors

    def _advance(self):
        self.pos += 1
        self.col += 1

    def _lex_identifier(self):
        start_c = self.col
        val = ""
        while self.pos < len(self.text) and (self.text[self.pos].isalnum() or self.text[self.pos] == '_'):
            val += self.text[self.pos]
            self._advance()
        self.tokens.append(Token(TokenType.IDENTIFIER, val, start_c, self.col, self.line))

    def _lex_number(self):
        start_c = self.col
        val = ""
        has_dot = False

        while self.pos < len(self.text):
            ch = self.text[self.pos]
            if ch.isdigit():
                val += ch
                self._advance()
            elif ch == '.' and not has_dot:
                if self.pos + 1 < len(self.text) and self.text[self.pos + 1].isdigit():
                    has_dot = True
                    val += ch
                    self._advance()
                else:
                    break
            else:
                break

        if self.pos < len(self.text) and (self.text[self.pos].isalpha() or self.text[self.pos] == '_'):
            malformed = val
            while self.pos < len(self.text) and (self.text[self.pos].isalnum() or self.text[self.pos] == '_'):
                malformed += self.text[self.pos]
                self._advance()
            err = LexicalError(
                message=f"Malformed token '{malformed}' at column {start_c}. Identifiers cannot start with a digit.",
                char=malformed,
                line=self.line,
                col=start_c,
                suggestion=f"Separate number from identifier, e.g. '{val} * {malformed[len(val):]}'."
            )
            self.errors.append(err)
            self.tokens.append(Token(TokenType.INVALID, malformed, start_c, self.col, self.line))
            return

        self.tokens.append(Token(TokenType.NUMBER, val, start_c, self.col, self.line))
