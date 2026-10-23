import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { addDays, getLocalDateStr } from '../utils/date';
import { amountText, money, toMinor } from '../utils/financeMoney';
import FinanceToBuy from '../components/FinanceToBuy';
import './FinancePage.css';

const pageTabs = ['Overview', 'Activity', 'Plan', 'To buy', 'Review'];

function toOpeningMinor(value, allowNegative = false) {
  if (allowNegative && value.trim().startsWith('-')) return -toMinor(value.trim().slice(1));
  if (value.trim() === '0' || value.trim() === '0.00') return 0;
  return toMinor(value);
}

function nextMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function niceDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function FormError({ error }) { return error ? <p className="form-error" role="alert">{error}</p> : null; }

function MoneyField({ id, label, value, onChange, required = true, hint = '' }) {
  return <div className="finance-field"><label htmlFor={id}>{label}</label><input id={id} className="task-input-field" type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder="0" />{hint && <small>{hint}</small>}</div>;
}

function TransactionForm({ initial, currency, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial ? {
    kind: initial.kind, title: initial.title, amount: amountText(initial.amount_minor), date: initial.date,
    category: initial.category || '', classification: initial.classification || 'essential',
    account: initial.account, transfer_to: initial.transfer_to || 'emergency',
  } : { kind: 'expense', title: '', amount: '', date: getLocalDateStr(), category: '', classification: 'essential', account: 'cash', transfer_to: 'emergency' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    try {
      const payload = {
        kind: form.kind, title: form.title.trim(), amount_minor: toMinor(form.amount), date: form.date,
        category: form.kind === 'transfer' ? '' : form.category.trim(),
        classification: form.kind === 'expense' ? form.classification : null,
        account: form.account,
        transfer_to: form.kind === 'transfer' ? form.transfer_to : null,
      };
      if (payload.kind === 'transfer' && payload.account === payload.transfer_to) throw new Error('Choose two different accounts.');
      setSaving(true);
      await onSave(payload);
    } catch (cause) {
      setError(cause.message || 'Could not save this entry.');
    } finally { setSaving(false); }
  };
  return <form className="finance-form" onSubmit={submit}>
    <div className="finance-form-row">
      <div className="finance-field"><label htmlFor="finance-kind">Type</label><select id="finance-kind" className="select-compact" value={form.kind} onChange={(event) => { const kind = event.target.value; setForm((current) => ({ ...current, kind, account: kind === 'transfer' ? 'cash' : current.account === 'investment' ? 'cash' : current.account })); }}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer between funds</option></select></div>
      <div className="finance-field"><label htmlFor="finance-date">Date</label><input id="finance-date" className="task-input-field" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required /></div>
    </div>
    <div className="finance-form-row"><div className="finance-field"><label htmlFor="finance-title">Description</label><input id="finance-title" className="task-input-field" value={form.title} onChange={(event) => set('title', event.target.value)} maxLength={255} required placeholder={form.kind === 'expense' ? 'What did you buy?' : form.kind === 'income' ? 'Income source' : 'Why transfer?'} /></div><MoneyField id="finance-amount" label={`Amount (${currency})`} value={form.amount} onChange={(value) => set('amount', value)} /></div>
    <div className="finance-form-row">
      <div className="finance-field"><label htmlFor="finance-account">{form.kind === 'transfer' ? 'From' : form.kind === 'income' ? 'Into' : 'Paid from'}</label><select id="finance-account" className="select-compact" value={form.account} onChange={(event) => set('account', event.target.value)}><option value="cash">Cash</option><option value="emergency">Emergency fund</option>{form.kind === 'transfer' && <option value="investment">Investment bucket</option>}</select></div>
      {form.kind === 'transfer' ? <div className="finance-field"><label htmlFor="finance-transfer-to">To</label><select id="finance-transfer-to" className="select-compact" value={form.transfer_to} onChange={(event) => set('transfer_to', event.target.value)}><option value="cash">Cash</option><option value="emergency">Emergency fund</option><option value="investment">Investment bucket</option></select></div> : <div className="finance-field"><label htmlFor="finance-category">Category <span>(optional)</span></label><input id="finance-category" className="task-input-field" value={form.category} onChange={(event) => set('category', event.target.value)} maxLength={100} placeholder="Food, rent, freelance…" /></div>}
    </div>
    {form.kind === 'expense' && <div className="finance-field"><label htmlFor="finance-classification">Spending type</label><select id="finance-classification" className="select-compact" value={form.classification} onChange={(event) => set('classification', event.target.value)}><option value="essential">Essential</option><option value="optional">Optional</option></select></div>}
    <FormError error={error} />
    <div className="finance-form-actions"><button type="submit" className="btn-primary" disabled={saving || !form.title.trim() || !form.amount}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save entry'}</button><button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}

function BudgetForm({ initial, currency, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [amount, setAmount] = useState(initial ? amountText(initial.amount_minor) : '');
  const [classification, setClassification] = useState(initial?.classification || 'essential');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { const amount_minor = toMinor(amount); setSaving(true); await onSave({ title: title.trim(), amount_minor, classification }); }
    catch (cause) { setError(cause.message || 'Could not save this planned cost.'); }
    finally { setSaving(false); }
  };
  return <form className="finance-form" onSubmit={submit}>
    <div className="finance-form-row"><div className="finance-field"><label htmlFor="budget-title">Monthly cost</label><input id="budget-title" className="task-input-field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Rent, groceries, transport…" /></div><MoneyField id="budget-amount" label={`Amount per month (${currency})`} value={amount} onChange={setAmount} /></div>
    <div className="finance-field"><label htmlFor="budget-type">Type</label><select id="budget-type" className="select-compact" value={classification} onChange={(event) => setClassification(event.target.value)}><option value="essential">Essential</option><option value="optional">Optional</option></select></div>
    <FormError error={error} /><div className="finance-form-actions"><button className="btn-primary" type="submit" disabled={saving || !title.trim() || !amount}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add monthly cost'}</button><button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function ObligationForm({ initial, currency, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [kind, setKind] = useState(initial?.kind || 'debt');
  const [amount, setAmount] = useState(initial ? amountText(initial.initial_minor) : '');
  const [dueDate, setDueDate] = useState(initial?.due_date || '');
  const [urgent, setUrgent] = useState(initial?.urgent || false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { const initial_minor = toMinor(amount); setSaving(true); await onSave({ title: title.trim(), kind, initial_minor, due_date: dueDate || null, urgent }); }
    catch (cause) { setError(cause.message || 'Could not save this obligation.'); }
    finally { setSaving(false); }
  };
  return <form className="finance-form" onSubmit={submit}>
    <div className="finance-form-row"><div className="finance-field"><label htmlFor="obligation-title">Name</label><input id="obligation-title" className="task-input-field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} required placeholder="Tuition, loan, bill…" /></div><MoneyField id="obligation-amount" label={`Original amount (${currency})`} value={amount} onChange={setAmount} /></div>
    <div className="finance-form-row"><div className="finance-field"><label htmlFor="obligation-kind">Type</label><select id="obligation-kind" className="select-compact" value={kind} onChange={(event) => setKind(event.target.value)}><option value="debt">Debt</option><option value="tuition">Tuition</option><option value="other">Other obligation</option></select></div><div className="finance-field"><label htmlFor="obligation-due">Due date <span>(optional)</span></label><input id="obligation-due" className="task-input-field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div>
    <label className="finance-check"><input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} /> Mark urgent</label>
    {initial && <p className="finance-hint">Recorded payments stay linked. Changing the original amount recalculates what remains.</p>}
    <FormError error={error} /><div className="finance-form-actions"><button className="btn-primary" type="submit" disabled={saving || !title.trim() || !amount}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add obligation'}</button><button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function PaymentForm({ obligation, currency, onSave, onCancel }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateStr());
  const [account, setAccount] = useState('cash');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { const amount_minor = toMinor(amount); if (amount_minor > obligation.remaining_minor) throw new Error('Payment exceeds the amount remaining.'); setSaving(true); await onSave({ amount_minor, date, account }); }
    catch (cause) { setError(cause.message || 'Could not record this payment.'); }
    finally { setSaving(false); }
  };
  return <form className="finance-form finance-payment-form" onSubmit={submit}>
    <p className="finance-hint">Payment for <strong>{obligation.title}</strong> · {money(obligation.remaining_minor, currency)} remaining</p>
    <div className="finance-form-row"><MoneyField id="payment-amount" label={`Payment (${currency})`} value={amount} onChange={setAmount} /><div className="finance-field"><label htmlFor="payment-date">Paid on</label><input id="payment-date" className="task-input-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div></div>
    <div className="finance-field"><label htmlFor="payment-account">Paid from</label><select id="payment-account" className="select-compact" value={account} onChange={(event) => setAccount(event.target.value)}><option value="cash">Cash</option><option value="emergency">Emergency fund</option></select></div>
    <FormError error={error} /><div className="finance-form-actions"><button className="btn-primary" type="submit" disabled={saving || !amount}>{saving ? 'Recording…' : 'Record payment'}</button><button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function SettingsForm({ settings, onSave }) {
  const [currency, setCurrency] = useState(settings.currency);
  const [cash, setCash] = useState(amountText(settings.opening_cash_minor));
  const [emergency, setEmergency] = useState(amountText(settings.opening_emergency_minor));
  const [investment, setInvestment] = useState(amountText(settings.opening_investment_minor));
  const [bufferTarget, setBufferTarget] = useState(amountText(settings.emergency_buffer_target_minor));
  const [target, setTarget] = useState(String(settings.runway_target_months));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSaved(false);
    try {
      const payload = { currency, opening_cash_minor: toOpeningMinor(cash, true), opening_emergency_minor: toOpeningMinor(emergency), opening_investment_minor: toOpeningMinor(investment), emergency_buffer_target_minor: toOpeningMinor(bufferTarget), runway_target_months: Number(target) };
      setSaving(true); await onSave(payload); setSaved(true);
    } catch (cause) { setError(cause.message || 'Could not save Finance settings.'); }
    finally { setSaving(false); }
  };
  return <form className="finance-form" onSubmit={submit}>
    <p className="finance-hint">Starting balances are what you held before recording entries here. Changing them later adjusts your current totals. Investment funds track money contributed, not market value.</p>
    <div className="finance-form-row"><div className="finance-field"><label htmlFor="finance-currency">Currency</label><select id="finance-currency" className="select-compact" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="KZT">KZT · Tenge</option><option value="USD">USD · Dollar</option><option value="EUR">EUR · Euro</option></select></div><div className="finance-field"><label htmlFor="runway-target">Runway target in months</label><input id="runway-target" className="task-input-field" type="number" min="1" max="24" value={target} onChange={(event) => setTarget(event.target.value)} required /></div></div>
    <div className="finance-form-row"><MoneyField id="opening-cash" label={`Starting cash (${currency})`} value={cash} onChange={setCash} hint="Negative is allowed for an overdraft." /><MoneyField id="opening-emergency" label={`Starting emergency fund (${currency})`} value={emergency} onChange={setEmergency} /></div>
    <div className="finance-form-row"><MoneyField id="opening-investment" label={`Starting tracked investments (${currency})`} value={investment} onChange={setInvestment} /><MoneyField id="buffer-target" label={`First emergency buffer goal (${currency})`} value={bufferTarget} onChange={setBufferTarget} /></div>
    <FormError error={error} />{saved && <p className="finance-success" role="status">Settings saved.</p>}<div className="finance-form-actions"><button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
  </form>;
}

