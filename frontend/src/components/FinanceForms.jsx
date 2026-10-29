import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { amountText, money, toBalanceMinor, toMinor } from '../utils/financeMoney';
import { getLocalDateStr } from '../utils/date';

export function Field({ id, label, children, hint }) {
  return <div className="finance-field"><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>;
}

export function MoneyField({ id, label, value, onChange, hint }) {
  return <Field id={id} label={label} hint={hint}><input id={id} className="task-input-field" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" required /></Field>;
}

function SaveForm({ children, onSubmit, onCancel, label = 'Save changes' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="finance-form" onSubmit={async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { await onSubmit(); }
    catch (cause) { setError(cause.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy}>{children}</fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="finance-form-actions"><button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : label}</button><button className="btn-secondary" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div></form>;
}

export function TransactionForm({ initial, currency, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ kind: initial?.kind || 'expense', title: initial?.title || '',
    amount: initial ? amountText(initial.amount_minor) : '', date: initial?.date || getLocalDateStr(),
    category: initial?.category || '', classification: initial?.classification || 'essential',
    description: initial?.description || '', account: initial?.account || 'cash', transfer_to: initial?.transfer_to || 'cash' }));
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const legacyTransfer = initial?.kind === 'transfer';
  return <SaveForm onCancel={onCancel} label={initial ? 'Save transaction' : 'Add transaction'} onSubmit={() => onSave({
    kind: form.kind, title: form.title.trim(), amount_minor: toMinor(form.amount), date: form.date,
    category: form.category.trim(), description: form.description.trim(), account: form.account,
    classification: form.kind === 'expense' ? form.classification : null, transfer_to: legacyTransfer ? form.transfer_to : null,
  })}>
    <div className="finance-form-row"><Field id="tx-kind" label="Type"><select id="tx-kind" className="select-compact" value={form.kind} disabled={legacyTransfer || !!initial?.income_source_id} onChange={(e) => set('kind', e.target.value)}><option value="expense">Expense</option><option value="income">Income received</option>{legacyTransfer && <option value="transfer">Saved transfer</option>}</select></Field><Field id="tx-date" label="Date"><input id="tx-date" className="task-input-field" type="date" required max={getLocalDateStr()} value={form.date} onChange={(e) => set('date', e.target.value)} /></Field></div>
    <div className="finance-form-row"><Field id="tx-title" label={form.kind === 'income' ? 'Source' : 'Description / reason'}><input autoFocus id="tx-title" className="task-input-field" value={form.title} maxLength={255} required onChange={(e) => set('title', e.target.value)} placeholder={form.kind === 'income' ? 'Salary, freelance…' : 'What was this for?'} /></Field><MoneyField id="tx-amount" label={`Amount (${currency})`} value={form.amount} onChange={(value) => set('amount', value)} /></div>
    {form.kind !== 'transfer' && <div className="finance-form-row"><Field id="tx-category" label={form.kind === 'expense' ? 'Category' : 'Category (optional)'} hint="Use the same category in your budget to compare spending."><input id="tx-category" className="task-input-field" value={form.category} maxLength={100} required={form.kind === 'expense'} placeholder="Groceries, transport, rent…" onChange={(e) => set('category', e.target.value)} /></Field>{form.kind === 'expense' && <Field id="tx-class" label="Spending type"><select id="tx-class" className="select-compact" value={form.classification} onChange={(e) => set('classification', e.target.value)}><option value="essential">Essential</option><option value="optional">Optional</option></select></Field>}</div>}
    <Field id="tx-description" label="Notes (optional)"><textarea id="tx-description" className="task-input-field" rows={2} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
    {initial?.account === 'emergency' && <p className="finance-hint">This saved transaction uses your emergency balance.</p>}
    {legacyTransfer && <p className="finance-hint">This is an existing transfer between saved funds. Its accounts stay unchanged.</p>}
    <p className="finance-hint">For debt, tuition, or bill repayments, use Record payment in Payments & Debts so balances update together.</p>
  </SaveForm>;
}

