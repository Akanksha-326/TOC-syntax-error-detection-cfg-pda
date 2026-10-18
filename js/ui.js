/**
 * UI Controller and Interactive Visualizer for CFG & PDA Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Module Initialization
  let grammarEngine = new GrammarEngine('full');
  let pdaSimulator = new PDASimulator(grammarEngine);
  const lexer = new Lexer();
  const treeBuilder = new ParseTreeBuilder();

  // Playback state
  let simulationSteps = [];
  let currentStepIdx = 0;
  let isPlaying = false;
  let playTimer = null;
  let playSpeed = 600; // ms

  // History state
  let sessionHistory = [];

  // DOM Elements
  const codeEditor = document.getElementById('codeEditor');
  const checkBtn = document.getElementById('checkBtn');
  const clearBtn = document.getElementById('clearBtn');
  const tokensContainer = document.getElementById('tokensContainer');
  const presetSelect = document.getElementById('presetSelect');
  const grammarModeSelect = document.getElementById('grammarModeSelect');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Grammar Elements
  const naturalRulesList = document.getElementById('naturalRulesList');
  const ll1RulesList = document.getElementById('ll1RulesList');
  const grammarBadge = document.getElementById('grammarBadge');

  // Status Elements
  const statusBanner = document.getElementById('statusBanner');
  const statusIcon = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusMsg = document.getElementById('statusMsg');
  const statusSuggestion = document.getElementById('statusSuggestion');

  // PDA Elements
  const btnStart = document.getElementById('btnStart');
  const btnPrev = document.getElementById('btnPrev');
  const btnPlay = document.getElementById('btnPlay');
  const btnNext = document.getElementById('btnNext');
  const btnEnd = document.getElementById('btnEnd');
  const stepCounter = document.getElementById('stepCounter');
  const speedSlider = document.getElementById('speedSlider');
  const speedVal = document.getElementById('speedVal');
  const stackContainer = document.getElementById('stackContainer');
  const tapeCells = document.getElementById('tapeCells');
  const stateBadge = document.getElementById('stateBadge');
  const actionBadge = document.getElementById('actionBadge');
  const stepRule = document.getElementById('stepRule');
  const stepDescription = document.getElementById('stepDescription');
  const traceLogCount = document.getElementById('traceLogCount');
  const traceTableBody = document.getElementById('traceTableBody');

  // Parse Tree Elements
  const parseTreeWrapper = document.getElementById('parseTreeWrapper');
  const derivationStepsBox = document.getElementById('derivationStepsBox');

  // Test Suite Elements
  const runAllTestsBtn = document.getElementById('runAllTestsBtn');
  const testSuiteTableBody = document.getElementById('testSuiteTableBody');

  // History Elements
  const historyListContainer = document.getElementById('historyListContainer');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // 2. Setup Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 3. Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    const curTheme = document.body.getAttribute('data-theme') || 'dark';
    const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', nextTheme);
  });

  // 4. Grammar Display Updater
  function updateGrammarDisplay() {
    naturalRulesList.innerHTML = grammarEngine.naturalGrammar
      .map(r => `<div class="rule-item">${escapeHtml(r)}</div>`)
      .join('');

    ll1RulesList.innerHTML = grammarEngine.productions
      .map(p => `<div class="rule-item">${p.ruleNumber}. ${escapeHtml(p.toString())}</div>`)
      .join('');

    grammarBadge.textContent = grammarEngine.type === 'full' ? 'Extended (Statements + Expressions)' : 'Pure Arithmetic';
  }

  // 5. Token Stream Renderer
  function renderTokens(tokens) {
    tokensContainer.innerHTML = '';
    for (const tok of tokens) {
      if (tok.type === TokenType.EOF) continue;

      let badgeClass = 'tok-IDENTIFIER';
      if (tok.type === TokenType.NUMBER) badgeClass = 'tok-NUMBER';
      else if (tok.type === TokenType.INVALID) badgeClass = 'tok-INVALID';
      else if (tok.type === TokenType.LPAREN || tok.type === TokenType.RPAREN) badgeClass = 'tok-PAREN';
      else if ([TokenType.PLUS, TokenType.MINUS, TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.CARET, TokenType.ASSIGN].includes(tok.type)) {
        badgeClass = 'tok-OP';
      }

      const span = document.createElement('span');
      span.className = `token-badge ${badgeClass}`;
      span.title = `Type: ${tok.type} | Col: ${tok.startCol}-${tok.endCol}`;
      span.textContent = `${tok.value} [${tok.type.slice(0, 3)}]`;
      tokensContainer.appendChild(span);
    }
  }

  // 6. Main Analyze / Parse Execution
  function executeAnalysis(shouldAutoPlay = false) {
    pausePlayback();
    const input = codeEditor.value.trim();

    if (!input) {
      statusBanner.className = 'status-banner invalid';
      statusIcon.textContent = '⚠️';
      statusTitle.textContent = 'Empty Input';
      statusMsg.textContent = 'Please enter an arithmetic expression or assignment statement.';
      statusSuggestion.style.display = 'none';
      tokensContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No tokens</span>';
      return;
    }

    // Module 1: Tokenize
    const lexResult = lexer.tokenize(input);
    renderTokens(lexResult.tokens);

    // Module 3: PDA Simulation
    const pdaResult = pdaSimulator.simulate(lexResult);
    simulationSteps = pdaSimulator.steps;

    // Module 4: Error Handling & Status Banner
    if (pdaResult.isValid) {
      statusBanner.className = 'status-banner valid';
      statusIcon.textContent = '✓';
      statusTitle.textContent = 'Syntax is valid! Accepted by PDA.';
      statusMsg.textContent = `Successfully verified against CFG rules. PDA accepted via final state & empty stack after ${simulationSteps.length} transitions.`;
      statusSuggestion.style.display = 'none';
    } else {
      const err = pdaResult.error || { message: 'Syntax error detected', col: 1 };
      statusBanner.className = 'status-banner invalid';
      statusIcon.textContent = '✕';
      statusTitle.textContent = `Syntax Error: ${err.type || 'Invalid Syntax'}`;
      statusMsg.textContent = `${err.message} (Line ${err.line || 1}, Column ${err.col || 1})`;
      if (err.suggestion) {
        statusSuggestion.style.display = 'block';
        statusSuggestion.innerHTML = `<strong>💡 Suggestion:</strong> ${escapeHtml(err.suggestion)}`;
      } else {
        statusSuggestion.style.display = 'none';
      }
    }

    // Module 5: Populate Trace Log Table
    traceLogCount.textContent = simulationSteps.length;
    traceTableBody.innerHTML = simulationSteps.map(s => {
      const isErr = s.action === 'ERROR';
      const isAcc = s.action === 'ACCEPT';
      const rowStyle = isErr ? 'color: #f87171;' : (isAcc ? 'color: #34d399;' : '');
      return `<tr style="${rowStyle}">
        <td>${s.stepNumber}</td>
        <td>${s.state}</td>
        <td>[${s.stack.join(', ')}]</td>
        <td>${escapeHtml(s.currentToken.value)}</td>
        <td>${s.action}</td>
      </tr>`;
    }).join('');

    // Module 2: Parse Tree & Leftmost Derivation
    if (pdaResult.parseTree) {
      const svg = treeBuilder.renderSVG(pdaResult.parseTree, 780);
      parseTreeWrapper.innerHTML = svg;
    } else {
      parseTreeWrapper.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Parse tree unavailable due to syntax errors.</div>';
    }

    if (pdaResult.derivationSteps && pdaResult.derivationSteps.length > 0) {
      derivationStepsBox.innerHTML = pdaResult.derivationSteps.map((step, idx) => {
        return `<div class="rule-item"><strong>Step ${idx}:</strong> ${step.join(' ') || 'ε'}</div>`;
      }).join('');
    } else {
      derivationStepsBox.innerHTML = '<div style="color: var(--text-muted);">Derivation stopped due to error.</div>';
    }

    // Add to Session History
    addToHistory(input, pdaResult.isValid, simulationSteps.length);

    // Initialize PDA playback at Step 0
    currentStepIdx = 0;
    renderStep(currentStepIdx);

    if (shouldAutoPlay) {
      startPlayback();
    }
  }

  // 7. Render Specific PDA Step
  function renderStep(idx) {
    if (!simulationSteps || simulationSteps.length === 0) return;
    if (idx < 0) idx = 0;
    if (idx >= simulationSteps.length) idx = simulationSteps.length - 1;
    currentStepIdx = idx;

    const step = simulationSteps[currentStepIdx];

    // Counter
    stepCounter.textContent = `Step ${step.stepNumber} / ${simulationSteps.length - 1}`;

    // State Badge
    stateBadge.textContent = `State: ${step.state}`;
    stateBadge.className = `state-badge state-${step.state}`;

    // Action Badge
    actionBadge.textContent = step.action;

    // Rule & Description
    stepRule.textContent = step.rule;
    stepDescription.textContent = step.description;

    // Render Tape
    renderTape(step);

    // Render Stack
    renderStack(step);

    // Update buttons
    btnPrev.disabled = (currentStepIdx === 0);
    btnStart.disabled = (currentStepIdx === 0);
    btnNext.disabled = (currentStepIdx === simulationSteps.length - 1);
    btnEnd.disabled = (currentStepIdx === simulationSteps.length - 1);
  }

  // 8. Visual Stack Renderer
  function renderStack(step) {
    stackContainer.innerHTML = '';
    const stackItems = step.stack;

    for (let i = 0; i < stackItems.length; i++) {
      const item = stackItems[i];
      const div = document.createElement('div');
      div.className = 'stack-item';
      div.textContent = item;

      if (i === 0 && item === 'Z0') {
        div.classList.add('bottom-marker');
      }
      if (i === stackItems.length - 1) {
        div.classList.add('top-marker');
        div.title = 'Top of Stack';
      }

      stackContainer.appendChild(div);
    }
  }

  // 9. Input Tape Renderer
  function renderTape(step) {
    tapeCells.innerHTML = '';
    const tokens = pdaSimulator.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const cell = document.createElement('div');
      cell.className = 'tape-cell';
      cell.textContent = tok.value;

      if (i === step.readHead) {
        cell.classList.add('active');
        cell.title = 'Current Read Head Lookahead';
      } else if (i < step.readHead) {
        cell.classList.add('consumed');
        cell.title = 'Consumed Token';
      }

      tapeCells.appendChild(cell);
    }
  }

  // 10. Playback Controls
  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    btnPlay.textContent = '⏸ Pause';
    btnPlay.style.background = 'var(--accent-amber)';

    playTimer = setInterval(() => {
      if (currentStepIdx < simulationSteps.length - 1) {
        currentStepIdx++;
        renderStep(currentStepIdx);
      } else {
        pausePlayback();
      }
    }, playSpeed);
  }

  function pausePlayback() {
    isPlaying = false;
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    btnPlay.textContent = '▶ Play';
    btnPlay.style.background = 'var(--accent-blue)';
  }

  btnPlay.addEventListener('click', () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      if (currentStepIdx >= simulationSteps.length - 1) {
        currentStepIdx = 0;
        renderStep(0);
      }
      startPlayback();
    }
  });

  btnNext.addEventListener('click', () => {
    pausePlayback();
    if (currentStepIdx < simulationSteps.length - 1) {
      currentStepIdx++;
      renderStep(currentStepIdx);
    }
  });

  btnPrev.addEventListener('click', () => {
    pausePlayback();
    if (currentStepIdx > 0) {
      currentStepIdx--;
      renderStep(currentStepIdx);
    }
  });

  btnStart.addEventListener('click', () => {
    pausePlayback();
    currentStepIdx = 0;
    renderStep(0);
  });

  btnEnd.addEventListener('click', () => {
    pausePlayback();
    currentStepIdx = simulationSteps.length - 1;
    renderStep(currentStepIdx);
  });

  speedSlider.addEventListener('input', (e) => {
    playSpeed = parseInt(e.target.value, 10);
    speedVal.textContent = `${playSpeed}ms`;
    if (isPlaying) {
      pausePlayback();
      startPlayback();
    }
  });

  // 11. Presets and Grammar Selection
  presetSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      codeEditor.value = e.target.value;
      executeAnalysis(false);
    }
  });

  grammarModeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    grammarEngine = new GrammarEngine(mode);
    pdaSimulator = new PDASimulator(grammarEngine);
    updateGrammarDisplay();
    executeAnalysis(false);
  });

  checkBtn.addEventListener('click', () => {
    executeAnalysis(false);
  });

  // Live Tokenization on user typing
  codeEditor.addEventListener('input', () => {
    const val = codeEditor.value.trim();
    if (val) {
      const lexRes = lexer.tokenize(val);
      renderTokens(lexRes.tokens);
    } else {
      tokensContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No tokens</span>';
    }
  });

  // Press Enter to submit
  codeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeAnalysis(false);
    }
  });

  // Quick Example Chips
  document.querySelectorAll('.quick-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (val) {
        codeEditor.value = val;
        executeAnalysis(false);
      }
    });
  });

  clearBtn.addEventListener('click', () => {
    codeEditor.value = '';
    tokensContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No tokens</span>';
    statusBanner.className = 'status-banner';
    statusIcon.textContent = 'ℹ️';
    statusTitle.textContent = 'Input Cleared';
    statusMsg.textContent = 'Enter an arithmetic expression or assignment above to check syntax.';
    statusSuggestion.style.display = 'none';
    codeEditor.focus();
  });

  // 12. Module 6: Automated Test Suite Runner
  const prebuiltTests = [
    { expr: "a + b * c", expect: true, cat: "Arithmetic Precedence" },
    { expr: "(a + b) * c", expect: true, cat: "Parenthesized Expr" },
    { expr: "x = a + b * c", expect: true, cat: "Variable Assignment" },
    { expr: "res = (10 + 20) / (var_a - 4)", expect: true, cat: "Complex Nested Expr" },
    { expr: "count = count + 1", expect: true, cat: "Self Assignment" },
    { expr: "42", expect: true, cat: "Single Number" },
    { expr: "my_var", expect: true, cat: "Single Identifier" },
    { expr: "a + * b", expect: false, cat: "Consecutive Operators" },
    { expr: "a + (b * c", expect: false, cat: "Missing Closing Paren" },
    { expr: "a + b)", expect: false, cat: "Unexpected Closing Paren" },
    { expr: "x =", expect: false, cat: "Incomplete Assignment" },
    { expr: "a + b +", expect: false, cat: "Trailing Operator" },
    { expr: "a b + c", expect: false, cat: "Missing Operator" },
    { expr: "a + @b", expect: false, cat: "Lexical Error" },
    { expr: "123abc + 5", expect: false, cat: "Malformed Identifier" }
  ];

  function runTestSuite() {
    testSuiteTableBody.innerHTML = '';
    let passedCount = 0;

    for (const test of prebuiltTests) {
      const lexRes = lexer.tokenize(test.expr);
      const res = pdaSimulator.simulate(lexRes);
      const isPassed = (res.isValid === test.expect);
      if (isPassed) passedCount++;

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Click to load into editor';
      tr.addEventListener('click', () => {
        codeEditor.value = test.expr;
        document.querySelector('[data-tab="pdaTab"]').click();
        executeAnalysis(false);
      });

      tr.innerHTML = `
        <td><code>${escapeHtml(test.expr)}</code></td>
        <td>${test.cat}</td>
        <td>${test.expect ? 'Valid' : 'Invalid'}</td>
        <td>${res.isValid ? 'Valid' : 'Invalid'}</td>
        <td>${pdaSimulator.steps.length}</td>
        <td><span class="${isPassed ? 'badge-pass' : 'badge-fail'}">${isPassed ? 'PASS' : 'FAIL'}</span></td>
      `;
      testSuiteTableBody.appendChild(tr);
    }
  }

  runAllTestsBtn.addEventListener('click', runTestSuite);

  // 13. Module 6: History Tracking
  function addToHistory(expr, isValid, stepsCount) {
    const timeStr = new Date().toLocaleTimeString();
    sessionHistory.unshift({ expr, isValid, stepsCount, timeStr });
    if (sessionHistory.length > 20) sessionHistory.pop();
    renderHistory();
  }

  function renderHistory() {
    if (sessionHistory.length === 0) {
      historyListContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No recent checks in this session.</div>';
      return;
    }

    historyListContainer.innerHTML = sessionHistory.map((item, idx) => {
      const statusColor = item.isValid ? '#34d399' : '#f87171';
      const statusText = item.isValid ? 'VALID' : 'INVALID';
      return `
        <div class="history-item" data-idx="${idx}">
          <div>
            <strong style="font-family: var(--font-mono);">${escapeHtml(item.expr)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.timeStr} • ${item.stepsCount} PDA steps</div>
          </div>
          <span style="font-weight: 700; font-size: 0.8rem; color: ${statusColor};">${statusText}</span>
        </div>
      `;
    }).join('');

    // Attach click listeners to history items
    const items = historyListContainer.querySelectorAll('.history-item');
    items.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        const record = sessionHistory[idx];
        if (record) {
          codeEditor.value = record.expr;
          document.querySelector('[data-tab="pdaTab"]').click();
          executeAnalysis(false);
        }
      });
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    sessionHistory = [];
    renderHistory();
  });

  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial Load
  updateGrammarDisplay();
  executeAnalysis(false);
  runTestSuite();
  renderHistory();
});
