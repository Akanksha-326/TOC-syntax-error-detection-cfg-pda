"""
CFG (Context-Free Grammar) Engine in Python.
Defines production rules, computes First/Follow sets, and builds LL(1) parsing table.
"""

from typing import Dict, List, Set, Optional

class Production:
    def __init__(self, lhs: str, rhs: List[str], rule_num: int, description: str = ""):
        self.lhs = lhs
        self.rhs = rhs
        self.rule_num = rule_num
        self.description = description

    def __repr__(self) -> str:
        return f"{self.lhs} -> {' '.join(self.rhs)}"

class CFGEngine:
    def __init__(self, mode: str = "full"):
        self.mode = mode
        self.productions: List[Production] = []
        self.non_terminals: List[str] = []
        self.terminals: List[str] = []
        self.start_symbol: str = ""
        self.first_sets: Dict[str, Set[str]] = {}
        self.follow_sets: Dict[str, Set[str]] = {}
        self.parse_table: Dict[str, Dict[str, Production]] = {}
        self._init_grammar(mode)

    def _init_grammar(self, mode: str):
        self.productions = []
        if mode == "arithmetic":
            self.start_symbol = "E"
            self.non_terminals = ["E", "E'", "T", "T'", "F"]
            self.terminals = ["id", "num", "+", "-", "*", "/", "%", "(", ")", "$"]

            self._add_rule("E", ["T", "E'"], 1, "E -> T E'")
            self._add_rule("E'", ["+", "T", "E'"], 2, "E' -> + T E'")
            self._add_rule("E'", ["-", "T", "E'"], 3, "E' -> - T E'")
            self._add_rule("E'", ["ε"], 4, "E' -> ε")
            self._add_rule("T", ["F", "T'"], 5, "T -> F T'")
            self._add_rule("T'", ["*", "F", "T'"], 6, "T' -> * F T'")
            self._add_rule("T'", ["/", "F", "T'"], 7, "T' -> / F T'")
            self._add_rule("T'", ["%", "F", "T'"], 8, "T' -> % F T'")
            self._add_rule("T'", ["ε"], 9, "T' -> ε")
            self._add_rule("F", ["(", "E", ")"], 10, "F -> ( E )")
            self._add_rule("F", ["id"], 11, "F -> id")
            self._add_rule("F", ["num"], 12, "F -> num")
        else:
            self.start_symbol = "S"
            self.non_terminals = ["S", "S'", "E", "E'", "T", "T'", "F"]
            self.terminals = ["id", "num", "=", "+", "-", "*", "/", "%", "(", ")", "$"]

            self._add_rule("S", ["id", "S'"], 1, "S -> id S'")
            self._add_rule("S", ["num", "T'", "E'"], 2, "S -> num T' E'")
            self._add_rule("S", ["(", "E", ")", "T'", "E'"], 3, "S -> ( E ) T' E'")

            self._add_rule("S'", ["=", "E"], 4, "S' -> = E")
            self._add_rule("S'", ["T'", "E'"], 5, "S' -> T' E'")

            self._add_rule("E", ["T", "E'"], 6, "E -> T E'")
            self._add_rule("E'", ["+", "T", "E'"], 7, "E' -> + T E'")
            self._add_rule("E'", ["-", "T", "E'"], 8, "E' -> - T E'")
            self._add_rule("E'", ["ε"], 9, "E' -> ε")

            self._add_rule("T", ["F", "T'"], 10, "T -> F T'")
            self._add_rule("T'", ["*", "F", "T'"], 11, "T' -> * F T'")
            self._add_rule("T'", ["/", "F", "T'"], 12, "T' -> / F T'")
            self._add_rule("T'", ["%", "F", "T'"], 13, "T' -> % F T'")
            self._add_rule("T'", ["ε"], 14, "T' -> ε")

            self._add_rule("F", ["(", "E", ")"], 15, "F -> ( E )")
            self._add_rule("F", ["id"], 16, "F -> id")
            self._add_rule("F", ["num"], 17, "F -> num")

        self._compute_first()
        self._compute_follow()
        self._build_table()

    def _add_rule(self, lhs: str, rhs: List[str], rule_num: int, description: str):
        self.productions.append(Production(lhs, rhs, rule_num, description))

    def is_non_terminal(self, sym: str) -> bool:
        return sym in self.non_terminals

    def is_terminal(self, sym: str) -> bool:
        return sym in self.terminals and sym != "ε"

    def _compute_first(self):
        for nt in self.non_terminals:
            self.first_sets[nt] = set()

        changed = True
        while changed:
            changed = False
            for prod in self.productions:
                lhs, rhs = prod.lhs, prod.rhs
                before_len = len(self.first_sets[lhs])

                if rhs == ["ε"]:
                    self.first_sets[lhs].add("ε")
                else:
                    all_eps = True
                    for sym in rhs:
                        if self.is_terminal(sym):
                            self.first_sets[lhs].add(sym)
                            all_eps = False
                            break
                        elif self.is_non_terminal(sym):
                            sym_first = self.first_sets[sym]
                            self.first_sets[lhs].update(sym_first - {"ε"})
                            if "ε" not in sym_first:
                                all_eps = False
                                break
                        else:
                            all_eps = False
                            break
                    if all_eps:
                        self.first_sets[lhs].add("ε")

                if len(self.first_sets[lhs]) > before_len:
                    changed = True

    def first_of_seq(self, seq: List[str]) -> Set[str]:
        res = set()
        all_eps = True
        for sym in seq:
            if sym == "ε":
                continue
            if self.is_terminal(sym):
                res.add(sym)
                all_eps = False
                break
            elif self.is_non_terminal(sym):
                res.update(self.first_sets[sym] - {"ε"})
                if "ε" not in self.first_sets[sym]:
                    all_eps = False
                    break
            else:
                all_eps = False
                break
        if all_eps:
            res.add("ε")
        return res

    def _compute_follow(self):
        for nt in self.non_terminals:
            self.follow_sets[nt] = set()
        self.follow_sets[self.start_symbol].add("$")

        changed = True
        while changed:
            changed = False
            for prod in self.productions:
                lhs, rhs = prod.lhs, prod.rhs
                for i, sym in enumerate(rhs):
                    if self.is_non_terminal(sym):
                        before_len = len(self.follow_sets[sym])
                        rem = rhs[i + 1:]
                        f_rem = self.first_of_seq(rem)
                        self.follow_sets[sym].update(f_rem - {"ε"})

                        if "ε" in f_rem or len(rem) == 0:
                            self.follow_sets[sym].update(self.follow_sets[lhs])

                        if len(self.follow_sets[sym]) > before_len:
                            changed = True

    def _build_table(self):
        for nt in self.non_terminals:
            self.parse_table[nt] = {}

        for prod in self.productions:
            lhs, rhs = prod.lhs, prod.rhs
            if lhs == "S'" and rhs == ["=", "E"]:
                self.parse_table[lhs]["="] = prod
                continue
            if lhs == "S'" and rhs == ["T'", "E'"]:
                for la in ["*", "/", "%", "+", "-", ")", "$"]:
                    if la not in self.parse_table[lhs]:
                        self.parse_table[lhs][la] = prod
                continue

            f_set = self.first_of_seq(rhs)
            for t in f_set - {"ε"}:
                self.parse_table[lhs][t] = prod
            if "ε" in f_set:
                for t in self.follow_sets[lhs]:
                    self.parse_table[lhs][t] = prod

    def get_entry(self, nt: str, term: str) -> Optional[Production]:
        return self.parse_table.get(nt, {}).get(term)
