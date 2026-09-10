import type { CardDesign } from './card-design';

const rayAngles = Array.from({ length: 25 }, (_, index) => index * 14.4);

export function CardTexture({
  design,
  id,
  color,
}: Readonly<{ design: CardDesign; id: string; color: string }>) {
  return (
    <g opacity={design.textureOpacity * 0.0028} fill="none" stroke={color} strokeWidth="1">
      <defs>
        <pattern id={id} width="40" height="64" patternUnits="userSpaceOnUse">
          <path d="M20 0 40 32 20 64 0 32Z" />
          <path d="M20 8 35 32 20 56 5 32Z" opacity=".4" />
          <circle cx="20" cy="32" r="1.5" fill={color} stroke="none" />
        </pattern>
      </defs>
      {design.texture === 'diamond' && (
        <rect width="600" height="800" fill={`url(#${id})`} stroke="none" />
      )}
      {design.texture === 'rays' &&
        rayAngles.map((angle) => (
          <path
            key={angle}
            d="M300 360 300-560 348-560Z"
            fill={color}
            stroke="none"
            transform={`rotate(${angle} 300 360)`}
          />
        ))}
    </g>
  );
}

export function CardNameplate({ design, panel }: Readonly<{ design: CardDesign; panel: string }>) {
  if (!design.showNameplate) return null;
  return (
    <g>
      <path
        d="M58 485 82 473H518L542 485 526 560H74Z"
        fill="#000000"
        opacity=".32"
        transform="translate(0 5)"
      />
      <path
        d="M58 480 82 468H518L542 480 526 557H74Z"
        fill={panel}
        stroke={design.metalColor}
        strokeWidth="1.5"
      />
      <path
        d="M70 485 85 477H515L530 485M85 547H515"
        fill="none"
        stroke={design.metalColor}
        opacity=".45"
      />
      <path
        d="m58 480 14 9-5 34m475-43-14 9 5 34"
        fill="none"
        stroke={design.metalColor}
        strokeWidth="3"
      />
    </g>
  );
}

export function CardEdition({ design }: Readonly<{ design: CardDesign }>) {
  return (
    <g fill={design.metalColor}>
      <path d="m300 704 4 4-4 4-4-4Z" />
      <path
        d="M180 708H275M325 708H420"
        fill="none"
        stroke={design.metalColor}
        strokeWidth="1"
        opacity=".6"
      />
      <text
        x="300"
        y="733"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="2.5"
      >
        {design.edition.toLocaleUpperCase()}
      </text>
    </g>
  );
}
