/* Avatarsco — Entry Gate
   A first-visit interstitial that captures who a visitor is, fires an analytics
   event, then softly routes them into the site. It NEVER shows again on the same
   device once a visitor has answered (or skipped). Add ?resetgate to the URL to
   force it back for testing.

   Analytics: set ANALYTICS.posthogKey below to send events to your own PostHog
   dashboard. While it is null, the gate still works and events log to the console
   (same null-switch pattern as cms.js's SHEET_CSV_URL). */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────
  // Paste your PostHog project API key here to start collecting on your dashboard.
  // Leave as null to keep the gate working with no analytics wired yet.
  var ANALYTICS = {
    // Master switch. false = send nothing (events only log to the console) while you build.
    // Flip to true when you launch to start sending events to your PostHog dashboard.
    enabled: false,
    // Consent banner. false = no banner, analytics runs seamlessly (DNT is still honored).
    // Flip to true (~Aug 2026) to bring back the Accept/Decline consent banner and only fire
    // after the visitor accepts. (Also restore the consent wording in privacy.html 02/05.)
    requireConsent: false,
    posthogKey: 'phc_pSJwyHshSA7j8zRXadBF5Mgy3dL96qNcLc4Sjy9LWe82',
    posthogHost: 'https://us.i.posthog.com'
  };

  var STORAGE_KEY = 'avatarsco_entry_v1';
  var CONSENT_KEY = 'avatarsco_consent_v1';

  // ── Consent (analytics fires only after the visitor accepts) ─────────────
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }
  function consentAccepted() { return getConsent() === 'accepted'; }

  // ── Storage helpers ─────────────────────────────────────────────────────
  function getStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }
  function setStored(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function clearStored() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ── URL params (for UTM tracking) ───────────────────────────────────────
  function getParams() {
    var out = {};
    try { new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; }); } catch (e) {}
    return out;
  }

  // ── PostHog loader (only runs if a key is set) ──────────────────────────
  var phInited = false;
  function initAnalytics() {
    if (phInited) return;
    if (!ANALYTICS.enabled || !ANALYTICS.posthogKey) return;
    if (ANALYTICS.requireConsent && !consentAccepted()) return;
    // Official PostHog stub snippet — queues calls until the library loads.
    !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
    window.posthog.init(ANALYTICS.posthogKey, { api_host: ANALYTICS.posthogHost, person_profiles: 'always', respect_dnt: true });
    phInited = true;
  }

  function track(event, props) {
    var p = getParams();
    var payload = Object.assign({
      referrer: document.referrer || 'direct',
      landing_path: location.pathname,
      utm_source: p.utm_source || null,
      utm_medium: p.utm_medium || null,
      utm_campaign: p.utm_campaign || null,
      ref: p.ref || null // supports custom ?ref= links you share
    }, props || {});
    var allowed = ANALYTICS.enabled && (!ANALYTICS.requireConsent || consentAccepted());
    if (allowed && window.posthog && ANALYTICS.posthogKey) {
      window.posthog.capture(event, payload);
    } else if (window.console) {
      console.debug('[entry-gate] ' + event, payload); // off / awaiting consent — logged locally only
    }
  }

  // ── Gate ────────────────────────────────────────────────────────────────
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ── Consent banner ──────────────────────────────────────────────────────
  function setupConsent() {
    // Banner held off: skip it entirely, analytics is governed by `enabled` alone (DNT honored).
    if (!ANALYTICS.requireConsent) { initAnalytics(); return; }

    var decision = getConsent();
    if (decision === 'accepted') initAnalytics(); // returning visitor who already agreed

    var banner = document.getElementById('cookie-consent');
    if (!banner || decision) return; // already decided (or no banner) — stay hidden

    banner.hidden = false;
    requestAnimationFrame(function () { banner.classList.add('is-open'); });

    var accept = document.getElementById('cookie-accept');
    var decline = document.getElementById('cookie-decline');
    if (accept) accept.addEventListener('click', function () {
      setConsent('accepted');
      initAnalytics();
      track('consent_granted');
      hideConsent(banner);
    });
    if (decline) decline.addEventListener('click', function () {
      setConsent('declined');
      hideConsent(banner);
    });
  }
  function hideConsent(banner) {
    banner.classList.remove('is-open');
    setTimeout(function () { banner.hidden = true; }, 420);
  }

  ready(function () {
    var reset = /[?&]resetgate\b/.test(location.search);
    if (reset) { clearStored(); try { localStorage.removeItem(CONSENT_KEY); } catch (e) {} }

    setupConsent(); // shows the consent banner first-visit; inits analytics if already accepted

    var gate = document.getElementById('entry-gate');
    if (!gate) return;

    var stored = getStored();
    if (stored && stored.seen && !reset) {
      // Returning visitor: do NOT show the gate again. Log a light return event.
      track('site_return', { segment: stored.segment || 'unknown' });
      return;
    }

    openGate(gate);
    track('entry_gate_shown', { visitor: 'new' });
  });

  function openGate(gate) {
    gate.hidden = false;
    requestAnimationFrame(function () { gate.classList.add('is-open'); });
    document.documentElement.style.overflow = 'hidden'; // lock scroll while open

    function choose(segment) {
      // Segment is still captured for analytics; everyone lands at the top of the home page.
      setStored({ seen: true, segment: segment, ts: Date.now() });
      track('entry_gate_selected', { segment: segment });
      closeGate(gate);
      window.scrollTo(0, 0);
    }

    Array.prototype.forEach.call(gate.querySelectorAll('.entry-gate-btn'), function (btn) {
      btn.addEventListener('click', function () {
        choose(btn.getAttribute('data-segment'));
      });
    });

    var skip = document.getElementById('entry-gate-skip');
    if (skip) skip.addEventListener('click', function () { choose('skipped'); });
  }

  function closeGate(gate) {
    gate.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(function () { gate.hidden = true; }, 420);
  }
})();
