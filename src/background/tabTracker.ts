import { isUrlBlocked } from '../shared/siteFilter';
import { getLastActiveTab, getSettings, setLastActiveTab } from '../shared/storage';
import type { ActiveTabRecord, ExtensionMessage } from '../shared/types';

export function isInjectableUrl(
  url: string | undefined,
  blockedDomains: string[] = []
): url is string {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  return !isUrlBlocked(url, blockedDomains);
}

export async function recordMouseTabActivity(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (!tab || tab.id === undefined) return;
  const settings = await getSettings();
  if (!isInjectableUrl(tab.url, settings.blockedDomains)) {
    return;
  }
  const record: ActiveTabRecord = {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url,
    updatedAt: Date.now(),
  };
  await setLastActiveTab(record);
}

export async function clearTabIfRemoved(removedTabId: number): Promise<void> {
  const last = await getLastActiveTab();
  if (last && last.tabId === removedTabId) {
    await setLastActiveTab(null);
  }
}

export async function clearLastActiveTabIfBlocked(blockedDomains: string[]): Promise<void> {
  const last = await getLastActiveTab();
  if (last && isUrlBlocked(last.url, blockedDomains)) {
    await setLastActiveTab(null);
  }
}

/**
 * Find the tab where the mouse most recently moved (excluding blocked domains),
 * falling back to an active or recently used injectable web tab.
 */
export async function findBestTargetTab(
  preferredTabId?: number
): Promise<{ tab: chrome.tabs.Tab | null; blockedActiveTab: boolean }> {
  const settings = await getSettings();
  const blocked = settings.blockedDomains;

  if (preferredTabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab && isUrlBlocked(tab.url, blocked)) {
        return { tab: null, blockedActiveTab: true };
      }
      if (tab && tab.id !== undefined && isInjectableUrl(tab.url, blocked)) {
        return { tab, blockedActiveTab: false };
      }
    } catch {
      // Ignore closed preferred tab
    }
  }

  // If the user is currently looking at a blocked tab in the focused window, never show on it
  const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const focusedActive = activeTabs[0];
  if (focusedActive && isUrlBlocked(focusedActive.url, blocked)) {
    return { tab: null, blockedActiveTab: true };
  }

  const last = await getLastActiveTab();
  if (last) {
    try {
      const tab = await chrome.tabs.get(last.tabId);
      if (tab && tab.id !== undefined && isInjectableUrl(tab.url, blocked)) {
        return { tab, blockedActiveTab: false };
      }
      await setLastActiveTab(null);
    } catch {
      await setLastActiveTab(null);
    }
  }

  for (const tab of activeTabs) {
    if (tab.id !== undefined && isInjectableUrl(tab.url, blocked)) {
      return { tab, blockedActiveTab: false };
    }
  }

  const allTabs = await chrome.tabs.query({});
  const webTabs = allTabs
    .filter((t) => t.id !== undefined && isInjectableUrl(t.url, blocked))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));

  return { tab: webTabs[0] ?? null, blockedActiveTab: false };
}

/**
 * Send a message to a tab's content script, injecting content.js dynamically
 * if the tab was open before the extension started or reloaded.
 */
export async function deliverMessageToTab(
  tabId: number,
  message: ExtensionMessage
): Promise<boolean> {
  const settings = await getSettings();
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isInjectableUrl(tab.url, settings.blockedDomains)) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const res = (await chrome.tabs.sendMessage(tabId, message)) as
      | { ok?: boolean; deferred?: boolean }
      | undefined;
    if (res && res.deferred) return false;
    return res ? res.ok !== false : true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      const res = (await chrome.tabs.sendMessage(tabId, message)) as
        | { ok?: boolean; deferred?: boolean }
        | undefined;
      if (res && res.deferred) return false;
      return res ? res.ok !== false : true;
    } catch {
      return false;
    }
  }
}
