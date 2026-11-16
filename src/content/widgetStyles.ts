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
  width: 348px;
  max-width: calc(100vw - 28px);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #f4f4f6;
  -webkit-font-smoothing: antialiased;
  animation: etr-slide-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
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
  background-color: #0b0914;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139, 92, 246, 0.14), transparent 70%),
    radial-gradient(rgba(196, 181, 253, 0.04) 1px, transparent 0);
  background-size: 100% 100%, 12px 12px;
  border: 1px solid rgba(196, 181, 253, 0.16);
  border-radius: 11px;
  box-shadow: 0 18px 42px rgba(7, 4, 18, 0.72), inset 0 1px 0 rgba(233, 213, 255, 0.08);
  padding: 13px 14px;
  overflow: hidden;
}

.etr-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #a855f7, #7c3aed);
}

.etr-card.state-correct {
  border-color: rgba(16, 185, 129, 0.4);
}

.etr-card.state-correct::before {
  background: #10b981;
}

.etr-card.state-wrong {
  border-color: rgba(244, 63, 94, 0.4);
}

.etr-card.state-wrong::before {
  background: #f43f5e;
}

.etr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 9px;
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
  border-radius: 4px;
  background: #17171c;
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: #a1a1aa;
  letter-spacing: 0.03em;
}

.etr-badge.retry {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.etr-badge.focus {
  background: rgba(139, 92, 246, 0.16);
  color: #c4b5fd;
  border-color: rgba(139, 92, 246, 0.36);
}

.etr-badge.correct {
  background: rgba(16, 185, 129, 0.14);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.32);
}

.etr-badge.wrong {
  background: rgba(244, 63, 94, 0.14);
  color: #fb7185;
  border-color: rgba(244, 63, 94, 0.32);
}

.etr-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.etr-icon-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #171426;
  color: #c4b5fd;
  border-radius: 7px;
  height: 26px;
  min-width: 26px;
  padding: 0 7px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.14s, color 0.14s, border-color 0.14s, transform 0.1s;
}

.etr-icon-btn:hover {
  background: #231e38;
  color: #ffffff;
  border-color: rgba(196, 181, 253, 0.35);
}

.etr-close-btn {
  padding: 0;
  width: 26px;
  background: rgba(244, 63, 94, 0.12);
  border-color: rgba(244, 63, 94, 0.36);
  color: #fda4af;
}

.etr-close-btn:hover {
  background: rgba(244, 63, 94, 0.28);
  border-color: rgba(244, 63, 94, 0.72);
  color: #ffffff;
}

.etr-prompt-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.etr-en {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: #f4f4f6;
  word-break: break-word;
}

.etr-en.is-sentence {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.42;
}

.etr-phonetic {
  font-size: 11px;
  color: #71717a;
  margin-bottom: 8px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
}

.etr-form {
  margin-top: 8px;
}

.etr-input {
  width: 100%;
  height: 33px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(196, 181, 253, 0.16);
  background: #120f1e;
  color: #f4f4f6;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.14s, box-shadow 0.14s;
}

.etr-input::placeholder {
  color: #7c7499;
}

.etr-input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.22);
}

.etr-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.etr-outcome-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.etr-outcome-secondary {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.etr-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  height: 29px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
  transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.08s;
}

.etr-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.etr-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.etr-btn-primary,
.etr-btn-next {
  background: linear-gradient(135deg, #9333ea, #7c3aed);
  color: #ffffff;
  border-color: rgba(196, 181, 253, 0.35);
  font-weight: 700;
  padding: 0 12px;
}

.etr-btn-primary:hover:not(:disabled),
.etr-btn-next:hover:not(:disabled) {
  background: linear-gradient(135deg, #a855f7, #8b5cf6);
}

.etr-btn-secondary,
.etr-btn-ghost {
  background: #131317;
  border-color: rgba(255, 255, 255, 0.09);
  color: #a1a1aa;
  height: 27px;
  padding: 0 8px;
  font-size: 11px;
}

.etr-btn-secondary:hover:not(:disabled),
.etr-btn-ghost:hover:not(:disabled) {
  color: #f4f4f6;
  background: #1f1f26;
  border-color: rgba(255, 255, 255, 0.18);
}

.etr-feedback-box {
  margin-top: 9px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12.5px;
  line-height: 1.44;
}

.etr-bubble {
  border-radius: 9px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: #12101c;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.etr-bubble-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.etr-bubble-bad {
  background: rgba(244, 63, 94, 0.13);
  border-color: rgba(244, 63, 94, 0.42);
  color: #ffe4e6;
}

.etr-bubble-bad .etr-bubble-label {
  color: #fb7185;
}

.etr-bubble-good {
  background: rgba(16, 185, 129, 0.13);
  border-color: rgba(16, 185, 129, 0.42);
  color: #ecfdf5;
  font-weight: 600;
}

.etr-bubble-good .etr-bubble-label {
  color: #34d399;
}

.etr-bubble-ai {
  background: rgba(245, 158, 11, 0.13);
  border-color: rgba(245, 158, 11, 0.45);
  color: #fef3c7;
}

.etr-bubble-ai .etr-bubble-label {
  color: #fbbf24;
}

.etr-bubble-muted {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(196, 181, 253, 0.14);
  color: #d4d4d8;
}

.etr-bubble-muted .etr-bubble-label {
  color: #a1a1aa;
}

.etr-label {
  color: #71717a;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
  margin-top: 2px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 12px;
  color: #d4d4d8;
}

.etr-example-tr {
  color: #71717a;
  font-size: 11.5px;
  margin-top: 2px;
}

.etr-repeat-note {
  margin-top: 7px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: #fbbf24;
  display: flex;
  align-items: center;
  gap: 5px;
}

.etr-repeat-note.ok {
  color: #34d399;
}

.etr-concept-box {
  margin-top: 7px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.3);
  font-size: 12px;
  line-height: 1.4;
  color: #f4f4f6;
}

.etr-concept-title {
  font-weight: 700;
  color: #c4b5fd;
  margin-bottom: 2px;
}

.etr-concept-stage {
  margin-top: 4px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  color: #a1a1aa;
}

.etr-flag-panel {
  margin-top: 7px;
  padding: 8px 9px;
  border-radius: 8px;
  background: #120f1e;
  border: 1px solid rgba(196, 181, 253, 0.14);
}

.etr-token-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.etr-token-chip {
  appearance: none;
  border: 1px solid rgba(196, 181, 253, 0.16);
  background: #181428;
  color: #e9d5ff;
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
}

.etr-token-chip:hover {
  border-color: #a855f7;
  color: #ffffff;
}

.etr-flag-row {
  display: flex;
  gap: 5px;
}

.etr-input-sm {
  flex: 1;
  height: 27px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #09090b;
  color: #f4f4f6;
  font-size: 11.5px;
  outline: none;
}

.etr-input-sm:focus {
  border-color: #f4f4f6;
}

.etr-toast {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 2147483647;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #09090b;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f4f4f6;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6);
  animation: etr-slide-in 0.18s ease-out;
}
`;
