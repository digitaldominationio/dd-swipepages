/* Swipe Toolkit — Content Script (injected into every page) */

// Respond to selection requests from the popup / background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const text = window.getSelection()?.toString()?.trim() || '';
    sendResponse({ text });
  }
});
