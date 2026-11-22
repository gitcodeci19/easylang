import type { UiThemeMode } from '../shared/types';

export const WIDGET_DARK_CSS = `
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
  z-index: 2147483645;
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
  background: #151820;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 15px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.56);
  padding: 14px 16px;
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
  background: #6366f1;
}

.etr-card.state-correct {
  border-color: rgba(52, 211, 153, 0.3);
}

.etr-card.state-correct::before {
  background: #10b981;
}

.etr-card.state-wrong {
  border-color: rgba(248, 113, 113, 0.3);
}

.etr-card.state-wrong::before {
  background: #e05263;
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
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #9ba3b5;
  letter-spacing: 0.02em;
}

.etr-badge.retry,
.etr-badge.focus,
.etr-badge.ai {
  background: rgba(99, 102, 241, 0.12);
  color: #c7d2fe;
  border-color: rgba(129, 140, 248, 0.28);
}

.etr-badge.correct {
  background: rgba(16, 185, 129, 0.11);
  color: #6ee7b7;
  border-color: rgba(52, 211, 153, 0.28);
}

.etr-badge.wrong {
  background: rgba(224, 82, 99, 0.11);
  color: #fda4af;
  border-color: rgba(248, 113, 113, 0.28);
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
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #111318;
  color: #edf0f5;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.14s, box-shadow 0.14s;
}

.etr-input::placeholder {
  color: #6c7386;
}

.etr-input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
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
  background: #6366f1;
  color: #ffffff;
  border-color: transparent;
  border-radius: 9px;
  height: 30px;
  font-weight: 700;
  padding: 0 14px;
}

.etr-btn-primary:hover:not(:disabled),
.etr-btn-next:hover:not(:disabled) {
  background: #7376f7;
}

.etr-btn-secondary,
.etr-btn-ghost {
  background: rgba(255, 255, 255, 0.055);
  border-color: rgba(255, 255, 255, 0.09);
  border-radius: 9px;
  color: #cbd2e1;
  height: 30px;
  padding: 0 10px;
  font-size: 11px;
}

.etr-btn-secondary:hover:not(:disabled),
.etr-btn-ghost:hover:not(:disabled) {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.16);
}

/* Unified calm mobile secondary button style (no rainbow button borders or green neon glow) */
.etr-btn-teach,
.etr-btn-teach.is-glow:not(.is-open),
.etr-btn-ai,
.etr-btn-flag {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.055);
  border-color: rgba(255, 255, 255, 0.09);
  border-radius: 9px;
  color: #cbd2e1;
  height: 30px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  box-shadow: none;
  animation: none;
}

.etr-btn-teach.is-glow:not(.is-open)::after {
  display: none;
}

.etr-btn-teach:hover:not(:disabled),
.etr-btn-teach.is-open,
.etr-btn-ai:hover:not(:disabled),
.etr-btn-flag:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.16);
  color: #f8fafc;
}

.etr-btn-ai-solid {
  background: #6366f1;
  border-color: transparent;
  border-radius: 9px;
  color: #ffffff;
  height: 29px;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 700;
}

.etr-btn-ai-solid:hover:not(:disabled) {
  background: #7376f7;
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

.etr-ans-primary {
  font-size: 13px;
  font-weight: 650;
  line-height: 1.42;
}

.etr-meaning-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.etr-meaning-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #d4d4e2;
}

.etr-bubble-good .etr-meaning-chip {
  background: rgba(16, 185, 129, 0.14);
  border-color: rgba(52, 211, 153, 0.3);
  color: #a7f3d0;
}

.etr-alt-block {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.etr-bubble-good .etr-alt-block {
  border-top-color: rgba(52, 211, 153, 0.24);
}

.etr-alt-label {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  color: #8e8ea2;
}

.etr-bubble-good .etr-alt-label {
  color: rgba(110, 231, 183, 0.78);
}

.etr-alt-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.etr-alt-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.8px;
  font-weight: 500;
  line-height: 1.38;
  color: #c7d2d9;
}

.etr-bubble-good .etr-alt-item {
  color: rgba(236, 253, 245, 0.82);
}

.etr-alt-dot {
  flex-shrink: 0;
  opacity: 0.65;
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

.tm-audio-bar.is-ai.is-synthesizing {
  border-color: transparent;
  background:
    linear-gradient(#151520, #151520) padding-box,
    linear-gradient(
      90deg,
      #ff3b5c,
      #ff9f1c,
      #ffd60a,
      #22c55e,
      #06b6d4,
      #6366f1,
      #ec4899,
      #ff3b5c
    ) border-box;
  background-size: 100% 100%, 200% 100%;
  animation: ai-rainbow-border 2.6s linear infinite;
  box-shadow:
    0 0 14px rgba(168, 85, 247, 0.2),
    inset 0 0 12px rgba(6, 182, 212, 0.08);
}

.tm-audio-bar.is-ai.is-synthesizing .tm-audio-play-btn {
  background: linear-gradient(135deg, #ff3b5c, #ff9f1c, #22c55e, #06b6d4, #8b5cf6, #ec4899);
  background-size: 220% 220%;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  animation: ai-rainbow-btn 2.4s ease infinite;
  cursor: wait;
}

.tm-audio-bar.is-ai.is-synthesizing .tm-audio-mini-btn {
  opacity: 0.42;
  cursor: wait;
}

.tm-audio-bar.is-ai.is-synthesizing .tm-audio-range,
.tm-audio-bar.is-ai.is-synthesizing .tm-audio-time {
  display: none;
}

.ai-coach-synth-wave {
  display: none;
  flex: 1;
  min-width: 0;
  height: 22px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-right: 8px;
  overflow: hidden;
}

.tm-audio-bar.is-ai.is-synthesizing .ai-coach-synth-wave {
  display: flex;
}

.ai-coach-wave-group {
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
  height: 18px;
  flex-shrink: 0;
  animation: ai-rainbow-hue 4.5s linear infinite;
}

.ai-coach-wave-bar {
  display: block;
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
  transform-origin: center;
  will-change: transform, opacity;
  animation: ai-rainbow-wave 1.05s ease-in-out infinite;
}

.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(1) { color: #ff3b5c; --wave-peak: 0.42; animation-delay: -1.40s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(2) { color: #ff6b35; --wave-peak: 0.72; animation-delay: -1.29s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(3) { color: #ff9f1c; --wave-peak: 0.96; animation-delay: -1.18s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(4) { color: #ffd60a; --wave-peak: 0.64; animation-delay: -1.07s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(5) { color: #84cc16; --wave-peak: 1.00; animation-delay: -0.96s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(6) { color: #22c55e; --wave-peak: 0.80; animation-delay: -0.85s; }
.ai-coach-wave-group.is-left .ai-coach-wave-bar:nth-child(7) { color: #14b8a6; --wave-peak: 0.56; animation-delay: -0.74s; }

.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(1) { color: #06b6d4; --wave-peak: 0.56; animation-delay: -0.66s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(2) { color: #38bdf8; --wave-peak: 0.82; animation-delay: -0.55s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(3) { color: #3b82f6; --wave-peak: 1.00; animation-delay: -0.44s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(4) { color: #6366f1; --wave-peak: 0.68; animation-delay: -0.33s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(5) { color: #8b5cf6; --wave-peak: 0.94; animation-delay: -0.22s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(6) { color: #d946ef; --wave-peak: 0.70; animation-delay: -0.11s; }
.ai-coach-wave-group.is-right .ai-coach-wave-bar:nth-child(7) { color: #ec4899; --wave-peak: 0.42; animation-delay: -0.02s; }

.ai-coach-synth-label {
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  background: linear-gradient(
    90deg,
    #ff6b81,
    #ffb347,
    #ffe66d,
    #4ade80,
    #38bdf8,
    #a78bfa,
    #f472b6,
    #ff6b81
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.35));
  animation: ai-rainbow-text 2.2s linear infinite;
}

.tm-audio-bar.is-ai.is-compact .ai-coach-synth-wave {
  gap: 6px;
  padding-right: 4px;
}

.tm-audio-bar.is-ai.is-compact .ai-coach-wave-group {
  gap: 2px;
}

.tm-audio-bar.is-ai.is-compact .ai-coach-wave-bar {
  width: 2.5px;
}

@keyframes ai-rainbow-wave {
  0%, 100% {
    transform: scaleY(0.22);
    opacity: 0.62;
  }
  50% {
    transform: scaleY(var(--wave-peak, 1));
    opacity: 1;
  }
}

@keyframes ai-rainbow-hue {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes ai-rainbow-border {
  0% { background-position: 0 0, 0% 50%; }
  100% { background-position: 0 0, 200% 50%; }
}

@keyframes ai-rainbow-text {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

@keyframes ai-rainbow-btn {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
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

.ui-ico {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  opacity: 0.9;
}

.etr-btn,
.etr-teach-choice-title,
.ai-coach-regen-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.tm-ex-speak,
.ai-coach-ex-speak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ==================== DARK MODE GHOST LANDMARKS & QUICK-SCHEDULE CONTROLS ==================== */
.etr-card {
  background-color: #141824;
  background-image:
    radial-gradient(circle at 82% 14%, rgba(245, 158, 11, 0.06), transparent 56%),
    url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='%23cbd5e1' stroke-opacity='0.085' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(28,18)'><path d='M24 2 L24 9 M21 9 L27 9 M22 9 C21 24 16 40 7 58 M26 9 C27 24 32 40 41 58 M14 34 L34 34 M10 46 L38 46 M16 58 A8 8 0 0 1 32 58 M4 58 L44 58'/></g><g transform='translate(124,34)'><path d='M4 18 L34 6 L22 28 L17 20 Z M34 6 L17 20'/><path d='M-12 28 Q-4 26 2 22' stroke-dasharray='2.5 4'/></g><g transform='translate(226,14)'><path d='M12 6 L12 18 M9 10 C12 4 15 10 12 12 M12 18 L19 25 M23 19 A4.5 4.5 0 1 0 32 19 M23 15 L19 11 M26 14 L25 9 M29 14 L30 9 M32 15 L36 11 M21 25 L34 25 L37 56 L18 56 Z M24 25 L23 56 M31 25 L32 56 M14 56 L41 56 M12 62 L43 62'/></g><g transform='translate(46,128)'><circle cx='20' cy='20' r='16'/><path d='M20 7 L23 17 L33 20 L23 23 L20 33 L17 23 L7 20 L17 17 Z'/></g><g transform='translate(142,118)'><path d='M18 4 L12 18 L24 18 Z M11 18 L25 18 L25 34 L11 34 Z M13 34 L13 64 M23 34 L23 64 M9 64 L27 64'/><circle cx='18' cy='26' r='4.5'/><path d='M18 26 L18 23.5 M18 26 L20.2 26'/></g><g transform='translate(248,128)'><path d='M8 18 L28 18 L26 32 C25 36 11 36 10 32 Z M28 21 L32 21 C34 21 34 28 31 28 L27 28 M6 38 L30 38 M14 13 C13 10 16 9 15 6 M21 13 C20 10 23 9 22 6'/></g><g transform='translate(28,224)'><path d='M4 12 C12 9 20 11 24 16 C28 11 36 9 44 12 L44 36 C36 33 28 35 24 40 C20 35 12 33 4 36 Z M24 16 L24 40 M10 18 L18 19 M10 24 L18 25 M30 19 L38 18 M30 25 L38 24'/></g><g transform='translate(136,226)'><circle cx='22' cy='22' r='17'/><ellipse cx='22' cy='22' rx='8' ry='17'/><path d='M6 16 L38 16 M6 28 L38 28 M22 5 L22 39'/></g><g transform='translate(232,230)'><path d='M4 34 L50 34 M12 34 L12 10 L16 6 L20 10 L20 34 M34 34 L34 10 L38 6 L42 10 L42 34 M20 16 L34 16 M4 26 Q12 18 12 18 M42 18 Q50 26 50 26 M20 34 A7 7 0 0 1 34 34'/></g></svg>");
  background-size: 100% 100%, 320px 320px;
  background-attachment: local, local;
  color: #f4f4f6;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-bottom: 3.5px solid rgba(0, 0, 0, 0.55);
  border-radius: 16px;
}

.etr-btn-primary {
  background: #a8680a;
  border-color: #b8740e;
  color: #ffffff;
}

.etr-btn-primary:hover:not(:disabled) {
  background: #b8740e;
  color: #ffffff;
}

.etr-cadence-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  background: #1d2333;
  border: 1.5px solid rgba(251, 191, 36, 0.28);
  border-bottom: 2.5px solid rgba(0, 0, 0, 0.45);
  color: #e2e8f0;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.etr-cadence-btn:hover,
.etr-cadence-btn.is-open {
  background: #273046;
  border-color: #fbbf24;
  color: #fde68a;
}

.etr-cadence-panel[hidden] {
  display: none !important;
}

.etr-cadence-panel {
  flex-shrink: 0;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 12px;
  background: #1a2030;
  border: 1.5px solid rgba(251, 191, 36, 0.24);
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: etr-slide-in 0.14s ease-out;
}

.etr-cadence-label {
  font-size: 11px;
  font-weight: 800;
  color: #cbd5e1;
}

.etr-cadence-chips {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}

.etr-cadence-chip {
  appearance: none;
  padding: 6px 4px;
  border-radius: 9px;
  background: #121722;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-bottom: 3px solid rgba(0, 0, 0, 0.45);
  color: #e2e8f0;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.08s;
}

.etr-cadence-chip:hover {
  background: #232c40;
  border-color: #fbbf24;
  color: #fde68a;
}

.etr-cadence-chip:active {
  transform: translateY(1px);
}

.etr-cadence-chip.is-active {
  background: #a8680a;
  border-color: #f59e0b;
  border-bottom-color: #8f5706;
  color: #ffffff;
}

.etr-cadence-chip.is-off:hover {
  background: rgba(225, 29, 72, 0.2);
  border-color: #fb7185;
  color: #fecdd3;
}

.etr-cadence-chip.is-off.is-active {
  background: #e11d48;
  border-color: #fb7185;
  border-bottom-color: #9f1239;
  color: #ffffff;
}

.etr-cadence-quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.etr-cadence-quick-btn {
  appearance: none;
  flex: 1 1 auto;
  padding: 5px 8px;
  border-radius: 8px;
  background: #121722;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-bottom: 2px solid rgba(0, 0, 0, 0.4);
  color: #cbd5e1;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.etr-cadence-quick-btn:hover {
  background: #232c40;
  color: #ffffff;
}

.etr-cadence-quick-btn.is-danger:hover {
  background: rgba(225, 29, 72, 0.22);
  border-color: #fb7185;
  color: #fecdd3;
}

.etr-card.is-dismiss-prompt {
  padding: 14px 16px 12px;
}

.etr-dismiss-header {
  margin-bottom: 6px;
}

.etr-dismiss-cadence-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(251, 191, 36, 0.35);
  color: #fde68a;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 9px;
}

.etr-dismiss-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.etr-dismiss-title {
  font-size: 15.5px;
  font-weight: 800;
  line-height: 1.28;
  color: #f8fafc;
  letter-spacing: -0.015em;
}

.etr-dismiss-sub {
  font-size: 12.2px;
  line-height: 1.4;
  color: #cbd5e1;
  margin-top: -5px;
}

.etr-dismiss-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 12px;
  background: #1a2030;
  border: 1.5px solid rgba(255, 255, 255, 0.09);
}

.etr-dismiss-section-label {
  font-size: 11px;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.etr-dismiss-intervals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.etr-dismiss-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.etr-dismiss-action {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #1a2030;
  border: 1.5px solid rgba(255, 255, 255, 0.14);
  border-bottom: 3.5px solid rgba(0, 0, 0, 0.5);
  text-align: left;
  cursor: pointer;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.etr-dismiss-action:active {
  transform: translateY(1px);
}

.etr-dismiss-action.is-mute {
  background: rgba(59, 130, 246, 0.14);
  border-color: rgba(96, 165, 250, 0.35);
  border-bottom-color: rgba(37, 99, 235, 0.55);
}

.etr-dismiss-action.is-mute:hover {
  background: rgba(59, 130, 246, 0.22);
  border-color: #60a5fa;
}

.etr-dismiss-action.is-pause {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(251, 191, 36, 0.36);
  border-bottom-color: rgba(180, 83, 9, 0.6);
}

.etr-dismiss-action.is-pause:hover {
  background: rgba(245, 158, 11, 0.22);
  border-color: #fbbf24;
}

.etr-dismiss-action-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.etr-dismiss-action.is-mute .etr-dismiss-action-icon {
  background: #2563eb;
  color: #ffffff;
}

.etr-dismiss-action.is-pause .etr-dismiss-action-icon {
  background: #d97706;
  color: #ffffff;
}

.etr-dismiss-action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.etr-dismiss-action-title {
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  color: #f8fafc;
}

.etr-dismiss-action.is-mute .etr-dismiss-action-title {
  color: #bfdbfe;
}

.etr-dismiss-action.is-pause .etr-dismiss-action-title {
  color: #fde68a;
}

.etr-dismiss-action-desc {
  font-size: 11.4px;
  line-height: 1.35;
  color: #cbd5e1;
  font-weight: 500;
}

.etr-dismiss-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.etr-dismiss-link {
  appearance: none;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 7px;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11.5px;
  font-weight: 700;
  color: #94a3b8;
  cursor: pointer;
}

.etr-dismiss-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

.etr-dismiss-link.is-danger:hover {
  background: rgba(225, 29, 72, 0.2);
  color: #fecdd3;
}
`;

