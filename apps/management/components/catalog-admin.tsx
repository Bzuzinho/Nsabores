'use client';

import type {
  CatalogCategory,
  CatalogProduct,
  Paginated,
  StockStatus,
} from '@nsabores/types';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { managementApi } from './management-auth';

type Mode = 'dashboard' | 'products' | 'product-form' | 'categories';
type Mutate = (
  path: string,
  init: RequestInit,
  success: string,
) => Promise<boolean>;
interface ProductFilters {
  search: string;
  category: string;
  stock: string;
  featured: string;
}
interface FilterSetters {
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  setStock: (value: string) => void;
  setFeatured: (value: string) => void;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return managementApi.request<T>(`/v1/admin/${path}`, init);
}

export function CatalogAdmin({
  mode,
  productId,
}: {
  mode: Mode;
  productId?: string;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [featured, setFeatured] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productResult, categoryResult] = await Promise.all([
        api<Paginated<CatalogProduct>>('products?limit=100'),
        api<CatalogCategory[]>('categories'),
      ]);
      setProducts(productResult.data);
      setCategories(categoryResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3000);
  };
  const mutate = async (path: string, init: RequestInit, success: string) => {
    setError('');
    try {
      await api(path, init);
      notify(success);
      await load();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado.');
      return false;
    }
  };

  if (loading)
    return (
      <div className="admin-state" aria-busy="true">
        A carregar catálogo...
      </div>
    );
  if (error && products.length === 0)
    return (
      <div className="admin-state admin-error" role="alert">
        {error}
        <button onClick={() => void load()}>Tentar novamente</button>
      </div>
    );

  return (
    <>
      {message && (
        <div className="admin-message" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}
      {mode === 'dashboard' && (
        <Dashboard products={products} categories={categories} />
      )}
      {mode === 'products' && (
        <ProductList
          products={products.filter(
            (product) =>
              (!search ||
                `${product.name} ${product.sku}`
                  .toLowerCase()
                  .includes(search.toLowerCase())) &&
              (!category || product.category.id === category) &&
              (!stock || product.stockStatus === stock) &&
              (!featured || String(product.isFeatured) === featured),
          )}
          categories={categories}
          filters={{ search, category, stock, featured }}
          setFilters={{ setSearch, setCategory, setStock, setFeatured }}
          mutate={mutate}
        />
      )}
      {mode === 'categories' && (
        <CategoryManager categories={categories} mutate={mutate} />
      )}
      {mode === 'product-form' && (
        <ProductForm
          categories={categories}
          product={products.find((item) => item.id === productId)}
          mutate={mutate}
        />
      )}
    </>
  );
}

function Dashboard({
  products,
  categories,
}: {
  products: CatalogProduct[];
  categories: CatalogCategory[];
}) {
  const metrics = [
    ['Produtos', products.length],
    ['Categorias', categories.length],
    ['Ativos', products.filter((item) => item.isActive).length],
    [
      'Sem stock',
      products.filter((item) => item.stockStatus === 'OUT_OF_STOCK').length,
    ],
    ['Destaques', products.filter((item) => item.isFeatured).length],
  ];
  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle="Estado atual da seleção Nsabores."
      />
      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </>
  );
}

