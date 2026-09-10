import { util, Canvas, FabricImage, type FabricObject, loadSVGFromString } from 'fabric';
import { useEffect, useRef, useState } from 'react';
import { packArtStyleKey, packArtSvg } from './pack-art';
import { packModelImage } from './pack-model';
import type { PackStudioDraft } from './pack-studio-model';

type PackCanvasProps = Readonly<{
  draft: PackStudioDraft;
  onCanvasReady: (canvas: Canvas | null) => void;
}>;

type CanvasLayers = {
  art: FabricObject | null;
  artKey: string;
  artVersion: number;
};

function addArt(canvas: Canvas, layers: CanvasLayers, art: FabricObject) {
  art.set({
    evented: false,
    left: 0,
    originX: 'left',
    originY: 'top',
    selectable: false,
    top: 0,
  });
  art.setCoords();
  if (layers.art) canvas.remove(layers.art);
  layers.art = art;
  canvas.add(art);
  canvas.sendObjectToBack(art);
  canvas.renderAll();
}

type RenderStatus = 'loading' | 'ready' | 'fallback' | 'error';

async function replaceArt(
  canvas: Canvas,
  layers: CanvasLayers,
  draft: PackStudioDraft,
  onStatus: (status: RenderStatus) => void,
) {
  const version = ++layers.artVersion;
  onStatus('loading');
  try {
    const image = await packModelImage(draft);
    if (version !== layers.artVersion) return;
    addArt(canvas, layers, new FabricImage(image));
    onStatus('ready');
  } catch {
    if (version !== layers.artVersion) return;
    try {
      const { objects, options } = await loadSVGFromString(packArtSvg(draft));
      if (version !== layers.artVersion) return;
      addArt(
        canvas,
        layers,
        util.groupSVGElements(
          objects.filter((object): object is FabricObject => object !== null),
          options,
        ),
      );
      onStatus('fallback');
    } catch {
      if (version === layers.artVersion) onStatus('error');
    }
  }
}

export async function packCanvasBlob(
  canvas: Canvas,
  format: 'png' | 'webp' = 'png',
  multiplier = 1,
): Promise<Blob> {
  const response = await fetch(
    canvas.toDataURL({ enableRetinaScaling: false, format, multiplier, quality: 0.94 }),
  );
  return response.blob();
}

export const packCanvasPng = (canvas: Canvas): Promise<Blob> => packCanvasBlob(canvas);

export function PackCanvas({ draft, onCanvasReady }: PackCanvasProps) {
  const [status, setStatus] = useState<RenderStatus>('loading');
  const element = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const draftRef = useRef(draft);
  const layersRef = useRef<CanvasLayers | null>(null);
  const callbacksRef = useRef({ onCanvasReady });

  useEffect(() => {
    draftRef.current = draft;
    callbacksRef.current = { onCanvasReady };
  }, [draft, onCanvasReady]);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const canvas = new Canvas(node, { height: 800, preserveObjectStacking: true, width: 600 });
    const layers: CanvasLayers = {
      art: null,
      artKey: packArtStyleKey(draftRef.current),
      artVersion: 0,
    };
    canvasRef.current = canvas;
    layersRef.current = layers;
    void replaceArt(canvas, layers, draftRef.current, (next) => {
      setStatus(next);
      callbacksRef.current.onCanvasReady(next === 'ready' || next === 'fallback' ? canvas : null);
    });
    return () => {
      layers.artVersion += 1;
      callbacksRef.current.onCanvasReady(null);
      layersRef.current = null;
      canvasRef.current = null;
      canvas.dispose();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layers = layersRef.current;
    if (!canvas || !layers) return;
    const nextArtKey = packArtStyleKey(draft);
    if (nextArtKey !== layers.artKey) {
      layers.artKey = nextArtKey;
      void replaceArt(canvas, layers, draft, (next) => {
        setStatus(next);
        callbacksRef.current.onCanvasReady(next === 'ready' || next === 'fallback' ? canvas : null);
      });
    }
    canvas.renderAll();
  }, [draft]);

  return (
    <>
      <canvas
        aria-label={`Editor visual do pack ${draft.name || 'sem nome'}, ${draft.cardsAmount} cartas`}
        className="pack-canvas"
        ref={element}
      />
      <output className="pack-studio-render-status" data-render-status={status}>
        {status === 'loading'
          ? 'Atualizando arte…'
          : status === 'fallback'
            ? 'Modelo 3D indisponível. Prévia e exportação em arte 2D.'
            : status === 'error'
              ? 'Não foi possível gerar a arte. Recarregue para tentar novamente.'
              : ''}
      </output>
    </>
  );
}
