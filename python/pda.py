"""
Formal Pushdown Automaton (PDA) Simulator in Python.
Simulates M = (Q, Σ, Γ, δ, q0, Z0, F) step by step with rich diagnostics.
"""

from typing import List, Dict, Any, Optional
from lexer import Token, TokenType, LexicalError
from cfg import CFGEngine, Production

class PDAStep:
    def __init__(self, step_num: int, state: str, action: str, top_of_stack: str,
                 stack: List[str], current_token: Token, remaining_str: str,
                 rule: str, description: str):
        self.step_num = step_num
        self.state = state
        self.action = action
        self.top_of_stack = top_of_stack
        self.stack = stack
        self.current_token = current_token
        self.remaining_str = remaining_str
        self.rule = rule
        self.description = description

    def __repr__(self) -> str:
        return f"[Step {self.step_num:02d} | {self.state}] Stack: {self.stack} | Lookahead: '{self.current_token.value}' | {self.action} -> {self.rule}"

class PDASimulator:
    def __init__(self, grammar: CFGEngine):
        self.grammar = grammar
        self.steps: List[PDAStep] = []
        self.stack: List[str] = []
        self.token_idx = 0
        self.tokens: List[Token] = []
        self.current_state = "q_start"

    def simulate(self, tokens: List[Token], lex_errors: List[LexicalError]) -> Dict[str, Any]:
        self.steps = []
        self.tokens = tokens
        self.token_idx = 0

        # Lexical Error check
        if lex_errors:
            err = lex_errors[0]
            step = PDAStep(
                step_num=0, state="q_error", action="ERROR", top_of_stack="Z0",
                stack=["Z0"], current_token=tokens[0], remaining_str="",
                rule="Trap", description=f"Lexical error: {err.message}"
            )
            self.steps.append(step)
            return {
                "valid": False,
                "error": {
                    "phase": "LEXICAL",
                    "type": "Invalid Token",
                    "message": err.message,
                    "col": err.col,
                    "suggestion": err.suggestion
                },
                "steps": self.steps
            }

        # Step 0: Initial configuration
        self.current_state = "q_start"
        self.stack = ["Z0"]

        self._record_step(
            "q_start", "INIT", "Z0",
            f"δ(q_start, ε, Z0) -> (q_loop, {self.grammar.start_symbol} Z0)",
            f"Push start symbol '{self.grammar.start_symbol}' onto stack and transition to state q_loop."
        )

        self.stack.append(self.grammar.start_symbol)
        self.current_state = "q_loop"

        step_limit = 500
        while len(self.stack) > 0 and len(self.steps) < step_limit:
            top_sym = self.stack[-1]
            cur_tok = self._get_cur_token()
            terminal_lookahead = self._tok_to_terminal(cur_tok)

            # Case 1: Stack top is Z0
            if top_sym == "Z0":
                if terminal_lookahead == "$":
                    self.stack.pop()
                    self.current_state = "q_accept"
                    self._record_step(
                        "q_accept", "ACCEPT", "Z0",
                        "δ(q_loop, $, Z0) -> (q_accept, ε)",
                        "Input string accepted! Stack empty and input fully consumed."
                    )
                    return {"valid": True, "error": None, "steps": self.steps}
                else:
                    self.current_state = "q_error"
                    err = self._diagnose_error(top_sym, cur_tok)
                    self._record_step(
                        "q_error", "ERROR", "Z0", "Trap",
                        f"Unexpected extra token '{cur_tok.value}' at column {cur_tok.start_col}."
                    )
                    return {"valid": False, "error": err, "steps": self.steps}

            # Case 2: Stack top is Terminal
            if self.grammar.is_terminal(top_sym):
                if top_sym == terminal_lookahead:
                    self.stack.pop()
                    self.token_idx += 1
                    self._record_step(
                        "q_loop", "MATCH", top_sym,
                        f"δ(q_loop, {top_sym}, {top_sym}) -> (q_loop, ε)",
                        f"Matched terminal '{top_sym}' with input token. Popped from stack and advanced input head."
                    )
                    continue
                else:
                    self.current_state = "q_error"
                    err = self._diagnose_error(top_sym, cur_tok)
                    self._record_step(
                        "q_error", "ERROR", top_sym, "Trap",
                        f"Mismatch: Expected terminal '{top_sym}' on stack, got '{cur_tok.value}'."
                    )
                    return {"valid": False, "error": err, "steps": self.steps}

            # Case 3: Stack top is Non-Terminal
            if self.grammar.is_non_terminal(top_sym):
                prod = self.grammar.get_entry(top_sym, terminal_lookahead)
                if not prod:
                    self.current_state = "q_error"
                    err = self._diagnose_error(top_sym, cur_tok)
                    self._record_step(
                        "q_error", "ERROR", top_sym, "No entry in M[A, a]",
                        f"No transition for non-terminal '{top_sym}' with lookahead '{terminal_lookahead}'."
                    )
                    return {"valid": False, "error": err, "steps": self.steps}

                self.stack.pop()
                if prod.rhs == ["ε"]:
                    self._record_step(
                        "q_loop", "POP_EPSILON", top_sym,
                        f"δ(q_loop, ε, {top_sym}) -> (q_loop, ε)",
                        f"Applied epsilon production {prod}. Popped non-terminal '{top_sym}'."
                    )
                else:
                    # Push reverse
                    for sym in reversed(prod.rhs):
                        self.stack.append(sym)
                    self._record_step(
                        "q_loop", "EXPAND", top_sym,
                        f"δ(q_loop, ε, {top_sym}) -> (q_loop, {''.join(reversed(prod.rhs))})",
                        f"Applied rule {prod}. Pushed symbols {list(reversed(prod.rhs))} onto stack."
                    )
                continue

            # Fallback
            break

        return {"valid": False, "error": {"message": "Step limit reached or unhandled state", "col": 1}, "steps": self.steps}

    def _record_step(self, state: str, action: str, top_sym: str, rule: str, desc: str):
        rem = " ".join([t.value for t in self.tokens[self.token_idx:]]) or "$"
        step = PDAStep(
            step_num=len(self.steps),
            state=state,
            action=action,
            top_of_stack=top_sym,
            stack=list(self.stack),
            current_token=self._get_cur_token(),
            remaining_str=rem,
            rule=rule,
            description=desc
        )
        self.steps.append(step)

    def _get_cur_token(self) -> Token:
        if self.token_idx < len(self.tokens):
            return self.tokens[self.token_idx]
        return Token(TokenType.EOF, "$", 0, 0, 1)

    def _tok_to_terminal(self, tok: Token) -> str:
        mapping = {
            TokenType.IDENTIFIER: "id",
            TokenType.NUMBER: "num",
            TokenType.ASSIGN: "=",
            TokenType.PLUS: "+",
            TokenType.MINUS: "-",
            TokenType.STAR: "*",
            TokenType.SLASH: "/",
            TokenType.PERCENT: "%",
            TokenType.CARET: "^",
            TokenType.LPAREN: "(",
            TokenType.RPAREN: ")",
            TokenType.EOF: "$",
        }
        return mapping.get(tok.type, tok.value)

    def _diagnose_error(self, top_sym: str, cur_tok: Token) -> Dict[str, Any]:
        col = cur_tok.start_col
        val = cur_tok.value
        prev_tok = self.tokens[self.token_idx - 1] if self.token_idx > 0 else None

        if top_sym == ")":
            return {
                "type": "Unmatched Parenthesis",
                "col": prev_tok.end_col if prev_tok else col,
                "message": f"Missing closing parenthesis ')' before '{val}'.",
                "suggestion": "Insert ')' to close the open sub-expression."
            }

        if cur_tok.type == TokenType.RPAREN:
            return {
                "type": "Mismatched Parenthesis",
                "col": col,
                "message": "Unexpected closing parenthesis ')' with no matching '('.",
                "suggestion": "Remove the unmatched ')' or add an opening '('."
            }

        if prev_tok and self._is_op(prev_tok) and self._is_op(cur_tok):
            return {
                "type": "Consecutive Operators",
                "col": col,
                "message": f"Unexpected operator '{val}' immediately after '{prev_tok.value}'.",
                "suggestion": f"Remove '{val}' or insert an operand between '{prev_tok.value}' and '{val}'."
            }

        if cur_tok.type == TokenType.EOF and prev_tok and self._is_op(prev_tok):
            return {
                "type": "Missing Operand",
                "col": prev_tok.end_col,
                "message": f"Incomplete expression: expected operand after operator '{prev_tok.value}'.",
                "suggestion": f"Append a variable or number after '{prev_tok.value}'."
            }

        if prev_tok and prev_tok.type in (TokenType.IDENTIFIER, TokenType.NUMBER) and cur_tok.type in (TokenType.IDENTIFIER, TokenType.NUMBER):
            return {
                "type": "Missing Operator",
                "col": col,
                "message": f"Unexpected operand '{val}' following '{prev_tok.value}'. Missing operator.",
                "suggestion": f"Insert an operator (+, *, -, /) between '{prev_tok.value}' and '{val}'."
            }

        expected = list(self.grammar.parse_table.get(top_sym, {}).keys())
        exp_str = ", ".join(expected) if expected else "valid expression"
        return {
            "type": "Unexpected Token",
            "col": col,
            "message": f"Unexpected token '{val}' at column {col}. Expected: {exp_str}.",
            "suggestion": f"Replace '{val}' with valid syntax."
        }

    def _is_op(self, tok: Token) -> bool:
        return tok.type in (TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH,
                            TokenType.PERCENT, TokenType.CARET, TokenType.ASSIGN)
