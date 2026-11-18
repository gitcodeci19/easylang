import { resolveSupportedLanguage } from './i18n';
import type {
  AiProviderIndex,
  AiTutorChatTurn,
  AiTutorContext,
  Card,
  ExtensionMessage,
  FeedbackLanguageMode,
} from './types';

export interface OpenAiTutorDrawerOptions {
  host: HTMLElement;
  context: AiTutorContext;
  card?: Card;
  uiLanguage: FeedbackLanguageMode;
  aiActive: boolean;
  crimson?: boolean;
  /** Optional persistent turn history for the current exercise so reopening keeps context. */
  history?: AiTutorChatTurn[];
  /** Optional unsent draft text to restore in the tutor input box. */
  draftQuestion?: string;
  /** Invoked whenever user/assistant turns change so active sessions can persist chat state immediately. */
  onHistoryChanged?: (history: AiTutorChatTurn[]) => void;
  /** Invoked as the learner types a question so unsent input survives popup close. */
  onDraftChanged?: (draft: string) => void;
  /** Invoked when the user closes the drawer so active sessions can persist `tutorOpen: false`. */
  onClosed?: () => void;
}

/**
 * Open a compact, context-aware slide-up AI Tutor Q&A overlay inside any lesson container
 * so the learner can immediately ask "Why is 'run' used here?" mid-exercise or after checking.
 */
