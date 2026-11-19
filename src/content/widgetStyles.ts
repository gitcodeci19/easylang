export const WIDGET_CSS = `
:host {
  all: initial;
}

*, *::before, *::after {
  box-sizing: border-box;
}

.etr-wrap {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 2147483647;
  width: 376px;
  max-width: calc(100vw - 28px);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #f4f4f6;
  -webkit-font-smoothing: antialiased;
  animation: etr-slide-in 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes etr-slide-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.etr-card {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 28px);
  background: #111117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  padding: 12px 14px;
  overflow: hidden;
}

.etr-lower-stage::-webkit-scrollbar,
.etr-teach-text::-webkit-scrollbar,
.etr-ask-output::-webkit-scrollbar {
  width: 5px;
}

.etr-lower-stage::-webkit-scrollbar-track,
.etr-teach-text::-webkit-scrollbar-track,
.etr-ask-output::-webkit-scrollbar-track {
  background: transparent;
}

.etr-lower-stage::-webkit-scrollbar-thumb,
.etr-teach-text::-webkit-scrollbar-thumb,
.etr-ask-output::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}

.etr-header,
.etr-prompt-row,
.etr-card > .etr-en,
.etr-phonetic,
.etr-form,
.etr-feedback-box,
.etr-outcome-footer {
  flex-shrink: 0;
}

.etr-lower-stage {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

.etr-lower-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.etr-lower-details[hidden],
.etr-teach-host-outcome[hidden],
.etr-teach-host-question[hidden],
.etr-teach-grid[hidden],
.tm-branch-slot[hidden],
.tm-picker-section[hidden] {
  display: none !important;
}

.etr-teach-host-question {
  margin-top: 8px;
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.etr-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #8b5cf6;
}

.etr-card.state-correct {
  border-color: rgba(16, 185, 129, 0.34);
}

.etr-card.state-correct::before {
  background: #10b981;
}

.etr-card.state-wrong {
  border-color: rgba(225, 29, 72, 0.36);
}

.etr-card.state-wrong::before {
  background: #e11d48;
}

.etr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
}

.etr-badges {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.etr-badge {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 5px;
  background: #1a1a23;
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: #a1a1b2;
  letter-spacing: 0.03em;
}

.etr-badge.retry,
.etr-badge.focus {
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.3);
}

.etr-badge.ai {
  background: rgba(14, 165, 233, 0.12);
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.32);
}

.etr-badge.correct {
  background: rgba(16, 185, 129, 0.13);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.32);
}

.etr-badge.wrong {
  background: rgba(225, 29, 72, 0.14);
  color: #fb7185;
  border-color: rgba(225, 29, 72, 0.34);
}

.etr-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.etr-icon-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: #181821;
  color: #a8a8b8;
  border-radius: 6px;
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}

.etr-icon-btn:hover {
  background: #22222e;
  color: #f4f4f6;
  border-color: rgba(255, 255, 255, 0.18);
}

.etr-close-btn {
  padding: 0;
  width: 24px;
  background: rgba(225, 29, 72, 0.12);
  border-color: rgba(244, 63, 94, 0.32);
  color: #fda4af;
}

.etr-close-btn:hover {
  background: rgba(225, 29, 72, 0.3);
  border-color: #fb7185;
  color: #ffffff;
}

.etr-prompt-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
  min-width: 0;
}

.etr-prompt-row > .etr-en {
  flex: 1 1 auto;
  min-width: 0;
}

.etr-prompt-row > .etr-icon-btn {
  flex-shrink: 0;
}

.etr-en {
  font-size: 16.5px;
  font-weight: 700;
  line-height: 1.32;
  letter-spacing: -0.012em;
  color: #f8f8fa;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: break-word;
}

.etr-en.is-sentence {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.44;
}

mark.etr-rule-glow {
  display: inline;
  padding: 1px 5px;
  margin: 0 -1px;
  border-radius: 5px;
  background: rgba(16, 185, 129, 0.22);
  color: #6ee7b7;
  box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.5), 0 0 14px rgba(16, 185, 129, 0.35);
  animation: etr-rule-glow-pulse 1.8s ease-in-out infinite;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

@keyframes etr-rule-glow-pulse {
  0%, 100% {
    background: rgba(16, 185, 129, 0.2);
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.48), 0 0 10px rgba(16, 185, 129, 0.28);
  }
  50% {
    background: rgba(16, 185, 129, 0.34);
    box-shadow: 0 0 0 1.5px rgba(52, 211, 153, 0.85), 0 0 18px rgba(16, 185, 129, 0.55);
  }
}

.etr-phonetic {
  font-size: 11px;
  color: #7c7c8e;
  margin-bottom: 6px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
}

.etr-form {
  margin-top: 8px;
}

.etr-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #0c0c11;
  color: #f4f4f6;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.14s, box-shadow 0.14s;
}

.etr-input::placeholder {
  color: #6b6b7d;
}

.etr-input:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.22);
}

.etr-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.etr-outcome-footer {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.etr-outcome-secondary {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.etr-outcome-footer .etr-btn-next {
  margin-left: auto;
}

.etr-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.08s;
}

.etr-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.etr-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.etr-btn-primary,
.etr-btn-next {
  background: #7c3aed;
  color: #ffffff;
  border-color: rgba(196, 181, 253, 0.28);
  font-weight: 700;
  padding: 0 12px;
}

.etr-btn-primary:hover:not(:disabled),
.etr-btn-next:hover:not(:disabled) {
  background: #8b5cf6;
}

.etr-btn-secondary,
.etr-btn-ghost {
  background: #181821;
  border-color: rgba(255, 255, 255, 0.09);
  color: #a4a4b4;
  height: 26px;
  padding: 0 8px;
  font-size: 10.5px;
}

.etr-btn-secondary:hover:not(:disabled),
.etr-btn-ghost:hover:not(:disabled) {
  color: #f4f4f6;
  background: #22222e;
  border-color: rgba(255, 255, 255, 0.18);
}

/* Semantic tool buttons: Emerald = Teach Me, Sky = Ask AI, Amber = Flag/Focus */
.etr-btn-teach {
  position: relative;
  overflow: hidden;
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.34);
  color: #6ee7b7;
  height: 26px;
  padding: 0 8px;
  font-size: 10.5px;
  font-weight: 700;
}

.etr-btn-teach:hover:not(:disabled),
.etr-btn-teach.is-open {
  background: rgba(16, 185, 129, 0.24);
  border-color: #34d399;
  color: #ecfdf5;
}

/* Shimmer + luminous pulse ONLY when 2+ substantive grammar voiceovers exist */
.etr-btn-teach.is-glow:not(.is-open) {
  background: rgba(16, 185, 129, 0.18);
  border-color: #34d399;
  color: #d1fae5;
  animation: etr-teach-glow 2.1s ease-in-out infinite;
}

.etr-btn-teach.is-glow:not(.is-open)::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: -75%;
  width: 55%;
  background: linear-gradient(90deg, transparent, rgba(167, 243, 208, 0.36), transparent);
  transform: skewX(-20deg);
  animation: etr-teach-sweep 2.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes etr-teach-glow {
  0%, 100% {
    box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.28), 0 0 8px rgba(16, 185, 129, 0.26);
  }
  50% {
    box-shadow: 0 0 0 1.5px rgba(110, 231, 183, 0.62), 0 0 16px rgba(16, 185, 129, 0.56);
  }
}

@keyframes etr-teach-sweep {
  0% {
    left: -75%;
  }
  45%, 100% {
    left: 135%;
  }
}

.etr-btn-ai {
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.34);
  color: #7dd3fc;
  height: 26px;
  padding: 0 8px;
  font-size: 10.5px;
  font-weight: 700;
}

.etr-btn-ai:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.2);
  border-color: #38bdf8;
  color: #f0f9ff;
}

.etr-btn-ai-solid {
  background: #0284c7;
  border-color: rgba(125, 211, 252, 0.32);
  color: #ffffff;
  height: 27px;
  padding: 0 11px;
  font-size: 11px;
  font-weight: 700;
}

.etr-btn-ai-solid:hover:not(:disabled) {
  background: #0ea5e9;
}

.etr-btn-flag {
  background: rgba(245, 158, 11, 0.09);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fcd34d;
  height: 26px;
  padding: 0 8px;
  font-size: 10.5px;
  font-weight: 700;
}

.etr-btn-flag:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.18);
  border-color: #fbbf24;
  color: #fffbeb;
}

.etr-btn-flag-solid {
  background: #d97706;
  border-color: rgba(253, 224, 71, 0.28);
  color: #ffffff;
  height: 27px;
  padding: 0 11px;
  font-size: 11px;
  font-weight: 700;
}

.etr-btn-flag-solid:hover:not(:disabled) {
  background: #f59e0b;
  color: #111117;
}

/* Compact, Scannable Outcome Bubbles (Left-bar semantics — zero color soup) */
.etr-feedback-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.42;
}

.etr-bubble {
  border-radius: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left-width: 3px;
  background: #171720;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.etr-bubble-label {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.etr-bubble-bad {
  background: rgba(225, 29, 72, 0.09);
  border-color: rgba(225, 29, 72, 0.22);
  border-left-color: #e11d48;
  color: #ffe4e6;
}

.etr-bubble-bad .etr-bubble-label {
  color: #fb7185;
}

.etr-bubble-good {
  background: rgba(16, 185, 129, 0.09);
  border-color: rgba(16, 185, 129, 0.24);
  border-left-color: #10b981;
  color: #ecfdf5;
  font-weight: 600;
}

.etr-bubble-good .etr-bubble-label {
  color: #34d399;
}

/* Neutral reference box for Accepted Meanings when answer is already correct */
.etr-bubble-ref {
  background: #16161f;
  border-color: rgba(255, 255, 255, 0.08);
  border-left-color: rgba(255, 255, 255, 0.22);
  color: #e4e4ec;
}

.etr-bubble-ref .etr-bubble-label {
  color: #8e8ea2;
}

.etr-bubble-ai {
  background: rgba(14, 165, 233, 0.09);
  border-color: rgba(14, 165, 233, 0.24);
  border-left-color: #0ea5e9;
  color: #e0f2fe;
}

.etr-bubble-ai .etr-bubble-label {
  color: #38bdf8;
}

.etr-bubble-muted {
  background: #15151d;
  border-color: rgba(255, 255, 255, 0.07);
  border-left-color: rgba(255, 255, 255, 0.16);
  color: #a8a8b8;
  font-size: 11.5px;
}

.etr-bubble-muted .etr-bubble-label {
  color: #7c7c8e;
}

.etr-label {
  color: #8a8a9c;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: block;
}

.etr-answer-good {
  color: #ecfdf5;
  font-weight: 600;
}

.etr-answer-bad {
  color: #ffe4e6;
}

.etr-example {
  padding: 6px 9px;
  border-radius: 7px;
  background: #15151e;
  border: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 11.5px;
  color: #d4d4df;
}

.etr-example-tr {
  color: #848496;
  font-size: 11px;
  margin-top: 2px;
}

.etr-repeat-note {
  margin-top: 7px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: #fcd34d;
  display: flex;
  align-items: center;
  gap: 5px;
}

.etr-repeat-note.ok {
  color: #6ee7b7;
}

/* Focus / Concept Card — Amber domain */
.etr-concept-box {
  margin-top: 7px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.24);
  border-left: 3px solid #f59e0b;
  font-size: 11.5px;
  line-height: 1.4;
  color: #f4f4f6;
}

.etr-concept-title {
  font-weight: 700;
  color: #fcd34d;
  margin-bottom: 2px;
}

.etr-concept-stage {
  margin-top: 4px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  color: #a4a4b4;
}

/* Inline Flag Panel (Amber) & Ask AI Panel (Sky) */
.etr-flag-panel {
  margin-top: 7px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #15151d;
  border: 1px solid rgba(245, 158, 11, 0.28);
}

.etr-token-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.etr-token-chip {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #1c1c26;
  color: #d8d8e4;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, color 0.12s;
}

.etr-token-chip:hover {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.etr-flag-row {
  display: flex;
  gap: 5px;
}

.etr-input-sm {
  flex: 1;
  min-width: 0;
  height: 27px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #0c0c11;
  color: #f4f4f6;
  font-family: inherit;
  font-size: 11.5px;
  outline: none;
}

.etr-input-sm:focus {
  border-color: #f59e0b;
}

.etr-ask-panel {
  border-color: rgba(14, 165, 233, 0.32);
}

.etr-ask-panel .etr-label {
  color: #7dd3fc;
}

.etr-ask-panel .etr-input-sm:focus {
  border-color: #0ea5e9;
}

.etr-ask-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 5px;
}

.etr-ask-output {
  margin-bottom: 6px;
  padding: 7px 9px;
  border-radius: 7px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.22);
  color: #e0f2fe;
  font-size: 11.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  max-height: 145px;
  overflow-y: auto;
}

/* Inline Teach Me Grammar Voice Coach — Matte Charcoal + Restrained Emerald Focus */
.etr-teach-panel {
  margin-top: 0;
  padding: 9px 10px;
  border-radius: 9px;
  background: #14151c;
  border: 1px solid rgba(16, 185, 129, 0.32);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.etr-teach-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.etr-teach-head {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #a7f3d0;
}

.etr-teach-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.etr-teach-help-btn {
  position: static;
  transform: none;
}

.etr-teach-close-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid rgba(244, 63, 94, 0.42);
  background: rgba(225, 29, 72, 0.16);
  color: #fecdd3;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.etr-teach-close-btn:hover {
  background: rgba(225, 29, 72, 0.34);
  border-color: #fb7185;
  color: #ffffff;
}

/* Branching connector tree: neutral at rest, Emerald ONLY on active branch */
.tm-branch-slot {
  margin-top: -3px;
  margin-bottom: -2px;
}

.tm-branch-tree {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.tm-branch-stem {
  width: 1.5px;
  height: 7px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.18);
}

.tm-branch-legs {
  display: grid;
  gap: 7px;
}

.tm-branch-leg {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tm-branch-leg::before {
  content: "";
  position: absolute;
  top: 0;
  left: -3.5px;
  right: -3.5px;
  height: 1.5px;
  background: rgba(255, 255, 255, 0.16);
}

.tm-branch-leg:first-child::before {
  left: 50%;
}

.tm-branch-leg:last-child::before {
  right: 50%;
}

.tm-branch-leg:only-child::before {
  display: none;
}

.tm-branch-drop {
  width: 1.5px;
  height: 7px;
  background: rgba(255, 255, 255, 0.18);
}

.tm-branch-arrow {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid rgba(255, 255, 255, 0.24);
}

.tm-branch-leg.is-active .tm-branch-drop {
  background: #10b981;
}

.tm-branch-leg.is-active .tm-branch-arrow {
  border-top-color: #10b981;
}

.etr-teach-grid {
  display: grid;
  gap: 7px;
}

.etr-teach-choice {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 7px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: #1a1b24;
  color: #c8c8d6;
  text-align: center;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.etr-teach-choice:hover {
  background: #21222e;
  border-color: rgba(16, 185, 129, 0.45);
  color: #ffffff;
  transform: translateY(-1px);
}

.etr-teach-choice.is-active {
  background: rgba(16, 185, 129, 0.14);
  border-color: #10b981;
  color: #ffffff;
}

.etr-teach-choice-title {
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.24;
}

.etr-teach-choice-cue {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9e9eb0;
}

.etr-teach-choice.is-active .etr-teach-choice-cue {
  background: #10b981;
  border-color: #34d399;
  color: #04241a;
  font-weight: 800;
}

.etr-teach-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.etr-teach-text {
  padding: 7px 9px;
  border-radius: 7px;
  background: #101117;
  border: 1px solid rgba(255, 255, 255, 0.06);
  max-height: 142px;
  overflow-y: auto;
}

.etr-teach-headline {
  font-size: 11.5px;
  font-weight: 700;
  color: #f4f4f6;
  margin-bottom: 3px;
}

.etr-teach-rule {
  font-size: 11px;
  line-height: 1.46;
  color: #c8c8d6;
  white-space: pre-line;
}

.tm-sync-word {
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -2px;
  transition: color 70ms ease, background-color 70ms ease, text-shadow 70ms ease;
}

.tm-sync-word.is-seekable {
  cursor: pointer;
}

.tm-sync-word.is-seekable:hover {
  background: rgba(255, 255, 255, 0.09);
  color: #ffffff;
}

.tm-sync-word.is-active {
  color: #ffffff;
  background: rgba(16, 185, 129, 0.28);
  text-shadow: 0 0 8px rgba(110, 231, 183, 0.42);
}

.tm-audio-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  background: #181922;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tm-audio-play-btn {
  appearance: none;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: none;
  background: #10b981;
  color: #04241a;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tm-audio-play-btn:hover {
  background: #34d399;
}

.tm-audio-mini-btn,
.tm-audio-speed-btn {
  appearance: none;
  height: 22px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #20212c;
  color: #d4d4df;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.tm-audio-mini-btn:hover,
.tm-audio-speed-btn:hover {
  border-color: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.tm-audio-time {
  flex-shrink: 0;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #a4a4b4;
}

.tm-audio-range {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 50px;
  height: 4px;
  margin: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  cursor: pointer;
}

.tm-audio-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #10b981;
  border: 2px solid #ffffff;
  cursor: pointer;
}

.etr-toast {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 2147483647;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #111117;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f4f4f6;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
  animation: etr-slide-in 0.16s ease-out;
}

/* Voice Guide Assistant: Quiet Neutral "?" at rest, Sky/Cyan while speaking */
.el-help-trigger {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(255, 255, 255, 0.05);
  color: #9898aa;
  font-family: inherit;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
}

.el-help-trigger.is-dot {
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.el-help-trigger:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.28);
  color: #ffffff;
}

.el-help-trigger.is-speaking {
  background: #0ea5e9;
  border-color: #7dd3fc;
  color: #041d2e;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25);
}

.el-guide-pill {
  position: absolute;
  top: 4px;
  right: calc(100% + 10px);
  z-index: 20;
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 9px 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(15, 16, 22, 0.96);
  backdrop-filter: blur(10px);
  color: #f0f9ff;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(14, 165, 233, 0.14);
  transition: transform 0.12s ease, border-color 0.12s ease;
  animation: etr-slide-in 0.16s ease-out;
}

.el-guide-pill[hidden] {
  display: none !important;
}

.el-guide-pill:hover {
  transform: translateY(-1px);
  border-color: #7dd3fc;
}

@media (max-width: 580px) {
  .el-guide-pill {
    right: 0;
    top: calc(100% + 8px);
  }
}

.el-guide-waves {
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
  height: 14px;
}

.el-guide-waves i {
  display: block;
  width: 2.5px;
  height: 5px;
  border-radius: 999px;
  background: #38bdf8;
}

.el-guide-pill.is-speaking .el-guide-waves i {
  animation: el-guide-wave 0.9s ease-in-out infinite;
}

.el-guide-pill.is-speaking .el-guide-waves i:nth-child(1) { animation-delay: 0s; }
.el-guide-pill.is-speaking .el-guide-waves i:nth-child(2) { animation-delay: 0.14s; }
.el-guide-pill.is-speaking .el-guide-waves i:nth-child(3) { animation-delay: 0.28s; }
.el-guide-pill.is-speaking .el-guide-waves i:nth-child(4) { animation-delay: 0.18s; }
.el-guide-pill.is-speaking .el-guide-waves i:nth-child(5) { animation-delay: 0.06s; }

@keyframes el-guide-wave {
  0%, 100% { height: 4px; opacity: 0.5; }
  50% { height: 13px; opacity: 1; }
}

.el-guide-pill-label {
  color: #f4f4f6;
}

.el-guide-pill-stop {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(225, 29, 72, 0.18);
  border: 1px solid rgba(244, 63, 94, 0.36);
  color: #fda4af;
  font-size: 9.5px;
  font-weight: 800;
}

.el-guide-pill:hover .el-guide-pill-stop {
  background: rgba(225, 29, 72, 0.32);
  color: #ffffff;
}

/* ==================== AI LIVE TEACHER (SARI TİK + İLKİZ) ==================== */
.etr-teach-group {
  display: inline-flex;
  align-items: stretch;
  gap: 3px;
}

.etr-ai-tick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 28px;
  padding: 0 7px;
  border-radius: 7px;
  border: 1px solid rgba(245, 158, 11, 0.42);
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
}

.etr-ai-tick-btn:hover {
  background: rgba(245, 158, 11, 0.22);
  border-color: #f59e0b;
  color: #fde68a;
  transform: translateY(-1px);
}

.etr-ai-tick-btn.is-active {
  background: linear-gradient(135deg, #f59e0b, #eab308);
  border-color: #fde047;
  color: #1c1304;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.45);
}

.etr-ai-tick-btn.is-in-head {
  height: 22px;
  padding: 0 7px;
  font-size: 10px;
}

.etr-ai-tick-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.etr-teach-panel.is-ai-mode {
  border-color: rgba(245, 158, 11, 0.36);
}

.etr-teach-panel.is-ai-mode .etr-teach-head {
  color: #fcd34d;
}

mark.etr-rule-glow.is-ai {
  background: rgba(245, 158, 11, 0.24);
  color: #fde68a;
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.55), 0 0 14px rgba(245, 158, 11, 0.38);
  animation: etr-rule-glow-ai 1.8s ease-in-out infinite;
}

@keyframes etr-rule-glow-ai {
  0%, 100% {
    background: rgba(245, 158, 11, 0.2);
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.5), 0 0 10px rgba(245, 158, 11, 0.3);
  }
  50% {
    background: rgba(245, 158, 11, 0.36);
    box-shadow: 0 0 0 1.5px rgba(251, 191, 36, 0.9), 0 0 18px rgba(245, 158, 11, 0.56);
  }
}

.ai-coach-panel {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ai-coach-audio-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ai-coach-audio-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ai-coach-voice-badge {
  font-size: 10.5px;
  font-weight: 700;
  color: #fcd34d;
}

.ai-coach-regen-btn {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.1);
  color: #fcd34d;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.ai-coach-regen-btn:hover {
  background: rgba(245, 158, 11, 0.22);
  color: #ffffff;
}

.tm-audio-bar.is-ai {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(245, 158, 11, 0.08);
}

.tm-audio-bar.is-ai .tm-audio-play-btn {
  background: #f59e0b;
  color: #1c1304;
}

.tm-audio-bar.is-ai .tm-audio-range {
  accent-color: #f59e0b;
}

.ai-coach-scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 176px;
  overflow-y: auto;
  padding-right: 2px;
}

.ai-coach-intro {
  margin: 0;
  font-size: 11px;
  line-height: 1.42;
  color: #e4e4ec;
}

.ai-coach-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-coach-item {
  padding: 7px 9px;
  border-radius: 8px;
  background: #101117;
  border: 1px solid rgba(255, 255, 255, 0.07);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.ai-coach-item:hover {
  border-color: rgba(245, 158, 11, 0.42);
}

.ai-coach-item.is-focused {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.ai-coach-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}

.ai-coach-item-title {
  font-size: 11px;
  font-weight: 800;
  color: #fde68a;
}

.ai-coach-focus-pill {
  padding: 1px 6px;
  border-radius: 5px;
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.42);
  color: #fde68a;
  font-size: 10px;
  font-weight: 700;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
}

.ai-coach-item-exp {
  margin: 0 0 5px 0;
  font-size: 11px;
  line-height: 1.44;
  color: #d4d4e0;
}

.ai-coach-examples {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.ai-coach-ex-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ai-coach-ex-en-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ai-coach-ex-en {
  font-size: 11px;
  font-weight: 700;
  color: #f4f4f6;
}

.ai-coach-ex-speak {
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #e4e4ec;
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
}

.ai-coach-ex-speak:hover {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.14);
}

.ai-coach-ex-tr {
  font-size: 10.5px;
  color: #9e9eb0;
}

.ai-coach-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 14px 10px;
  border-radius: 8px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.25);
  text-align: center;
}

.ai-coach-state.is-error {
  background: rgba(225, 29, 72, 0.08);
  border-color: rgba(244, 63, 94, 0.35);
}

.ai-coach-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(245, 158, 11, 0.25);
  border-top-color: #f59e0b;
  animation: ai-coach-spin 0.8s linear infinite;
}

@keyframes ai-coach-spin {
  to { transform: rotate(360deg); }
}

.ai-coach-state-title {
  font-size: 11.5px;
  font-weight: 700;
  color: #fde68a;
}

.ai-coach-state.is-error .ai-coach-state-title {
  color: #fda4af;
}

.ai-coach-state-sub {
  font-size: 10.5px;
  line-height: 1.4;
  color: #b4b4c4;
}

.tm-branch-tree.is-ai .tm-branch-leg.is-active .tm-branch-drop {
  background: #f59e0b;
}

.tm-branch-tree.is-ai .tm-branch-leg.is-active .tm-branch-arrow {
  border-top-color: #f59e0b;
}

.ai-coach-choice-grid {
  display: grid;
  gap: 7px;
}

.ai-coach-choice {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 7px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: #1a1b24;
  color: #c8c8d6;
  text-align: center;
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.ai-coach-choice:hover {
  background: #221f1a;
  border-color: rgba(245, 158, 11, 0.5);
  color: #ffffff;
  transform: translateY(-1px);
}

.ai-coach-choice.is-active {
  background: rgba(245, 158, 11, 0.14);
  border-color: #f59e0b;
  color: #ffffff;
}

.ai-coach-choice-title {
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.24;
}

.ai-coach-choice-cue {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9e9eb0;
}

.ai-coach-choice.is-active .ai-coach-choice-cue {
  background: #f59e0b;
  border-color: #fbbf24;
  color: #1c1304;
  font-weight: 800;
}

.ai-coach-detail-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tm-sync-word.is-ai-word.is-active {
  background: rgba(245, 158, 11, 0.28);
  color: #fef08a;
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.5);
}
`;
