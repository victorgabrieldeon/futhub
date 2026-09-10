import type { PackStudioDraft } from './pack-studio-model';

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function textureSvg(draft: PackStudioDraft): string {
  const opacity = (draft.textureOpacity / 500).toFixed(2);
  if (draft.texture === 'aura') {
    return `<g fill="none" stroke="${draft.accentColor}" stroke-opacity="${opacity}" stroke-width="2"><ellipse cx="300" cy="438" rx="132" ry="118"/><ellipse cx="300" cy="438" rx="184" ry="164"/><ellipse cx="300" cy="438" rx="230" ry="205"/></g>`;
  }
  if (draft.texture === 'none') return '';
  const path =
    draft.texture === 'fire'
      ? 'M210 610C160 536 222 466 270 418C262 510 318 528 300 608M390 610C356 540 412 484 450 440C446 518 486 540 478 610'
      : 'M106 514L152 486L132 574L206 522M454 470L400 524L430 540L362 616';
  return `<path d="${path}" fill="none" stroke="${draft.accentColor}" stroke-opacity="${opacity}" stroke-width="2"/>`;
}

function packSymbol(draft: PackStudioDraft): string {
  return `<g>
    <circle cx="300" cy="448" r="144" fill="#04050f" fill-opacity=".52"/>
    <circle cx="300" cy="436" r="139" fill="#fbfbff" stroke="url(#accentFoil)" stroke-width="12"/>
    <circle cx="300" cy="436" r="124" fill="url(#cardFace)" stroke="#fff" stroke-opacity=".52" stroke-width="3"/>
    <path d="M300 364l38 28-14 45h-48l-14-45z" fill="${draft.color}" stroke="#fff" stroke-opacity=".72" stroke-width="4"/>
    <path d="M198 403l38-28 34 24-10 42-44 14-31-25zM402 403l-38-28-34 24 10 42 44 14 31-25zM222 507l40-38 38 20v48l-36 24-43-17zM378 507l-40-38-38 20v48l36 24 43-17z" fill="${draft.color}" stroke="#fff" stroke-opacity=".72" stroke-width="4"/>
    <path d="M262 437l-38 70M338 437l40 70M216 455l6 52M384 455l-6 52M236 375l-38 28M364 375l38 28" fill="none" stroke="#fff" stroke-opacity=".62" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="256" cy="384" rx="54" ry="22" fill="#fff" fill-opacity=".40" transform="rotate(-30 256 384)"/>
  </g>`;
}

function frontImageSvg(draft: PackStudioDraft): string {
  return draft.frontImage
    ? `<image href="${draft.frontImage}" x="55" y="112" width="490" height="584" preserveAspectRatio="xMidYMid slice" opacity=".82"/>`
    : '';
}