export function openAiTutorDrawer(options: OpenAiTutorDrawerOptions): void {
  const isTr = resolveSupportedLanguage(options.uiLanguage) === 'tr';
  const existing = options.host.querySelector('.ait-overlay');
  if (existing) {
    existing.remove();
  }

  const history: AiTutorChatTurn[] = options.history ?? [];

  const overlay = document.createElement('div');
  overlay.className = `ait-overlay ${options.crimson ? 'is-crimson' : ''}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  // Stop keyboard shortcuts on underlying exercise from firing while drawer is open
  const stopBubble = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDrawer();
      return;
    }
    e.stopPropagation();
  };

  const closeDrawer = (): void => {
    overlay.removeEventListener('keydown', stopBubble);
    overlay.remove();
    options.onClosed?.();
  };

  overlay.addEventListener('keydown', stopBubble);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDrawer();
  });

  const panel = document.createElement('div');
  panel.className = 'ait-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'ait-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'ait-title-wrap';
  const titleEl = document.createElement('span');
  titleEl.className = 'ait-title';
  titleEl.textContent = isTr ? '✨ AI Öğretmene Sor' : '✨ Ask AI Tutor';
  titleWrap.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ait-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = isTr ? 'Kapat (Esc)' : 'Close (Esc)';
  closeBtn.addEventListener('click', closeDrawer);

  header.append(titleWrap, closeBtn);
  panel.appendChild(header);

  // Context pill showing the current sentence / user attempt so the learner sees AI has full context
  const ctxStrip = document.createElement('div');
  ctxStrip.className = 'ait-context-strip';
  const ctxMain = document.createElement('div');
  ctxMain.className = 'ait-context-en';
  ctxMain.textContent =
    options.context.expectedAnswer || options.context.sentenceEn || options.context.promptText || '';
  ctxStrip.appendChild(ctxMain);

  const subParts: string[] = [];
  if (options.context.meaningTr) subParts.push(options.context.meaningTr);
  if (options.context.userAnswer && options.context.userAnswer !== '(skipped)') {
    subParts.push(
      isTr ? `Cevabın: "${options.context.userAnswer}"` : `Your answer: "${options.context.userAnswer}"`
    );
  }
  if (subParts.length > 0) {
    const ctxSub = document.createElement('div');
    ctxSub.className = 'ait-context-sub';
    ctxSub.textContent = subParts.join(' · ');
    ctxStrip.appendChild(ctxSub);
  }
  panel.appendChild(ctxStrip);

  // Messages area
  const messagesEl = document.createElement('div');
  messagesEl.className = 'ait-messages';

  const appendBubble = (
    role: 'user' | 'assistant' | 'error',
    text: string,
    meta?: { providerIndex?: AiProviderIndex; suggestedFocusToken?: string }
  ): HTMLElement => {
    const row = document.createElement('div');
    row.className = `ait-msg ait-msg-${role}`;

    const body = document.createElement('div');
    body.className = 'ait-msg-text';
    body.textContent = text;
    row.appendChild(body);

    if (role === 'assistant') {
      const foot = document.createElement('div');
      foot.className = 'ait-msg-foot';

      if (meta?.providerIndex) {
        const prov = document.createElement('span');
        prov.className = 'ait-prov-tag';
        prov.textContent = `AI${meta.providerIndex}`;
        foot.appendChild(prov);
      }

      if (options.card && meta?.suggestedFocusToken) {
        const pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.className = 'ait-pin-btn';
        pinBtn.textContent = isTr
          ? `📌 "${meta.suggestedFocusToken}" zayıf noktama ekle`
          : `📌 Pin "${meta.suggestedFocusToken}" to focus`;
        pinBtn.addEventListener('click', async () => {
          pinBtn.disabled = true;
          pinBtn.textContent = isTr ? 'Ekleniyor...' : 'Saving...';
          try {
            const res = (await chrome.runtime.sendMessage({
              type: 'FLAG_CONCEPT_GAP',
              cardId: options.card!.id,
              focusToken: meta.suggestedFocusToken!,
              userQuestion: history[history.length - 2]?.text,
              card: options.card,
            } satisfies ExtensionMessage)) as { ok?: boolean };
            pinBtn.textContent = res?.ok
              ? isTr
                ? `✓ "${meta.suggestedFocusToken}" Özel Derslere eklendi`
                : `✓ "${meta.suggestedFocusToken}" saved to Focus`
              : isTr
                ? 'Eklenemedi'
                : 'Failed';
          } catch {
            pinBtn.textContent = isTr ? 'Eklenemedi' : 'Failed';
          }
        });
        foot.appendChild(pinBtn);
      }

      if (foot.childElementCount > 0) {
        row.appendChild(foot);
      }
    }

    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  };

  if (history.length === 0) {
    const emptyHint = document.createElement('div');
    emptyHint.className = 'ait-empty-hint';
    emptyHint.textContent = options.aiActive
      ? isTr
        ? 'Aklına takılanı doğrudan sor (ör. "Neden run kullanılıyor, koşmak değil mi?") veya alttaki hızlı butonlardan birine tıkla:'
        : 'Ask anything confusing about this sentence, or tap a quick question below:'
      : isTr
        ? 'AI Öğretmen şu an kapalı. Ayarlar → AI - API Ayarları bölümünden ücretsiz Groq/NVIDIA/AMD anahtarı ekleyerek anlık soru sorabilirsin.'
        : 'AI Tutor is off. Add a free Groq/NVIDIA/AMD API key in Settings → AI Evaluation to ask live questions.';
    messagesEl.appendChild(emptyHint);
  } else {
    for (const turn of history) {
      appendBubble(turn.role, turn.text);
    }
  }
  panel.appendChild(messagesEl);

  // Quick-question chips
  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'ait-quick-chips';

  const quickPrompts: Array<{ label: string; prompt: string }> = isTr
    ? [
        ...(options.context.userAnswer && options.context.userAnswer !== '(skipped)'
          ? [
              {
                label: '❓ Neden yanlış?',
                prompt: 'Benim cevabım neden yanlış ve doğrusu neden tam olarak böyle kuruluyor?',
              },
            ]
          : []),
        {
          label: '🔍 Kelime kelime açıkla',
          prompt: 'Bu cümleyi kelime kelime ve kalıp mantığıyla kısaca açıklar mısın?',
        },
        {
          label: '✨ 2 günlük örnek',
          prompt: 'Bu yapıyı günlük modern İngilizcede 2 farklı kısa örnekle gösterir misin?',
        },
      ]
    : [
        ...(options.context.userAnswer && options.context.userAnswer !== '(skipped)'
          ? [
              {
                label: '❓ Why wrong?',
                prompt: 'Why is my answer wrong and why is the expected sentence phrased that way?',
              },
            ]
          : []),
        {
          label: '🔍 Word by word',
          prompt: 'Break this sentence down word by word and explain any idiom or grammar rule.',
        },
        {
          label: '✨ 2 everyday examples',
          prompt: 'Give 2 short modern everyday examples using the same pattern.',
        },
      ];

  // Input form
  const inputRow = document.createElement('form');
  inputRow.className = 'ait-input-row';

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'ait-input';
  inputEl.placeholder = isTr
    ? 'Örn: Neden "run" kullanılıyor, koşmak değil mi?'
    : 'e.g. Why is "run" used here?';
  inputEl.autocomplete = 'off';
  inputEl.disabled = !options.aiActive;
  if (options.draftQuestion) {
    inputEl.value = options.draftQuestion;
  }
  inputEl.addEventListener('input', () => {
    options.onDraftChanged?.(inputEl.value);
  });

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'ait-send-btn';
  sendBtn.textContent = isTr ? 'Sor' : 'Ask';
  sendBtn.disabled = !options.aiActive;

  let busy = false;
  const submitQuestion = async (rawQuestion: string): Promise<void> => {
    const q = rawQuestion.trim();
    if (!q || busy || !options.aiActive) return;

    busy = true;
    inputEl.value = '';
    options.onDraftChanged?.('');
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    // Remove initial hint on first message
    messagesEl.querySelector('.ait-empty-hint')?.remove();

    appendBubble('user', q);
    const thinkingRow = appendBubble(
      'assistant',
      isTr ? '✨ AI düşünüyor...' : '✨ AI is thinking...'
    );
    thinkingRow.classList.add('is-loading');

    const snapshotHistory = [...history];
    history.push({ role: 'user', text: q });
    options.onHistoryChanged?.([...history]);

    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'ASK_AI_TUTOR',
        question: q,
        context: options.context,
        history: snapshotHistory,
        language: options.uiLanguage,
      } satisfies ExtensionMessage)) as {
        ok?: boolean;
        answer?: string;
        suggestedFocusToken?: string;
        providerIndex?: AiProviderIndex;
        error?: string;
      };

      thinkingRow.remove();

      if (res?.ok && res.answer) {
        history.push({ role: 'assistant', text: res.answer });
        options.onHistoryChanged?.([...history]);
        appendBubble('assistant', res.answer, {
          providerIndex: res.providerIndex,
          suggestedFocusToken: res.suggestedFocusToken,
        });
      } else {
        history.pop();
        options.onHistoryChanged?.([...history]);
        appendBubble(
          'error',
          res?.error ||
            (isTr
              ? 'AI şu an yanıt veremedi. Lütfen tekrar dene.'
              : 'AI could not answer right now. Please try again.')
        );
      }
    } catch (err) {
      thinkingRow.remove();
      history.pop();
      options.onHistoryChanged?.([...history]);
      const msg = err instanceof Error ? err.message : String(err);
      appendBubble('error', msg || (isTr ? 'Bağlantı hatası.' : 'Connection error.'));
    } finally {
      busy = false;
      inputEl.disabled = !options.aiActive;
      sendBtn.disabled = !options.aiActive;
      sendBtn.textContent = isTr ? 'Sor' : 'Ask';
      inputEl.focus();
    }
  };

  for (const qp of quickPrompts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ait-chip';
    chip.textContent = qp.label;
    chip.disabled = !options.aiActive;
    chip.addEventListener('click', () => {
      void submitQuestion(qp.prompt);
    });
    chipsWrap.appendChild(chip);
  }

  inputRow.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitQuestion(inputEl.value);
  });

  inputRow.append(inputEl, sendBtn);
  panel.append(chipsWrap, inputRow);
  overlay.appendChild(panel);
  options.host.appendChild(overlay);

  if (options.aiActive) {
    setTimeout(() => inputEl.focus(), 20);
  }
}
