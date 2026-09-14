import { useEffect, useState } from 'react';
import { packModelImage } from './pack-model';
import type { PackStudioDraft } from './pack-studio-model';

export function PackModelPreview({ draft }: Readonly<{ draft: PackStudioDraft }>) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setFailed(false);
    void packModelImage(draft)
      .then((canvas) => {
        if (current) setImageUrl(canvas.toDataURL('image/png'));
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [draft]);

  if (failed) return <p className="form-error">Não foi possível renderizar a prévia 3D.</p>;
  if (!imageUrl) return <p className="form-note">Renderizando prévia 3D…</p>;

  return (
    <img
      alt={`Prévia 3D do pack ${draft.name || 'novo'}`}
      className="pack-model-preview"
      src={imageUrl}
    />
  );
}
