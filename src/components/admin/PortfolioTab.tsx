import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Images, LoaderCircle, Pencil, Plus, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import { errorMessage } from '../../lib/api';
import { compressImage, publicUrl, PORTFOLIO_BUCKET, randomId, uploadToBucket } from '../../lib/images';
import type { SessionUser } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { categoryLabel, DEFAULT_PORTFOLIO, normalizePortfolioRow, PORTFOLIO_CATEGORIES, subCategoryLabel, type PortfolioItem } from '../../content/portfolio';
import type { LoadState } from './AdminDashboard';

interface PortfolioTabProps {
  user: SessionUser;
  onChanged?: () => Promise<void> | void;
}

export default function PortfolioTab({ user, onChanged }: PortfolioTabProps) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<PortfolioItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PortfolioItem | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [importing, setImporting] = useState(false);
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('portfolio_images')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Could not load portfolio:', error);
      setState('error');
      return;
    }
    setItems((data || []).map(normalizePortfolioRow));
    setOrderDirty(false);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const afterChange = async () => {
    await load();
    await onChanged?.();
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: items.length };
    PORTFOLIO_CATEGORIES.forEach((entry) => {
      map[entry.value] = items.filter((item) => item.category === entry.value).length;
    });
    return map;
  }, [items]);

  const visible = category === 'all' ? items : items.filter((item) => item.category === category);
  const canReorder = category === 'all';

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const results = await Promise.all(
        items.map((item, index) => supabase.from('portfolio_images').update({ display_order: index }).eq('id', item.id).select('id'))
      );
      const failed = results.find((result) => result.error || !result.data?.length);
      if (failed) throw failed.error || new Error('Order could not be saved. The portfolio update policy may be missing (see the migration).');
      toast.success('Gallery order saved');
      await afterChange();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the order.'));
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleFeatured = async (item: PortfolioItem) => {
    const next = !item.isFeatured;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isFeatured: next } : entry)));
    const { data, error } = await supabase.from('portfolio_images').update({ is_featured: next }).eq('id', item.id).select('id');
    if (error || !data?.length) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isFeatured: !next } : entry)));
      toast.error(error?.message || 'Could not update. The portfolio update policy may be missing (see the migration).');
      return;
    }
    toast.success(next ? 'Marked as featured' : 'Removed from featured');
    await onChanged?.();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('portfolio_images').delete().eq('id', deleting.id);
    if (error) {
      toast.error(error.message || 'Could not delete this photo.');
      return;
    }
    toast.success('Photo removed from the gallery');
    setDeleting(null);
    await afterChange();
  };

  const importDefaults = async () => {
    setImporting(true);
    try {
      const rows = DEFAULT_PORTFOLIO.map((item, index) => ({
        title: item.title,
        description: item.description || '',
        category: item.category,
        subcategory: item.subCategory,
        image_url: new URL(item.src, window.location.origin).href,
        created_by: user.id,
        display_order: index,
        is_featured: Boolean(item.isFeatured),
      }));
      const { error } = await supabase.from('portfolio_images').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} photos imported. You can now reorder and edit them.`);
      await afterChange();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not import the built-in photos.'));
    } finally {
      setImporting(false);
    }
  };

  const onDragStart = (id: string) => (event: DragEvent) => {
    dragId.current = id;
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (id: string) => (event: DragEvent) => {
    if (!dragId.current) return;
    event.preventDefault();
    setDragOver(id);
  };
  const onDrop = (id: string) => (event: DragEvent) => {
    event.preventDefault();
    const from = items.findIndex((item) => item.id === dragId.current);
    const to = items.findIndex((item) => item.id === id);
    dragId.current = null;
    setDragOver(null);
    if (from >= 0 && to >= 0) move(from, to);
  };

  return (
    <section className="admin-section" aria-labelledby="portfolio-title">
      <header className="admin-head">
        <div>
          <h1 id="portfolio-title">Portfolio</h1>
          <p>{state === 'ready' && items.length === 0 ? 'The website is showing the built-in photos.' : `${items.length} photos in the gallery`}</p>
        </div>
        <div className="admin-head-actions">
          {orderDirty && (
            <button type="button" className="btn btn-primary btn-sm" onClick={saveOrder} disabled={savingOrder}>
              {savingOrder && <LoaderCircle size={16} className="spin" />} Save order
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => void load()} aria-label="Refresh portfolio" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus size={16} /> Add photo
          </button>
        </div>
      </header>

      {state === 'loading' && (
        <div className="loading-row">
          <LoaderCircle size={20} className="spin" /> Loading gallery…
        </div>
      )}
      {state === 'error' && (
        <div className="notice notice-danger">
          The gallery could not be loaded. <button type="button" className="btn-link" onClick={() => void load()}>Try again</button>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <div className="empty-state admin-card">
          <Images size={36} />
          <h3>Manage the gallery from here</h3>
          <p>
            Your website currently shows the {DEFAULT_PORTFOLIO.length} built-in photos. Import them to reorder, feature, edit or remove them, or start fresh by adding
            your own.
          </p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={importDefaults} disabled={importing}>
              {importing ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} Import built-in photos
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing('new')}>
              <ImagePlus size={16} /> Add a photo
            </button>
          </div>
        </div>
      )}

      {state === 'ready' && items.length > 0 && (
        <>
          <div className="chip-row" role="group" aria-label="Filter by category">
            <button type="button" className={`chip chip-sm ${category === 'all' ? 'is-active' : ''}`} onClick={() => setCategory('all')} aria-pressed={category === 'all'}>
              All <span className="chip-count">{counts.all}</span>
            </button>
            {PORTFOLIO_CATEGORIES.filter((entry) => counts[entry.value]).map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={`chip chip-sm ${category === entry.value ? 'is-active' : ''}`}
                onClick={() => setCategory(entry.value)}
                aria-pressed={category === entry.value}
              >
                {entry.name} <span className="chip-count">{counts[entry.value]}</span>
              </button>
            ))}
          </div>
          <p className="admin-hint">
            {canReorder
              ? 'Drag photos or use the arrows to change the order on the website, then press Save order. Starred photos are featured and shown first.'
              : 'Switch to All to change the order.'}
          </p>

          <ul className="pf-grid">
            {visible.map((item) => {
              const index = items.indexOf(item);
              return (
                <li
                  key={item.id}
                  className={`pf-card ${dragOver === item.id ? 'is-drag-over' : ''}`}
                  draggable={canReorder}
                  onDragStart={canReorder ? onDragStart(item.id) : undefined}
                  onDragOver={canReorder ? onDragOver(item.id) : undefined}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={canReorder ? onDrop(item.id) : undefined}
                  onDragEnd={() => setDragOver(null)}
                >
                  <div className="pf-thumb">
                    <img src={item.thumb || item.src} alt={item.title} loading="lazy" draggable={false} />
                    {canReorder && (
                      <span className="pf-order" aria-hidden="true">
                        <GripVertical size={14} /> {index + 1}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`pf-star ${item.isFeatured ? 'is-on' : ''}`}
                      onClick={() => toggleFeatured(item)}
                      aria-pressed={Boolean(item.isFeatured)}
                      aria-label={item.isFeatured ? `Unfeature ${item.title}` : `Feature ${item.title}`}
                      title={item.isFeatured ? 'Featured' : 'Feature this photo'}
                    >
                      <Star size={16} />
                    </button>
                  </div>
                  <div className="pf-body">
                    <strong title={item.title}>{item.title}</strong>
                    <span>
                      {categoryLabel(item.category)}
                      {item.subCategory ? ` · ${subCategoryLabel(item.category, item.subCategory)}` : ''}
                    </span>
                  </div>
                  <div className="pf-actions">
                    {canReorder && (
                      <>
                        <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${item.title} earlier`}>
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          onClick={() => move(index, index + 1)}
                          disabled={index === items.length - 1}
                          aria-label={`Move ${item.title} later`}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </>
                    )}
                    <span className="footer-spacer" />
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`} title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => setDeleting(item)} aria-label={`Delete ${item.title}`} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && (
        <PortfolioForm
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          user={user}
          nextOrder={items.length}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await afterChange();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title="Remove this photo?"
        message={`“${deleting?.title || ''}” will no longer appear on the website. Customers who saved it as a favorite will lose it.`}
        confirmLabel="Remove photo"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

interface PortfolioFormProps {
  item: PortfolioItem | null;
  user: SessionUser;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function PortfolioForm({ item, user, nextOrder, onClose, onSaved }: PortfolioFormProps) {
  const isNew = !item;
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState(item?.category || 'portrait');
  const [subCategory, setSubCategory] = useState(item?.subCategory || '');
  const [featured, setFeatured] = useState(Boolean(item?.isFeatured));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(item?.thumb || item?.src || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const subOptions = PORTFOLIO_CATEGORIES.find((entry) => entry.value === category)?.subCategories || [];

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickFile = (picked?: File | null) => {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setErrors((current) => ({ ...current, file: 'Choose a JPG, PNG or WebP image.' }));
      return;
    }
    if (picked.size > 25 * 1024 * 1024) {
      setErrors((current) => ({ ...current, file: 'That file is over 25 MB. Export a smaller version first.' }));
      return;
    }
    setErrors((current) => ({ ...current, file: '' }));
    setFile(picked);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Give the photo a title.';
    if (isNew && !file) next.file = 'Choose a photo to upload.';
    setErrors(next);
    if (Object.values(next).some(Boolean) || saving) return;

    setSaving(true);
    try {
      let imageUrl: string | undefined;
      if (file) {
        const compressed = await compressImage(file, 2000, 0.85);
        const stored = await uploadToBucket(PORTFOLIO_BUCKET, `gallery/${randomId()}.jpg`, compressed.blob);
        if (stored) {
          imageUrl = publicUrl(PORTFOLIO_BUCKET, stored);
        } else {
          imageUrl = (await compressImage(file, 1400, 0.8)).dataUrl;
          toast.warning('Storage is not set up, so the photo was saved inside the database. Run the migration to enable proper uploads.');
        }
      }

      const fields: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category,
        subcategory: subCategory,
        is_featured: featured,
      };
      if (imageUrl) fields.image_url = imageUrl;

      if (isNew) {
        const { error } = await supabase.from('portfolio_images').insert({ ...fields, created_by: user.id, display_order: nextOrder });
        if (error) throw error;
        toast.success('Photo added to the gallery');
      } else {
        const { data, error } = await supabase.from('portfolio_images').update(fields).eq('id', item!.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('Changes were not saved. The portfolio update policy may be missing (see the migration).');
        toast.success('Photo updated');
      }
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save this photo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      icon={isNew ? <ImagePlus size={22} /> : <Pencil size={22} />}
      title={isNew ? 'Add a photo' : 'Edit photo'}
      description="Large photos are resized to 2000px and compressed automatically."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="portfolio-form" className="btn btn-primary" disabled={saving}>
            {saving && <LoaderCircle size={16} className="spin" />}
            {saving ? 'Saving…' : isNew ? 'Add to gallery' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="portfolio-form" className="pf-form" onSubmit={submit} noValidate>
        <div className="pf-form-media">
          <button
            type="button"
            className={`dropzone pf-drop ${errors.file ? 'is-invalid' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              pickFile(event.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <>
                <Upload size={24} />
                <span>Drop a photo here or click to choose</span>
              </>
            )}
          </button>
          {preview && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> {isNew || file ? 'Choose another' : 'Replace photo'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => pickFile(event.target.files?.[0])} />
          {errors.file && <span className="field-error">{errors.file}</span>}
        </div>

        <div className="pf-form-fields">
          <div className="field">
            <label htmlFor="pf-title">Title</label>
            <input id="pf-title" type="text" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title) || undefined} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pf-category">Category</label>
              <select
                id="pf-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSubCategory('');
                }}
              >
                {PORTFOLIO_CATEGORIES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pf-sub">Type</label>
              <select id="pf-sub" value={subCategory} onChange={(event) => setSubCategory(event.target.value)}>
                <option value="">None</option>
                {subOptions.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pf-desc">
              Description <span className="optional">(optional)</span>
            </label>
            <textarea id="pf-desc" rows={3} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
            <span>Feature this photo (featured photos lead the gallery’s All view)</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
