/**
 * Pushdown Automaton (PDA) Simulator & Parser Engine
 * 
 * Formal Definition: M = (Q, Σ, Γ, δ, q0, Z0, F)
 * - Q = { q_start, q_loop, q_accept, q_error }
 * - Σ = Tokens from Lexer { id, num, =, +, -, *, /, %, (, ), $ }
 * - Γ = Stack alphabet (Terminals, Non-Terminals, Z0)
 * - q0 = q_start
 * - Z0 = Bottom-of-stack marker ('Z0')
 * - F = { q_accept }
 */

// Resolve dependencies for Node.js or Browser environment without redeclaring top-level let/const
var _ParseTreeNode = (typeof ParseTreeNode !== 'undefined') ? ParseTreeNode : null;
var _ParseTreeBuilder = (typeof ParseTreeBuilder !== 'undefined') ? ParseTreeBuilder : null;
var _TokenType = (typeof TokenType !== 'undefined') ? TokenType : null;
var _Token = (typeof Token !== 'undefined') ? Token : null;

if (typeof require !== 'undefined') {
  try {
    if (!_ParseTreeNode || !_ParseTreeBuilder) {
      const pt = require('./parsetree.js');
      _ParseTreeNode = _ParseTreeNode || pt.ParseTreeNode;
      _ParseTreeBuilder = _ParseTreeBuilder || pt.ParseTreeBuilder;
    }
    if (!_TokenType || !_Token) {
      const lx = require('./lexer.js');
      _TokenType = _TokenType || lx.TokenType;
      _Token = _Token || lx.Token;
    }
  } catch (e) {
    // browser environment
  }
}

class PDASimulator {
  constructor(grammarEngine) {
    this.grammar = grammarEngine;
    this.treeBuilder = _ParseTreeBuilder ? new _ParseTreeBuilder() : null;
    this.reset();
  }

  reset() {
    this.steps = [];
    this.currentState = 'q_start';
    this.stack = [];
    this.tokenIndex = 0;
    this.tokens = [];
    this.result = {
      isValid: false,
      error: null,
      derivationSteps: [],
      parseTree: null
    };
  }

