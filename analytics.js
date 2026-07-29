(() => {
  const STORAGE_KEY = 'botyr_analytics_events_v1';
  const VISITOR_KEY = 'botyr_visitor_id_v1';
  const SESSION_KEY = 'botyr_session_id_v1';
  const MAX_LOCAL_EVENTS = 500;

  const createId = prefix => {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${random}`;
  };
  const getOrCreate = (storage, key, prefix) => {
    let value = storage.getItem(key);
    if (!value) {
      value = createId(prefix);
      storage.setItem(key, value);
    }
    return value;
  };

  const visitorId = getOrCreate(localStorage, VISITOR_KEY, 'visitor');
  const sessionId = getOrCreate(sessionStorage, SESSION_KEY, 'session');
  const adapters = new Set();

  const readEvents = () => {
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(events) ? events : [];
    } catch {
      return [];
    }
  };
  const persist = event => {
    const events = readEvents();
    events.push(event);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_LOCAL_EVENTS)));
  };
  const forwardToKnownProviders = event => {
    if (typeof globalThis.gtag === 'function') {
      globalThis.gtag('event', event.name, event.properties);
    }
    if (Array.isArray(globalThis._hmt)) {
      globalThis._hmt.push(['_trackEvent', 'botyr', event.name, JSON.stringify(event.properties)]);
    }
    adapters.forEach(adapter => {
      try { adapter(event); } catch (error) { console.warn('[analytics adapter]', error); }
    });
  };

  const track = (name, properties = {}) => {
    const event = {
      event_id: createId('event'),
      name,
      occurred_at: new Date().toISOString(),
      visitor_id: visitorId,
      session_id: sessionId,
      page: location.pathname,
      page_url: location.href,
      referrer: document.referrer || null,
      properties,
      schema_version: 1,
    };
    persist(event);
    forwardToKnownProviders(event);
    document.dispatchEvent(new CustomEvent('botyr:analytics', { detail: event }));
    return event;
  };

  globalThis.BotyrAnalytics = {
    track,
    getEvents: readEvents,
    clearLocalEvents: () => localStorage.removeItem(STORAGE_KEY),
    registerAdapter: adapter => adapters.add(adapter),
    exportJSON: () => JSON.stringify(readEvents(), null, 2),
  };

  track('page_view', { page_type: 'homepage' });

  document.addEventListener('click', event => {
    const generateCta = event.target.closest('a[href="#generator"]');
    if (generateCta) {
      track('generate_cta_click', {
        placement: generateCta.closest('.hero') ? 'hero' : generateCta.closest('.nav') ? 'navigation' : 'page',
      });
    }
    const copy = event.target.closest('#copy, .copy-script');
    if (copy) {
      track('solution_copy', { scope: copy.id === 'copy' ? 'full_plan' : 'single_script' });
    }
    const wechat = event.target.closest('.wechat-fab, #result-wechat, #upgrade-entry, #case-contact, .consult-one');
    if (wechat) {
      track('wechat_click', { placement: wechat.id || wechat.className || 'unknown' });
    }
    if (event.target.closest('#regenerate')) {
      track('regenerate_click', { source: 'result_action_bar' });
    }
  }, { capture: true });

  const form = document.querySelector('#idea-form');
  let formStarted = false;
  form?.addEventListener('input', event => {
    if (formStarted) return;
    formStarted = true;
    track('form_start', { first_field: event.target.id || 'unknown' });
  }, { capture: true });
  form?.addEventListener('submit', () => {
    track('form_submit', {
      industry: document.querySelector('#industry')?.value || 'unknown',
      has_product: Boolean(document.querySelector('#offer')?.value.trim()),
      has_facts: Boolean(document.querySelector('#facts')?.value.trim()),
      has_city: Boolean(document.querySelector('#city')?.value.trim()),
    });
  }, { capture: true });

  document.addEventListener('botyr:generation-success', event => {
    track('generation_success', {
      industry: event.detail?.industry || 'unknown',
      idea_count: event.detail?.ideaCount || 0,
    });
  });
})();
