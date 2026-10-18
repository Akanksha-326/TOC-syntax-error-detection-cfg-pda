/**
 * CFG (Context-Free Grammar) Engine
 * Defines Grammar rules, computes First/Follow sets, and generates LL(1) Parsing Tables.
 */

class Production {
  constructor(lhs, rhs, ruleNumber = 0, description = '') {
    this.lhs = lhs; // string, e.g. "E"
    this.rhs = rhs; // array of symbols, e.g. ["T", "E'"] or ["ε"]
    this.ruleNumber = ruleNumber;
    this.description = description;
  }

  toString() {
    return `${this.lhs} -> ${this.rhs.join(' ')}`;
  }
}

class GrammarEngine {
  constructor(type = 'full') {
    this.type = type; // 'full' (with assignments) or 'arithmetic' (pure expressions)
    this.productions = [];
    this.nonTerminals = [];
    this.terminals = [];
    this.startSymbol = '';
    this.firstSets = {};
    this.followSets = {};
    this.parseTable = {};
    this.naturalGrammar = [];

    this.initGrammar(type);
  }

  initGrammar(type = 'full') {
    this.type = type;
    this.productions = [];

    if (type === 'arithmetic') {
      // Natural Grammar for pure arithmetic
      this.naturalGrammar = [
        "E -> E + T | E - T | T",
        "T -> T * F | T / F | T % F | F",
        "F -> ( E ) | id | num"
      ];

      // Transformed LL(1) Grammar
      this.startSymbol = 'E';
      this.nonTerminals = ['E', "E'", 'T', "T'", 'F'];
      this.terminals = ['id', 'num', '+', '-', '*', '/', '%', '(', ')', '$'];

      this.addRule('E', ['T', "E'"], 1, "E -> T E' (Expression begins with Term)");
      this.addRule("E'", ['+', 'T', "E'"], 2, "E' -> + T E' (Addition)");
      this.addRule("E'", ['-', 'T', "E'"], 3, "E' -> - T E' (Subtraction)");
      this.addRule("E'", ['ε'], 4, "E' -> ε (No further additive operators)");
      this.addRule('T', ['F', "T'"], 5, "T -> F T' (Term begins with Factor)");
      this.addRule("T'", ['*', 'F', "T'"], 6, "T' -> * F T' (Multiplication)");
      this.addRule("T'", ['/', 'F', "T'"], 7, "T' -> / F T' (Division)");
      this.addRule("T'", ['%', 'F', "T'"], 8, "T' -> % F T' (Modulo)");
      this.addRule("T'", ['ε'], 9, "T' -> ε (No further multiplicative operators)");
      this.addRule('F', ['(', 'E', ')'], 10, "F -> ( E ) (Parenthesized expression)");
      this.addRule('F', ['id'], 11, "F -> id (Identifier operand)");
      this.addRule('F', ['num'], 12, "F -> num (Numeric literal operand)");

    } else {
      // Full Grammar (Assignments + Expressions)
      this.naturalGrammar = [
        "S -> id = E | E",
        "E -> E + T | E - T | T",
        "T -> T * F | T / F | T % F | F",
        "F -> ( E ) | id | num"
      ];

      this.startSymbol = 'S';
      this.nonTerminals = ['S', "S'", 'E', "E'", 'T', "T'", 'F'];
      this.terminals = ['id', 'num', '=', '+', '-', '*', '/', '%', '(', ')', '$'];

      this.addRule('S', ['id', "S'"], 1, "S -> id S' (Statement starting with identifier)");
      this.addRule('S', ['num', "T'", "E'"], 2, "S -> num T' E' (Statement starting with number)");
      this.addRule('S', ['(', 'E', ')', "T'", "E'"], 3, "S -> ( E ) T' E' (Statement starting with parenthesized expr)");

      this.addRule("S'", ['=', 'E'], 4, "S' -> = E (Assignment statement)");
      this.addRule("S'", ["T'", "E'"], 5, "S' -> T' E' (Identifier as expression)");

      this.addRule('E', ['T', "E'"], 6, "E -> T E' (Expression begins with Term)");
      this.addRule("E'", ['+', 'T', "E'"], 7, "E' -> + T E' (Addition)");
      this.addRule("E'", ['-', 'T', "E'"], 8, "E' -> - T E' (Subtraction)");
      this.addRule("E'", ['ε'], 9, "E' -> ε (Empty additive continuation)");

      this.addRule('T', ['F', "T'"], 10, "T -> F T' (Term begins with Factor)");
      this.addRule("T'", ['*', 'F', "T'"], 11, "T' -> * F T' (Multiplication)");
      this.addRule("T'", ['/', 'F', "T'"], 12, "T' -> / F T' (Division)");
      this.addRule("T'", ['%', 'F', "T'"], 13, "T' -> % F T' (Modulo)");
      this.addRule("T'", ['ε'], 14, "T' -> ε (Empty multiplicative continuation)");

      this.addRule('F', ['(', 'E', ')'], 15, "F -> ( E ) (Parenthesized expression)");
      this.addRule('F', ['id'], 16, "F -> id (Identifier operand)");
      this.addRule('F', ['num'], 17, "F -> num (Numeric literal operand)");
    }

    this.computeFirstSets();
    this.computeFollowSets();
    this.buildParseTable();
  }