export function BudgetForm({ initial, month, currency, onSave, onCancel }) {
  const [form, setForm] = useState({ title: initial?.title || '', amount: initial ? amountText(initial.amount_minor) : '',
    category: initial?.category || initial?.title || '', classification: initial?.classification || 'essential', allocation: initial?.allocation || 'living' });
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const linked = ['debt', 'tuition', 'bill'].includes(form.allocation);
  return <SaveForm onCancel={onCancel} label="Save allocation" onSubmit={() => onSave({ title: form.title.trim(), month,
    amount_minor: toMinor(form.amount), category: form.category.trim(), allocation: form.allocation,
    classification: linked ? 'essential' : form.classification })}>
    <div className="finance-form-row"><Field id="budget-title" label="Allocation name"><input autoFocus id="budget-title" className="task-input-field" value={form.title} maxLength={255} required onChange={(e) => set('title', e.target.value)} placeholder="Groceries, tuition…" /></Field><MoneyField id="budget-amount" label={`Planned amount (${currency})`} value={form.amount} onChange={(v) => set('amount', v)} /></div>
    <div className="finance-form-row"><Field id="budget-allocation" label="Allocate to"><select id="budget-allocation" className="select-compact" value={form.allocation} onChange={(e) => set('allocation', e.target.value)}><option value="living">Living costs</option><option value="debt">Debts</option><option value="tuition">Tuition</option><option value="bill">Recurring bills</option><option value="other">Other expenses</option></select></Field>{!linked && <Field id="budget-category" label="Transaction category"><input id="budget-category" className="task-input-field" value={form.category} maxLength={100} required onChange={(e) => set('category', e.target.value)} placeholder="Match your transaction category" /></Field>}</div>
    {!linked && <Field id="budget-class" label="Spending type"><select id="budget-class" className="select-compact" value={form.classification} onChange={(e) => set('classification', e.target.value)}><option value="essential">Essential</option><option value="optional">Optional</option></select></Field>}
    {linked && <p className="finance-hint">Recorded repayments count toward this allocation. Scheduled payments and this allocation overlap; they are reserved once.</p>}
  </SaveForm>;
}

export function ObligationForm({ initial, currency, onSave, onCancel }) {
  const [form, setForm] = useState({ title: initial?.title || '', kind: initial?.kind || 'debt',
    amount: initial ? amountText(initial.initial_minor) : '', historical: amountText(initial?.historical_paid_minor || 0),
    due_date: initial?.due_date || '', urgent: initial?.urgent || false, recurrence: initial?.recurrence || '', terms: initial?.terms || '' });
  const [parts, setParts] = useState(() => (initial?.kind === 'bill' ? [] : initial?.schedule || []).filter((p) => p.id).map((p) => ({ id: p.id, label: p.label, amount: amountText(p.amount_minor), due_date: p.due_date || '' })));
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const updatePart = (index, key, value) => setParts((old) => old.map((p, i) => i === index ? { ...p, [key]: value } : p));
  return <SaveForm onCancel={onCancel} label="Save obligation" onSubmit={() => {
    const schedule = form.kind === 'bill' ? [] : parts.map((p) => ({ id: p.id || null, label: p.label.trim(), amount_minor: toMinor(p.amount), due_date: p.due_date || null }));
    const historical = form.kind === 'bill' ? 0 : toBalanceMinor(form.historical);
    return onSave({ title: form.title.trim(), kind: form.kind,
      initial_minor: schedule.length ? schedule.reduce((sum, p) => sum + p.amount_minor, 0) + historical : toMinor(form.amount),
      historical_paid_minor: historical, due_date: form.due_date || null, urgent: form.urgent,
      recurrence: form.kind === 'bill' ? 'monthly' : form.recurrence || null, terms: form.terms.trim(), schedule });
  }}>
    <div className="finance-form-row"><Field id="ob-title" label="Name"><input autoFocus id="ob-title" className="task-input-field" value={form.title} maxLength={255} required onChange={(e) => set('title', e.target.value)} /></Field><Field id="ob-kind" label="Type"><select id="ob-kind" className="select-compact" value={form.kind} onChange={(e) => set('kind', e.target.value)}><option value="debt">Consumer debt</option><option value="tuition">University tuition</option><option value="bill">Monthly bill</option><option value="other">Other obligation</option></select></Field></div>
    {!parts.length || form.kind === 'bill' ? <MoneyField id="ob-amount" label={`${form.kind === 'bill' ? 'Amount per month' : 'Total original amount'} (${currency})`} value={form.amount} onChange={(v) => set('amount', v)} /> : <p className="finance-hint">The total is the sum of installments plus the historical paid amount. Edit installment amounts below.</p>}
    {form.kind !== 'bill' && <div className="finance-form-row"><MoneyField id="ob-historical" label={`Paid before tracking (${currency})`} value={form.historical} onChange={(v) => set('historical', v)} hint="Historical only. Does not subtract from current cash." /><Field id="ob-recurrence" label="Payment frequency"><select id="ob-recurrence" className="select-compact" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}><option value="">Not specified</option><option value="monthly">Monthly</option></select></Field></div>}
    {(parts.length === 0 || form.kind === 'bill') && <Field id="ob-due" label={form.kind === 'bill' ? 'First monthly due date (optional)' : 'Due date (optional)'} hint={form.kind === 'bill' ? 'Repeats on the same day each month; shorter months use their last day.' : 'Leave blank if unknown.'}><input id="ob-due" className="task-input-field" type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>}
    {form.kind !== 'bill' && <div className="finance-installment-editor"><div className="finance-section-head"><h3>Installment schedule</h3><button className="finance-link" type="button" onClick={() => setParts((old) => [...old, { label: `Payment ${old.length + 1}`, amount: '', due_date: '' }])}><Plus size={14} /> Add installment</button></div>{parts.map((p, index) => <div className="finance-installment-fields" key={p.id || `new-${index}`}><Field id={`part-label-${index}`} label="Label"><input id={`part-label-${index}`} className="task-input-field" value={p.label} maxLength={100} required onChange={(e) => updatePart(index, 'label', e.target.value)} /></Field><MoneyField id={`part-amount-${index}`} label={`Amount (${currency})`} value={p.amount} onChange={(v) => updatePart(index, 'amount', v)} /><Field id={`part-date-${index}`} label="Due date"><input id={`part-date-${index}`} className="task-input-field" type="date" value={p.due_date} onChange={(e) => updatePart(index, 'due_date', e.target.value)} /></Field><button type="button" className="icon-btn" aria-label={`Remove ${p.label}`} onClick={() => setParts((old) => old.filter((_, i) => i !== index))}><X size={16} /></button></div>)}</div>}
    <Field id="ob-terms" label="Interest, fees, or repayment terms (optional)"><textarea id="ob-terms" className="task-input-field" rows={2} value={form.terms} maxLength={2000} onChange={(e) => set('terms', e.target.value)} placeholder="Enter confirmed terms. No interest or fees are assumed." /></Field>
    <label className="finance-check"><input type="checkbox" checked={form.urgent} onChange={(e) => set('urgent', e.target.checked)} /> Prioritize as urgent</label>
  </SaveForm>;
}

