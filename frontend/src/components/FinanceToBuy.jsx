import { useEffect, useState } from 'react';
import { Check, ExternalLink, Plus, ShoppingBag } from 'lucide-react';
import { api } from '../api/client';
import { amountText, money, toMinor } from '../utils/financeMoney';

function displayDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function PurchaseImage({ item }) {
  const [failed, setFailed] = useState(false);
  return <div className="finance-purchase-image">
    {item.image_url && !failed
      ? <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <ShoppingBag size={28} aria-hidden="true" />}
  </div>;
}

function PurchaseForm({ initial, currency, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    price: initial ? amountText(initial.estimated_minor) : '',
    target_date: initial?.target_date || '',
    product_url: initial?.product_url || '',
    image_url: initial?.image_url || '',
    notes: initial?.notes || '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        estimated_minor: toMinor(form.price),
        target_date: form.target_date || null,
        product_url: form.product_url.trim(),
        image_url: form.image_url.trim(),
        notes: form.notes.trim(),
      };
      setSaving(true);
      await onSave(payload);
    } catch (cause) {
      setError(cause.message || 'Could not save this purchase plan.');
    } finally {
      setSaving(false);
    }
  };

  return <form className="finance-form" onSubmit={submit}>
    <div className="finance-form-row">
      <div className="finance-field"><label htmlFor="purchase-title">What do you want to buy?</label><input id="purchase-title" className="task-input-field" value={form.title} onChange={(event) => set('title', event.target.value)} maxLength={255} required autoFocus placeholder="Item name" /></div>
      <div className="finance-field"><label htmlFor="purchase-price">Estimated price ({currency})</label><input id="purchase-price" className="task-input-field" type="text" inputMode="decimal" value={form.price} onChange={(event) => set('price', event.target.value)} required placeholder="0" /></div>
    </div>
    <div className="finance-form-row">
      <div className="finance-field"><label htmlFor="purchase-target">Buy by <span>(optional)</span></label><input id="purchase-target" className="task-input-field" type="date" value={form.target_date} onChange={(event) => set('target_date', event.target.value)} /></div>
      <div className="finance-field"><label htmlFor="purchase-link">Product link <span>(optional)</span></label><input id="purchase-link" className="task-input-field" type="url" value={form.product_url} onChange={(event) => set('product_url', event.target.value)} maxLength={2048} placeholder="https://…" /></div>
    </div>
    <div className="finance-field"><label htmlFor="purchase-image">Image URL <span>(optional)</span></label><input id="purchase-image" className="task-input-field" type="url" value={form.image_url} onChange={(event) => set('image_url', event.target.value)} maxLength={2048} placeholder="https://…/image.jpg" /><small>Paste a direct image URL. The image loads from that website.</small></div>
    <div className="finance-field"><label htmlFor="purchase-notes">Notes <span>(optional)</span></label><textarea id="purchase-notes" className="task-input-field" rows={3} maxLength={2000} value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Why you want it, size, alternatives…" /></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="finance-form-actions"><button type="submit" className="btn-primary" disabled={saving || !form.title.trim() || !form.price}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add to list'}</button><button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}

export default function FinanceToBuy({ currency }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editor, setEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api.getFinancePurchasePlans().then((saved) => {
      if (active) { setItems(saved); setLoadError(''); }
    }).catch((cause) => {
      if (active) setLoadError(cause.message || 'Could not load your purchase plans.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const save = async (payload) => {
    const saved = editor === 'new'
      ? await api.createFinancePurchasePlan(payload)
      : await api.updateFinancePurchasePlan(editor.id, payload);
    setItems((current) => editor === 'new'
      ? [saved, ...current]
      : current.map((item) => item.id === saved.id ? saved : item));
    setEditor(null);
    setActionError('');
  };

  const setPurchased = async (item) => {
    setBusyId(item.id);
    setActionError('');
    setConfirmDelete(null);
    try {
      const updated = await api.setFinancePurchaseStatus(item.id, !item.purchased);
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (cause) {
      setActionError(cause.message || 'Could not update this item.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    if (confirmDelete !== item.id) { setConfirmDelete(item.id); return; }
    setBusyId(item.id);
    setActionError('');
    try {
      await api.deleteFinancePurchasePlan(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setConfirmDelete(null);
    } catch (cause) {
      setActionError(cause.message || 'Could not delete this item.');
    } finally {
      setBusyId(null);
    }
  };

  const planned = items.filter((item) => !item.purchased);
  const bought = items.filter((item) => item.purchased);
  const plannedTotal = planned.reduce((sum, item) => sum + item.estimated_minor, 0);

  const renderItem = (item) => <article className={`finance-purchase-card${item.purchased ? ' is-bought' : ''}`} key={item.id}>
    <PurchaseImage key={item.image_url} item={item} />
    <div className="finance-purchase-copy">
      <h3>{item.title}</h3>
      {item.target_date && <p className="finance-purchase-target">Buy by {displayDate(item.target_date)}</p>}
      {item.notes && <p className="finance-purchase-notes">{item.notes}</p>}
      {item.product_url && <a className="finance-purchase-link" href={item.product_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> Open product link</a>}
    </div>
    <div className="finance-purchase-side">
      <strong>{money(item.estimated_minor, currency)}</strong>
      <div className="finance-purchase-actions">
        <button type="button" className="btn-secondary" onClick={() => setPurchased(item)} disabled={busyId === item.id}>{item.purchased ? 'Move to plan' : <><Check size={14} aria-hidden="true" /> Mark bought</>}</button>
        <button type="button" className="finance-link" onClick={() => { setEditor(item); setConfirmDelete(null); }}>Edit</button>
        <button type="button" className={`finance-link danger${confirmDelete === item.id ? ' confirming' : ''}`} onClick={() => remove(item)} disabled={busyId === item.id}>{confirmDelete === item.id ? 'Confirm delete' : 'Delete'}</button>
      </div>
    </div>
  </article>;

  return <section className="cockpit-section finance-to-buy" aria-labelledby="finance-to-buy-title">
    <div className="finance-section-head"><div><h2 id="finance-to-buy-title">Things to buy</h2><p>Save ideas with an estimated price, image, link, and target date.</p></div>{!editor && <button type="button" className="btn-primary" disabled={loading || !!loadError} onClick={() => { setEditor('new'); setConfirmDelete(null); }}><Plus size={15} aria-hidden="true" /> Add item</button>}</div>
    <p className="finance-hint">Plans do not change your balances. Record an expense in Transactions after you buy something.</p>
    {editor && <PurchaseForm key={editor === 'new' ? 'new' : editor.id} initial={editor === 'new' ? null : editor} currency={currency} onSave={save} onCancel={() => setEditor(null)} />}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {loadError && <div className="finance-purchase-load-error" role="alert">{loadError} <button type="button" className="btn-secondary" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Retry</button></div>}
    {loading ? <p className="finance-empty" role="status">Loading purchase plans…</p> : !loadError && <>
      <div className="finance-purchase-summary"><span>{planned.length} planned {planned.length === 1 ? 'item' : 'items'}</span><strong>{money(plannedTotal, currency)} estimated</strong></div>
      {planned.length ? <div className="finance-purchase-list" aria-label="Planned purchases">{planned.map(renderItem)}</div> : <p className="finance-empty">Nothing planned yet. Add something you want to buy.</p>}
      {bought.length > 0 && <div className="finance-purchased"><h3>Bought ({bought.length})</h3><div className="finance-purchase-list" aria-label="Bought items">{bought.map(renderItem)}</div></div>}
    </>}
  </section>;
}
