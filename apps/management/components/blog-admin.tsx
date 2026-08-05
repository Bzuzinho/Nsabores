'use client';

import type { BlogPost, BlogPostStatus, Paginated } from '@nsabores/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { managementApi } from './management-auth';

export function BlogAdmin({ postId }: { postId?: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (postId) {
        setPost(await managementApi.get<BlogPost>(`/v1/admin/blog/${postId}`));
      } else {
        const result = await managementApi.get<Paginated<BlogPost>>(
          '/v1/admin/blog?limit=100',
        );
        setPosts(result.data);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    return posts.filter(
      (item) =>
        (!status || item.status === status) &&
        (!normalized ||
          `${item.title} ${item.excerpt}`
            .toLocaleLowerCase('pt-PT')
            .includes(normalized)),
    );
  }, [posts, query, status]);

  const remove = async (item: BlogPost) => {
    if (!confirm(`Eliminar definitivamente “${item.title}”?`)) return;
    setError('');
    try {
      await managementApi.delete(`/v1/admin/blog/${item.id}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      coverImageUrl: data.coverImageUrl,
      imageAlt: data.imageAlt,
      status: data.status as BlogPostStatus,
      publishedAt: data.publishedAt
        ? new Date(String(data.publishedAt)).toISOString()
        : undefined,
    };
    try {
      await managementApi.request(
        postId ? `/v1/admin/blog/${postId}` : '/v1/admin/blog',
        {
          method: postId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      router.push('/blog');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar blog…
      </div>
    );

  if (postId || postId === '') {
    return (
      <section className="admin-page">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Conteúdo editorial</p>
            <h1>{post ? 'Editar artigo' : 'Novo artigo'}</h1>
            <p>Crie o conteúdo que será publicado no Blog Nsabores.</p>
          </div>
          <Link className="admin-secondary" href="/blog">
            Voltar
          </Link>
        </header>
        {error && <p className="admin-error">{error}</p>}
        <form
          className="admin-form blog-admin-form"
          onSubmit={(event) => void submit(event)}
        >
          <label className="wide">
            Título
            <input
              required
              name="title"
              maxLength={180}
              defaultValue={post?.title}
            />
          </label>
          <label>
            Slug
            <input
              required
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              defaultValue={post?.slug}
            />
          </label>
          <label>
            Estado
            <select name="status" defaultValue={post?.status ?? 'DRAFT'}>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </label>
          <label className="wide">
            Resumo
            <textarea
              required
              name="excerpt"
              maxLength={600}
              defaultValue={post?.excerpt}
            />
          </label>
          <label className="wide">
            Conteúdo
            <textarea
              required
              className="blog-content-editor"
              name="content"
              maxLength={50000}
              defaultValue={post?.content}
            />
          </label>
          <label className="wide">
            Imagem de capa
            <input
              required
              name="coverImageUrl"
              pattern="(/images/.+|https?://.+)"
              defaultValue={
                post?.coverImageUrl ?? '/images/experience-dinner-clean.jpg'
              }
            />
          </label>
          <label className="wide">
            Texto alternativo da imagem
            <input
              required
              name="imageAlt"
              maxLength={220}
              defaultValue={post?.imageAlt}
            />
          </label>
          <label>
            Data de publicação
            <input
              type="datetime-local"
              name="publishedAt"
              defaultValue={post?.publishedAt?.slice(0, 16)}
            />
          </label>
          <button className="admin-primary" disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar artigo'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Conteúdo editorial</p>
          <h1>Blog</h1>
          <p>Criação, publicação, edição e remoção de artigos.</p>
        </div>
        <Link className="admin-primary" href="/blog/novo">
          Novo artigo
        </Link>
      </header>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-list-toolbar blog-toolbar">
        <label>
          <span>Pesquisar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="PUBLISHED">Publicados</option>
          </select>
        </label>
        <small>{filtered.length} artigos</small>
      </div>
      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Artigo</th>
              <th>Estado</th>
              <th>Publicação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  <small>/{item.slug}</small>
                </td>
                <td>
                  {item.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                </td>
                <td>
                  {item.publishedAt
                    ? new Date(item.publishedAt).toLocaleString('pt-PT')
                    : '—'}
                </td>
                <td>
                  <Link href={`/blog/${item.id}`}>Editar</Link>
                  <button type="button" onClick={() => void remove(item)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
