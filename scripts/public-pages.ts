import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SERVICES, STUDIO } from '../src/content/site';

const origin = 'https://tutokpitikstudios.com';
const sessions = [
  {
    slug: 'bgc-street-portraits',
    service: 'portrait',
    title: 'Street portraits in BGC',
    text: 'Explore the studio’s BGC street portrait series, from casual portraits to environmental shots.',
    photo: 'bgc-series-1',
    alt: 'Outdoor portrait from the BGC photography series',
  },
  {
    slug: 'birthday-celebration',
    service: 'birthday',
    title: 'Birthday celebration photography',
    text: 'A portrait from the studio’s published birthday portfolio. Choose coverage for portraits, the program and the details you want to remember.',
    photo: 'joy-xix',
    alt: 'Birthday portrait from the JOY XIX session',
  },
];
const photo: Record<string, string> = {
  portrait: 'bgc-series-1',
  birthday: 'joy-xix',
  event: 'indak',
  landscape: 'spiral-stairway',
};
const esc = (v: string) =>
  v
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const price = (n: number) => '₱' + n.toLocaleString('en-PH');
export function publicPages(): Plugin {
  return {
    name: 'studio-public-pages',
    apply: 'build',
    async writeBundle(options, bundle) {
      const out = resolve(options.dir || 'dist');
      const shell = await readFile(resolve(out, 'index.html'), 'utf8');
      const image = (slug: string) =>
        Object.keys(bundle).find(
          (f) => f.includes('/' + slug + '-1800-') && f.endsWith('.jpg'),
        );
      const css = Object.keys(bundle).find((f) =>
        /^assets\/index-[\w-]+\.css$/.test(f),
      );
      const urls = ['/', '/privacy', '/terms'];
      async function page(
        url: string,
        title: string,
        description: string,
        body: string,
        img?: string,
      ) {
        urls.push(url);
        const folder = resolve(out, '.' + url);
        await mkdir(folder, { recursive: true });
        const heading = esc(title) + ' · ' + STUDIO.name;
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${origin + url}"><meta property="og:type" content="website"><meta property="og:url" content="${origin + url}"><meta property="og:title" content="${heading}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${origin}/${img || 'og-image.jpg'}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon-32.png"><link rel="stylesheet" href="/${css}"></head><body class="studio-story"><main class="container"><a href="/">← Tutok Pitik Studios</a><p class="eyebrow">Quezon City &amp; Metro Manila</p><h1>${esc(title)}</h1><p class="section-lead">${esc(description)}</p>${body}<footer><a href="/privacy">Data Privacy Notice</a> · <a href="/terms">Booking terms</a></footer></main><script type="module" src="/service-visit.js"></script></body></html>`;
        await writeFile(resolve(folder, 'index.html'), html);
      }
      for (const service of SERVICES) {
        const img = image(photo[service.id]);
        const link = '/?service=' + service.id;
        const packages = service.packages
          .map(
            (p) =>
              `<article class="package-card"><h2>${esc(p.name)}</h2><p>${p.hours} hours · ${price(p.hours * service.rate)}</p><p>${esc(p.note)}. Deposit ${price((p.hours * service.rate) / 2)}.</p><a class="btn btn-primary" href="${link}&amp;hours=${p.hours}#contact">Book ${esc(p.name)}</a></article>`,
          )
          .join('');
        const related = sessions
          .filter((s) => s.service === service.id)
          .map(
            (s) =>
              `<p><a href="/sessions/${s.slug}/">View ${esc(s.title)}</a></p>`,
          )
          .join('');
        await page(
          '/services/' + service.id + '/',
          service.title,
          service.description,
          `<section data-studio-service="${service.id}">${img ? `<img src="/${img}" alt="${esc(service.title)} portfolio example">` : ''}${related}<h2>Choose your coverage</h2><div class="package-grid">${packages}</div><p>Includes editing and private gallery delivery. Ask for a written photo-count and travel quote for your venue before paying. For a date change contact the studio from your booking.</p><a class="btn btn-outline" href="${link}#ask-studio">Ask about this shoot</a></section>`,
          img,
        );
      }
      for (const s of sessions) {
        const img = image(s.photo);
        const extra =
          s.service === 'portrait'
            ? ['bgc-series-2', 'bgc-series-3']
                .map(
                  (slug, i) =>
                    `<img loading="lazy" src="/${image(slug)}" alt="BGC street portrait, photograph ${i + 2}">`,
                )
                .join('')
            : '';
        await page(
          '/sessions/' + s.slug + '/',
          s.title,
          s.text,
          `<section data-studio-service="${s.service}">${img ? `<img src="/${img}" alt="${s.alt}">` : ''}${extra}<a class="btn btn-primary" href="/services/${s.service}/">See coverage and prices</a> <a class="btn btn-outline" href="/?service=${s.service}#contact">Book a similar shoot</a></section>`,
          img,
        );
      }
      for (const [path, title] of [
        ['privacy', 'Data Privacy Notice'],
        ['terms', 'Terms and Conditions'],
      ]) {
        const folder = resolve(out, path);
        await mkdir(folder, { recursive: true });
        await writeFile(
          resolve(folder, 'index.html'),
          shell
            .replace(
              /(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g,
              '$1' + title + ' · ' + STUDIO.name,
            )
            .replace(
              /<title>.*?<\/title>/,
              `<title>${title} · ${STUDIO.name}</title>`,
            )
            .replaceAll(
              'content="' + origin + '/"',
              'content="' + origin + '/' + path + '"',
            )
            .replace(
              'rel="canonical" href="' + origin + '/"',
              'rel="canonical" href="' + origin + '/' + path + '"',
            ),
        );
      }
      await writeFile(
        resolve(out, '404.html'),
        shell.replace(
          '<title>',
          '<meta name="robots" content="noindex"><title>',
        ),
      );
      await writeFile(
        resolve(out, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => '<url><loc>' + origin + url + '</loc></url>').join('')}</urlset>`,
      );
    },
  };
}