export function PaymentForm({ obligation, selected, month, currency, onSave, onCancel }) {
  const options = obligation.schedule.filter((p) => p.remaining_minor > 0);
  const [partId, setPartId] = useState(String(selected?.id || options[0]?.id || ''));
  const [billMonth, setBillMonth] = useState(selected?.bill_month || month);
  const part = options.find((p) => String(p.id) === partId) || options[0];
  const billPaid = obligation.schedule.find((p) => p.bill_month === billMonth);
  const remaining = obligation.kind === 'bill' ? (billPaid?.remaining_minor ?? obligation.initial_minor) : part?.remaining_minor ?? obligation.remaining_minor;
  const [amount, setAmount] = useState(amountText(selected?.remaining_minor || remaining));
  const [date, setDate] = useState(getLocalDateStr());
  return <SaveForm onCancel={onCancel} label="Record payment" onSubmit={() => {
    const minor = toMinor(amount);
    if (minor > remaining) throw new Error('Payment exceeds the remaining amount.');
    return onSave({ amount_minor: minor, date, account: 'cash', schedule_item_id: obligation.kind === 'bill' ? null : part?.id || null, bill_month: obligation.kind === 'bill' ? billMonth : null });
  }}>
    <p className="finance-hint">{obligation.title} · {money(remaining, currency)} remaining. A single linked expense updates cash and the obligation together.</p>
    {obligation.kind === 'bill' ? <Field id="pay-month" label="Bill month"><input id="pay-month" className="task-input-field" type="month" min="1900-01" max="2100-12" required value={billMonth} onChange={(e) => { setBillMonth(e.target.value); const next = obligation.schedule.find((p) => p.bill_month === e.target.value); setAmount(amountText(next?.remaining_minor ?? obligation.initial_minor)); }} /></Field> : options.some((p) => p.id) && <Field id="pay-part" label="Installment"><select id="pay-part" className="select-compact" value={partId} onChange={(e) => { setPartId(e.target.value); setAmount(amountText(options.find((p) => String(p.id) === e.target.value).remaining_minor)); }}>{options.map((p) => <option key={p.id} value={p.id}>{p.label} · {money(p.remaining_minor, currency)}</option>)}</select></Field>}
    <div className="finance-form-row"><MoneyField id="pay-amount" label={`Full or partial payment (${currency})`} value={amount} onChange={setAmount} /><Field id="pay-date" label="Paid on"><input id="pay-date" className="task-input-field" type="date" max={getLocalDateStr()} required value={date} onChange={(e) => setDate(e.target.value)} /></Field></div>
  </SaveForm>;
}

