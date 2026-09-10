import { type Config, removeBackground } from '@imgly/background-removal';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import { playerImageSpecification } from './studio-model';

export type ImageTreatmentTarget = Readonly<{
  description: string;
  fileName: string;
  height: number;
  label: string;
  width: number;
}>;

type ImageFilterPreset = Readonly<{
  id: string;
  label: string;
  settings: ImageTreatmentSettings;
}>;

type ImageTreatmentSettings = Readonly<{
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
  sharpen: number;
}>;

type ImageTreatmentProps = Readonly<{
  onApply: (imageUrl: string, image: Blob) => void;
  source?: TreatmentSource;
  target?: ImageTreatmentTarget;
}>;

type TreatmentSource = Readonly<{
  fileName: string;
  url: string;
}>;

type ImageCrop = Readonly<{
  scale: number;
  x: number;
  y: number;
}>;

const defaultSettings: ImageTreatmentSettings = {
  brightness: 100,
  contrast: 100,
  hue: 0,
  saturation: 100,
  sharpen: 0,
};

const defaultCrop: ImageCrop = { scale: 100, x: 0, y: 0 };
const playerImageTarget: ImageTreatmentTarget = {
  description:
    'PNG 1200 × 1200 é o padrão da foto do jogador. Ajuste o enquadramento antes de aplicar.',
  fileName: 'jogador',
  height: playerImageSpecification.height,
  label: 'card',
  width: playerImageSpecification.width,
};

