import { useEffect, useState } from 'react';
import { packModelImage } from './pack-model';
import {
  type PackStudioArt,
  type PackStudioDraft,
  defaultPackStudioDraft,
  packStudioArtKeys,
  packStudioPresets,
} from './pack-studio-model';

type Preview = Readonly<{ label: string; url: string | null }>;
let previews: Promise<readonly Preview[]> | undefined;

function presetPreviews(): Promise<readonly Preview[]> {
  previews ??= Promise.all(
    packStudioPresets.map(async ({ label, art }) => {
      try {
        const canvas = await packModelImage({ ...defaultPackStudioDraft(), ...art });
        return { label, url: canvas.toDataURL('image/png') };
      } catch {
        return { label, url: null };
      }
    }),
  );
  return previews;
}

export function PackStudioPresets({
  draft,
  onApplyArt,
}: Readonly<{
  draft: PackStudioDraft;
  onApplyArt: (art: PackStudioArt) => void;
}>) {
  const [images, setImages] = useState<readonly Preview[]>([]);
  useEffect(() => {
    let mounted = true;
    void presetPreviews().then((result) => {
      if (mounted) setImages(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <div className="pack-studio-section-label">Direção de arte</div>
      <div aria-label="Presets de arte" className="pack-studio-direction-list">
        {packStudioPresets.map(({ label, description, art }) => {
          const image = images.find((item) => item.label === label);
          return (
            <button
              aria-label={`Aplicar preset ${label}`}
              aria-pressed={packStudioArtKeys.every((key) => draft[key] === art[key])}
              key={label}
              onClick={() => onApplyArt(art)}
              type="button"
            >
              <span className="pack-studio-preset-image">
                {image?.url ? (
                  <img alt="" height={128} src={image.url} width={96} />
                ) : (
                  <span>{image ? 'Prévia indisponível' : 'Carregando…'}</span>
                )}
              </span>
              <strong>{label}</strong>
              <small>{description}</small>
            </button>
          );
        })}
      </div>
      <p className="form-note">
        Miniaturas com texto de exemplo. Presets alteram apenas acabamento e cores.
      </p>
    </>
  );
}