export const WIDGET_LIGHT_CSS = `/* ==================== ICE WHITE & MODERN COBALT TACTILE 3D OVERLAY ==================== */
.etr-card {
  background-color: #fcf8ec;
  background-image:
    radial-gradient(circle at 82% 14%, rgba(199, 130, 20, 0.04), transparent 56%),
    url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320' fill='none' stroke='%239a6b24' stroke-opacity='0.115' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round'><g transform='translate(28,18)'><path d='M24 2 L24 9 M21 9 L27 9 M22 9 C21 24 16 40 7 58 M26 9 C27 24 32 40 41 58 M14 34 L34 34 M10 46 L38 46 M16 58 A8 8 0 0 1 32 58 M4 58 L44 58'/></g><g transform='translate(124,34)'><path d='M4 18 L34 6 L22 28 L17 20 Z M34 6 L17 20'/><path d='M-12 28 Q-4 26 2 22' stroke-dasharray='2.5 4'/></g><g transform='translate(226,14)'><path d='M12 6 L12 18 M9 10 C12 4 15 10 12 12 M12 18 L19 25 M23 19 A4.5 4.5 0 1 0 32 19 M23 15 L19 11 M26 14 L25 9 M29 14 L30 9 M32 15 L36 11 M21 25 L34 25 L37 56 L18 56 Z M24 25 L23 56 M31 25 L32 56 M14 56 L41 56 M12 62 L43 62'/></g><g transform='translate(46,128)'><circle cx='20' cy='20' r='16'/><path d='M20 7 L23 17 L33 20 L23 23 L20 33 L17 23 L7 20 L17 17 Z'/></g><g transform='translate(142,118)'><path d='M18 4 L12 18 L24 18 Z M11 18 L25 18 L25 34 L11 34 Z M13 34 L13 64 M23 34 L23 64 M9 64 L27 64'/><circle cx='18' cy='26' r='4.5'/><path d='M18 26 L18 23.5 M18 26 L20.2 26'/></g><g transform='translate(248,128)'><path d='M8 18 L28 18 L26 32 C25 36 11 36 10 32 Z M28 21 L32 21 C34 21 34 28 31 28 L27 28 M6 38 L30 38 M14 13 C13 10 16 9 15 6 M21 13 C20 10 23 9 22 6'/></g><g transform='translate(28,224)'><path d='M4 12 C12 9 20 11 24 16 C28 11 36 9 44 12 L44 36 C36 33 28 35 24 40 C20 35 12 33 4 36 Z M24 16 L24 40 M10 18 L18 19 M10 24 L18 25 M30 19 L38 18 M30 25 L38 24'/></g><g transform='translate(136,226)'><circle cx='22' cy='22' r='17'/><ellipse cx='22' cy='22' rx='8' ry='17'/><path d='M6 16 L38 16 M6 28 L38 28 M22 5 L22 39'/></g><g transform='translate(232,230)'><path d='M4 34 L50 34 M12 34 L12 10 L16 6 L20 10 L20 34 M34 34 L34 10 L38 6 L42 10 L42 34 M20 16 L34 16 M4 26 Q12 18 12 18 M42 18 Q50 26 50 26 M20 34 A7 7 0 0 1 34 34'/></g></svg>");
  background-size: 100% 100%, 320px 320px;
  background-attachment: local, local;
  color: #1f1a12;
  border: 2px solid #e8ddc0;
  border-bottom: 4px solid #d5c08d;
  border-radius: 18px;
  box-shadow: 0 20px 48px rgba(41, 30, 12, 0.16), 0 4px 12px rgba(41, 30, 12, 0.06);
}

.etr-card.state-correct {
  border-color: #86efac;
  border-bottom-color: #22c55e;
}

.etr-card.state-wrong {
  border-color: #fda4af;
  border-bottom-color: #f43f5e;
}

.etr-header {
  border-bottom: 2px solid #f4ecd4;
}

.etr-badge {
  background: #f4ecd4;
  border: 1.5px solid #e8ddc0;
  color: #3d3427;
  font-weight: 800;
}

.etr-badge.retry,
.etr-badge.focus,
.etr-badge.ai {
  background: #fef7de;
  border: 1.5px solid #ebd08b;
  color: #7d4b05;
}

.etr-badge.correct {
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
}

.etr-badge.wrong {
  background: #ffe4e6;
  border-color: #fda4af;
  color: #be123c;
}

.etr-icon-btn {
  background: #fffdf7;
  border: 2px solid #e8ddc0;
  border-bottom: 3px solid #d5c08d;
  color: #544938;
  border-radius: 9px;
}

.etr-icon-btn:hover {
  background: #fef7de;
  border-color: #dfb655;
  border-bottom-color: #b8740e;
  color: #7d4b05;
}

.etr-close-btn {
  background: #fffdf7;
  border: 2px solid #e8ddc0;
  border-bottom: 3px solid #d5c08d;
  color: #544938;
}

.etr-close-btn:hover {
  background: #ffe4e6;
  border-color: #fda4af;
  border-bottom-color: #e11d48;
  color: #be123c;
}

.etr-en {
  color: #1f1a12;
}

mark.etr-rule-glow {
  background: #dcfce7;
  color: #15803d;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 6px;
  box-shadow: 0 0 0 1.5px #4ade80;
}

mark.etr-rule-glow.is-ai {
  background: #fef3c7;
  color: #92400e;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 6px;
  box-shadow: 0 0 0 1.5px #f59e0b;
}

.etr-phonetic,
.etr-prompt-label,
.etr-hint,
.etr-ex-tr,
.etr-alt-label,
.etr-label {
  color: #544938;
}

.etr-input,
.etr-input-sm {
  background: #fffdf7;
  color: #1f1a12;
  border: 2px solid #d5c08d;
  border-radius: 12px;
  font-weight: 600;
}

.etr-input::placeholder,
.etr-input-sm::placeholder {
  color: #786a54;
}

.etr-input:focus,
.etr-input-sm:focus {
  background: #fffdf7;
  border-color: #a8680a;
  box-shadow: 0 0 0 3px rgba(199, 130, 20, 0.14);
}

.etr-outcome-footer {
  border-top: 2px solid #e8ddc0;
}

.etr-btn,
.etr-btn-secondary,
.etr-btn-ghost,
.etr-btn-teach,
.etr-btn-teach.is-glow:not(.is-open),
.etr-btn-ai,
.etr-btn-flag {
  border-radius: 11px;
  background: #fffdf7;
  border: 2px solid #e8ddc0;
  border-bottom: 4px solid #d5c08d;
  color: #292218;
  font-weight: 800;
}

.etr-btn:hover:not(:disabled),
.etr-btn-secondary:hover:not(:disabled),
.etr-btn-ghost:hover:not(:disabled),
.etr-btn-ai:hover:not(:disabled),
.etr-btn-flag:hover:not(:disabled) {
  background: #faf5e6;
  border-color: #d5c08d;
  border-bottom-color: #bfa673;
  color: #1f1a12;
}

.etr-btn-teach:hover:not(:disabled),
.etr-btn-teach.is-open {
  background: #fef7de;
  border-color: #b8740e;
  border-bottom-color: #a8680a;
  color: #7d4b05;
}

.etr-btn:active:not(:disabled) {
  transform: translateY(2px);
  border-bottom-width: 2px;
}

.etr-btn-primary,
.etr-btn-next,
.etr-btn-ai-solid {
  background: #a8680a;
  border: 2px solid #a8680a;
  border-bottom: 4px solid #7d4b05;
  color: #ffffff;
  font-weight: 800;
}

.etr-btn-primary:hover:not(:disabled),
.etr-btn-next:hover:not(:disabled),
.etr-btn-ai-solid:hover:not(:disabled) {
  background: #b8740e;
  border-color: #b8740e;
  border-bottom-color: #7d4b05;
  color: #ffffff;
}

.etr-btn-flag-solid {
  background: #f59e0b;
  border: 2px solid #f59e0b;
  border-bottom: 4px solid #d97706;
  color: #ffffff;
}

.etr-btn-flag-solid:hover:not(:disabled) {
  background: #d97706;
  color: #ffffff;
}

/* Crisp Light Feedback & Outcome Bubbles */
.etr-bubble {
  background: #fffdf7;
  border: 2px solid #e8ddc0;
  border-left-width: 4px;
  color: #1f1a12;
  border-radius: 12px;
}

.etr-bubble-ref {
  background: #fffdf7;
  border-color: #e8ddc0;
  border-left-color: #bfa673;
  color: #1f1a12;
}

.etr-bubble-ref .etr-bubble-label {
  color: #544938;
}

.etr-bubble-good {
  background: #f0fdf4;
  border-color: #86efac;
  border-left-color: #16a34a;
  color: #14532d;
}

.etr-bubble-bad {
  background: #fff1f2;
  border-color: #fda4af;
  border-left-color: #e11d48;
  color: #881337;
}

.etr-bubble-ai {
  background: #fef7de;
  border-color: #ebd08b;
  border-left-color: #a8680a;
  color: #714209;
}

.etr-bubble-muted {
  background: #faf5e6;
  border-color: #e8ddc0;
  border-left-color: #d5c08d;
  color: #544938;
}

.etr-bubble-label {
  color: #544938;
}

.etr-bubble-good .etr-bubble-label {
  color: #15803d;
}

.etr-bubble-bad .etr-bubble-label {
  color: #be123c;
}

.etr-bubble-ai .etr-bubble-label {
  color: #7d4b05;
}

.etr-bubble-muted .etr-bubble-label {
  color: #6e604b;
}

.etr-answer-good {
  color: #14532d;
}

.etr-answer-bad {
  color: #9f1239;
}

.etr-meaning-chip {
  background: #fffdf7;
  border: 1.5px solid #d5c08d;
  color: #292218;
}

.etr-bubble-good .etr-meaning-chip {
  background: #dcfce7;
  border-color: #86efac;
  color: #14532d;
}

.etr-alt-block {
  border-top-color: #e8ddc0;
}

.etr-bubble-good .etr-alt-block {
  border-top-color: #86efac;
}

.etr-alt-item {
  color: #3d3427;
}

.etr-bubble-good .etr-alt-label {
  color: #15803d;
}

.etr-bubble-good .etr-alt-item {
  color: #166534;
}

.etr-example {
  background: #fffdf7;
  border: 1.5px solid #e8ddc0;
  color: #1f1a12;
}

.etr-example-tr {
  color: #544938;
}

.etr-repeat-note {
  color: #b45309;
  font-weight: 700;
}

.etr-repeat-note.ok {
  color: #15803d;
  font-weight: 700;
}

.etr-concept-box {
  background: #fef7de;
  border: 2px solid #ebd08b;
  border-left: 4px solid #a8680a;
  color: #292218;
}

.etr-concept-title {
  color: #7d4b05;
  font-weight: 800;
}

.etr-concept-stage {
  color: #544938;
  font-weight: 600;
}

.etr-flag-panel {
  background: #fffdf7;
  border: 2px solid #fde68a;
  border-radius: 12px;
}

.etr-ask-panel {
  background: #fffdf7;
  border: 2px solid #ebd08b;
  border-radius: 12px;
}

.etr-ask-panel .etr-label {
  color: #7d4b05;
}

.etr-ask-output {
  background: #faf5e6;
  border: 1.5px solid #d5c08d;
  color: #1f1a12;
}

.etr-token-chip {
  background: #faf5e6;
  border: 1.5px solid #d5c08d;
  color: #292218;
}

.etr-token-chip:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #78350f;
}

/* Crisp Light Teach Me & AI Live Teacher (EMA) Panel */
.etr-teach-panel {
  background: #fffdf7;
  border: 2px solid #ebd08b;
  border-radius: 14px;
  color: #1f1a12;
}

.etr-teach-panel.is-ai-mode {
  background: #fffdf7;
  border: 2px solid #fcd34d;
}

.etr-teach-head-row {
  border-bottom: 1.5px solid #e8ddc0;
}

.etr-teach-head {
  color: #7d4b05;
  font-weight: 800;
}

.etr-teach-panel.is-ai-mode .etr-teach-head {
  color: #b45309;
  font-weight: 800;
}

.etr-teach-close-btn {
  background: #ffe4e6;
  border: 1.5px solid #fda4af;
  color: #be123c;
  border-radius: 7px;
}

.etr-teach-close-btn:hover {
  background: #e11d48;
  border-color: #e11d48;
  color: #ffffff;
}

.el-help-trigger {
  background: #f4ecd4;
  border: 1.5px solid #d5c08d;
  color: #544938;
}

.el-help-trigger:hover {
  background: #fef7de;
  border-color: #b8740e;
  color: #7d4b05;
}

.el-guide-pill {
  background: #fffdf7;
  border: 2px solid #b8740e;
  border-bottom: 3px solid #a8680a;
  color: #7d4b05;
  box-shadow: 0 10px 26px rgba(199, 130, 20, 0.2);
}

.el-guide-pill-label {
  color: #1f1a12;
}

.el-guide-waves i {
  background: #a8680a;
}

.el-guide-pill-stop {
  background: #ffe4e6;
  border-color: #fda4af;
  color: #be123c;
}

.tm-branch-stem,
.tm-branch-leg::before,
.tm-branch-drop {
  background: #d5c08d;
}

.tm-branch-arrow {
  border-top-color: #bfa673;
}

.tm-branch-leg.is-active .tm-branch-drop {
  background: #a8680a;
}

.tm-branch-leg.is-active .tm-branch-arrow {
  border-top-color: #a8680a;
}

.tm-branch-tree.is-ai .tm-branch-leg.is-active .tm-branch-drop {
  background: #d97706;
}

.tm-branch-tree.is-ai .tm-branch-leg.is-active .tm-branch-arrow {
  border-top-color: #d97706;
}

.etr-teach-choice,
.ai-coach-choice {
  background: #faf5e6;
  border: 2px solid #e8ddc0;
  border-bottom: 3px solid #d5c08d;
  border-radius: 11px;
  color: #1f1a12;
}

.etr-teach-choice:hover,
.ai-coach-choice:hover {
  background: #fffdf7;
  border-color: #dfb655;
  border-bottom-color: #b8740e;
  color: #7d4b05;
}

.etr-teach-choice.is-active {
  background: #fef7de;
  border-color: #b8740e;
  border-bottom-color: #a8680a;
  color: #7d4b05;
}

.ai-coach-choice.is-active {
  background: #fffbeb;
  border-color: #f59e0b;
  border-bottom-color: #d97706;
  color: #92400e;
}

.etr-teach-choice-cue,
.ai-coach-choice-cue {
  background: #e8ddc0;
  border-color: #d5c08d;
  color: #544938;
}

.etr-teach-choice.is-active .etr-teach-choice-cue {
  background: #a8680a;
  border-color: #a8680a;
  color: #ffffff;
}

.ai-coach-choice.is-active .ai-coach-choice-cue {
  background: #f59e0b;
  border-color: #d97706;
  color: #ffffff;
}

.etr-ai-tick-btn {
  background: #fffbeb;
  border: 1.5px solid #fcd34d;
  color: #b45309;
}

.etr-ai-tick-btn:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.etr-ai-tick-btn.is-active {
  background: #f59e0b;
  border-color: #d97706;
  color: #ffffff;
  box-shadow: none;
}

.ai-coach-voice-badge {
  color: #92400e;
  font-weight: 800;
}

.ai-coach-regen-btn {
  background: #fffbeb;
  border: 1.5px solid #fcd34d;
  color: #92400e;
  font-weight: 800;
}

.ai-coach-regen-btn:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #78350f;
}

/* Crisp Light Audio Bar inside Floating Teach Me / EMA */
.tm-audio-bar {
  background: #fef7de;
  border: 2px solid #ebd08b;
  border-radius: 12px;
  padding: 7px 10px;
  color: #1f1a12;
}

.tm-audio-play-btn {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: #a8680a;
  border-bottom: 3px solid #7d4b05;
  color: #ffffff;
}

.tm-audio-play-btn:hover {
  background: #b8740e;
}

.tm-audio-mini-btn,
.tm-audio-speed-btn {
  height: 26px;
  padding: 0 7px;
  border-radius: 7px;
  background: #fffdf7;
  border: 1.5px solid #ebd08b;
  border-bottom: 2px solid #dfb655;
  color: #7c4c0a;
  font-weight: 800;
}

.tm-audio-mini-btn:hover,
.tm-audio-speed-btn:hover {
  background: #fcedbf;
  border-color: #b8740e;
  color: #7d4b05;
}

.tm-audio-range {
  height: 5px;
  background: #ebd08b;
  accent-color: #a8680a;
}

.tm-audio-range::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  background: #a8680a;
  border: 2px solid #fffdf7;
  box-shadow: 0 1px 4px rgba(199, 130, 20, 0.35);
}

.tm-audio-time {
  color: #714209;
  font-weight: 700;
}

.tm-audio-bar.is-ai {
  background: #fffbeb;
  border: 2px solid #fde68a;
}

.tm-audio-bar.is-ai .tm-audio-play-btn {
  background: #f59e0b;
  border-bottom: 3px solid #d97706;
  color: #ffffff;
}

.tm-audio-bar.is-ai .tm-audio-mini-btn,
.tm-audio-bar.is-ai .tm-audio-speed-btn {
  background: #fffdf7;
  border-color: #fcd34d;
  border-bottom-color: #f59e0b;
  color: #92400e;
}

.tm-audio-bar.is-ai .tm-audio-mini-btn:hover,
.tm-audio-bar.is-ai .tm-audio-speed-btn:hover {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #78350f;
}

.tm-audio-bar.is-ai .tm-audio-range {
  background: #fde68a;
  accent-color: #d97706;
}

.tm-audio-bar.is-ai .tm-audio-range::-webkit-slider-thumb {
  background: #d97706;
  border: 2px solid #fffdf7;
  box-shadow: 0 1px 4px rgba(217, 119, 6, 0.35);
}

.tm-audio-bar.is-ai .tm-audio-time {
  color: #92400e;
}

.tm-audio-bar.is-ai.is-synthesizing {
  background:
    linear-gradient(#fffdf7, #fffdf7) padding-box,
    linear-gradient(90deg, #a8680a, #b8740e, #b8740e, #f59e0b, #a8680a) border-box;
  background-size: 100% 100%, 200% 100%;
  box-shadow: 0 4px 14px rgba(199, 130, 20, 0.14);
}

/* Readable Explanation Text, Synced Words & Example Sentences */
.etr-teach-text {
  background: #faf5e6;
  border: 1.5px solid #e8ddc0;
  border-radius: 10px;
}

.etr-teach-headline {
  color: #1f1a12;
  font-weight: 800;
}

.etr-teach-rule {
  color: #3d3427;
}

.tm-sync-word.is-seekable:hover {
  background: #fef7de;
  color: #7d4b05;
}

.tm-sync-word.is-active {
  background: #fcedbf;
  color: #7d4b05;
  font-weight: 700;
  text-shadow: none;
}

.tm-sync-word.is-ai-word.is-active {
  background: #fef3c7;
  color: #92400e;
  font-weight: 700;
  box-shadow: 0 0 0 1px #f59e0b;
}

.ai-coach-intro {
  color: #3d3427;
}

.ai-coach-item {
  background: #faf5e6;
  border: 1.5px solid #e8ddc0;
  color: #1f1a12;
}

.ai-coach-item.is-focused {
  background: #fffdf7;
  border: 2px solid #f59e0b;
}

.ai-coach-item-title {
  color: #92400e;
  font-weight: 800;
}

.ai-coach-focus-pill {
  background: #fef3c7;
  border: 1.5px solid #f59e0b;
  color: #92400e;
  font-weight: 800;
}

.ai-coach-item-exp {
  color: #292218;
}

.ai-coach-examples {
  border-top: 1.5px solid #e8ddc0;
}

.ai-coach-ex-en {
  color: #1f1a12;
  font-weight: 700;
}

.ai-coach-ex-tr {
  color: #544938;
}

.ai-coach-ex-speak {
  background: #fef7de;
  border: 1.5px solid #ebd08b;
  color: #a8680a;
}

.ai-coach-ex-speak:hover {
  background: #a8680a;
  border-color: #a8680a;
  color: #ffffff;
}

.ai-coach-state {
  background: #fffbeb;
  border: 1.5px solid #fde68a;
}

.ai-coach-state.is-error {
  background: #fff1f2;
  border: 1.5px solid #fda4af;
}

.ai-coach-state-title {
  color: #92400e;
  font-weight: 800;
}

.ai-coach-state.is-error .ai-coach-state-title {
  color: #be123c;
}

.ai-coach-state-sub {
  color: #544938;
}

.etr-ai-chat-box,
.tm-ex-row {
  background: #faf5e6;
  border: 2px solid #e8ddc0;
  color: #1f1a12;
}

.etr-toast {
  background: #fffdf7;
  color: #1f1a12;
  border: 2px solid #d5c08d;
  border-bottom: 4px solid #bfa673;
  box-shadow: 0 12px 30px rgba(41, 30, 12, 0.16);
}

/* Inline Cadence Selector Pill & Compact Popover */
.etr-cadence-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  background: #faf5e6;
  border: 1.5px solid #d5c08d;
  border-bottom: 2.5px solid #bfa673;
  color: #3d3427;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.etr-cadence-btn:hover,
.etr-cadence-btn.is-open {
  background: #fef7de;
  border-color: #dfb655;
  border-bottom-color: #a8680a;
  color: #7d4b05;
}

.etr-cadence-panel[hidden] {
  display: none !important;
}

.etr-cadence-panel {
  flex-shrink: 0;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 12px;
  background: #faf5e6;
  border: 2px solid #fcedbf;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: etr-slide-in 0.14s ease-out;
}

.etr-cadence-label {
  font-size: 11px;
  font-weight: 800;
  color: #544938;
  letter-spacing: 0.01em;
}

.etr-cadence-chips {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}

.etr-cadence-chip {
  appearance: none;
  padding: 6px 4px;
  border-radius: 9px;
  background: #fffdf7;
  border: 1.5px solid #d5c08d;
  border-bottom: 3px solid #bfa673;
  color: #292218;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.08s;
}

.etr-cadence-chip:hover {
  background: #fef7de;
  border-color: #e6aa32;
  border-bottom-color: #a8680a;
  color: #7d4b05;
}

.etr-cadence-chip:active {
  transform: translateY(1px);
}

.etr-cadence-chip.is-active {
  background: #a8680a;
  border-color: #a8680a;
  border-bottom-color: #7d4b05;
  color: #ffffff;
}

.etr-cadence-chip.is-off:hover {
  background: #fff1f2;
  border-color: #fda4af;
  border-bottom-color: #e11d48;
  color: #be123c;
}

.etr-cadence-chip.is-off.is-active {
  background: #e11d48;
  border-color: #e11d48;
  border-bottom-color: #be123c;
  color: #ffffff;
}

.etr-cadence-quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 6px;
  border-top: 1.5px solid #e8ddc0;
}

.etr-cadence-quick-btn {
  appearance: none;
  flex: 1 1 auto;
  padding: 5px 8px;
  border-radius: 8px;
  background: #fffdf7;
  border: 1.5px solid #e8ddc0;
  border-bottom: 2px solid #d5c08d;
  color: #3d3427;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.etr-cadence-quick-btn:hover {
  background: #f4ecd4;
  border-color: #bfa673;
  color: #1f1a12;
}

.etr-cadence-quick-btn.is-danger:hover {
  background: #fff1f2;
  border-color: #fda4af;
  color: #be123c;
}

/* Dismiss Quick-Adjust Card (triggered immediately on X before answering) */
.etr-card.is-dismiss-prompt {
  padding: 14px 16px 12px;
}

.etr-dismiss-header {
  margin-bottom: 6px;
}

.etr-dismiss-cadence-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fef7de;
  border-color: #ebd08b;
  color: #7d4b05;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  font-weight: 800;
  padding: 4px 9px;
}

.etr-dismiss-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.etr-dismiss-title {
  font-size: 15.5px;
  font-weight: 800;
  line-height: 1.28;
  color: #1f1a12;
  letter-spacing: -0.015em;
}

.etr-dismiss-sub {
  font-size: 12.2px;
  line-height: 1.4;
  color: #544938;
  margin-top: -5px;
}

.etr-dismiss-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 12px;
  background: #faf5e6;
  border: 1.5px solid #e8ddc0;
}

.etr-dismiss-section-label {
  font-size: 11px;
  font-weight: 800;
  color: #544938;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.etr-dismiss-intervals {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.etr-dismiss-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.etr-dismiss-action {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fffdf7;
  border: 2px solid #d5c08d;
  border-bottom: 3.5px solid #bfa673;
  text-align: left;
  cursor: pointer;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: background 0.12s, border-color 0.12s, transform 0.08s;
}

.etr-dismiss-action:active {
  transform: translateY(1px);
}

.etr-dismiss-action.is-mute {
  background: #fef7de;
  border-color: #dfb655;
  border-bottom-color: #a8680a;
}

.etr-dismiss-action.is-mute:hover {
  background: #fcedbf;
  border-color: #b8740e;
}

.etr-dismiss-action.is-pause {
  background: #fffbeb;
  border-color: #fcd34d;
  border-bottom-color: #d97706;
}

.etr-dismiss-action.is-pause:hover {
  background: #fef3c7;
  border-color: #f59e0b;
}

.etr-dismiss-action-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.etr-dismiss-action.is-mute .etr-dismiss-action-icon {
  background: #a8680a;
  color: #ffffff;
}

.etr-dismiss-action.is-pause .etr-dismiss-action-icon {
  background: #d97706;
  color: #ffffff;
}

.etr-dismiss-action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.etr-dismiss-action-title {
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  color: #1f1a12;
}

.etr-dismiss-action.is-mute .etr-dismiss-action-title {
  color: #714209;
}

.etr-dismiss-action.is-pause .etr-dismiss-action-title {
  color: #78350f;
}

.etr-dismiss-action-desc {
  font-size: 11.4px;
  line-height: 1.35;
  color: #544938;
  font-weight: 600;
}

.etr-dismiss-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1.5px solid #e8ddc0;
}

.etr-dismiss-link {
  appearance: none;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 7px;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11.5px;
  font-weight: 700;
  color: #6e604b;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.etr-dismiss-link:hover {
  background: #f4ecd4;
  color: #1f1a12;
}

.etr-dismiss-link.is-danger:hover {
  background: #fff1f2;
  color: #be123c;
}`;

export const WIDGET_CSS = WIDGET_DARK_CSS + '\n' + WIDGET_LIGHT_CSS;

export function getWidgetCss(themeMode?: UiThemeMode): string {
  return themeMode === 'dark' ? WIDGET_DARK_CSS : WIDGET_CSS;
}
