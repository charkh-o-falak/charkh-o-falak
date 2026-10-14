// Charkh o Falak — Chrome extension
// No external configuration-server requests are performed.
const REGISTRATION = {
  id: 'flow-helper',
  matches: ['https://flow.google.com/*'],
  js: ['engine.js'],
  runAt: 'document_start',
  world: 'MAIN',
  persistAcrossSessions: true
};
const REGISTRATION_IDS = [REGISTRATION.id];
let specInFlight = null;
async function getLocalSpec() {
  if (!specInFlight) {
    specInFlight = fetch(chrome.runtime.getURL('flow-spec.json'))
      .then(response => {
        if (!response.ok) throw new Error('Local configuration HTTP ' + response.status);
        return response.json();
      })
      .then(spec => {
        if (spec?.v !== 1 ||
            spec.origin !== 'https://flow.google.com' ||
            typeof spec.path !== 'string' ||
            typeof spec.rpcids !== 'string' ||
            typeof spec.tag !== 'string' ||
            !Number.isInteger(spec.flagIndex) ||
            !Number.isInteger(spec.minLength)) {
          throw new Error('Invalid local configuration');
        }
        return spec;
      })
      .catch(error => {
        console.warn('Charkh o Falak local spec:', error.message);
        specInFlight = null;
        return null;
      });
  }
  return specInFlight;
}
chrome.runtime.onInstalled.addListener(async ({reason}) => {
  if (reason !== 'install') return;
  try { await chrome.scripting.registerContentScripts([REGISTRATION]); }
  catch (error) { console.error('Charkh o Falak setup:', error.message); }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'getSpec') {
    getLocalSpec().then(spec => sendResponse({ok: !!spec, spec}));
    return true;
  }
  if (!sender.tab && message?.type === 'setEnabled') {
    (async () => {
      const entries = await chrome.scripting.getRegisteredContentScripts({ids: REGISTRATION_IDS});
      if (message.enabled && entries.length === 0) await chrome.scripting.registerContentScripts([REGISTRATION]);
      if (!message.enabled && entries.length > 0) await chrome.scripting.unregisterContentScripts({ids: REGISTRATION_IDS});
      sendResponse({ok: true});
    })().catch(error => sendResponse({ok: false, error: error.message}));
    return true;
  }
});
