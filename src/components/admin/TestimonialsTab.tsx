import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Database, Eye, EyeOff, LoaderCircle, MessageSquareQuote, Pencil, Plus, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import { errorMessage, isMissingRelation } from '../../lib/api';
import { initials } from '../../lib/format';
import { compressImage, publicUrl, PORTFOLIO_BUCKET, randomId, uploadToBucket } from '../../lib/images';
import { supabase } from '../../lib/supabase';

interface Testimonial {
  id: string;
  client_name: string;
  client_context: string;
  quote: string;
  rating: number;
  photo_url: string;
  is_published: boolean;
  display_order: number;
}

const normalize = (row: any): Testimonial => ({
  id: String(row.id),
  client_name: row.client_name || '',
  client_context: row.client_context || '',
  quote: row.quote || '',
  rating: Math.min(5, Math.max(1, Number(row.rating) || 5)),
  photo_url: row.photo_url || '',
  is_published: Boolean(row.is_published),
  display_order: Number(row.display_order) || 0,
});

export default function TestimonialsTab() {
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('testimonials').select('*').order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) {
      setState(isMissingRelation(error) ? 'missing' : 'error');
      return;
    }
    setRows((data || []).map(normalize));
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (id: string, fields: Partial<Testimonial>) => {
    const { data, error } = await supabase.from('testimonials').update(fields).eq('id', id).select('id');
    if (error || !data?.length) throw error || new Error('This testimonial could not be updated.');
  };

  const togglePublished = async (row: Testimonial) => {
    try {
      await update(row.id, { is_published: !row.is_published });
      toast.success(row.is_published ? 'Hidden from the website' : 'Published on the website');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setRows(next);
    try {
      await Promise.all(next.map((row, order) => (row.display_order === order ? null : update(row.id, { display_order: order }))));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the new order.'));
      await load();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('testimonials').delete().eq('id', deleting.id);
    if (error) {
      toast.error(error.message || 'Could not delete this testimonial.');
      return;
    }
    toast.success('Testimonial deleted');
    setDeleting(null);
    await load();
  };

  const published = rows.filter((row) => row.is_published).length;

  return (
    <section className="admin-section" aria-labelledby="reviews-title">
      <header className="admin-head">
        <div>
          <h1 id="reviews-title">Testimonials</h1>
          <p>{state === 'ready' ? `${published} of ${rows.length} published on the website` : 'Client reviews shown on the website'}</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="icon-btn" onClick={() => void load()} aria-label="Refresh testimonials" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')} disabled={state === 'missing'}>
            <Plus size={16} /> Add testimonial
          </button>
        </div>
      </header>

      <div className="notice notice-info">
        <MessageSquareQuote size={18} />
        <span>Only add real reviews from real clients, with their permission. The reviews section stays hidden on the website until at least one is published.</span>
      </div>

      {state === 'missing' && (
        <div className="notice notice-warning">
          <Database size={18} />
          <span>
            The <code>testimonials</code> table does not exist yet. Apply the Supabase migration in <code>supabase/migrations</code> to turn on reviews.
          </span>
        </div>
      )}
      {state === 'error' && (
        <div className="notice notice-danger">
          Testimonials could not be loaded. <button type="button" className="btn-link" onClick={() => void load()}>Try again</button>
        </div>
      )}
      {state === 'loading' && (
        <div className="loading-row">
          <LoaderCircle size={20} className="spin" /> Loading…
        </div>
      )}

      {state === 'ready' &&
        (rows.length === 0 ? (
          <div className="empty-state admin-card">
            <MessageSquareQuote size={36} />
            <h3>No testimonials yet</h3>
            <p>Ask happy clients for a short quote after delivering their photos, then add it here.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Add the first one
            </button>
          </div>
        ) : (
          <ul className="review-admin-list">
            {rows.map((row, index) => (
              <li key={row.id} className={`admin-card review-admin ${row.is_published ? '' : 'is-hidden'}`}>
                <div className="review-admin-head">
                  <span className="avatar">{row.photo_url ? <img src={row.photo_url} alt="" /> : initials(row.client_name)}</span>
                  <div>
                    <strong>{row.client_name}</strong>
                    <span>{row.client_context || '—'}</span>
                  </div>
                  <span className={`badge ${row.is_published ? 'badge-success' : 'badge-neutral'}`}>{row.is_published ? 'Published' : 'Hidden'}</span>
                </div>
                <p className="review-admin-quote">“{row.quote}”</p>
                <div className="review-admin-foot">
                  <span className="stars" aria-label={`${row.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, star) => (
                      <Star key={star} size={14} className={star < row.rating ? 'is-on' : ''} />
                    ))}
                  </span>
                  <span className="footer-spacer" />
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move down">
                    <ArrowDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => togglePublished(row)}
                    aria-label={row.is_published ? `Hide ${row.client_name}'s testimonial` : `Publish ${row.client_name}'s testimonial`}
                    title={row.is_published ? 'Hide' : 'Publish'}
                  >
                    {row.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(row)} aria-label={`Edit ${row.client_name}'s testimonial`} title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => setDeleting(row)} aria-label={`Delete ${row.client_name}'s testimonial`} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {editing && (
        <TestimonialForm
          key={editing === 'new' ? 'new' : editing.id}
          row={editing === 'new' ? null : editing}
          nextOrder={rows.length}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title="Delete this testimonial?"
        message={`${deleting?.client_name || ''}'s review will be removed permanently. To take it off the website but keep it, hide it instead.`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

function TestimonialForm({ row, nextOrder, onClose, onSaved }: { row: Testimonial | null; nextOrder: number; onClose: () => void; onSaved: () => Promise<void> | void }) {
  const isNew = !row;
  const [name, setName] = useState(row?.client_name || '');
  const [context, setContext] = useState(row?.client_context || '');
  const [quote, setQuote] = useState(row?.quote || '');
  const [rating, setRating] = useState(row?.rating || 5);
  const [photo, setPhoto] = useState(row?.photo_url || '');
  const [publishNow, setPublishNow] = useState(row?.is_published ?? false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, 320, 0.85);
      const stored = await uploadToBucket(PORTFOLIO_BUCKET, `testimonials/${randomId()}.jpg`, compressed.blob);
      setPhoto(stored ? publicUrl(PORTFOLIO_BUCKET, stored) : compressed.dataUrl);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not use this photo.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the client’s name.';
    if (quote.trim().length < 10) next.quote = 'Add the client’s words (at least 10 characters).';
    setErrors(next);
    if (Object.keys(next).length || saving) return;

    setSaving(true);
    const fields = {
      client_name: name.trim(),
      client_context: context.trim(),
      quote: quote.trim(),
      rating,
      photo_url: photo || null,
      is_published: publishNow,
    };
    try {
      if (isNew) {
        const { error } = await supabase.from('testimonials').insert({ ...fields, display_order: nextOrder });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('testimonials').update(fields).eq('id', row!.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('This testimonial could not be updated.');
      }
      toast.success(isNew ? 'Testimonial added' : 'Testimonial updated');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save this testimonial.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="md"
      icon={<MessageSquareQuote size={22} />}
      title={isNew ? 'Add a testimonial' : 'Edit testimonial'}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="testimonial-form" className="btn btn-primary" disabled={saving || uploading}>
            {saving && <LoaderCircle size={16} className="spin" />}
            {isNew ? 'Add testimonial' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="testimonial-form" onSubmit={submit} noValidate>
        <div className="review-form-photo">
          <span className="avatar avatar-lg">{photo ? <img src={photo} alt="" /> : initials(name || '?')}</span>
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} {photo ? 'Change photo' : 'Add photo'}
            </button>
            {photo && (
              <button type="button" className="btn-link" onClick={() => setPhoto('')}>
                Remove
              </button>
            )}
            <span className="field-hint">Optional. Use a photo the client is happy to share.</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void pickPhoto(event.target.files?.[0])} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="tf-name">Client name</label>
            <input id="tf-name" type="text" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name) || undefined} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="tf-context">
              Shoot <span className="optional">(optional)</span>
            </label>
            <input id="tf-context" type="text" maxLength={60} placeholder="e.g. 1st birthday, Quezon City" value={context} onChange={(event) => setContext(event.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="tf-quote">What they said</label>
          <textarea id="tf-quote" rows={4} maxLength={500} value={quote} onChange={(event) => setQuote(event.target.value)} aria-invalid={Boolean(errors.quote) || undefined} />
          {errors.quote ? <span className="field-error">{errors.quote}</span> : <span className="field-hint">{quote.length}/500</span>}
        </div>
        <div className="field">
          <span className="field-label" id="tf-rating-label">
            Rating
          </span>
          <div className="star-input" role="radiogroup" aria-labelledby="tf-rating-label">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className={value <= rating ? 'is-on' : ''}
                onClick={() => setRating(value)}
              >
                <Star size={22} />
              </button>
            ))}
          </div>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
          <span>Show on the website</span>
        </label>
      </form>
    </Modal>
  );
}