function ProductList({
  products,
  categories,
  filters,
  setFilters,
  mutate,
}: {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  filters: ProductFilters;
  setFilters: FilterSetters;
  mutate: Mutate;
}) {
  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} resultados`}
        action={
          <Link className="admin-primary" href="/catalogo/produtos/novo">
            Novo produto
          </Link>
        }
      />
      <div className="admin-filters">
        <input
          aria-label="Pesquisar"
          placeholder="Pesquisar produto ou SKU"
          value={filters.search}
          onChange={(event) => setFilters.setSearch(event.target.value)}
        />
        <select
          aria-label="Categoria"
          value={filters.category}
          onChange={(event) => setFilters.setCategory(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((item: CatalogCategory) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Stock"
          value={filters.stock}
          onChange={(event) => setFilters.setStock(event.target.value)}
        >
          <option value="">Todos os estados</option>
          <option value="IN_STOCK">Em stock</option>
          <option value="LOW_STOCK">Stock baixo</option>
          <option value="OUT_OF_STOCK">Sem stock</option>
          <option value="PREORDER">Pré-encomenda</option>
        </select>
        <select
          aria-label="Destaque"
          value={filters.featured}
          onChange={(event) => setFilters.setFeatured(event.target.value)}
        >
          <option value="">Todos</option>
          <option value="true">Destaques</option>
          <option value="false">Não destacados</option>
        </select>
      </div>
      {products.length === 0 ? (
        <div className="admin-state">
          Nenhum produto corresponde aos filtros.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Estado</th>
                <th>Destaque</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: CatalogProduct) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                  </td>
                  <td>{product.category.name}</td>
                  <td>
                    {(product.priceCents / 100).toLocaleString('pt-PT', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </td>
                  <td>{product.isActive ? product.stockStatus : 'Inativo'}</td>
                  <td>
                    <button
                      onClick={() =>
                        void mutate(
                          `products/${product.id}`,
                          {
                            method: 'PATCH',
                            body: JSON.stringify({
                              isFeatured: !product.isFeatured,
                            }),
                          },
                          'Destaque atualizado.',
                        )
                      }
                    >
                      {product.isFeatured ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td>
                    <Link href={`/catalogo/produtos/${product.id}`}>
                      Editar
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`Desativar ${product.name}?`))
                          void mutate(
                            `products/${product.id}`,
                            { method: 'DELETE' },
                            'Produto desativado.',
                          );
                      }}
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ProductForm({
  categories,
  product,
  mutate,
}: {
  categories: CatalogCategory[];
  product?: CatalogProduct;
  mutate: Mutate;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    Object.assign(payload, {
      priceCents: Math.round(Number(payload.price) * 100),
      compareAtPriceCents: payload.compareAtPrice
        ? Math.round(Number(payload.compareAtPrice) * 100)
        : undefined,
      gallery: String(payload.gallery || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      isActive: form.get('isActive') === 'on',
      isFeatured: form.get('isFeatured') === 'on',
      minimumOrderQuantity: Number(payload.minimumOrderQuantity || 1),
      orderMultiple: Number(payload.orderMultiple || 1),
      caseSize: payload.caseSize ? Number(payload.caseSize) : undefined,
    });
    delete payload.price;
    delete payload.compareAtPrice;
    const ok = await mutate(
      product ? `products/${product.id}` : 'products',
      { method: product ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      product ? 'Produto atualizado.' : 'Produto criado.',
    );
    if (ok && !product) event.currentTarget.reset();
  };
  return (
    <>
      <PageHeader
        title={product ? 'Editar produto' : 'Novo produto'}
        subtitle="Preços em euros; a API guarda cêntimos inteiros."
      />
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label>
          Nome
          <input required name="name" defaultValue={product?.name} />
        </label>
        <label>
          Slug
          <input
            required
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={product?.slug}
          />
        </label>
        <label>
          SKU
          <input
            required
            name="sku"
            pattern="[A-Z0-9][A-Z0-9._-]*"
            defaultValue={product?.sku}
          />
        </label>
        <label>
          Categoria
          <select
            required
            name="categoryId"
            defaultValue={product?.category.id}
          >
            <option value="">Selecionar</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Descrição curta
          <input
            required
            maxLength={240}
            name="shortDescription"
            defaultValue={product?.shortDescription}
          />
        </label>
        <label className="wide">
          Descrição
          <textarea
            name="description"
            defaultValue={product?.description ?? ''}
          />
        </label>
        <label>
          Preço
          <input
            required
            min="0"
            step="0.01"
            type="number"
            name="price"
            defaultValue={product ? product.priceCents / 100 : ''}
          />
        </label>
        <label>
          Preço anterior
          <input
            min="0"
            step="0.01"
            type="number"
            name="compareAtPrice"
            defaultValue={
              product?.compareAtPriceCents
                ? product.compareAtPriceCents / 100
                : ''
            }
          />
        </label>
        <label className="wide">
          Imagem
          <input
            required
            name="imageUrl"
            pattern="(/images/.+|https?://.+)"
            defaultValue={product?.imageUrl}
          />
        </label>
        <label className="wide">
          Galeria, um URL por linha
          <textarea name="gallery" defaultValue={product?.gallery.join('\n')} />
        </label>
        <label>
          Stock
          <select
            name="stockStatus"
            defaultValue={product?.stockStatus ?? 'IN_STOCK'}
          >
            {(
              [
                'IN_STOCK',
                'LOW_STOCK',
                'OUT_OF_STOCK',
                'PREORDER',
              ] as StockStatus[]
            ).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Canal de venda
          <select name="channel" defaultValue={product?.channel ?? 'BOTH'}>
            <option value="BOTH">Loja e profissional</option>
            <option value="B2C_ONLY">Apenas loja</option>
            <option value="B2B_ONLY">Apenas profissional</option>
          </select>
        </label>
        <label>
          Unidade de venda
          <select name="saleUnit" defaultValue={product?.saleUnit ?? 'UNIT'}>
            <option value="UNIT">Unidade</option>
            <option value="PACK">Pack</option>
            <option value="CASE">Caixa</option>
          </select>
        </label>
        <label>
          Quantidade mínima
          <input
            required
            min="1"
            type="number"
            name="minimumOrderQuantity"
            defaultValue={product?.minimumOrderQuantity ?? 1}
          />
        </label>
        <label>
          Múltiplo de encomenda
          <input
            required
            min="1"
            type="number"
            name="orderMultiple"
            defaultValue={product?.orderMultiple ?? 1}
          />
        </label>
        <label>
          Unidades por caixa
          <input
            min="1"
            type="number"
            name="caseSize"
            defaultValue={product?.caseSize ?? ''}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
          />{' '}
          Ativo
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product?.isFeatured}
          />{' '}
          Destaque
        </label>
        <button className="admin-primary" type="submit">
          Guardar produto
        </button>
      </form>
    </>
  );
}

function CategoryManager({
  categories,
  mutate,
}: {
  categories: CatalogCategory[];
  mutate: Mutate;
}) {
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      slug: form.get('slug'),
      description: form.get('description'),
      sortOrder: Number(form.get('sortOrder')),
      isActive: form.get('isActive') === 'on',
    };
    const ok = await mutate(
      editing ? `categories/${editing.id}` : 'categories',
      { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      editing ? 'Categoria atualizada.' : 'Categoria criada.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  };
  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Organização pública do catálogo."
      />
      <div className="category-layout">
        <div>
          {categories.map((item) => (
            <article className="category-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  /{item.slug} · {item.isActive ? 'Ativa' : 'Inativa'}
                </small>
              </div>
              <button onClick={() => setEditing(item)}>Editar</button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Eliminar ${item.name}? Categorias com produtos serão protegidas.`,
                    )
                  )
                    void mutate(
                      `categories/${item.id}`,
                      { method: 'DELETE' },
                      'Categoria eliminada.',
                    );
                }}
              >
                Eliminar
              </button>
            </article>
          ))}
        </div>
        <form
          className="admin-form compact"
          key={editing?.id ?? 'new'}
          onSubmit={(event) => void submit(event)}
        >
          <h2>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
          <label>
            Nome
            <input required name="name" defaultValue={editing?.name} />
          </label>
          <label>
            Slug
            <input
              required
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              defaultValue={editing?.slug}
            />
          </label>
          <label>
            Descrição
            <textarea
              name="description"
              defaultValue={editing?.description ?? ''}
            />
          </label>
          <label>
            Ordem
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={editing?.sortOrder ?? categories.length}
            />
          </label>
          <label className="check">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={editing?.isActive ?? true}
            />{' '}
            Ativa
          </label>
          <button className="admin-primary">Guardar categoria</button>
        </form>
      </div>
    </>
  );
}

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