export function packArtSvg(draft: PackStudioDraft): string {
  const effect =
    draft.effect === 'holographic' ? '#ff91d8' : draft.effect === 'chrome' ? '#dbe7ff' : '#fff4c2';
  const lightOpacity = (0.12 + draft.tintOpacity / 180).toFixed(2);
  const viewportTop = Math.max(152, Math.min(draft.kickerY, draft.headlineY) - 66);
  const viewportBottom = Math.min(398, Math.max(draft.kickerY, draft.headlineY) + 64);
  const viewportHeight = viewportBottom - viewportTop;
  const headlineSize = Math.max(30, Math.min(draft.headlineSize, 62));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="wrapper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#696a7c"/><stop offset=".14" stop-color="#fff"/><stop offset=".3" stop-color="#77788b"/><stop offset=".5" stop-color="#f8f7ff"/><stop offset=".72" stop-color="#77788b"/><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#555666"/></linearGradient>
    <linearGradient id="seal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#090718"/><stop offset=".14" stop-color="${draft.color}"/><stop offset=".48" stop-color="${effect}" stop-opacity="${lightOpacity}"/><stop offset=".74" stop-color="${draft.color}"/><stop offset="1" stop-color="#090718"/></linearGradient>
    <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#060b16"/><stop offset=".2" stop-color="${draft.color}"/><stop offset=".5" stop-color="#0a1831"/><stop offset=".78" stop-color="${draft.color}"/><stop offset="1" stop-color="#040811"/></linearGradient>
    <linearGradient id="accentFoil" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${draft.accentColor}"/><stop offset=".24" stop-color="${effect}"/><stop offset=".48" stop-color="#fff"/><stop offset=".72" stop-color="${draft.accentColor}"/><stop offset="1" stop-color="#676879"/></linearGradient>
    <linearGradient id="cardFace" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="${draft.color}" stop-opacity=".54"/><stop offset="1" stop-color="#070611" stop-opacity=".96"/></linearGradient>
    <linearGradient id="cardSheen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset=".58" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="brandPlate" x1="0" x2="1"><stop stop-color="#090812" stop-opacity=".15"/><stop offset=".18" stop-color="#090812" stop-opacity=".94"/><stop offset=".82" stop-color="#090812" stop-opacity=".94"/><stop offset="1" stop-color="#090812" stop-opacity=".15"/></linearGradient>
    <radialGradient id="centerGlow"><stop stop-color="${draft.accentColor}" stop-opacity=".42"/><stop offset=".48" stop-color="${draft.color}" stop-opacity=".2"/><stop offset="1" stop-color="#05040d" stop-opacity="0"/></radialGradient>
    <linearGradient id="viewport" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ddecff" stop-opacity=".22"/><stop offset=".12" stop-color="#07122b" stop-opacity=".84"/><stop offset=".86" stop-color="#020610" stop-opacity=".9"/><stop offset="1" stop-color="#adc8ff" stop-opacity=".16"/></linearGradient>
    <linearGradient id="raisedType" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".32" stop-color="${draft.textColor}"/><stop offset="1" stop-color="${draft.textColor}" stop-opacity=".48"/></linearGradient>
    <filter id="pressedType" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="3" dy="7" stdDeviation="2" flood-color="#000" flood-opacity=".88"/><feDropShadow dx="-1" dy="-2" stdDeviation=".8" flood-color="#fff" flood-opacity=".68"/></filter>
    <clipPath id="packBody"><rect x="55" y="112" width="490" height="584" rx="20"/></clipPath>
  </defs>
  <g>
    <rect x="29" y="31" width="552" height="764" rx="36" fill="#020107" fill-opacity=".28"/>
    <rect x="25" y="23" width="556" height="768" rx="36" fill="#020107" fill-opacity=".34"/>
    <rect x="20" y="12" width="560" height="776" rx="36" fill="url(#wrapper)"/>
    <rect x="31" y="23" width="538" height="754" rx="30" fill="#0a0912" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <rect x="42" y="34" width="516" height="732" rx="26" fill="url(#body)" stroke="#8d8da0" stroke-width="2"/>
    <rect x="55" y="112" width="490" height="584" rx="20" fill="url(#body)" stroke="#f4f2ff" stroke-opacity=".72" stroke-width="3"/>
    <g clip-path="url(#packBody)">
      <ellipse cx="300" cy="416" rx="278" ry="270" fill="url(#centerGlow)"/>
      ${frontImageSvg(draft)}
      <rect x="55" y="112" width="490" height="584" fill="${effect}" opacity="${lightOpacity}"/>
      ${textureSvg(draft)}
      <path d="M56 164C156 108 402 118 544 188" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="15"/>
      <path d="M66 674L526 154" stroke="#fff" stroke-opacity=".08" stroke-width="56"/>
      <path d="M80 690L540 170" stroke="#fff" stroke-opacity=".17" stroke-width="3"/>
      <path d="M74 172C116 186 148 178 184 158M418 666C466 646 504 650 534 628" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/>
    </g>
    <rect x="42" y="34" width="516" height="104" rx="24" fill="url(#seal)"/>
    <g fill="none" stroke="#fff" stroke-opacity=".24"><path d="M52 50C156 34 410 40 548 56"/><path d="M50 61C182 45 422 53 550 65"/><path d="M50 72C182 56 422 64 550 76"/><path d="M50 83C182 67 422 75 550 87"/><path d="M50 94C182 78 422 86 550 98"/><path d="M50 105C182 89 422 97 550 109"/><path d="M54 119C168 102 434 108 546 124"/><path d="M58 130C174 116 426 118 542 132"/></g>
    <rect x="42" y="674" width="516" height="92" rx="24" fill="url(#seal)"/>
    <g fill="none" stroke="#fff" stroke-opacity=".24"><path d="M52 687C156 675 410 679 548 693"/><path d="M50 698C182 682 422 690 550 702"/><path d="M50 709C182 693 422 701 550 713"/><path d="M50 720C182 704 422 712 550 724"/><path d="M50 731C182 715 422 723 550 735"/><path d="M50 742C182 726 422 734 550 746"/><path d="M52 753C174 739 426 743 548 757"/></g>
    <rect x="30" y="62" width="18" height="654" rx="9" fill="url(#wrapper)" opacity=".88"/><rect x="552" y="62" width="18" height="654" rx="9" fill="url(#wrapper)" opacity=".88"/>
    <path d="M50 154H550M50 668H550" stroke="#fff" stroke-opacity=".42" stroke-width="3"/>
    <path d="M70 170H530" stroke="${draft.accentColor}" stroke-opacity=".58" stroke-width="2"/>
    <rect x="92" y="${viewportTop}" width="416" height="${viewportHeight}" rx="28" fill="url(#viewport)" stroke="${draft.accentColor}" stroke-opacity=".78" stroke-width="3"/>
    <rect x="102" y="${viewportTop + 10}" width="396" height="${viewportHeight - 20}" rx="21" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="2"/>
    ${packSymbol(draft)}
    <text x="${draft.kickerX}" y="${draft.kickerY}" fill="${draft.accentColor}" font-family="Arial, sans-serif" font-size="19" font-weight="800" letter-spacing="5" text-anchor="middle">${escapeText(draft.kicker.toUpperCase())}</text>
    <text x="${draft.headlineX}" y="${draft.headlineY}" fill="url(#raisedType)" stroke="${draft.accentColor}" stroke-width="3" paint-order="stroke" filter="url(#pressedType)" font-family="Arial, sans-serif" font-size="${headlineSize}" font-style="italic" font-weight="900" text-anchor="middle">${escapeText(draft.headline.toUpperCase())}</text>
    <text x="300" y="620" fill="url(#accentFoil)" font-family="Arial, sans-serif" font-size="48" font-style="italic" font-weight="900" text-anchor="middle">FH</text>
    <text x="300" y="652" fill="#fff" font-family="Arial, sans-serif" font-size="18" font-style="italic" font-weight="800" letter-spacing="5" text-anchor="middle">FUTHUB</text>
    <path d="M75 142C92 132 104 136 118 148M482 140C504 126 524 132 538 150M74 654C90 646 108 650 122 662M476 660C500 646 520 650 538 666" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="3"/>
  </g>
</svg>`;
}

export function packArtStyleKey(draft: PackStudioDraft): string {
  return [
    draft.accentColor,
    draft.color,
    draft.textColor,
    draft.effect,
    draft.texture,
    draft.textureOpacity,
    draft.tintOpacity,
    draft.frontImage,
    draft.headline,
    draft.headlineSize,
    draft.headlineX,
    draft.headlineY,
    draft.kicker,
    draft.kickerX,
    draft.kickerY,
  ].join('|');
}
