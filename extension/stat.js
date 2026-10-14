// Read-only diagnostic endpoint for the popup. No user data is transmitted.
'use strict';

const DIAGNOSTIC_ATTRIBUTE = 'data-flow-local-diagnostic';
const MAX_STATE_LENGTH = 80;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'status') return;

  let diagnostic;
  try {
    diagnostic = JSON.parse(
      document.documentElement.getAttribute(DIAGNOSTIC_ATTRIBUTE) || 'null'
    );
  } catch {
    // Malformed or unavailable attribute: report not-loaded below.
  }

  sendResponse({
    state: typeof diagnostic?.state === 'string'
      ? diagnostic.state.slice(0, MAX_STATE_LENGTH)
      : 'not-loaded',
    applied: diagnostic?.applied > 0
  });
});