  addRule(lhs, rhs, ruleNumber, description) {
    this.productions.push(new Production(lhs, rhs, ruleNumber, description));
  }

  isNonTerminal(symbol) {
    return this.nonTerminals.includes(symbol);
  }

  isTerminal(symbol) {
    return this.terminals.includes(symbol) && symbol !== 'ε';
  }

  computeFirstSets() {
    this.firstSets = {};
    for (const nt of this.nonTerminals) {
      this.firstSets[nt] = new Set();
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const prod of this.productions) {
        const lhs = prod.lhs;
        const rhs = prod.rhs;
        const beforeSize = this.firstSets[lhs].size;

        if (rhs.length === 1 && rhs[0] === 'ε') {
          this.firstSets[lhs].add('ε');
        } else {
          let allDeriveEpsilon = true;
          for (const sym of rhs) {
            if (this.isTerminal(sym)) {
              this.firstSets[lhs].add(sym);
              allDeriveEpsilon = false;
              break;
            } else if (this.isNonTerminal(sym)) {
              const symFirst = this.firstSets[sym];
              for (const item of symFirst) {
                if (item !== 'ε') {
                  this.firstSets[lhs].add(item);
                }
              }
              if (!symFirst.has('ε')) {
                allDeriveEpsilon = false;
                break;
              }
            } else {
              allDeriveEpsilon = false;
              break;
            }
          }
          if (allDeriveEpsilon) {
            this.firstSets[lhs].add('ε');
          }
        }

        if (this.firstSets[lhs].size > beforeSize) {
          changed = true;
        }
      }
    }
  }

  computeFirstOfSequence(sequence) {
    const result = new Set();
    let allCanBeEpsilon = true;

    for (const sym of sequence) {
      if (sym === 'ε') continue;

      if (this.isTerminal(sym)) {
        result.add(sym);
        allCanBeEpsilon = false;
        break;
      } else if (this.isNonTerminal(sym)) {
        const symFirst = this.firstSets[sym];
        for (const item of symFirst) {
          if (item !== 'ε') result.add(item);
        }
        if (!symFirst.has('ε')) {
          allCanBeEpsilon = false;
          break;
        }
      } else {
        allCanBeEpsilon = false;
        break;
      }
    }

    if (allCanBeEpsilon) {
      result.add('ε');
    }
    return result;
  }

  computeFollowSets() {
    this.followSets = {};
    for (const nt of this.nonTerminals) {
      this.followSets[nt] = new Set();
    }

    this.followSets[this.startSymbol].add('$');

    let changed = true;
    while (changed) {
      changed = false;
      for (const prod of this.productions) {
        const lhs = prod.lhs;
        const rhs = prod.rhs;

        for (let i = 0; i < rhs.length; i++) {
          const sym = rhs[i];
          if (this.isNonTerminal(sym)) {
            const beforeSize = this.followSets[sym].size;
            const remainder = rhs.slice(i + 1);
            const firstOfRemainder = this.computeFirstOfSequence(remainder);

            for (const item of firstOfRemainder) {
              if (item !== 'ε') {
                this.followSets[sym].add(item);
              }
            }

            if (firstOfRemainder.has('ε') || remainder.length === 0) {
              for (const item of this.followSets[lhs]) {
                this.followSets[sym].add(item);
              }
            }

            if (this.followSets[sym].size > beforeSize) {
              changed = true;
            }
          }
        }
      }
    }
  }

  buildParseTable() {
    this.parseTable = {};
    for (const nt of this.nonTerminals) {
      this.parseTable[nt] = {};
    }

    for (const prod of this.productions) {
      const lhs = prod.lhs;
      const rhs = prod.rhs;

      // Special handling for S' -> T' E' vs S' -> = E
      if (lhs === "S'" && rhs[0] === '=') {
        this.parseTable[lhs]['='] = prod;
        continue;
      }
      if (lhs === "S'" && rhs[0] === "T'") {
        // Lookaheads for S' -> T' E'
        const lookaheads = ['*', '/', '%', '+', '-', ')', '$'];
        for (const la of lookaheads) {
          if (!this.parseTable[lhs][la]) {
            this.parseTable[lhs][la] = prod;
          }
        }
        continue;
      }

      const firstSet = this.computeFirstOfSequence(rhs);

      for (const terminal of firstSet) {
        if (terminal !== 'ε') {
          this.parseTable[lhs][terminal] = prod;
        }
      }

      if (firstSet.has('ε')) {
        for (const terminal of this.followSets[lhs]) {
          this.parseTable[lhs][terminal] = prod;
        }
      }
    }
  }

  getParseTableEntry(nonTerminal, terminal) {
    if (this.parseTable[nonTerminal] && this.parseTable[nonTerminal][terminal]) {
      return this.parseTable[nonTerminal][terminal];
    }
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GrammarEngine, Production };
}
