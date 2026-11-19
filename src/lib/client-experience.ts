export function visitContext() {
  const sourceKey = 'tps:visit-source';
  const source = () => {
    try {
      const utm = new URLSearchParams(location.search).get('utm_source') || '';
      const origin =
        utm || (document.referrer ? new URL(document.referrer).hostname : '');
      const channel = /facebook|instagram|messenger|tiktok|linkedin/i.test(
        origin,
      )
        ? 'social'
        : /google|bing|duckduckgo/i.test(origin)
          ? 'search'
          : origin && origin !== location.hostname
            ? 'referral'
            : '';
      if (channel) sessionStorage.setItem(sourceKey, channel);
      return channel || sessionStorage.getItem(sourceKey) || 'direct';
    } catch {
      return 'direct';
    }
  };
  return {
    source: source(),
    device: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
  };
}
export function countStep(stage: string, service = 'other') {
  if (navigator.doNotTrack === '1') return;
  void fetch('/.netlify/functions/studio-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ kind: 'event', stage, service, ...visitContext() }),
  }).catch(() => undefined);
}