  /**
   * Runs the complete parsing and records every PDA step transition
   */
  simulate(lexerResult) {
    this.reset();
    this.tokens = lexerResult.tokens;

    // First check for lexical errors
    if (lexerResult.errors && lexerResult.errors.length > 0) {
      const lexErr = lexerResult.errors[0];
      this.result.isValid = false;
      this.result.error = {
        phase: 'LEXICAL',
        type: 'Invalid Token',
        line: lexErr.line,
        col: lexErr.col,
        message: lexErr.message,
        suggestion: lexErr.suggestion
      };
      this.recordStep({
        state: 'q_error',
        action: 'ERROR',
        topOfStack: 'Z0',
        rule: 'None',
        description: `Lexical error: ${lexErr.message}`
      });
      return this.result;
    }

    // Step 0: Initial PDA configuration
    // Stack contains [Z0]
    this.currentState = 'q_start';
    this.stack = ['Z0'];
    this.tokenIndex = 0;

    this.recordStep({
      state: 'q_start',
      action: 'INIT',
      topOfStack: 'Z0',
      rule: 'δ(q_start, ε, Z0) -> (q_loop, S Z0)',
      description: `Push start symbol '${this.grammar.startSymbol}' onto stack above marker 'Z0' and transition to state q_loop.`
    });

    // Push start symbol
    this.stack.push(this.grammar.startSymbol);
    this.currentState = 'q_loop';

    // Parse Tree root
    const rootNode = _ParseTreeNode ? new _ParseTreeNode(this.grammar.startSymbol, 'non-terminal') : null;
    this.result.parseTree = rootNode;

    // Node stack parallel to symbol stack to build the parse tree
    // Note: Z0 doesn't have a parse tree node
    const nodeStack = [null, rootNode];

    // Leftmost derivation tracker
    let sententialForm = [this.grammar.startSymbol];
    this.result.derivationSteps.push([...sententialForm]);

    // Parsing loop
    let maxSteps = 500; // Safeguard against infinite loops
    let stepCount = 0;

    while (this.stack.length > 0 && stepCount < maxSteps) {
      stepCount++;
      const topSymbol = this.stack[this.stack.length - 1];
      const currentNode = nodeStack[nodeStack.length - 1];
      const curToken = this.getCurrentToken();
      const terminalLookahead = this.tokenToTerminal(curToken);

      // Case 1: Stack top is Z0
      if (topSymbol === 'Z0') {
        if (terminalLookahead === '$') {
          // Both stack and input are empty -> ACCEPT!
          this.stack.pop(); // Pop Z0
          this.currentState = 'q_accept';
          this.recordStep({
            state: 'q_accept',
            action: 'ACCEPT',
            topOfStack: 'Z0',
            rule: 'δ(q_loop, $, Z0) -> (q_accept, ε)',
            description: `Input string completely consumed and stack reduced to Z0. Expression is syntactically valid!`
          });
          this.result.isValid = true;
          return this.result;
        } else {
          // Extra input remaining
          this.currentState = 'q_error';
          const err = this.diagnoseError(topSymbol, curToken, 'EXTRA_INPUT');
          this.result.error = err;
          this.recordStep({
            state: 'q_error',
            action: 'ERROR',
            topOfStack: 'Z0',
            rule: 'Trap',
            description: `Syntax Error: Stack finished but unexpected extra token '${curToken.value}' at column ${curToken.startCol}.`
          });
          this.result.isValid = false;
          return this.result;
        }
      }

      // Case 2: Stack top is Terminal
      if (this.grammar.isTerminal(topSymbol)) {
        if (topSymbol === terminalLookahead) {
          // MATCH & POP
          this.stack.pop();
          const matchedNode = nodeStack.pop();
          if (matchedNode) {
            matchedNode.value = curToken.value;
          }

          const matchedToken = curToken;
          this.tokenIndex++; // Consume token from input

          this.recordStep({
            state: 'q_loop',
            action: 'MATCH',
            topOfStack: topSymbol,
            rule: `δ(q_loop, ${topSymbol}, ${topSymbol}) -> (q_loop, ε)`,
            description: `Matched terminal '${topSymbol}' ('${matchedToken.value}') with input token. Pop '${topSymbol}' from stack and advance input head.`
          });
          continue;
        } else {
          // Terminal Mismatch Error
          this.currentState = 'q_error';
          const err = this.diagnoseError(topSymbol, curToken, 'TERMINAL_MISMATCH');
          this.result.error = err;
          this.recordStep({
            state: 'q_error',
            action: 'ERROR',
            topOfStack: topSymbol,
            rule: 'Trap',
            description: `Mismatch: Expected terminal '${topSymbol}' on stack, but encountered '${curToken.value}'.`
          });
          this.result.isValid = false;
          return this.result;
        }
      }

      // Case 3: Stack top is Non-Terminal
      if (this.grammar.isNonTerminal(topSymbol)) {
        const prod = this.grammar.getParseTableEntry(topSymbol, terminalLookahead);

        if (!prod) {
          // No production rule in table for [topSymbol, lookahead]
          this.currentState = 'q_error';
          const err = this.diagnoseError(topSymbol, curToken, 'NO_PRODUCTION');
          this.result.error = err;
          this.recordStep({
            state: 'q_error',
            action: 'ERROR',
            topOfStack: topSymbol,
            rule: 'No entry in M[A, a]',
            description: `No transition found in parse table for non-terminal '${topSymbol}' with lookahead '${terminalLookahead}'.`
          });
          this.result.isValid = false;
          return this.result;
        }

        // Pop the non-terminal
        this.stack.pop();
        const parentNode = nodeStack.pop();

        if (prod.rhs.length === 1 && prod.rhs[0] === 'ε') {
          // Epsilon production: A -> ε
          if (parentNode && _ParseTreeNode) {
            const epsNode = new _ParseTreeNode('ε', 'epsilon', 'ε', prod.toString());
            parentNode.addChild(epsNode);
          }

          // Update derivation
          sententialForm = this.replaceFirstInArray(sententialForm, topSymbol, []);
          this.result.derivationSteps.push([...sententialForm]);

          this.recordStep({
            state: 'q_loop',
            action: 'POP_EPSILON',
            topOfStack: topSymbol,
            rule: `δ(q_loop, ε, ${topSymbol}) -> (q_loop, ε) [Rule: ${prod.toString()}]`,
            description: `Expanded non-terminal '${topSymbol}' via epsilon production ${prod.toString()}. Non-terminal '${topSymbol}' popped from stack.`
          });
        } else {
          // Non-epsilon production: Push symbols in reverse order so leftmost symbol is on top!
          const childrenNodes = [];
          for (let i = 0; i < prod.rhs.length; i++) {
            const sym = prod.rhs[i];
            const symType = this.grammar.isNonTerminal(sym) ? 'non-terminal' : 'terminal';
            const childNode = _ParseTreeNode ? new _ParseTreeNode(sym, symType, null, prod.toString()) : null;
            childrenNodes.push(childNode);
            if (parentNode && childNode) {
              parentNode.addChild(childNode);
            }
          }

          // Push reverse onto stack & nodeStack
          for (let i = prod.rhs.length - 1; i >= 0; i--) {
            this.stack.push(prod.rhs[i]);
            nodeStack.push(childrenNodes[i]);
          }

          // Update derivation
          sententialForm = this.replaceFirstInArray(sententialForm, topSymbol, prod.rhs);
          this.result.derivationSteps.push([...sententialForm]);

          this.recordStep({
            state: 'q_loop',
            action: 'EXPAND',
            topOfStack: topSymbol,
            rule: `δ(q_loop, ε, ${topSymbol}) -> (q_loop, ${[...prod.rhs].reverse().join('')}) [Rule: ${prod.toString()}]`,
            description: `Expanded non-terminal '${topSymbol}' via rule ${prod.toString()}. Pushed symbols [${[...prod.rhs].reverse().join(', ')}] onto stack.`
          });
        }
        continue;
      }

      // Unexpected stack state
      this.currentState = 'q_error';
      this.result.error = {
        phase: 'PARSING',
        type: 'Internal Error',
        line: curToken.line,
        col: curToken.startCol,
        message: `Unknown symbol '${topSymbol}' on stack.`,
        suggestion: 'Check grammar symbol specifications.'
      };
      this.result.isValid = false;
      return this.result;
    }

    if (stepCount >= maxSteps) {
      this.currentState = 'q_error';
      this.result.error = {
        phase: 'PARSING',
        type: 'Step Limit Exceeded',
        line: 1,
        col: 1,
        message: 'Maximum PDA simulation steps exceeded (possible cyclic expansion).',
        suggestion: 'Verify grammar for recursion issues.'
      };
      this.result.isValid = false;
    }

    return this.result;
  }

