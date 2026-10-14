(() => {
  'use strict';

  // Protocol message names must match engine.js exactly.
  const SPEC_RESPONSE_TYPE = 'charkh-flow-spec';
  const SPEC_REQUEST_TYPE = 'charkh-flow-spec-request';

  // undefined = not yet requested; null = requested but unavailable.
  let cachedSpec;

  async function getFlowSpec() {
    if (cachedSpec !== undefined) {
      return cachedSpec;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'getSpec' });
      cachedSpec = response?.ok && response.spec ? response.spec : null;
    } catch {
      cachedSpec = null;
    }

    return cachedSpec;
  }

  function sendSpecToPage(spec) {
    window.postMessage({ type: SPEC_RESPONSE_TYPE, spec }, location.origin);
  }

  window.addEventListener('message', event => {
    if (event.source !== window) {
      return;
    }
    if (event.data?.type !== SPEC_REQUEST_TYPE) {
      return;
    }
    getFlowSpec().then(sendSpecToPage);
  });

  getFlowSpec().then(sendSpecToPage);
})();
