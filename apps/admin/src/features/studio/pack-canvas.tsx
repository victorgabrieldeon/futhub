import { Canvas, Circle, type FabricObject, IText, Line, Polygon, Rect, Text } from 'fabric';
import { useEffect, useRef } from 'react';
import type { PackStudioDraft, PackTexture } from './pack-studio-model';

type PackCanvasProps = Readonly<{
  draft: PackStudioDraft;
  onCanvasReady: (canvas: Canvas | null) => void;
  onTextChange: (value: string) => void;
  onTextTransform: (x: number, y: number) => void;
}>;

type CanvasLayers = Readonly<{
  accent: readonly FabricObject[];
  body: readonly Rect[];
  effect: Rect;
  headline: IText;
  kicker: Text;
  quantity: Text;
  texture: Readonly<Record<PackTexture, readonly FabricObject[]>>;
}>;

const textureIds = ['mesh', 'shards', 'rings'] as const;

function line(points: [number, number, number, number]): Line {
  return new Line(points, {
    evented: false,
    opacity: 0,
    selectable: false,
    strokeWidth: 2,
  });
}

function staticObject<T extends FabricObject>(object: T): T {
  object.set({ evented: false, selectable: false });
  return object;
}

function createTexture(texture: PackTexture): readonly FabricObject[] {
  if (texture === 'rings') {
    return [116, 158, 202].map((radius) =>
      staticObject(
        new Circle({
          fill: 'transparent',
          left: 300 - radius,
          opacity: 0,
          radius,
          strokeWidth: 2,
          top: 434 - radius,
        }),
      ),
    );
  }

  const segments =
    texture === 'mesh'
      ? [
          [98, 565, 198, 430],
          [198, 430, 286, 546],
          [286, 546, 394, 402],
          [394, 402, 504, 548],
          [102, 654, 218, 584],
          [218, 584, 322, 690],
          [322, 690, 466, 514],
        ]
      : [
          [96, 620, 240, 500],
          [151, 690, 292, 510],
          [292, 510, 374, 636],
          [374, 636, 504, 488],
          [92, 456, 214, 388],
          [390, 400, 504, 456],
        ];
  return segments.map((segment) => staticObject(line(segment as [number, number, number, number])));
}

function createBackdrop(): readonly FabricObject[] {
  const objects: FabricObject[] = [
    staticObject(
      new Rect({
        fill: '#080816',
        height: 760,
        left: 30,
        rx: 24,
        ry: 24,
        stroke: '#776eff',
        strokeWidth: 1,
        top: 20,
        width: 540,
      }),
    ),
  ];
  for (let offset = -760; offset < 620; offset += 16) {
    objects.push(
      staticObject(
        new Line([offset, 780, offset + 760, 20], {
          opacity: 0.13,
          stroke: '#766fff',
          strokeWidth: 1,
        }),
      ),
    );
  }
  return objects;
}

function createBall(): readonly FabricObject[] {
  const pentagon = [
    { x: 300, y: 366 },
    { x: 335, y: 390 },
    { x: 322, y: 430 },
    { x: 278, y: 430 },
    { x: 265, y: 390 },
  ];
  return [
    staticObject(
      new Circle({
        fill: 'rgba(10, 10, 38, .18)',
        left: 211,
        radius: 89,
        strokeWidth: 7,
        top: 311,
      }),
    ),
    staticObject(new Polygon(pentagon, { fill: 'rgba(255, 255, 255, .12)', strokeWidth: 4 })),
    staticObject(new Line([300, 366, 300, 322], { strokeWidth: 3 })),
    staticObject(new Line([335, 390, 373, 365], { strokeWidth: 3 })),
    staticObject(new Line([322, 430, 354, 467], { strokeWidth: 3 })),
    staticObject(new Line([278, 430, 243, 467], { strokeWidth: 3 })),
    staticObject(new Line([265, 390, 227, 365], { strokeWidth: 3 })),
  ];
}

function effectColor(effect: PackStudioDraft['effect']): string {
  if (effect === 'holographic') return '#ff9fda';
  if (effect === 'chrome') return '#dbe4ff';
  return '#ffffff';
}

function setupHeadline(headline: IText) {
  headline.set({
    borderColor: '#ffffff',
    borderScaleFactor: 1.5,
    cornerColor: '#5b4cc4',
    cornerSize: 14,
    padding: 10,
    transparentCorners: false,
  });
}

