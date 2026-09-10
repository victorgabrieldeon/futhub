import { type Config, removeBackground } from '@imgly/background-removal';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';

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
  onApply: (imageUrl: string) => void;
}>;

const defaultSettings: ImageTreatmentSettings = {
  brightness: 100,
  contrast: 100,
  hue: 0,
  saturation: 100,
  sharpen: 0,
};

const imageFilterPresets: readonly ImageFilterPreset[] = [
  { id: 'original', label: 'Original', settings: defaultSettings },
  {
    id: 'vibrant',
    label: 'Vibrante',
    settings: { ...defaultSettings, contrast: 108, saturation: 128, sharpen: 18 },
  },
  {
    id: 'mono',
    label: 'Mono',
    settings: { ...defaultSettings, brightness: 104, contrast: 118, saturation: 0, sharpen: 12 },
  },
  {
    id: 'warm',
    label: 'Quente',
    settings: { ...defaultSettings, brightness: 104, hue: -8, saturation: 112, sharpen: 10 },
  },
  {
    id: 'cool',
    label: 'Frio',
    settings: { ...defaultSettings, contrast: 105, hue: 10, saturation: 108, sharpen: 10 },
  },
];

export function ImageTreatment({ onApply }: ImageTreatmentProps) {
  const inputId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceUrlRef = useRef('');
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
  const [status, setStatus] = useState('Envie uma imagem para iniciar o tratamento.');
  const [processing, setProcessing] = useState(false);
  const activeSource = cutout ?? source;

  useEffect(
    () => () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!sourceUrl) return;
    let active = true;
    void loadImage(sourceUrl)
      .then((image) => {
        if (!active) return;
        setSource(image);
        setSourceSize({ height: image.naturalHeight, width: image.naturalWidth });
        setStatus('Imagem pronta. Ajuste e aplique no card ou baixe em PNG.');
      })
      .catch(() => {
        if (active) setStatus('Não foi possível ler esta imagem. Use PNG, JPEG ou WebP válido.');
      });
    return () => {
      active = false;
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (!activeSource || !canvasRef.current) return;
    renderImageTreatment(canvasRef.current, activeSource, settings, 1200);
  }, [activeSource, settings]);

  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Use uma imagem PNG, JPEG ou WebP.');
      return;
    }
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    if (cutoutUrlRef.current) URL.revokeObjectURL(cutoutUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    sourceUrlRef.current = nextUrl;
    cutoutUrlRef.current = '';
    setSource(null);
    setSourceFile(file);
    setCutout(null);
    setSourceUrl(nextUrl);
    setFileName(file.name);
    setStatus('Lendo imagem…');
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
      setStatus('Fundo removido com IA. Revise bordas e aplique no card.');
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
  }

  function updateSetting<Key extends keyof ImageTreatmentSettings>(
    key: Key,
    value: ImageTreatmentSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function renderOutput() {
    if (!activeSource) return null;
    const canvas = document.createElement('canvas');
    renderImageTreatment(canvas, activeSource, settings);
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
      link.download = `${fileName.replace(/\.[^.]+$/, '') || 'imagem'}-tratada.png`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('PNG tratado baixado.');
    });
  }

  function applyToCard() {
    void runOutput(async (canvas) => {
      const image = await canvasBlob(canvas);
      onApply(URL.createObjectURL(image));
      setStatus('Imagem tratada aplicada no card.');
    });
  }

  const hasImage = Boolean(activeSource);

  return (
    <div className="image-treatment" aria-labelledby="image-treatment-title">
      <header className="image-treatment-header">
        <div>
          <p className="eyebrow">Laboratório de imagem</p>
          <h2 id="image-treatment-title">Prepare recortes para o card</h2>
          <p>Tratamento local no navegador. Nenhuma imagem é enviada para o servidor.</p>
        </div>
        {sourceSize && (
          <div className="image-treatment-source">
            <span>Arquivo aberto</span>
            <strong>
              {sourceSize.width} × {sourceSize.height}
            </strong>
          </div>
        )}
      </header>

      <div className="image-treatment-workspace">
        <section className="image-treatment-preview" aria-label="Prévia da imagem tratada">
          {hasImage ? (
            <div className="image-treatment-canvas-wrap">
              <canvas ref={canvasRef} />
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

          <fieldset className="image-treatment-presets" disabled={!hasImage}>
            <legend>Filtros</legend>
            <div>
              {imageFilterPresets.map((preset) => (
                <button key={preset.id} onClick={() => applyPreset(preset)} type="button">
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
              O modelo identifica a pessoa e preserva transparência nas bordas. O primeiro uso baixa
              cerca de 80 MB e fica em cache neste navegador.
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
              {processing ? 'Gerando…' : 'Aplicar no card'}
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
  maximumDimension?: number,
) {
  const scale = maximumDimension
    ? Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight))
    : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.height = height;
  canvas.width = width;
  const context = canvas.getContext('2d', { willReadFrequently: settings.sharpen > 0 });
  if (!context) throw new Error('Canvas indisponível.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  if (
    settings.brightness !== 100 ||
    settings.contrast !== 100 ||
    settings.hue !== 0 ||
    settings.saturation !== 100
  ) {
    const buffer = document.createElement('canvas');
    buffer.height = height;
    buffer.width = width;
    buffer.getContext('2d')?.drawImage(canvas, 0, 0);
    context.clearRect(0, 0, width, height);
    context.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%) hue-rotate(${settings.hue}deg)`;
    context.drawImage(buffer, 0, 0);
    context.filter = 'none';
  }

  if (settings.sharpen > 0) sharpenImage(context, width, height, settings.sharpen / 100);
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
