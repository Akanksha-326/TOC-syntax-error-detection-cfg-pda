const { Lexer } = require('../js/lexer.js');
const { GrammarEngine } = require('../js/grammar.js');
const { PDASimulator } = require('../js/pda.js');

const grammar = new GrammarEngine('full');
const pda = new PDASimulator(grammar);

const testCases = [
  // Valid cases
  { input: "a + b * c", expectValid: true, name: "Basic arithmetic precedence" },
  { input: "(a + b) * c", expectValid: true, name: "Parentheses precedence" },
  { input: "x = a + b * c", expectValid: true, name: "Variable assignment" },
  { input: "result = (10 + 20) / (var_a - 4)", expectValid: true, name: "Complex nested arithmetic" },
  { input: "count = count + 1", expectValid: true, name: "Self assignment" },
  { input: "42", expectValid: true, name: "Single number" },
  { input: "foo", expectValid: true, name: "Single identifier" },

  // Invalid cases
  { input: "a + * b", expectValid: false, name: "Consecutive operators" },
  { input: "a + (b * c", expectValid: false, name: "Missing closing parenthesis" },
  { input: "a + b)", expectValid: false, name: "Unexpected closing parenthesis" },
  { input: "x =", expectValid: false, name: "Incomplete assignment" },
  { input: "a + b +", expectValid: false, name: "Trailing operator" },
  { input: "a b + c", expectValid: false, name: "Missing operator between operands" },
  { input: "a + @b", expectValid: false, name: "Invalid character" },
  { input: "123var + 5", expectValid: false, name: "Malformed number/identifier" }
];

console.log("=== RUNNING TOC ENGINE TESTS ===\n");
let passed = 0;

for (const tc of testCases) {
  const lexer = new Lexer();
  const lexRes = lexer.tokenize(tc.input);
  const pdaRes = pda.simulate(lexRes);

  const ok = pdaRes.isValid === tc.expectValid;
  if (ok) {
    passed++;
    console.log(`[PASS] ${tc.name}: "${tc.input}" -> Valid: ${pdaRes.isValid} (Steps: ${pda.steps.length})`);
  } else {
    console.log(`[FAIL] ${tc.name}: "${tc.input}" -> Expected: ${tc.expectValid}, Got: ${pdaRes.isValid}`);
    if (pdaRes.error) {
      console.log(`       Error: ${pdaRes.error.message}`);
    }
  }
}

console.log(`\nResults: ${passed} / ${testCases.length} Passed`);
