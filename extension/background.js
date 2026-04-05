/* Swipe Toolkit — Manifest V3 Service Worker */

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'swipe-generate-ai',
    title: 'Generate with AI',
    contexts: ['selection'],
  });
});

// Handle context-menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'swipe-generate-ai' && info.selectionText) {
    // Store the selected text so the popup can pick it up
    chrome.storage.local.set({ pendingSelection: info.selectionText });
    // Open the popup programmatically (best-effort; Chrome may block this)
    chrome.action.openPopup().catch(() => {
      // Fallback: the user can open the popup manually
    });
  }
});

// Relay messages between content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    // Ask the active tab's content script for the current selection
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTION' }, (response) => {
          sendResponse(response || { text: '' });
        });
      } else {
        sendResponse({ text: '' });
      }
    });
    return true; // keep the channel open for async response
  }

  if (message.type === 'CLEAR_PENDING_SELECTION') {
    chrome.storage.local.remove('pendingSelection');
    sendResponse({ ok: true });
    return false;
  }
});