function ReviewForm({ week, currency, onSave }) {
  const [wins, setWins] = useState(week.review.wins);
  const [cut, setCut] = useState(week.review.spending_to_cut);
  const [next, setNext] = useState(week.review.next_action);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try { await onSave({ wins, spending_to_cut: cut, next_action: next }); setSaved(true); }
    catch (cause) { setError(cause.message || 'Could not save this review.'); }
    finally { setSaving(false); }
  };
  return <div>
    <div className="finance-review-stats"><div><span>Income</span><strong>{money(week.income_minor, currency)}</strong></div><div><span>Essential spent</span><strong>{money(week.essential_minor, currency)}</strong></div><div><span>Optional spent</span><strong>{money(week.optional_minor, currency)}</strong></div><div><span>Obligations paid</span><strong>{money(week.obligation_paid_minor, currency)}</strong></div><div><span>Emergency added</span><strong>{money(week.emergency_added_minor, currency)}</strong></div><div><span>Invested</span><strong>{money(week.investment_added_minor, currency)}</strong></div></div>
    <p className="finance-hint">Previous week’s optional spending: {money(week.previous_optional_minor, currency)}. Compare the numbers, then choose one action for next week.</p>
    <form className="finance-form" onSubmit={submit}><div className="finance-field"><label htmlFor="finance-review-wins">What went well?</label><textarea id="finance-review-wins" className="task-input-field" rows={3} maxLength={5000} value={wins} onChange={(event) => setWins(event.target.value)} /></div><div className="finance-field"><label htmlFor="finance-review-cut">What spending can I cut?</label><textarea id="finance-review-cut" className="task-input-field" rows={3} maxLength={5000} value={cut} onChange={(event) => setCut(event.target.value)} /></div><div className="finance-field"><label htmlFor="finance-review-next">What money action comes next?</label><textarea id="finance-review-next" className="task-input-field" rows={3} maxLength={5000} value={next} onChange={(event) => setNext(event.target.value)} /></div><FormError error={error} />{saved && <p className="finance-success" role="status">Review saved.</p>}<button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save weekly review'}</button></form>
  </div>;
}

