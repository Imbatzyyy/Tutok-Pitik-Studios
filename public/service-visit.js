const service = document.querySelector('[data-studio-service]')?.dataset
  .studioService;
if (service && navigator.doNotTrack !== '1') {
  const ref =
    new URLSearchParams(location.search).get('utm_source') ||
    (document.referrer ? new URL(document.referrer).hostname : '');
  const source = /facebook|instagram|messenger|tiktok/i.test(ref)
    ? 'social'
    : /google|bing|duckduckgo/i.test(ref)
      ? 'search'
      : ref && ref !== location.hostname
        ? 'referral'
        : 'direct';
  try {
    if (source !== 'direct') sessionStorage.setItem('tps:visit-source', source);
  } catch {}
  const track = (stage) =>
    fetch('/.netlify/functions/studio-contact', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'event',
        stage,
        service,
        source,
        device: matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop',
      }),
    }).catch(() => {});
  track('service_view');
  document
    .querySelectorAll('a[href*="hours="]')
    .forEach((link) => link.addEventListener('click', () => track('package')));
}
