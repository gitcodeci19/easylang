import { isUrlBlocked } from '../shared/siteFilter';
import { getSettings } from '../shared/storage';
import type { ExtensionMessage } from '../shared/types';
import { launchListeningQuiz, removeListeningQuiz } from './listeningQuiz';
import { launchPageHighlightQuiz, removePageHighlightQuiz } from './pageHighlightQuiz';
import { removeRecallWidget, renderRecallWidget, renderToast } from './widget';

declare global {
  interface Window {
    __enTrRecallInitialized?: boolean;
  }
}

async function initContentScript(): Promise<void> {
  document.getElementById('etr-pinned-popup-host')?.remove();
  if (window.__enTrRecallInitialized) return;

  const initialSettings = await getSettings();
  if (isUrlBlocked(window.location.href, initialSettings.blockedDomains)) {
    return;
  }

  window.__enTrRecallInitialized = true;

  let lastSentAt = 0;
  const THROTTLE_MS = 2000;

  const reportActivity = (): void => {
    const now = Date.now();
    if (now - lastSentAt < THROTTLE_MS) return;
    lastSentAt = now;
    try {
      void chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' } satisfies ExtensionMessage);
    } catch {
      // Extension context may be invalidated after an update
    }
  };

  window.addEventListener('mousemove', reportActivity, { passive: true });
  window.addEventListener('pointerdown', reportActivity, { passive: true });
  window.addEventListener('keydown', reportActivity, { passive: true });
  window.addEventListener('focus', reportActivity, { passive: true });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'SHOW_CARD') {
      void (async () => {
        const settings = await getSettings();
        if (isUrlBlocked(window.location.href, settings.blockedDomains)) {
          removeRecallWidget();
          sendResponse({ ok: false, blocked: true });
          return;
        }
        if (settings.skipFullscreen && document.fullscreenElement) {
          sendResponse({ ok: false, deferred: true });
          return;
        }
        renderRecallWidget(message.payload, settings);
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message.type === 'HIDE_CARD') {
      removeRecallWidget();
      removePageHighlightQuiz();
      removeListeningQuiz();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'RUN_PAGE_QUIZ') {
      void (async () => {
        const settings = await getSettings();
        if (isUrlBlocked(window.location.href, settings.blockedDomains)) {
          removePageHighlightQuiz();
          renderToast('LingoEx is blocked on this site.');
          sendResponse({ ok: false, blocked: true });
          return;
        }
        sendResponse({ ok: true });
        await launchPageHighlightQuiz();
      })();
      return true;
    }

    if (message.type === 'RUN_LISTENING_QUIZ') {
      void (async () => {
        const settings = await getSettings();
        if (isUrlBlocked(window.location.href, settings.blockedDomains)) {
          removeListeningQuiz();
          renderToast('LingoEx is blocked on this site.');
          sendResponse({ ok: false, blocked: true });
          return;
        }
        sendResponse({ ok: true });
        await launchListeningQuiz();
      })();
      return true;
    }

    if (message.type === 'SHOW_TOAST') {
      renderToast(message.message);
      sendResponse({ ok: true });
      return false;
    }

    return false;
  });
}

void initContentScript();
