// Shared PriceMaster cache for Sales / Sales Edit.
// Loads the whole PriceMaster in one call (getPriceMasterAll) and keeps it in localStorage for
// 24 hours, so model/variant/accessory selection needs no server call after the first load of
// the day. Uses the same storage key as CRM Quote, so the cache is shared between the pages.
const PMCache = (function () {
  const KEY = 'pm_cache_v1';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  let data = null; // { models, variantsByModel, details }

  function readStored() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY));
      if (p && p.data && p.data.models) return p;
    } catch (e) {}
    return null;
  }

  async function fetchFresh() {
    const r = await API.getPriceMasterAll();
    if (r && r.success) {
      data = { models: r.models || [], variantsByModel: r.variantsByModel || {}, details: r.details || {} };
      try { localStorage.setItem(KEY, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) {}
      return true;
    }
    return false;
  }

  // Fresh cache (< 24h) is used as-is; otherwise refetch, falling back to a stale copy if the
  // server is unreachable so the form still works.
  async function ensure() {
    if (data) return data;
    const stored = readStored();
    if (stored && (Date.now() - (stored.ts || 0)) < MAX_AGE_MS) { data = stored.data; return data; }
    try { if (await fetchFresh()) return data; } catch (e) {}
    if (stored) data = stored.data;
    return data;
  }

  return {
    ensure: ensure,
    models: function () { return data ? data.models : null; },
    variants: function (model) { return data && data.variantsByModel[model] ? data.variantsByModel[model] : null; },
    details: function (model, variant) { return data && data.details[model + '|' + variant] ? data.details[model + '|' + variant] : null; }
  };
})();