export default function FinancePage() {
  const today = getLocalDateStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [reviewDate, setReviewDate] = useState(today);
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [revision, setRevision] = useState(0);
  const [transactionEditor, setTransactionEditor] = useState(null);
  const [budgetEditor, setBudgetEditor] = useState(null);
  const [obligationEditor, setObligationEditor] = useState(null);
  const [paying, setPaying] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let active = true;
    Promise.all([api.getFinanceOverview(month, reviewDate), api.getFinanceTransactions(month)]).then(([summary, entries]) => {
      if (!active) return;
      setOverview(summary); setTransactions(entries); setHasMore(entries.length === 50); setError('');
    }).catch((cause) => { if (active) setError(cause.message || 'Could not load Finance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, revision, reviewDate]);

  const refresh = () => { setRevision((value) => value + 1); setActionError(''); setConfirmDelete(''); };
  const remove = async (key, action) => {
    if (confirmDelete !== key) { setConfirmDelete(key); return; }
    setActionError('');
    try { await action(); refresh(); }
    catch (cause) { setActionError(cause.message || 'Could not remove this item.'); }
  };
  const more = async () => {
    try { const entries = await api.getFinanceTransactions(month, transactions.length); setTransactions((current) => [...current, ...entries]); setHasMore(entries.length === 50); }
    catch (cause) { setActionError(cause.message || 'Could not load more entries.'); }
  };
  const changeMonth = (offset) => { setMonth((current) => nextMonth(current, offset)); setLoading(true); setTransactionEditor(null); };
  const currency = overview?.settings.currency || 'KZT';
  const openObligations = overview?.obligations.filter((item) => item.remaining_minor > 0) || [];
  const urgentObligations = openObligations.filter((item) => item.urgent || (item.due_date && item.due_date <= today));
  const tuitionRemaining = openObligations.filter((item) => item.kind === 'tuition').reduce((sum, item) => sum + item.remaining_minor, 0);
  const debtRemaining = openObligations.filter((item) => item.kind === 'debt').reduce((sum, item) => sum + item.remaining_minor, 0);
  const visibleTransactions = transactions.filter((item) => filter === 'all' || item.kind === filter || (filter === 'optional' && item.classification === 'optional'));

  return <div className="finance-page">
    <div className="finance-page-head"><div><p className="cockpit-weekday">MONEY, CLEARLY</p><h1 className="cockpit-title">Finance</h1></div><span className="finance-currency">{currency}</span></div>
    <nav className="finance-tabs" aria-label="Finance sections">{pageTabs.map((item) => <button key={item} type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {error && <div className="cockpit-section finance-error" role="alert">{error} <button type="button" className="btn-secondary" onClick={() => { setLoading(true); refresh(); }}>Retry</button></div>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {loading && !overview ? <div className="cockpit-section" role="status">Loading Finance…</div> : overview && !error && <>
      {tab === 'Overview' && <>
        <div className="finance-summary-grid">
          <div className={`finance-summary-card primary${overview.balances_minor.cash < 0 ? ' negative' : ''}`}><span>Cash available</span><strong>{money(overview.balances_minor.cash, currency)}</strong><small>Starting cash + income − expenses − transfers</small></div>
          <div className="finance-summary-card"><span>Emergency fund</span><strong>{money(overview.balances_minor.emergency, currency)}</strong><small>Tracked separately from cash</small></div>
          <div className="finance-summary-card"><span>Monthly minimum</span><strong>{money(overview.minimum_monthly_minor, currency)}</strong><small>Sum of planned essential costs</small></div>
          <div className="finance-summary-card"><span>Liquid runway</span><strong>{overview.runway_months === null ? 'Set a budget' : `${overview.runway_months} months`}</strong><small>(Cash + emergency) ÷ monthly minimum</small></div>
        </div>
        <section className="cockpit-section"><div className="finance-section-head"><div><h2>Money this month</h2><p>{new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p></div><button type="button" className="btn-secondary" onClick={() => { setTab('Activity'); setTransactionEditor('new'); }}><Plus size={15} /> Add entry</button></div><div className="finance-inline-metrics"><div><span>Income</span><strong className="positive">{money(overview.month.income_minor, currency)}</strong></div><div><span>Essential spent</span><strong>{money(overview.month.essential_minor, currency)}</strong></div><div><span>Optional spent</span><strong>{money(overview.month.optional_minor, currency)}</strong></div></div>{overview.month.optional_categories.length > 0 && <div className="finance-optional-breakdown"><p>Optional spending by category</p>{overview.month.optional_categories.slice(0, 5).map((item) => <div key={item.name}><span>{item.name}</span><strong>{money(item.amount_minor, currency)}</strong></div>)}</div>}{overview.optional_plan_minor > 0 && <p className="finance-hint">Planned optional limit: {money(overview.optional_plan_minor, currency)} this month.</p>}</section>
        <section className="cockpit-section"><div className="finance-section-head"><h2>Obligations needing attention</h2><button type="button" className="finance-link" onClick={() => setTab('Plan')}>View all</button></div>{urgentObligations.length ? urgentObligations.map((item) => <div className="finance-list-row" key={item.id}><div><strong>{item.title}</strong><small>{item.kind}{item.due_date ? ` · due ${niceDate(item.due_date)}` : ''}</small></div><div className="finance-row-right"><strong>{money(item.remaining_minor, currency)}</strong><button type="button" className="btn-secondary" onClick={() => setPaying(item)}>Record payment</button></div></div>) : <p className="finance-empty">No urgent obligations recorded.</p>}{paying && <PaymentForm key={paying.id} obligation={paying} currency={currency} onCancel={() => setPaying(null)} onSave={async (data) => { await api.payFinanceObligation(paying.id, data); setPaying(null); refresh(); }} />}</section>
        <div className="finance-summary-grid secondary"><div className="finance-summary-card"><span>Tuition remaining</span><strong>{money(tuitionRemaining, currency)}</strong></div><div className="finance-summary-card"><span>Debt remaining</span><strong>{money(debtRemaining, currency)}</strong></div><div className="finance-summary-card"><span>First emergency buffer</span><strong>{overview.settings.emergency_buffer_target_minor ? `${Math.round(Math.max(0, overview.balances_minor.emergency) / overview.settings.emergency_buffer_target_minor * 100)}%` : 'Set a goal'}</strong><small>{overview.settings.emergency_buffer_target_minor ? `Goal: ${money(overview.settings.emergency_buffer_target_minor, currency)}` : 'Choose a small starting goal in Plan'}</small></div><div className="finance-summary-card"><span>Tracked investments</span><strong>{money(overview.balances_minor.investment, currency)}</strong><small>Contributions, not market value</small></div></div>
        <p className="finance-hint finance-bottom-hint">Runway target: {overview.settings.runway_target_months} months. All balances are based on entries you record; Lock In does not connect to your bank.</p>
      </>}

      {tab === 'Activity' && <>
        <section className="cockpit-section"><div className="finance-section-head"><h2>{transactionEditor && transactionEditor !== 'new' ? 'Edit entry' : 'Record money movement'}</h2>{!transactionEditor && <button type="button" className="btn-primary" onClick={() => setTransactionEditor('new')}><Plus size={15} /> New entry</button>}</div>{transactionEditor && <TransactionForm key={transactionEditor === 'new' ? 'new' : transactionEditor.id} initial={transactionEditor === 'new' ? null : transactionEditor} currency={currency} onCancel={() => setTransactionEditor(null)} onSave={async (data) => { if (transactionEditor === 'new') await api.createFinanceTransaction(data); else await api.updateFinanceTransaction(transactionEditor.id, data); setMonth(data.date.slice(0, 7)); setTransactionEditor(null); refresh(); }} />}{!transactionEditor && <p className="finance-hint">Record each income, essential or optional expense, and transfer between funds.</p>}</section>
        <section className="cockpit-section"><div className="finance-section-head finance-month-row"><h2>All entries</h2><div className="finance-month-switch"><button type="button" className="icon-btn" aria-label="Previous finance month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><span>{new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><button type="button" className="icon-btn" aria-label="Next finance month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div></div><div className="finance-filters" aria-label="Filter entries">{[['all', 'All'], ['income', 'Income'], ['expense', 'Expenses'], ['optional', 'Optional'], ['transfer', 'Transfers']].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>{loading ? <p className="finance-empty" role="status">Loading entries…</p> : visibleTransactions.length ? <ul className="finance-transactions">{visibleTransactions.map((item) => <li key={item.id} className="finance-transaction"><span className={`finance-transaction-icon ${item.kind}`} aria-hidden="true">{item.kind === 'income' ? <ArrowDownLeft size={17} /> : item.kind === 'expense' ? <ArrowUpRight size={17} /> : <ArrowLeftRight size={17} />}</span><div className="finance-transaction-copy"><strong>{item.title}</strong><small>{niceDate(item.date)} · {item.kind === 'transfer' ? `${item.account} → ${item.transfer_to}` : `${item.category || item.kind} · ${item.account}`}{item.classification ? ` · ${item.classification}` : ''}</small></div><div className="finance-transaction-side"><strong className={item.kind === 'income' ? 'positive' : ''}>{item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : ''}{money(item.amount_minor, currency)}</strong><div><button type="button" className="finance-link" onClick={() => { if (item.obligation_id) { setActionError('Reverse a payment to correct it; payment amounts cannot be edited.'); return; } setTransactionEditor(item); }}>Edit</button><button type="button" className={`finance-link danger${confirmDelete === `transaction-${item.id}` ? ' confirming' : ''}`} onClick={() => remove(`transaction-${item.id}`, () => api.deleteFinanceTransaction(item.id))}>{confirmDelete === `transaction-${item.id}` ? (item.obligation_id ? 'Confirm reversal' : 'Confirm delete') : item.obligation_id ? 'Reverse' : 'Delete'}</button></div></div></li>)}</ul> : <p className="finance-empty">No {filter === 'all' ? '' : `${filter} `}entries {hasMore ? 'among loaded entries' : 'this month'}.</p>}{hasMore && <button type="button" className="btn-secondary finance-load-more" onClick={more}>Load more</button>}</section>
      </>}

      {tab === 'Plan' && <>
        <section className="cockpit-section"><div className="finance-section-head"><div><h2>Monthly budget</h2><p>Essentials define your minimum monthly cost.</p></div><button type="button" className="btn-secondary" onClick={() => setBudgetEditor('new')}><Plus size={15} /> Add cost</button></div><div className="finance-inline-metrics"><div><span>Essential minimum</span><strong>{money(overview.minimum_monthly_minor, currency)}</strong></div><div><span>Optional plan</span><strong>{money(overview.optional_plan_minor, currency)}</strong></div></div><p className="finance-hint">Include regular debt or tuition payments as essential costs if they belong in your monthly minimum.</p>{budgetEditor && <BudgetForm key={budgetEditor === 'new' ? 'new' : budgetEditor.id} initial={budgetEditor === 'new' ? null : budgetEditor} currency={currency} onCancel={() => setBudgetEditor(null)} onSave={async (data) => { if (budgetEditor === 'new') await api.createFinanceBudgetItem(data); else await api.updateFinanceBudgetItem(budgetEditor.id, data); setBudgetEditor(null); refresh(); }} />}{overview.budget_items.length ? overview.budget_items.map((item) => <div className="finance-list-row" key={item.id}><div><strong>{item.title}</strong><small>{item.classification} · every month</small></div><div className="finance-row-right"><strong>{money(item.amount_minor, currency)}</strong><div><button type="button" className="finance-link" onClick={() => setBudgetEditor(item)}>Edit</button><button type="button" className={`finance-link danger${confirmDelete === `budget-${item.id}` ? ' confirming' : ''}`} onClick={() => remove(`budget-${item.id}`, () => api.deleteFinanceBudgetItem(item.id))}>{confirmDelete === `budget-${item.id}` ? 'Confirm delete' : 'Delete'}</button></div></div></div>) : <p className="finance-empty">Add essential monthly costs to calculate your minimum budget and runway.</p>}</section>
        <section className="cockpit-section"><div className="finance-section-head"><div><h2>Debt, tuition & obligations</h2><p>Record each payment to reduce the remaining amount.</p></div><button type="button" className="btn-secondary" onClick={() => setObligationEditor('new')}><Plus size={15} /> Add obligation</button></div>{obligationEditor && <ObligationForm key={obligationEditor === 'new' ? 'new' : obligationEditor.id} initial={obligationEditor === 'new' ? null : obligationEditor} currency={currency} onCancel={() => setObligationEditor(null)} onSave={async (data) => { if (obligationEditor === 'new') await api.createFinanceObligation(data); else await api.updateFinanceObligation(obligationEditor.id, data); setObligationEditor(null); refresh(); }} />}{overview.obligations.length ? overview.obligations.map((item) => <div className="finance-list-row" key={item.id}><div><strong>{item.title}</strong><small>{item.kind}{item.urgent ? ' · urgent' : ''}{item.due_date ? ` · due ${niceDate(item.due_date)}` : ''}{item.remaining_minor === 0 ? ' · cleared' : ''}</small></div><div className="finance-row-right"><strong>{money(item.remaining_minor, currency)}</strong><div>{item.remaining_minor > 0 && <button type="button" className="finance-link" onClick={() => setPaying(item)}>Record payment</button>}<button type="button" className="finance-link" onClick={() => setObligationEditor(item)}>Edit</button><button type="button" className={`finance-link danger${confirmDelete === `obligation-${item.id}` ? ' confirming' : ''}`} onClick={() => remove(`obligation-${item.id}`, () => api.deleteFinanceObligation(item.id))}>{confirmDelete === `obligation-${item.id}` ? 'Confirm delete' : 'Delete'}</button></div></div></div>) : <p className="finance-empty">No obligations recorded.</p>}{paying && <PaymentForm key={paying.id} obligation={paying} currency={currency} onCancel={() => setPaying(null)} onSave={async (data) => { await api.payFinanceObligation(paying.id, data); setPaying(null); refresh(); }} />}</section>
        <section className="cockpit-section"><div className="finance-section-head"><div><h2>Balances & runway target</h2><p>Set the amounts you held before tracking in Lock In.</p></div><Wallet size={20} aria-hidden="true" /></div><SettingsForm settings={overview.settings} onSave={async (data) => { await api.saveFinanceSettings(data); refresh(); }} /></section>
      </>}

      {tab === 'To buy' && <FinanceToBuy currency={currency} />}

      {tab === 'Review' && <section className="cockpit-section"><div className="finance-section-head"><div><h2>Weekly money review</h2><p>{niceDate(overview.week.start)} – {niceDate(overview.week.end)}</p></div><div className="finance-month-switch"><button type="button" className="icon-btn" aria-label="Previous money review week" onClick={() => setReviewDate((date) => addDays(date, -7))}><ChevronLeft size={17} /></button><button type="button" className="btn-secondary" onClick={() => setReviewDate(today)}>This week</button><button type="button" className="icon-btn" aria-label="Next money review week" onClick={() => setReviewDate((date) => addDays(date, 7))}><ChevronRight size={17} /></button></div></div><ReviewForm key={overview.week.start} week={overview.week} currency={currency} onSave={(data) => api.saveFinanceWeeklyReview(overview.week.start, data)} /></section>}
    </>}
  </div>;
}