function createLayers(): CanvasLayers {
  const body = [
    staticObject(
      new Rect({
        height: 516,
        left: 92,
        rx: 12,
        ry: 12,
        stroke: '#d9e2ff',
        strokeWidth: 3,
        top: 176,
        width: 416,
      }),
    ),
    staticObject(
      new Rect({
        height: 88,
        left: 84,
        rx: 20,
        ry: 20,
        stroke: '#f2f1ff',
        strokeWidth: 3,
        top: 84,
        width: 432,
      }),
    ),
  ];
  const effect = staticObject(
    new Rect({
      fill: '#ffffff',
      height: 510,
      left: 95,
      opacity: 0.16,
      rx: 10,
      ry: 10,
      top: 180,
      width: 410,
    }),
  );
  const ball = createBall();
  const accent = [
    ...ball,
    staticObject(
      new Text('FH', {
        fontFamily: 'Arial',
        fontSize: 47,
        fontStyle: 'italic',
        fontWeight: '800',
        left: 250,
        top: 544,
      }),
    ),
    staticObject(
      new Text('FUTHUB', {
        fontFamily: 'Arial',
        fontSize: 25,
        fontWeight: '800',
        left: 237,
        top: 598,
      }),
    ),
  ];
  const headline = new IText('', {
    fontFamily: 'Arial',
    fontSize: 42,
    fontWeight: '800',
    left: 300,
    originX: 'center',
    originY: 'center',
    textAlign: 'center',
    top: 250,
  });
  setupHeadline(headline);
  return {
    accent,
    body,
    effect,
    headline,
    kicker: staticObject(
      new Text('', {
        charSpacing: 110,
        fontFamily: 'Arial',
        fontSize: 15,
        left: 300,
        originX: 'center',
        top: 331,
      }),
    ),
    quantity: staticObject(
      new Text('', {
        fontFamily: 'Arial',
        fontSize: 45,
        fontWeight: '800',
        left: 300,
        originX: 'center',
        top: 354,
      }),
    ),
    texture: {
      mesh: createTexture('mesh'),
      rings: createTexture('rings'),
      shards: createTexture('shards'),
    },
  };
}

function applyDraft(layers: CanvasLayers, draft: PackStudioDraft) {
  for (const shape of layers.body) shape.set({ fill: draft.color });
  for (const shape of layers.accent)
    shape.set({ fill: draft.accentColor, stroke: draft.accentColor });
  layers.effect.set({ fill: effectColor(draft.effect), opacity: 0.14 + draft.tintOpacity / 300 });
  for (const texture of textureIds) {
    for (const shape of layers.texture[texture]) {
      shape.set({
        opacity: texture === draft.texture ? draft.textureOpacity / 100 : 0,
        stroke: draft.accentColor,
        visible: texture === draft.texture,
      });
    }
  }
  layers.kicker.set({ fill: draft.textColor, text: draft.kicker });
  layers.quantity.set({
    fill: draft.textColor,
    text: `${draft.cardsAmount} ${draft.cardsAmount === 1 ? 'CARTA' : 'CARTAS'}`,
  });
  layers.headline.set({
    fill: draft.textColor,
    fontSize: draft.headlineSize,
    left: draft.headlineX,
    text: draft.headline,
    top: draft.headlineY,
  });
}

export async function packCanvasPng(canvas: Canvas): Promise<Blob> {
  const response = await fetch(
    canvas.toDataURL({ enableRetinaScaling: false, format: 'png', multiplier: 1 }),
  );
  return response.blob();
}

export function PackCanvas({
  draft,
  onCanvasReady,
  onTextChange,
  onTextTransform,
}: PackCanvasProps) {
  const element = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const draftRef = useRef(draft);
  const layersRef = useRef<CanvasLayers | null>(null);
  const callbacksRef = useRef({ onCanvasReady, onTextChange, onTextTransform });

  useEffect(() => {
    draftRef.current = draft;
    callbacksRef.current = { onCanvasReady, onTextChange, onTextTransform };
  }, [draft, onCanvasReady, onTextChange, onTextTransform]);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const canvas = new Canvas(node, { height: 800, preserveObjectStacking: true, width: 600 });
    const layers = createLayers();
    canvasRef.current = canvas;
    layersRef.current = layers;
    canvas.add(
      ...createBackdrop(),
      ...layers.body,
      ...layers.texture.mesh,
      ...layers.texture.shards,
      ...layers.texture.rings,
      layers.effect,
      staticObject(
        new Rect({
          fill: 'rgba(8, 7, 35, .64)',
          height: 96,
          left: 104,
          rx: 12,
          ry: 12,
          top: 316,
          width: 392,
        }),
      ),
      ...layers.accent,
      layers.kicker,
      layers.quantity,
      layers.headline,
    );
    applyDraft(layers, draftRef.current);
    canvas.renderAll();
    callbacksRef.current.onCanvasReady(canvas);
    canvas.on('text:changed', ({ target }) => {
      if (target === layers.headline) callbacksRef.current.onTextChange(layers.headline.text);
    });
    canvas.on('object:modified', ({ target }) => {
      if (target === layers.headline) {
        callbacksRef.current.onTextTransform(
          layers.headline.left ?? 300,
          layers.headline.top ?? 250,
        );
      }
    });
    return () => {
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
    applyDraft(layers, draft);
    canvas.renderAll();
  }, [draft]);

  return <canvas aria-label="Editor visual do pack" className="pack-canvas" ref={element} />;
}
