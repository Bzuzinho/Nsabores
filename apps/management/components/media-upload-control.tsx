'use client';

import { useState, type ChangeEvent } from 'react';
import { managementApi } from './management-auth';

type UploadedMedia = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export function MediaUploadControl({
  targetName,
  multiple = false,
  label = 'Carregar imagem',
}: {
  targetName: string;
  multiple?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    const files = Array.from(event.currentTarget.files ?? []);
    if (!form || !files.length) return;

    setBusy(true);
    setMessage('');

    try {
      const urls: string[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append('file', file);
        const uploaded = await managementApi.postForm<UploadedMedia>(
          '/v1/admin/media',
          data,
        );
        urls.push(uploaded.url);
      }

      const target = form.elements.namedItem(targetName);
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      ) {
        throw new Error('Campo de destino da imagem não encontrado.');
      }

      if (multiple) {
        const current = target.value
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean);
        target.value = [...new Set([...current, ...urls])].join('\n');
      } else {
        target.value = urls[0] ?? '';
      }

      setMessage(
        files.length === 1
          ? 'Imagem carregada.'
          : `${files.length} imagens carregadas.`,
      );
      event.currentTarget.value = '';
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : 'O upload da imagem falhou.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          disabled={busy}
          onChange={(event) => void upload(event)}
        />
      </label>
      <small>{busy ? 'A carregar…' : message || 'JPG, PNG ou WebP · máximo 8 MB'}</small>
    </div>
  );
}