  replaceFirstInArray(arr, target, replacement) {
    const idx = arr.indexOf(target);
    if (idx === -1) return arr;
    const res = [...arr.slice(0, idx), ...replacement, ...arr.slice(idx + 1)];
    return res;
  }

  getCurrentToken() {
    if (this.tokenIndex < this.tokens.length) {
      return this.tokens[this.tokenIndex];
    }
    return _Token ? new _Token(_TokenType.EOF, '$', 0, 0, 1) : { type: 'EOF', value: '$', startCol: 0, endCol: 0, line: 1 };
  }

  tokenToTerminal(token) {
    if (!_TokenType) return token.value;
    switch (token.type) {
      case _TokenType.IDENTIFIER: return 'id';
      case _TokenType.NUMBER: return 'num';
      case _TokenType.ASSIGN: return '=';
      case _TokenType.PLUS: return '+';
      case _TokenType.MINUS: return '-';
      case _TokenType.STAR: return '*';
      case _TokenType.SLASH: return '/';
      case _TokenType.PERCENT: return '%';
      case _TokenType.CARET: return '^';
      case _TokenType.LPAREN: return '(';
      case _TokenType.RPAREN: return ')';
      case _TokenType.EOF: return '$';
      default: return token.value;
    }
  }

  recordStep(info) {
    const remaining = this.tokens.slice(this.tokenIndex).map(t => t.value);
    this.steps.push({
      stepNumber: this.steps.length,
      state: info.state,
      action: info.action,
      topOfStack: info.topOfStack,
      stack: [...this.stack],
      readHead: this.tokenIndex,
      currentToken: this.getCurrentToken(),
      remainingTokens: remaining.join(' ') || '$',
      rule: info.rule,
      description: info.description
    });
  }

