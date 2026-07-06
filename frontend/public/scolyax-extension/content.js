/**
 * Scolyax Anti-Distraction Extension — Content Script v1.1
 *
 * Injected into every page. When running inside a Scolyax tab it bridges:
 *   background → content script → window.postMessage → React app
 *   React app  → window.postMessage → content script → background (NEW in v1.1)
 *
 * When running in any other page it stays silent (no session relaying needed).
 */

/** Announce that the extension is present to whatever page we're in. */
function announceReady() {
  window.postMessage({ source: 'scolyax-extension', type: 'SCOLYAX_EXTENSION_READY' }, '*')
}

// Announce immediately, and retry for pages that load React asynchronously
announceReady()
setTimeout(announceReady, 800)
setTimeout(announceReady, 2500)

// Reply to explicit pings from the React app (handles late-mount scenarios)
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const msg = event.data || {}
  if (msg.source !== 'scolyax-app') return

  // Ping: just re-announce
  if (msg.type === 'SCOLYAX_PING') {
    announceReady()
    return
  }

  // Session control: relay from React app → background service worker
  if (
    msg.type === 'SESSION_START' ||
    msg.type === 'SESSION_END' ||
    msg.type === 'SESSION_UPDATE_PLATFORMS'
  ) {
    chrome.runtime.sendMessage({
      type: msg.type,
      blockedDomains: msg.blockedDomains || [],
      methodName: msg.methodName || ''
    }).catch(() => {}) // Ignore if background not ready
  }
})

// Relay tab-switch messages from the background service worker to the page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SCOLYAX_TAB_SWITCHED') {
    window.postMessage({
      source: 'scolyax-extension',
      type: 'SCOLYAX_TAB_SWITCHED',
      url: message.url
    }, '*')
  }
})