const imageFilterPresets: readonly ImageFilterPreset[] = [
  {
    id: 'dramatic',
    label: 'Dramático',
    settings: { ...defaultSettings, brightness: 94, contrast: 132, saturation: 92, sharpen: 28 },
  },
  {
    id: 'futuristic',
    label: 'Futurista',
    settings: { ...defaultSettings, contrast: 120, hue: 15, saturation: 138, sharpen: 20 },
  },
  {
    id: 'stadium-lights',
    label: 'Stadium Lights',
    settings: { ...defaultSettings, brightness: 112, contrast: 124, saturation: 118, sharpen: 20 },
  },
  {
    id: 'futties-glow',
    label: 'Futties Glow',
    settings: {
      ...defaultSettings,
      brightness: 110,
      contrast: 114,
      hue: -12,
      saturation: 145,
      sharpen: 16,
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    settings: { ...defaultSettings, brightness: 94, contrast: 128, saturation: 75, sharpen: 15 },
  },
];

export function ImageTreatment({
  onApply,
  source: initialSource,
  target = playerImageTarget,
}: ImageTreatmentProps) {
  const inputId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localSourceUrlRef = useRef('');
  const cutoutUrlRef = useRef('');
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [cutout, setCutout] = useState<HTMLImageElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [sourceSize, setSourceSize] = useState<Readonly<{ height: number; width: number }> | null>(
    null,
  );
  const [settings, setSettings] = useState<ImageTreatmentSettings>(defaultSettings);
  const [crop, setCrop] = useState<ImageCrop>(defaultCrop);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [status, setStatus] = useState('Envie uma imagem para iniciar o tratamento.');
  const [processing, setProcessing] = useState(false);
  const activeSource = cutout ?? source;

  useEffect(
    () => () => {
      if (localSourceUrlRef.current) URL.revokeObjectURL(localSourceUrlRef.current);
      if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!initialSource?.url || initialSource.url === sourceUrl) return;
    selectSource(initialSource.url, null, initialSource.fileName);
  }, [initialSource?.fileName, initialSource?.url, sourceUrl]);

  useEffect(() => {
    if (!sourceUrl) return;
    let active = true;
    void loadImage(sourceUrl)
      .then((image) => {
        if (!active) return;
        setSource(image);
        setSourceSize({ height: image.naturalHeight, width: image.naturalWidth });
        setStatus(`Imagem pronta. Ajuste e aplique no ${target.label} ou baixe em PNG.`);
      })
      .catch(() => {
        if (active) setStatus('Não foi possível ler esta imagem. Use PNG, JPEG ou WebP válido.');
      });
    return () => {
      active = false;
    };
  }, [sourceUrl, target.label]);

  useEffect(() => {
    if (!activeSource || !canvasRef.current) return;
    renderImageTreatment(canvasRef.current, activeSource, settings, crop, target);
  }, [activeSource, crop, settings, target]);

  function selectSource(nextUrl: string, file: File | null, name: string, ownsUrl = false) {
    if (localSourceUrlRef.current) URL.revokeObjectURL(localSourceUrlRef.current);
    if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
    localSourceUrlRef.current = ownsUrl ? nextUrl : '';
    cutoutUrlRef.current = '';
    setSource(null);
    setSourceFile(file);
    setCutout(null);
    setSourceUrl(nextUrl);
    setFileName(name);
    setCrop(defaultCrop);
    setActivePreset(null);
    setStatus('Lendo imagem…');
  }

  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Use uma imagem PNG, JPEG ou WebP.');
      return;
    }
    selectSource(URL.createObjectURL(file), file, file.name, true);
  }

  async function removeBackgroundWithAi() {
    if (!sourceFile || processing) return;
    setProcessing(true);
    setStatus('Preparando modelo de recorte…');
    try {
      const options = {
        device: 'cpu',
        model: 'isnet',
        output: { format: 'image/png', quality: 1 },
        progress: (_asset: string, current: number, total: number) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          setStatus(
            percent ? `Baixando modelo de recorte: ${percent}%` : 'Preparando modelo de recorte…',
          );
        },
      } satisfies Config;
      const result = await removeBackground(sourceFile, options);
      const resultUrl = URL.createObjectURL(result);
      const image = await loadImage(resultUrl);
      if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
      cutoutUrlRef.current = resultUrl;
      setCutout(image);
      setStatus(`Fundo removido com IA. Revise bordas e aplique no ${target.label}.`);
    } catch {
      setStatus('Não foi possível remover o fundo. Confira sua conexão e tente novamente.');
    } finally {
      setProcessing(false);
    }
  }

  function restoreOriginalBackground() {
    if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
    cutoutUrlRef.current = '';
    setCutout(null);
    setStatus('Imagem original restaurada.');
  }

  function applyPreset(preset: ImageFilterPreset) {
    setSettings(preset.settings);
    setActivePreset(preset.id);
  }

  function updateSetting<Key extends keyof ImageTreatmentSettings>(
    key: Key,
    value: ImageTreatmentSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setActivePreset(null);
  }

  function renderOutput() {
    if (!activeSource) return null;
    const canvas = document.createElement('canvas');
    renderImageTreatment(canvas, activeSource, settings, crop, target);
    return canvas;
  }

  async function runOutput(action: (canvas: HTMLCanvasElement) => Promise<void>) {
    if (!activeSource || processing) return;
    setProcessing(true);
    try {
      await nextAnimationFrame();
      const canvas = renderOutput();
      if (!canvas) return;
      await action(canvas);
    } catch {
      setStatus('Não foi possível gerar a imagem tratada.');
    } finally {
      setProcessing(false);
    }
  }

  function downloadImage() {
    void runOutput(async (canvas) => {
      const image = await canvasBlob(canvas);
      const url = URL.createObjectURL(image);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName.replace(/\.[^.]+$/, '') || target.fileName}-${target.width}x${target.height}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('PNG tratado baixado.');
    });
  }

  function applyToCard() {
    void runOutput(async (canvas) => {
      const image = await canvasBlob(canvas);
      onApply(URL.createObjectURL(image), image);
      setStatus(`Imagem tratada aplicada no ${target.label}.`);
    });
  }

  const hasImage = Boolean(activeSource);

  return (
    <div className="image-treatment" aria-labelledby="image-treatment-title">
      <header className="image-treatment-header">
        <div>
          <p className="eyebrow">Laboratório de imagem</p>
          <h2 id="image-treatment-title">Prepare recortes para o {target.label}</h2>
          <p>{target.description}</p>
        </div>
        {sourceSize && (
          <div className="image-treatment-source">
            <span>Arquivo aberto</span>
            <strong>
              {sourceSize.width} × {sourceSize.height}
            </strong>
            <small>
              Saída: {target.width} × {target.height} PNG
            </small>
          </div>
        )}
      </header>

      <div className="image-treatment-workspace">
        <section className="image-treatment-preview" aria-label="Comparação da imagem tratada">
          {hasImage ? (
            <div className="image-treatment-compare">
              <figure>
                <figcaption>Original</figcaption>
                <img alt="Imagem original" src={sourceUrl} />
              </figure>
              <figure>
                <figcaption>Recorte padronizado</figcaption>
                <div className="image-treatment-canvas-wrap">
                  <canvas ref={canvasRef} />
                </div>
              </figure>
            </div>
          ) : (
            <label className="image-treatment-empty" htmlFor={inputId}>
              <span aria-hidden="true">✦</span>
              <strong>Envie uma imagem</strong>
              <small>PNG, JPEG ou WebP</small>
            </label>
          )}
          <p aria-live="polite" className="image-treatment-status">
            {status}
          </p>
        </section>

        <aside className="image-treatment-controls" aria-label="Ajustes de imagem">
          <div className="image-treatment-control-scroll">
            <label className="image-treatment-upload" htmlFor={inputId}>
              <span>{hasImage ? 'Trocar imagem' : 'Enviar imagem'}</span>
              <small>{fileName || 'PNG, JPEG ou WebP'}</small>
              <input
                accept="image/png,image/jpeg,image/webp"
                id={inputId}
                onChange={uploadImage}
                type="file"
              />
            </label>

            <fieldset className="image-treatment-crop" disabled={!hasImage}>
              <legend>Enquadramento</legend>
              <p>
                Saída obrigatória: {target.width} × {target.height} px em PNG. No zoom 100%, a
                imagem inteira é preservada; aumente o zoom somente quando quiser recortar.
              </p>
              {sourceSize &&
                (sourceSize.width < target.width || sourceSize.height < target.height) && (
                  <p className="image-treatment-crop-warning">
                    Esta imagem será ampliada para atingir a resolução padrão. Prefira um original
                    maior quando possível.
                  </p>
                )}
              <ImageRange
                label="Zoom do recorte"
                max={220}
                min={100}
                onChange={(value) => setCrop((current) => ({ ...current, scale: value }))}
                value={crop.scale}
              />
              <ImageRange
                label="Horizontal"
                max={100}
                min={-100}
                onChange={(value) => setCrop((current) => ({ ...current, x: value }))}
                suffix=""
                value={crop.x}
              />
              <ImageRange
                label="Vertical"
                max={100}
                min={-100}
                onChange={(value) => setCrop((current) => ({ ...current, y: value }))}
                suffix=""
                value={crop.y}
              />
              <button
                className="image-treatment-crop-reset"
                disabled={crop.scale === defaultCrop.scale && crop.x === 0 && crop.y === 0}
                onClick={() => setCrop(defaultCrop)}
                type="button"
              >
                Centralizar recorte
              </button>
            </fieldset>

            <fieldset className="image-treatment-presets" disabled={!hasImage}>
              <legend>Filtros</legend>
              <div>
                {imageFilterPresets.map((preset) => (
                  <button
                    aria-pressed={activePreset === preset.id}
                    className={activePreset === preset.id ? 'is-active' : undefined}
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="image-treatment-sliders" disabled={!hasImage}>
              <legend>Ajustes finos</legend>
              <ImageRange
                label="Luz"
                max={140}
                min={60}
                onChange={(value) => updateSetting('brightness', value)}
                value={settings.brightness}
              />
              <ImageRange
                label="Contraste"
                max={160}
                min={60}
                onChange={(value) => updateSetting('contrast', value)}
                value={settings.contrast}
              />
              <ImageRange
                label="Saturação"
                max={180}
                min={0}
                onChange={(value) => updateSetting('saturation', value)}
                value={settings.saturation}
              />
              <ImageRange
                label="Matiz"
                max={45}
                min={-45}
                onChange={(value) => updateSetting('hue', value)}
                suffix="°"
                value={settings.hue}
              />
              <ImageRange
                label="Realçar detalhes"
                max={100}
                min={0}
                onChange={(value) => updateSetting('sharpen', value)}
                suffix="%"
                value={settings.sharpen}
              />
            </fieldset>

            <fieldset className="image-treatment-background" disabled={!sourceFile}>
              <legend>Recorte por IA</legend>
              <p>
                O modelo identifica a pessoa e preserva transparência nas bordas. O primeiro uso
                baixa cerca de 80 MB e fica em cache neste navegador.
              </p>
              <div className="image-treatment-background-actions">
                <button
                  className="button-secondary"
                  disabled={!sourceFile || processing}
                  onClick={() => void removeBackgroundWithAi()}
                  type="button"
                >
                  {processing
                    ? 'Recortando…'
                    : cutout
                      ? 'Refazer recorte IA'
                      : 'Remover fundo com IA'}
                </button>
                {cutout && (
                  <button
                    className="image-treatment-restore"
                    onClick={restoreOriginalBackground}
                    type="button"
                  >
                    Restaurar original
                  </button>
                )}
              </div>
            </fieldset>
          </div>

          <div className="image-treatment-actions">
            <button
              className="button-secondary"
              disabled={!hasImage || processing}
              onClick={downloadImage}
              type="button"
            >
              Baixar PNG
            </button>
            <button
              className="button-primary"
              disabled={!hasImage || processing}
              onClick={applyToCard}
              type="button"
            >
              {processing ? 'Gerando…' : `Aplicar no ${target.label}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ImageRange({
  label,
  max,
  min,
  onChange,
  suffix = '%',
  value,
}: Readonly<{
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}>) {
  return (
    <label>
      <span>
        {label}{' '}
        <output>
          {value}
          {suffix}
        </output>
      </span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function loadImage(source: string): Promise<HTMLImageElement> {
  const { promise, reject, resolve } = Promise.withResolvers<HTMLImageElement>();
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Imagem indisponível.'));
  image.src = source;
  return promise;
}

function renderImageTreatment(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  settings: ImageTreatmentSettings,
  crop: ImageCrop,
  target: ImageTreatmentTarget,
) {
  const { height, width } = target;
  canvas.height = height;
  canvas.width = width;
  const context = canvas.getContext('2d', { willReadFrequently: settings.sharpen > 0 });
  if (!context) throw new Error('Canvas indisponível.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (
    settings.brightness !== 100 ||
    settings.contrast !== 100 ||
    settings.hue !== 0 ||
    settings.saturation !== 100
  ) {
    context.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)`;
  }
  drawCroppedImage(context, image, crop, width, height);
  context.filter = 'none';
  if (settings.sharpen > 0) sharpenImage(context, width, height, settings.sharpen / 100);
}

function drawCroppedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  crop: ImageCrop,
  width: number,
  height: number,
) {
  const baseScale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const scale = baseScale * (crop.scale / 100);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const overflowX = Math.max(0, (renderedWidth - width) / 2);
  const overflowY = Math.max(0, (renderedHeight - height) / 2);
  context.drawImage(
    image,
    (width - renderedWidth) / 2 + overflowX * (crop.x / 100),
    (height - renderedHeight) / 2 + overflowY * (crop.y / 100),
    renderedWidth,
    renderedHeight,
  );
}

function sharpenImage(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
) {
  const source = context.getImageData(0, 0, width, height);
  const result = new Uint8ClampedArray(source.data);
  const rowSize = width * 4;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = y * rowSize + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const current = source.data[pixel + channel];
        const edges =
          current * 4 -
          source.data[pixel - 4 + channel] -
          source.data[pixel + 4 + channel] -
          source.data[pixel - rowSize + channel] -
          source.data[pixel + rowSize + channel];
        result[pixel + channel] = Math.round(
          Math.min(255, Math.max(0, current + edges * strength)),
        );
      }
    }
  }
  source.data.set(result);
  context.putImageData(source, 0, 0);
}

function nextAnimationFrame(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  window.requestAnimationFrame(() => resolve());
  return promise;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const { promise, reject, resolve } = Promise.withResolvers<Blob>();
  canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('PNG indisponível.'))),
    'image/png',
  );
  return promise;
}