  /**
   * Intelligently diagnoses syntax errors and suggests fixes
   */
  diagnoseError(topSymbol, curToken, context) {
    const col = curToken.startCol;
    const val = curToken.value;
    const line = curToken.line;

    // Check previous token
    const prevToken = this.tokenIndex > 0 ? this.tokens[this.tokenIndex - 1] : null;

    // 1. Missing closing parenthesis
    if (topSymbol === ')') {
      return {
        phase: 'SYNTAX',
        type: 'Unmatched Parenthesis',
        line,
        col: prevToken ? prevToken.endCol : col,
        message: `Missing closing parenthesis ')' before '${val}'.`,
        suggestion: `Insert a ')' to close the open sub-expression.`
      };
    }

    // 2. Unexpected closing parenthesis
    if (_TokenType && curToken.type === _TokenType.RPAREN) {
      return {
        phase: 'SYNTAX',
        type: 'Mismatched Parenthesis',
        line,
        col,
        message: `Unexpected closing parenthesis ')' with no matching '('.`,
        suggestion: `Remove the stray ')' or add a matching '(' before.`
      };
    }

    // 3. Consecutive operators (e.g. a + * b)
    if (prevToken && this.isOperator(prevToken) && this.isOperator(curToken)) {
      return {
        phase: 'SYNTAX',
        type: 'Consecutive Operators',
        line,
        col,
        message: `Unexpected operator '${val}' immediately after '${prevToken.value}'.`,
        suggestion: `Remove '${val}' or place an identifier or number between '${prevToken.value}' and '${val}'.`
      };
    }

    // 4. Missing operand at end of expression (e.g. a + b +)
    if (_TokenType && curToken.type === _TokenType.EOF && prevToken && this.isOperator(prevToken)) {
      return {
        phase: 'SYNTAX',
        type: 'Missing Operand',
        line: prevToken.line,
        col: prevToken.endCol,
        message: `Incomplete expression: expected operand after operator '${prevToken.value}'.`,
        suggestion: `Append a variable or number after '${prevToken.value}'.`
      };
    }

    // 5. Incomplete assignment (e.g. x =)
    if (_TokenType && prevToken && prevToken.type === _TokenType.ASSIGN && curToken.type === _TokenType.EOF) {
      return {
        phase: 'SYNTAX',
        type: 'Missing Assignment Value',
        line: prevToken.line,
        col: prevToken.endCol,
        message: `Assignment operator '=' must be followed by an expression.`,
        suggestion: `Provide an expression or value after '=' (e.g. 'x = 10').`
      };
    }

    // 6. Missing operator between two operands (e.g. a b or 2 a)
    if (_TokenType && prevToken && (prevToken.type === _TokenType.IDENTIFIER || prevToken.type === _TokenType.NUMBER) &&
        (curToken.type === _TokenType.IDENTIFIER || curToken.type === _TokenType.NUMBER)) {
      return {
        phase: 'SYNTAX',
        type: 'Missing Operator',
        line,
        col,
        message: `Unexpected operand '${val}' following '${prevToken.value}'. Missing operator.`,
        suggestion: `Insert an arithmetic operator (such as '+', '*', '-', '/') between '${prevToken.value}' and '${val}'.`
      };
    }

    // 7. General unexpected token
    const expected = this.getExpectedTerminals(topSymbol);
    const expStr = expected.length > 0 ? expected.join(', ') : 'valid operand or sub-expression';

    return {
      phase: 'SYNTAX',
      type: 'Unexpected Token',
      line,
      col,
      message: `Unexpected token '${val}' at column ${col}. Expected: ${expStr}.`,
      suggestion: `Replace '${val}' with one of [${expStr}].`
    };
  }

  isOperator(token) {
    if (!_TokenType) return false;
    return [
      _TokenType.PLUS, _TokenType.MINUS, _TokenType.STAR, _TokenType.SLASH,
      _TokenType.PERCENT, _TokenType.CARET, _TokenType.ASSIGN
    ].includes(token.type);
  }

  getExpectedTerminals(nonTerminal) {
    if (!this.grammar.parseTable[nonTerminal]) return [];
    return Object.keys(this.grammar.parseTable[nonTerminal]);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDASimulator };
}
