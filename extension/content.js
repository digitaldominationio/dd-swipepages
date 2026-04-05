/* Swipe Toolkit — Content Script (injected into every page) */

// Track the last non-empty selection so it survives popup click deselection
let lastSelection = '';

document.addEventListener('mouseup', () => {
  const text = window.getSelection()?.toString()?.trim() || '';
  if (text) lastSelection = text;
});

document.addEventListener('keyup', () => {
  const text = window.getSelection()?.toString()?.trim() || '';
  if (text) lastSelection = text;
});

// Respond to selection requests from the popup / background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const current = window.getSelection()?.toString()?.trim() || '';
    sendResponse({ text: current || lastSelection });
  }
});
