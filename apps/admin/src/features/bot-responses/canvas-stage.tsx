import {
  type CanvasImage,
  type CanvasLayer,
  type Scope,
  drawCanvas,
  httpUrl,
} from '@futhub/bot-templates';
import extraBold from '@futhub/bot-templates/fonts/FiraSans-ExtraBold.otf?url';
import regular from '@futhub/bot-templates/fonts/FiraSans-Regular.otf?url';
import semiBold from '@futhub/bot-templates/fonts/FiraSans-SemiBold.otf?url';
import { useEffect, useRef } from 'react';

// The bot draws with the same Fira Sans files, so preview text metrics match production.
let fonts: Promise<unknown> | undefined;
function loadFonts(): Promise<unknown> {
  fonts ??= Promise.all(
    [
      [regular, '400'],
      [semiBold, '600'],
      [extraBold, '800'],
    ].map(async ([url, weight]) => {
      const face = new FontFace('Fira Sans', `url(${url})`, { weight });
      document.fonts.add(await face.load());
    }),
  ).catch(() => undefined);
  return fonts;
}

const pictures = new Map<string, Promise<HTMLImageElement | null>>();
function loadPicture(url: string): Promise<HTMLImageElement | null> {
  const safe = httpUrl(url);
  if (!safe) return Promise.resolve(null);
  let picture = pictures.get(safe);
  if (!picture) {
    picture = new Promise((resolve) => {
      const element = new Image();
      element.referrerPolicy = 'no-referrer';
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = safe;
    });
    pictures.set(safe, picture);
  }
  return picture;
}

export function layerBounds(layer: CanvasLayer, scope: Scope) {
  switch (layer.type) {
    case 'rect':
    case 'image':
      return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    case 'text':
      return { x: layer.x, y: layer.y, w: layer.w, h: layer.size * 1.2 * layer.lines };
    case 'list': {
      const value = scope.data[layer.source];
      const count = Math.max(1, Math.min(layer.limit, Array.isArray(value) ? value.length : 1));
      const columns = Math.max(1, Math.min(layer.columns, count));
      const rows = Math.ceil(count / Math.max(1, layer.columns));
      return {
        x: layer.x,
        y: layer.y,
        w: columns * (layer.cellWidth + layer.gapX) - layer.gapX,
        h: rows * (layer.cellHeight + layer.gapY) - layer.gapY,
      };
    }
  }
}

export function CanvasStage({
  image,
  scope,
  selected,
  onSelect,
  onMove,
  className,
}: {
  image: CanvasImage;
  scope: Scope;
  selected?: number | null;
  onSelect?: (index: number | null) => void;
  onMove?: (index: number, x: number, y: number) => void;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ index: number; dx: number; dy: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    let cancelled = false;
    void (async () => {
      await loadFonts();
      // Draw off-screen first so a slow image never shows a half-painted frame.
      const buffer = document.createElement('canvas');
      buffer.width = image.width;
      buffer.height = image.height;
      const draft = buffer.getContext('2d');
      if (!draft) return;
      await drawCanvas<HTMLImageElement>(draft, image, scope, loadPicture, 'Fira Sans');
      if (cancelled) return;
      element.width = image.width;
      element.height = image.height;
      context.clearRect(0, 0, image.width, image.height);
      context.drawImage(buffer, 0, 0);
      const layer = selected === null || selected === undefined ? null : image.layers[selected];
      if (layer) {
        const box = layerBounds(layer, scope);
        const unit = Math.max(2, image.width / 400);
        context.save();
        context.strokeStyle = '#55E8FF';
        context.lineWidth = unit;
        context.setLineDash([unit * 4, unit * 3]);
        context.strokeRect(box.x, box.y, box.w, box.h);
        context.restore();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image, scope, selected]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * image.width) / rect.width,
      y: ((event.clientY - rect.top) * image.height) / rect.height,
    };
  };

  const interactive = Boolean(onSelect);
  return (
    <canvas
      ref={canvas}
      width={image.width}
      height={image.height}
      className={className ?? 'canvas-stage'}
      data-interactive={interactive}
      aria-label={
        interactive ? 'Prévia editável da imagem; clique e arraste camadas' : 'Imagem gerada'
      }
      onPointerDown={(event) => {
        if (!onSelect) return;
        const { x, y } = point(event);
        for (let index = image.layers.length - 1; index >= 0; index--) {
          const layer = image.layers[index];
          if (!layer) continue;
          const box = layerBounds(layer, scope);
          if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
            onSelect(index);
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { index, dx: x - layer.x, dy: y - layer.y, x: layer.x, y: layer.y };
            return;
          }
        }
        onSelect(null);
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state || !onMove) return;
        const { x, y } = point(event);
        const nextX = Math.round(x - state.dx);
        const nextY = Math.round(y - state.dy);
        if (nextX === state.x && nextY === state.y) return;
        drag.current = { ...state, x: nextX, y: nextY };
        onMove(state.index, nextX, nextY);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
