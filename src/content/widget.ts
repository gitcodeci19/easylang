import { sanitizeConceptExplanationForCard } from '../shared/concepts';
import { getUiStrings, resolveSupportedLanguage } from '../shared/i18n';
import { speakEnglishText as speakEnglish } from '../shared/speech';
import type {
  ActivePrompt,
  AnswerOutcomeResult,
  ConceptNote,
  ExtensionMessage,
  ExtensionSettings,
} from '../shared/types';
import { WIDGET_CSS } from './widgetStyles';

const HOST_ID = 'en-tr-recall-shadow-host';
const TOAST_HOST_ID = 'en-tr-recall-toast-host';

let escapeKeyHandler: ((e: KeyboardEvent) => void) | null = null;

export function removeRecallWidget(): void {
  if (escapeKeyHandler) {
    window.removeEventListener('keydown', escapeKeyHandler);
    escapeKeyHandler = null;
  }
  document.getElementById(HOST_ID)?.remove();
}

function sendBgMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Create a crisp vector close (X) SVG icon with consistent sizing across widgets. */
export function buildCloseSvg(): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', 'M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.1');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
}

function createCloseIconBtn(title: string): HTMLButtonElement {
  const btn = createEl('button', 'etr-icon-btn etr-close-btn');
  btn.type = 'button';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.appendChild(buildCloseSvg());
  return btn;
}

function isolateKeyboardEvents(el: HTMLElement): void {
  const stop = (e: Event) => {
    e.stopPropagation();
  };
  el.addEventListener('keydown', stop);
  el.addEventListener('keyup', stop);
  el.addEventListener('keypress', stop);
}

