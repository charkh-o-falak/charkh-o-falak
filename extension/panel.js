// Charkh o Falak — popup controller
'use strict';

const FLOW_URL = 'https://flow.google.com/';
const CONTENT_SCRIPT_ID = 'flow-helper';
const UNSUPPORTED_COUNTRY_PATH = '/unsupported-country';

const STATES = {
  enabled: ['ok', 'روشن است', 'افزونه روشن است. برای اعمال تغییرات، تب Flow را دوباره بارگذاری کنید.'],
  disabled: ['idle', 'خاموش است', 'افزونه خاموش است. برای اعمال تغییر، تب باز Flow را دوباره بارگذاری کنید.'],
  active: ['ok', 'در حال فعالیت', 'موتور در این تب یک پاسخ را پردازش کرده است.'],
  armed: ['armed', 'آماده به کار', 'موتور منتظر پاسخ Flow است.'],
  awaitingSpec: ['armed', 'در حال آماده‌سازی', 'تنظیمات محلی در حال بارگذاری هستند.'],
  specUnavailable: ['warn', 'نیازمند بررسی', 'بارگذاری تنظیمات محلی ناموفق بود.'],
  schemaMismatch: ['bad', 'نیازمند به‌روزرسانی', 'ساختار پاسخ Flow احتمالاً تغییر کرده است.'],
  reloadTab: ['warn', 'نیازمند بارگذاری مجدد', 'برای فعال شدن افزونه، این تب Flow را دوباره بارگذاری کنید.'],
  saved: ['ok', 'تغییر ثبت شد', 'برای اعمال تغییر، تب Flow را دوباره بارگذاری کنید.'],
};

const toggle = document.getElementById('toggle');
const powerLabel = document.getElementById('powerLabel');
const statusEl = document.getElementById('status');
const statusDot = statusEl.querySelector('.status-dot');
const statusText = statusEl.querySelector('.status-text');
const errorEl = document.getElementById('error');
const reloadButton = document.getElementById('reload');
const openButton = document.getElementById('open');
let activeTab = null;

function setStatus(name) {
  const [color, title, description] = STATES[name] || STATES.reloadTab;
  powerLabel.textContent = title;
  statusDot.className = `status-dot status-dot--${color}`;
  statusText.textContent = description;
}
function setEnabled(value) {
  toggle.setAttribute('aria-checked', String(Boolean(value)));
}
function isFlowTab(tab) {
  if (!tab?.url) return false;
  try { return new URL(tab.url).origin === 'https://flow.google.com'; }
  catch { return false; }
}
function statusFromMessage(message) {
  if (message?.applied) return 'active';
  if (message?.state === 'armed') return 'armed';
  if (message?.state === 'awaiting-spec') return 'awaitingSpec';
  if (message?.state?.startsWith('spec unavailable') || message?.state?.startsWith('spec invalid')) return 'specUnavailable';
  if (message?.state?.startsWith('schema mismatch')) return 'schemaMismatch';
  return 'reloadTab';
}
async function init() {
  const registrations = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  const enabled = registrations.length > 0;
  setEnabled(enabled);
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onFlowTab = isFlowTab(activeTab);
  reloadButton.hidden = !onFlowTab;
  setStatus(enabled ? 'enabled' : 'disabled');

  if (onFlowTab && enabled) {
    try {
      const message = await chrome.tabs.sendMessage(activeTab.id, {type: 'status'});
      setStatus(statusFromMessage(message));
    } catch { setStatus('reloadTab'); }
  }
  toggle.disabled = false;
}

toggle.addEventListener('click', async () => {
  const current = toggle.getAttribute('aria-checked') === 'true';
  const desired = !current;
  toggle.disabled = true;
  errorEl.textContent = '';
  try {
    const response = await chrome.runtime.sendMessage({type: 'setEnabled', enabled: desired});
    if (!response?.ok) throw new Error(response?.error || 'تغییر وضعیت افزونه ناموفق بود.');
    setEnabled(desired);
    setStatus(desired ? 'enabled' : 'disabled');
  } catch (error) {
    setEnabled(current);
    errorEl.textContent = error.message || 'خطای نامشخص در تغییر وضعیت افزونه.';
  } finally { toggle.disabled = false; }
});

openButton.addEventListener('click', () => chrome.tabs.create({url: FLOW_URL}));
reloadButton.addEventListener('click', async () => {
  errorEl.textContent = '';
  try {
    const tab = await chrome.tabs.get(activeTab.id);
    if (!isFlowTab(tab)) throw new Error('ابتدا یک تب Google Flow را باز کنید.');
    const url = new URL(tab.url);
    if (url.pathname.endsWith(UNSUPPORTED_COUNTRY_PATH)) {
      url.pathname = url.pathname.slice(0, -UNSUPPORTED_COUNTRY_PATH.length) || '/';
      await chrome.tabs.update(tab.id, {url: url.href});
    } else {
      await chrome.tabs.reload(tab.id);
    }
    window.close();
  } catch (error) { errorEl.textContent = error.message || 'بارگذاری مجدد ناموفق بود.'; }
});
init().catch(error => {
  setStatus('specUnavailable');
  errorEl.textContent = error.message || 'امکان دریافت وضعیت افزونه نیست.';
  toggle.disabled = false;
});
