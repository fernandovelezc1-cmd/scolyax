/**
 * Scolyax Anti-Distraction Extension — Background Service Worker v1.1
 *
 * Two responsibilities:
 *  1. DETECT: Broadcast the active tab URL to Scolyax tabs (existing behavior)
 *  2. BLOCK:  When a study session is active, redirect any tab that navigates to
 *             a blocked platform to the extension's blocked.html page.
 *
 * Session state is stored in chrome.storage.session so it survives service-worker
 * restarts within the same browser session but resets when the browser closes.
 */

const SCOLYAX_URL = 'https://scolyax.vercel.app'

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Strip scheme/leading slashes and return just the hostname-like domain string. */
function cleanDomain(raw) {
  return raw.replace(/^\/\//, '').toLowerCase().trim()
}

/**
 * Return true if `url` belongs to one of the `blockedDomains`.
 * Matches exact hostname AND any subdomain (e.g. "www.netflix.com" for "netflix.com").
 */
function isBlocked(url, blockedDomains) {
  if (!url || !blockedDomains || !blockedDomains.length) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return blockedDomains.some(raw => {
      const domain = cleanDomain(raw)
      return hostname === domain || hostname.endsWith('.' + domain)
    })
  } catch (_) {
    return false
  }
}

/** Build the URL for the block page, passing the originally-requested URL for context. */
function blockPageUrl(originalUrl) {
  return chrome.runtime.getURL('blocked.html') +
    '?blocked=' + encodeURIComponent(originalUrl)
}

// ─── Session state ──────────────────────────────────────────────────────────

async function getSession() {
  try {
    const data = await chrome.storage.session.get(['sessionActive', 'blockedDomains', 'methodName'])
    return {
      active: !!data.sessionActive,
      blockedDomains: data.blockedDomains || [],
      methodName: data.methodName || ''
    }
  } catch (_) {
    return { active: false, blockedDomains: [], methodName: '' }
  }
}

async function startSession(blockedDomains, methodName) {
  await chrome.storage.session.set({
    sessionActive: true,
    blockedDomains,
    methodName: methodName || ''
  })
}

async function endSession() {
  await chrome.storage.session.set({ sessionActive: false, blockedDomains: [] })
}

// ─── Block-check for a tab ──────────────────────────────────────────────────

async function checkAndBlock(tabId, url) {
  if (!url || url.startsWith('chrome') || url.startsWith('about') ||
      url.startsWith(chrome.runtime.getURL(''))) return

  const session = await getSession()
  if (!session.active) return
  if (!isBlocked(url, session.blockedDomains)) return

  // Redirect to block page
  try {
    await chrome.tabs.update(tabId, { url: blockPageUrl(url) })
  } catch (_) {}
}

// ─── Tab event listeners ────────────────────────────────────────────────────

/**
 * Broadcast the currently-active tab's URL to every OTHER tab in the same window.
 * Scolyax's content script (running in the background tab) will relay this to the page.
 */
async function broadcastActiveUrl(tabId, windowId) {
  try {
    const activeTab = await chrome.tabs.get(tabId)
    const url = activeTab.url || activeTab.pendingUrl || ''
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return

    // Block check (new in v1.1)
    await checkAndBlock(tabId, url)

    const tabs = await chrome.tabs.query({ windowId })
    for (const tab of tabs) {
      if (tab.id && tab.id !== tabId) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SCOLYAX_TAB_SWITCHED',
          url
        }).catch(() => {})
      }
    }
  } catch (_) {}
}

// User switches to a different tab
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  broadcastActiveUrl(tabId, windowId)
})

// URL changes inside any tab (SPA navigation or address-bar navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Block check on the new URL
  if (changeInfo.url) {
    await checkAndBlock(tabId, changeInfo.url)
  }

  // Original broadcast behavior: only when the changed tab is the active one
  if (!changeInfo.url) return
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (active?.id === tabId) {
      broadcastActiveUrl(tabId, active.windowId)
    }
  } catch (_) {}
})

// ─── Message handler (from content.js / React app) ─────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SESSION_START') {
    startSession(message.blockedDomains || [], message.methodName || '')
      .then(() => sendResponse({ ok: true }))
    return true // async
  }

  if (message.type === 'SESSION_END') {
    endSession().then(() => sendResponse({ ok: true }))
    return true
  }

  if (message.type === 'SESSION_UPDATE_PLATFORMS') {
    chrome.storage.session.get(['methodName']).then(data => {
      startSession(message.blockedDomains || [], data.methodName || '')
        .then(() => sendResponse({ ok: true }))
    })
    return true
  }
})
