"""
CLI Application for CFG and PDA Simulator
Usage:
    python python/main.py "a + b * c"
    python python/main.py --mode arithmetic "(10 + 20) * 3"
"""

import sys
import argparse
from lexer import Lexer
from cfg import CFGEngine
from pda import PDASimulator

def main():
    parser = argparse.ArgumentParser(description="CFG & PDA Syntax Analyzer & Simulator (Theory of Computation)")
    parser.add_argument("expression", nargs="?", default="a + b * c", help="Input expression to validate")
    parser.add_argument("--mode", choices=["full", "arithmetic"], default="full", help="Grammar mode")
    parser.add_argument("--trace", action="store_true", default=True, help="Display detailed PDA step trace")

    args = parser.parse_args()

    print("=" * 70)
    print("   THEORY OF COMPUTATION: CFG & PDA SYNTAX ANALYZER")
    print("=" * 70)
    print(f"Input Expression : {args.expression}")
    print(f"Grammar Mode     : {args.mode.upper()}")
    print("-" * 70)

    # 1. Lexical Analysis
    lexer = Lexer()
    tokens, lex_errors = lexer.tokenize(args.expression)
    print("\n[MODULE 1] TOKEN STREAM:")
    print("  " + " | ".join([f"{t.type.value}('{t.value}')" for t in tokens if t.value != "$"]))

    # 2. CFG Engine
    grammar = CFGEngine(mode=args.mode)
    print("\n[MODULE 2] CFG PRODUCTIONS (LL(1) Transformed):")
    for prod in grammar.productions[:6]:
        print(f"  {prod}")
    if len(grammar.productions) > 6:
        print(f"  ... ({len(grammar.productions) - 6} more rules)")

    # 3. PDA Simulation
    pda = PDASimulator(grammar)
    result = pda.simulate(tokens, lex_errors)

    if args.trace:
        print("\n[MODULE 3 & 5] PDA SIMULATION TRACE:")
        print(f"{'Step':<5} | {'State':<9} | {'Stack (Bottom -> Top)':<30} | {'Lookahead':<10} | {'Action'}")
        print("-" * 75)
        for s in result["steps"]:
            stk_str = "[" + ", ".join(s.stack) + "]"
            tok_val = s.current_token.value
            print(f"{s.step_num:<5} | {s.state:<9} | {stk_str:<30} | {tok_val:<10} | {s.action}")

    # 4. Result & Diagnostics
    print("\n" + "=" * 70)
    if result["valid"]:
        print("  STATUS: SYNTAX IS VALID! ACCEPTED BY PDA.")
        print("  Reason: Entire input consumed and stack reduced to Z0 in state q_accept.")
    else:
        err = result["error"]
        print("  STATUS: SYNTAX IS INVALID! REJECTED BY PDA.")
        print(f"  Error Type : {err.get('type')}")
        print(f"  Position   : Column {err.get('col')}")
        print(f"  Details    : {err.get('message')}")
        if err.get('suggestion'):
            print(f"  Suggestion : {err.get('suggestion')}")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