export function IncomeSourceForm({ initial, currency, onSave, onCancel }) {
  const [form, setForm] = useState({ title: initial?.title || '', amount: initial ? amountText(initial.amount_minor) : '', frequency: initial?.frequency || 'monthly', expected_date: initial?.expected_date || '', arrival_note: initial?.arrival_note || '', active: initial?.active ?? true });
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return <SaveForm onCancel={onCancel} label="Save expected income" onSubmit={() => onSave({ title: form.title.trim(), amount_minor: toMinor(form.amount), frequency: form.frequency, expected_date: form.expected_date || null, arrival_note: form.arrival_note.trim(), active: form.active })}>
    <div className="finance-form-row"><Field id="source-title" label="Income source"><input autoFocus id="source-title" className="task-input-field" maxLength={255} required value={form.title} onChange={(e) => set('title', e.target.value)} /></Field><MoneyField id="source-amount" label={`Expected amount (${currency})`} value={form.amount} onChange={(v) => set('amount', v)} /></div>
    <div className="finance-form-row"><Field id="source-frequency" label="Frequency"><select id="source-frequency" className="select-compact" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}><option value="monthly">Monthly</option><option value="one_time">One time</option></select></Field><Field id="source-date" label="Expected date (optional)"><input id="source-date" className="task-input-field" type="date" value={form.expected_date} onChange={(e) => set('expected_date', e.target.value)} /></Field></div>
    <Field id="source-note" label="Arrival details (optional)"><input id="source-note" className="task-input-field" maxLength={255} value={form.arrival_note} onChange={(e) => set('arrival_note', e.target.value)} placeholder="End of month" /></Field>
    <label className="finance-check"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Include in expected income</label><p className="finance-hint">Expected income is excluded from your available balance until you mark it received.</p>
  </SaveForm>;
}

export function ReceiptForm({ source, month, currency, onSave, onCancel }) {
  const [amount, setAmount] = useState(amountText(source.amount_minor));
  const [date, setDate] = useState(getLocalDateStr());
  const [period, setPeriod] = useState(month);
  return <SaveForm onCancel={onCancel} label="Confirm income received" onSubmit={() => onSave({ amount_minor: toMinor(amount), date, period })}>
    <p className="finance-hint">Confirm money actually received from {source.title}. This creates one income transaction.</p>
    <div className="finance-form-row"><MoneyField id="receipt-amount" label={`Received amount (${currency})`} value={amount} onChange={setAmount} /><Field id="receipt-date" label="Received on"><input id="receipt-date" className="task-input-field" type="date" max={getLocalDateStr()} required value={date} onChange={(e) => setDate(e.target.value)} /></Field></div>
    {source.frequency === 'monthly' && <Field id="receipt-period" label="Income for month"><input id="receipt-period" className="task-input-field" type="month" min="1900-01" max="2100-12" required value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>}
  </SaveForm>;
}

export function OpeningBalanceForm({ settings, currency, onSave, onCancel }) {
  const [cash, setCash] = useState(amountText(settings.opening_cash_minor));
  return <SaveForm onCancel={onCancel} onSubmit={() => onSave({ ...settings, opening_cash_minor: toBalanceMinor(cash, true) })}>
    <MoneyField id="opening-cash" label={`Opening balance (${currency})`} value={cash} onChange={setCash} hint="Money held before your first recorded transaction. Negative balances are allowed. Do not enter your current balance if those transactions are already recorded." />
  </SaveForm>;
}

export function MonthIncomeForm({ amount, currency, onSave, onCancel }) {
  const [value, setValue] = useState(amountText(amount));
  return <SaveForm onCancel={onCancel} onSubmit={() => onSave({ expected_income_minor: toBalanceMinor(value) })}>
    <MoneyField id="month-income" label={`Expected income this month (${currency})`} value={value} onChange={setValue} hint="A planning amount only. It never changes your cash balance." />
  </SaveForm>;
}
