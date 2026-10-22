// Kalendae icon (Night Wallet), drawn on a 1024 grid: Caelum’s navy sky, Hora’s twilight glow,
// Consensus Weather’s frosted glass, silver coins and a crescent on the clasp.
// The same drawing feeds the app header, icons.html (PNG export) and icons/icon.svg.
let _uid = 0;


function iconSVG(opt = {}) {
  const u = 'k' + (++_uid);
  const rx = opt.square ? 0 : 228;
  const size = opt.size || 1024;
  const body = { x: 214, y: 452, w: 596, h: 360, r: 76 };
  const coins = `
    <circle cx="604" cy="414" r="146" fill="url(#${u}sun)" stroke="#fff" stroke-opacity=".7" stroke-width="4"/>
    <circle cx="604" cy="414" r="124" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-dasharray="3 11"/>
    <circle cx="420" cy="452" r="108" fill="url(#${u}sun2)" stroke="#fff" stroke-opacity=".6" stroke-width="3.5"/>
    <circle cx="420" cy="452" r="90" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="4" stroke-dasharray="3 10"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <defs>
    <linearGradient id="${u}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070d26"/><stop offset=".55" stop-color="#1b2a63"/><stop offset="1" stop-color="#3a4f92"/></linearGradient>
    <radialGradient id="${u}dusk" cx=".5" cy="1.08" r=".78"><stop offset="0" stop-color="#ffb36b" stop-opacity=".75"/><stop offset=".3" stop-color="#e0828e" stop-opacity=".45"/><stop offset=".62" stop-color="#77479a" stop-opacity=".22"/><stop offset="1" stop-color="#77479a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}sun" cx=".38" cy=".28" r=".85"><stop offset="0" stop-color="#ffffff" stop-opacity=".92"/><stop offset=".45" stop-color="#dfe6f2" stop-opacity=".72"/><stop offset="1" stop-color="#8f9bb3" stop-opacity=".5"/></radialGradient>
    <radialGradient id="${u}sun2" cx=".38" cy=".28" r=".85"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset=".5" stop-color="#d3dbe8" stop-opacity=".62"/><stop offset="1" stop-color="#7f8aa3" stop-opacity=".45"/></radialGradient>
    <linearGradient id="${u}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#bfe6ff" stop-opacity=".16"/></linearGradient>
    <linearGradient id="${u}edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
    <linearGradient id="${u}tab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>
    <filter id="${u}blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="${u}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <clipPath id="${u}clip"><rect width="1024" height="1024" rx="${rx}"/></clipPath>
    <clipPath id="${u}wal"><rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="${body.r}"/></clipPath>
    <mask id="${u}moon"><rect width="1024" height="1024" fill="black"/><circle cx="702" cy="640" r="40" fill="white"/><circle cx="722" cy="624" r="34" fill="black"/></mask>
  </defs>
  <g clip-path="url(#${u}clip)">
    <rect width="1024" height="1024" fill="url(#${u}bg)"/>
    <rect width="1024" height="1024" fill="url(#${u}dusk)"/>
    ${[[160, 150, 5], [272, 96, 3.5], [846, 140, 5], [920, 290, 3], [734, 80, 3], [100, 330, 3], [934, 470, 2.6], [520, 70, 2.6]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".8"/>`).join('')}


    <circle cx="604" cy="414" r="180" fill="#e6eeff" opacity=".2" filter="url(#${u}glow)"/><circle cx="420" cy="452" r="132" fill="#e6eeff" opacity=".14" filter="url(#${u}glow)"/>
    ${coins}

    <rect x="${body.x}" y="${body.y + 26}" width="${body.w}" height="${body.h}" rx="${body.r}" fill="#030616" opacity=".35" filter="url(#${u}blur)"/>
    <g clip-path="url(#${u}wal)">
      <rect width="1024" height="1024" fill="url(#${u}bg)" opacity=".55"/>
      <g filter="url(#${u}blur)" opacity=".85">${coins}</g>
      <rect width="1024" height="1024" fill="url(#${u}glass)"/>
      <ellipse cx="380" cy="440" rx="300" ry="90" fill="#fff" opacity=".1"/>
    </g>
    <rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="${body.r}" fill="none" stroke="url(#${u}edge)" stroke-width="6"/>
    <rect x="${body.x + 30}" y="${body.y + 30}" width="${body.w - 60}" height="${body.h - 60}" rx="${body.r - 26}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="5" stroke-dasharray="14 13"/>

    <rect x="618" y="570" width="262" height="140" rx="70" fill="#0b1433" opacity=".35" filter="url(#${u}blur)"/>
    <rect x="618" y="566" width="262" height="140" rx="70" fill="url(#${u}tab)"/>
    <rect x="618" y="566" width="262" height="140" rx="70" fill="none" stroke="url(#${u}edge)" stroke-width="5"/>
    <circle cx="702" cy="636" r="46" fill="#fff" opacity=".18" filter="url(#${u}glow)"/>
    <rect width="1024" height="1024" fill="#fff" mask="url(#${u}moon)"/>
    <circle cx="806" cy="636" r="9" fill="#fff" opacity=".7"/>

  </g>
</svg>`;
}

function svgToPng(svg, size) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      res(c.toDataURL('image/png'));
    };
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function download(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
