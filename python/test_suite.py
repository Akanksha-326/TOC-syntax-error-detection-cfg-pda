"""
Automated Test Suite for Python CFG and PDA implementation
"""

from lexer import Lexer
from cfg import CFGEngine
from pda import PDASimulator

def run_tests():
    grammar = CFGEngine("full")
    pda = PDASimulator(grammar)

    test_cases = [
        ("a + b * c", True, "Basic arithmetic precedence"),
        ("(a + b) * c", True, "Parenthesized expression"),
        ("x = a + b * c", True, "Variable assignment"),
        ("result = (10 + 20) / (var_a - 4)", True, "Complex nested arithmetic"),
        ("count = count + 1", True, "Increment expression"),
        ("42", True, "Single number literal"),
        ("var_x", True, "Single variable identifier"),
        ("a + * b", False, "Consecutive operators"),
        ("a + (b * c", False, "Missing closing parenthesis"),
        ("a + b)", False, "Unmatched closing parenthesis"),
        ("x =", False, "Incomplete assignment"),
        ("a + b +", False, "Trailing operator"),
        ("a b + c", False, "Missing operator between variables"),
        ("a + @b", False, "Invalid character token"),
        ("123var + 5", False, "Malformed identifier beginning with digit"),
    ]

    print("=== RUNNING PYTHON TOC TEST SUITE ===\n")
    passed = 0
    for expr, expected, desc in test_cases:
        tokens, errs = Lexer().tokenize(expr)
        res = pda.simulate(tokens, errs)
        ok = (res["valid"] == expected)
        if ok:
            passed += 1
            print(f"[PASS] {desc}: '{expr}' -> Valid={res['valid']} ({len(res['steps'])} steps)")
        else:
            print(f"[FAIL] {desc}: '{expr}' -> Expected={expected}, Got={res['valid']}")

    print(f"\nSummary: {passed}/{len(test_cases)} tests passed successfully.\n")
    return passed == len(test_cases)

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