export function renderToast(message: string): void {
  document.getElementById(TOAST_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = TOAST_HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;
  const toast = createEl('div', 'etr-toast', message);

  shadow.append(style, toast);
  (document.body ?? document.documentElement).appendChild(host);

  window.setTimeout(() => {
    host.remove();
  }, 3600);
}

export function renderRecallWidget(
  prompt: ActivePrompt,
  settings: ExtensionSettings
): void {
  removeRecallWidget();

  const { card, isRetry, retryAttempt, targetConcept } = prompt;
  const ui = getUiStrings(settings.uiLanguage);
  const isTr = resolveSupportedLanguage(settings.uiLanguage) === 'tr';
  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = WIDGET_CSS;

  const wrap = createEl('div', 'etr-wrap');
  const cardEl = createEl('div', 'etr-card');

  const renderQuestionView = (): void => {
    cardEl.className = 'etr-card';
    cardEl.replaceChildren();

    const header = createEl('div', 'etr-header');
    const badges = createEl('div', 'etr-badges');

    const typeLabel =
      card.type === 'sentence'
        ? isTr
          ? 'Cümle'
          : 'Sentence'
        : card.pos || (isTr ? 'Kelime' : 'Word');
    badges.appendChild(createEl('span', 'etr-badge', `${card.level} · ${typeLabel}`));
    if (isRetry) {
      badges.appendChild(
        createEl(
          'span',
          'etr-badge retry',
          isTr ? `Tekrar #${retryAttempt}` : `Retry #${retryAttempt}`
        )
      );
    }
    if (targetConcept) {
      badges.appendChild(
        createEl('span', 'etr-badge focus', isTr ? 'Odak' : 'Focus')
      );
    }

    const headerActions = createEl('div', 'etr-header-actions');
    const snoozeBtn = createEl('button', 'etr-icon-btn', '5m');
    snoozeBtn.type = 'button';
    snoozeBtn.title = isTr ? '5 dakika ertele' : 'Snooze for 5 minutes';
    snoozeBtn.addEventListener('click', async () => {
      await sendBgMessage({ type: 'SNOOZE_PROMPT', minutes: 5 });
      removeRecallWidget();
    });

    const muteBtn = createEl('button', 'etr-icon-btn', '1h');
    muteBtn.type = 'button';
    muteBtn.title = isTr ? '1 saat sessize al' : 'Mute for 1 hour';
    muteBtn.addEventListener('click', async () => {
      await sendBgMessage({ type: 'MUTE_FOR_HOURS', hours: 1 });
      removeRecallWidget();
    });

    const closeBtn = createCloseIconBtn(isTr ? 'Kapat' : 'Dismiss');
    closeBtn.addEventListener('click', async () => {
      await sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
      removeRecallWidget();
    });

    headerActions.append(snoozeBtn, muteBtn, closeBtn);
    header.append(badges, headerActions);

    const promptRow = createEl('div', 'etr-prompt-row');
    const enEl = createEl(
      'div',
      card.type === 'sentence' ? 'etr-en is-sentence' : 'etr-en',
      card.en
    );
    const speakBtn = createEl('button', 'etr-icon-btn', '▶');
    speakBtn.type = 'button';
    speakBtn.title = isTr ? 'Sesli oku' : 'Pronounce aloud';
    speakBtn.addEventListener('click', () => speakEnglish(card.en));
    promptRow.append(enEl, speakBtn);

    cardEl.append(header, promptRow);

    if (card.phonetic) {
      cardEl.appendChild(createEl('div', 'etr-phonetic', card.phonetic));
    }

    const form = createEl('form', 'etr-form');
    const input = createEl('input', 'etr-input');
    input.type = 'text';
    input.placeholder = isTr ? 'Türkçe anlamını yazın...' : 'Type the Turkish meaning...';
    input.autocomplete = 'off';
    input.spellcheck = false;
    isolateKeyboardEvents(input);

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        await sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
        removeRecallWidget();
      }
    });

    const actions = createEl('div', 'etr-actions');
    const dontKnowBtn = createEl('button', 'etr-btn etr-btn-ghost', ui.dontKnow);
    dontKnowBtn.type = 'button';

    const submitBtn = createEl('button', 'etr-btn etr-btn-primary', ui.checkAnswer);
    submitBtn.type = 'submit';

    actions.append(dontKnowBtn, submitBtn);
    form.append(input, actions);
    cardEl.appendChild(form);

    const errorLine = createEl('div', 'etr-repeat-note');
    errorLine.hidden = true;
    cardEl.appendChild(errorLine);

    let submitting = false;

    const handleSubmit = async (): Promise<void> => {
      if (submitting) return;
      const val = input.value.trim();
      if (!val) {
        input.focus();
        return;
      }
      submitting = true;
      errorLine.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = isTr ? 'Kontrol ediliyor...' : 'Checking...';
      try {
        const res = await sendBgMessage<{
          ok: boolean;
          result?: AnswerOutcomeResult;
          error?: string;
        }>({
          type: 'SUBMIT_ANSWER',
          cardId: card.id,
          userAnswer: val,
          card,
        });
        if (res?.ok && res.result) {
          renderOutcomeView(val, res.result);
          return;
        }
        errorLine.hidden = false;
        errorLine.textContent = `⚠ ${res?.error ?? 'Could not reach background service.'}`;
      } catch (err) {
        errorLine.hidden = false;
        errorLine.textContent = `⚠ Extension reloaded — press F5 to refresh this tab (${
          err instanceof Error ? err.message : 'disconnected'
        }).`;
      }
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = ui.checkAnswer;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void handleSubmit();
    });

    dontKnowBtn.addEventListener('click', async () => {
      if (submitting) return;
      submitting = true;
      dontKnowBtn.disabled = true;
      const res = await sendBgMessage<{ ok: boolean; result?: AnswerOutcomeResult }>({
        type: 'MARK_DONT_KNOW',
        cardId: card.id,
        card,
      });
      if (res?.ok && res.result) {
        renderOutcomeView('', res.result);
      }
    });

    if (settings.autoSpeak) {
      speakEnglish(card.en);
    }
  };

  const renderOutcomeView = (userAnswer: string, outcome: AnswerOutcomeResult): void => {
    const isCorrect = outcome.evaluation.isCorrect;
    cardEl.className = `etr-card ${isCorrect ? 'state-correct' : 'state-wrong'}`;
    cardEl.replaceChildren();

    const header = createEl('div', 'etr-header');
    const badges = createEl('div', 'etr-badges');
    badges.appendChild(
      createEl(
        'span',
        `etr-badge ${isCorrect ? 'correct' : 'wrong'}`,
        isCorrect ? (isTr ? '✓ Doğru!' : '✓ Correct!') : isTr ? '✕ Yanlış' : '✕ Incorrect'
      )
    );
    badges.appendChild(createEl('span', 'etr-badge', card.level));
    if (outcome.evaluation.aiStatus === 'used' || outcome.evaluation.matchKind === 'ai') {
      const aiLabel = `AI${outcome.evaluation.aiProviderIndex ?? 1}`;
      badges.appendChild(createEl('span', 'etr-badge', aiLabel));
    } else if (outcome.evaluation.aiStatus === 'error') {
      badges.appendChild(createEl('span', 'etr-badge wrong', isTr ? 'AI Hatası' : 'AI Error'));
    }

    const headerActions = createEl('div', 'etr-header-actions');
    const speakBtn = createEl('button', 'etr-icon-btn', '▶');
    speakBtn.type = 'button';
    speakBtn.title = isTr ? 'Sesli oku' : 'Pronounce aloud';
    speakBtn.addEventListener('click', () => speakEnglish(card.en));

    const closeBtn = createCloseIconBtn(isTr ? 'Kapat' : 'Close');
    closeBtn.addEventListener('click', removeRecallWidget);

    headerActions.append(speakBtn, closeBtn);
    header.append(badges, headerActions);

    const enEl = createEl(
      'div',
      card.type === 'sentence' ? 'etr-en is-sentence' : 'etr-en',
      card.en
    );

    const feedbackBox = createEl('div', 'etr-feedback-box');

    if (userAnswer) {
      const userBubble = createEl(
        'div',
        `etr-bubble ${isCorrect ? 'etr-bubble-good' : 'etr-bubble-bad'}`
      );
      userBubble.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          isCorrect
            ? isTr
              ? '✓ Senin Cevabın'
              : '✓ Your Answer'
            : isTr
              ? '✕ Senin Cevabın'
              : '✕ Your Answer'
        )
      );
      userBubble.appendChild(createEl('div', undefined, userAnswer));
      feedbackBox.appendChild(userBubble);
    }

    const ansBubble = createEl('div', 'etr-bubble etr-bubble-good');
    ansBubble.appendChild(
      createEl(
        'span',
        'etr-bubble-label',
        isCorrect
          ? isTr
            ? '✓ Kabul Edilen Anlamlar'
            : '✓ Accepted Meanings'
          : isTr
            ? '✓ Doğru Anlam'
            : '✓ Correct Meaning'
      )
    );
    ansBubble.appendChild(createEl('div', undefined, card.acceptedTr.join(', ')));
    feedbackBox.appendChild(ansBubble);

    if (outcome.evaluation.aiNote) {
      const aiBubble = createEl('div', 'etr-bubble etr-bubble-ai');
      aiBubble.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          outcome.evaluation.aiStatus === 'error'
            ? isTr
              ? '⚠ AI Durumu'
              : '⚠ AI Status'
            : isTr
              ? '✨ AI Değerlendirmesi'
              : '✨ AI Evaluation'
        )
      );
      aiBubble.appendChild(createEl('div', undefined, outcome.evaluation.aiNote));
      feedbackBox.appendChild(aiBubble);
    } else if (!isCorrect && outcome.evaluation.aiStatus === 'disabled') {
      const aiHint = createEl('div', 'etr-bubble etr-bubble-muted');
      aiHint.appendChild(
        createEl(
          'span',
          'etr-bubble-label',
          isTr ? '✨ AI Değerlendirmesi' : '✨ AI Evaluation'
        )
      );
      aiHint.appendChild(
        createEl(
          'div',
          undefined,
          isTr
            ? 'AI değerlendirmesi kapalı (Ayarlar → AI - API Ayarları kısmından etkinleştirebilirsiniz).'
            : 'AI evaluation is disabled (enable it under AI - API Keys for smart paraphrase checks).'
        )
      );
      feedbackBox.appendChild(aiHint);
    }

    if (
      card.type === 'word' &&
      card.exampleEn &&
      card.exampleEn.trim().toLowerCase() !== card.en.trim().toLowerCase()
    ) {
      const exDiv = createEl('div', 'etr-example');
      exDiv.appendChild(createEl('div', undefined, `"${card.exampleEn}"`));
      if (card.exampleTr) {
        exDiv.appendChild(createEl('div', 'etr-example-tr', card.exampleTr));
      }
      feedbackBox.appendChild(exDiv);
    }

    const localizedRepeat = isTr
      ? outcome.nextRepeatLabel
          .replace(/^Retry in (\d+) min$/i, '$1 dk sonra tekrar')
          .replace(/^Next review in (\d+)d$/i, '$1 gün sonra tekrar')
          .replace(/^Next review in (\d+)h$/i, '$1 saat sonra tekrar')
          .replace(/^In (\d+) days?$/i, '$1 gün sonra tekrar')
          .replace(/^In (\d+) hours?$/i, '$1 saat sonra tekrar')
          .replace(/^Next review tomorrow$/i, 'Yarın tekrar')
          .replace(/^Tomorrow$/i, 'Yarın')
      : outcome.nextRepeatLabel;

    const deltaSign = outcome.ratingDelta >= 0 ? `+${outcome.ratingDelta}` : String(outcome.ratingDelta);
    const repeatNote = createEl(
      'div',
      `etr-repeat-note ${isCorrect ? 'ok' : ''}`,
      `${localizedRepeat} · ${outcome.newRating} ${deltaSign} · ${outcome.estimatedLevel}`
    );

    const conceptSlot = createEl('div');
    const renderConceptBanner = (
      concept: Pick<ConceptNote, 'label' | 'explanation'> & { sourceEn?: string },
      progressText?: string,
      includeExplanation: boolean = true
    ): void => {
      conceptSlot.replaceChildren();
      const box = createEl('div', 'etr-concept-box');
      box.appendChild(createEl('div', 'etr-concept-title', concept.label));
      const cleanExplanation = includeExplanation
        ? sanitizeConceptExplanationForCard(concept.explanation, concept.sourceEn, card.en)
        : '';
      if (cleanExplanation) {
        box.appendChild(createEl('div', undefined, cleanExplanation));
      }
      let displayProgress = progressText;
      if (isTr && displayProgress) {
        const addedMatch = displayProgress.match(
          /^📌 "(.+)" added to focus list \(next check in (\d+) questions\)\.$/
        );
        const queuedMatch = displayProgress.match(
          /^🔁 "(.+)" queued again \(next check in (\d+) questions\)\.$/
        );
        const stageMatch = displayProgress.match(
          /^🎯 "(.+)" cleared Stage (\d+) \(next check in (\d+) questions\)\.$/
        );
        const stageFinalMatch = displayProgress.match(
          /^⏳ "(.+)" cleared Stage (\d+) [–-] final retention test in (\d+) questions!$/
        );
        const masteredMatch = displayProgress.match(/^✅ "(.+)" mastered/i);
        if (addedMatch) {
          displayProgress = `📌 "${addedMatch[1]}" odak listesine eklendi (${addedMatch[2]} soru sonra tekrar).`;
        } else if (queuedMatch) {
          displayProgress = `🔁 "${queuedMatch[1]}" tekrar sıraya alındı (${queuedMatch[2]} soru sonra tekrar).`;
        } else if (stageFinalMatch) {
          displayProgress = `⏳ "${stageFinalMatch[1]}" ${stageFinalMatch[2]}. aşamayı geçti (${stageFinalMatch[3]} soru sonra son kalıcılık testi!).`;
        } else if (stageMatch) {
          displayProgress = `🎯 "${stageMatch[1]}" ${stageMatch[2]}. aşamayı geçti (${stageMatch[3]} soru sonra tekrar).`;
        } else if (masteredMatch) {
          displayProgress = `✅ "${masteredMatch[1]}" odak hedefi öğrenildi.`;
        }
      }
      box.appendChild(
        createEl(
          'div',
          'etr-concept-stage',
          displayProgress ??
            (isTr
              ? 'Odak listesine eklendi · +2, +4 ve +10 soruda tekrar'
              : 'Added to Focus · reviewed in +2, +4, +10 questions')
        )
      );
      conceptSlot.appendChild(box);
    };

    if (outcome.recordedConcept) {
      // On a passed scheduled review (no new weakPoint triggered), hide stale past-mistake text
      const isCleanReinforcementPass =
        isCorrect && !outcome.evaluation.weakPoint && Boolean(targetConcept);
      renderConceptBanner(
        outcome.recordedConcept,
        outcome.conceptProgressNote,
        !isCleanReinforcementPass
      );
    } else if (targetConcept && outcome.conceptProgressNote) {
      renderConceptBanner(targetConcept, outcome.conceptProgressNote, !isCorrect);
    }

    const flagPanel = createEl('div', 'etr-flag-panel');
    flagPanel.hidden = true;

    const flagPromptLabel = createEl(
      'span',
      'etr-label',
      isTr
        ? 'Kelime seçin veya sorunuzu yazın:'
        : 'Pick a word or type a question:'
    );
    flagPromptLabel.style.marginBottom = '6px';

    const tokens = Array.from(
      new Set(
        card.en
          .split(/\s+/)
          .map((t) => t.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, ''))
          .filter(Boolean)
      )
    );

    const chipsWrap = createEl('div', 'etr-token-chips');
    const flagInput = createEl('input', 'etr-input-sm');
    flagInput.type = 'text';
    flagInput.placeholder = isTr
      ? 'örn. cut short veya neden get kullanıldı?'
      : 'e.g. cut short or why used to?';
    isolateKeyboardEvents(flagInput);

    const flagSubmitBtn = createEl(
      'button',
      'etr-btn etr-btn-primary',
      isTr ? 'Kaydet' : 'Save'
    );
    flagSubmitBtn.type = 'button';

    const submitConceptFlag = async (token: string, question?: string): Promise<void> => {
      const cleaned = token.trim();
      if (!cleaned) {
        flagInput.focus();
        return;
      }
      flagSubmitBtn.disabled = true;
      flagSubmitBtn.textContent = '...';
      const res = await sendBgMessage<{ ok: boolean; concept?: ConceptNote; error?: string }>({
        type: 'FLAG_CONCEPT_GAP',
        cardId: card.id,
        focusToken: cleaned,
        userQuestion: question,
        card,
      });
      flagSubmitBtn.disabled = false;
      flagSubmitBtn.textContent = isTr ? 'Kaydet' : 'Save';

      if (res?.ok && res.concept) {
        flagPanel.hidden = true;
        renderConceptBanner(
          res.concept,
          isTr
            ? `"${res.concept.label}" odak listesine eklendi`
            : `"${res.concept.label}" added to Focus`
        );
      }
    };

    for (const tok of tokens) {
      const chip = createEl('button', 'etr-token-chip', tok);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        flagInput.value = tok;
        void submitConceptFlag(tok);
      });
      chipsWrap.appendChild(chip);
    }

    flagSubmitBtn.addEventListener('click', () => {
      const raw = flagInput.value.trim();
      const firstMatch = tokens.find((t) => raw.toLowerCase().includes(t.toLowerCase()));
      void submitConceptFlag(firstMatch ?? raw, raw);
    });

    flagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        flagSubmitBtn.click();
      }
    });

    const flagRow = createEl('div', 'etr-flag-row');
    flagRow.append(flagInput, flagSubmitBtn);
    flagPanel.append(flagPromptLabel, chipsWrap, flagRow);

    // Instant AI Tutor Q&A panel on Recall card
    const askAiPanel = createEl('div', 'etr-flag-panel etr-ask-panel');
    askAiPanel.hidden = true;

    const askAiLabel = createEl(
      'span',
      'etr-label',
      isTr ? '✨ AI Öğretmene Sor (Neden böyle?):' : '✨ Ask AI Tutor:'
    );
    askAiLabel.style.marginBottom = '5px';

    const askAiHistory: Array<{ role: 'user' | 'assistant'; text: string }> = [];
    const askAiOutput = createEl('div', 'etr-ask-output');
    askAiOutput.hidden = true;

    const askAiInput = createEl('input', 'etr-input-sm');
    askAiInput.type = 'text';
    askAiInput.placeholder = isTr
      ? 'Örn: Neden "run" kullanılıyor, koşmak değil mi?'
      : 'e.g. Why is this word used here?';
    isolateKeyboardEvents(askAiInput);

    const askAiSendBtn = createEl(
      'button',
      'etr-btn etr-btn-primary',
      isTr ? 'Sor' : 'Ask'
    );
    askAiSendBtn.type = 'button';

    const submitAskAi = async (): Promise<void> => {
      const q = askAiInput.value.trim();
      if (!q) {
        askAiInput.focus();
        return;
      }
      askAiSendBtn.disabled = true;
      askAiSendBtn.textContent = '...';
      askAiOutput.hidden = false;
      askAiOutput.textContent = isTr ? '✨ AI düşünüyor...' : '✨ Thinking...';
      const prevHist = [...askAiHistory];
      askAiHistory.push({ role: 'user', text: q });
      const res = await sendBgMessage<{
        ok: boolean;
        answer?: string;
        error?: string;
      }>({
        type: 'ASK_AI_TUTOR',
        question: q,
        history: prevHist,
        context: {
          sentenceEn: card.en,
          meaningTr: card.acceptedTr.join(', '),
          userAnswer: userAnswer || undefined,
          expectedAnswer: card.acceptedTr[0],
          existingExplanation: outcome.evaluation.aiNote,
        },
      });
      askAiSendBtn.disabled = false;
      askAiSendBtn.textContent = isTr ? 'Sor' : 'Ask';
      if (res?.ok && res.answer) {
        askAiHistory.push({ role: 'assistant', text: res.answer });
        askAiInput.value = '';
        askAiOutput.textContent = res.answer;
      } else {
        askAiHistory.pop();
        askAiOutput.textContent =
          res?.error ||
          (isTr
            ? 'AI şu an yanıt veremedi (Ayarlar → AI bölümünden ücretsiz anahtar eklenebilir).'
            : 'AI unavailable right now (enable AI in Settings).');
      }
    };

    askAiSendBtn.addEventListener('click', () => void submitAskAi());
    askAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submitAskAi();
      }
    });

    const askAiRow = createEl('div', 'etr-flag-row');
    askAiRow.append(askAiInput, askAiSendBtn);
    askAiPanel.append(askAiLabel, askAiOutput, askAiRow);

    cardEl.append(header, enEl, feedbackBox, repeatNote, conceptSlot, flagPanel, askAiPanel);

    const footer = createEl('div', 'etr-outcome-footer');
    const nextBtn = createEl('button', 'etr-btn etr-btn-next', ui.nextQuestion);
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', async () => {
      nextBtn.disabled = true;
      nextBtn.textContent = '...';
      await sendBgMessage({ type: 'TRIGGER_NOW' });
    });

    const secondaryRow = createEl('div', 'etr-outcome-secondary');
    if (!isCorrect && userAnswer) {
      const overrideBtn = createEl(
        'button',
        'etr-btn etr-btn-ghost',
        isTr ? '✓ Doğru Say' : '✓ Correct'
      );
      overrideBtn.type = 'button';
      overrideBtn.title = isTr
        ? 'Cevabım doğruydu, kabul et'
        : 'Accept my translation';
      overrideBtn.addEventListener('click', async () => {
        overrideBtn.disabled = true;
        overrideBtn.textContent = '...';
        const res = await sendBgMessage<{ ok: boolean; result?: AnswerOutcomeResult }>({
          type: 'OVERRIDE_CORRECT',
          cardId: card.id,
          card,
        });
        if (res?.ok && res.result) {
          renderOutcomeView(userAnswer, res.result);
        }
      });
      secondaryRow.appendChild(overrideBtn);
    }

    const askAiToggleBtn = createEl(
      'button',
      'etr-btn etr-btn-ghost',
      isTr ? '💬 AI’a Sor' : '💬 Ask AI'
    );
    askAiToggleBtn.type = 'button';
    askAiToggleBtn.title = isTr
      ? 'Bu cümle hakkında yapay zekâya soru sor'
      : 'Ask the AI tutor about this card';
    askAiToggleBtn.addEventListener('click', () => {
      flagPanel.hidden = true;
      askAiPanel.hidden = !askAiPanel.hidden;
      if (!askAiPanel.hidden) askAiInput.focus();
    });

    const flagToggleBtn = createEl(
      'button',
      'etr-btn etr-btn-ghost',
      isTr ? 'Takıldım' : 'Flag'
    );
    flagToggleBtn.type = 'button';
    flagToggleBtn.title = isTr
      ? 'Kelime veya gramer kuralını odak listesine ekle'
      : 'Pin word or grammar rule for review';
    flagToggleBtn.addEventListener('click', () => {
      askAiPanel.hidden = true;
      flagPanel.hidden = !flagPanel.hidden;
      if (!flagPanel.hidden) flagInput.focus();
    });

    const closeNowBtn = createEl(
      'button',
      'etr-btn etr-btn-secondary',
      ui.closeBtn
    );
    closeNowBtn.type = 'button';
    closeNowBtn.addEventListener('click', removeRecallWidget);

    secondaryRow.append(askAiToggleBtn, flagToggleBtn, closeNowBtn);
    footer.append(secondaryRow, nextBtn);
    cardEl.appendChild(footer);
  };

  renderQuestionView();
  escapeKeyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      void sendBgMessage({ type: 'DISMISS_PROMPT', cardId: card.id });
      removeRecallWidget();
    }
  };
  window.addEventListener('keydown', escapeKeyHandler);

  wrap.appendChild(cardEl);
  shadow.append(style, wrap);
  (document.body ?? document.documentElement).appendChild(host);
}
