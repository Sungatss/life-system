import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bell, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Plus, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { getLocalDateStr } from '../utils/date';
import { money } from '../utils/financeMoney';
import FinanceToBuy from '../components/FinanceToBuy';
import { BudgetForm, IncomeSourceForm, MonthIncomeForm, ObligationForm, OpeningBalanceForm, PaymentForm, ReceiptForm, TransactionForm } from '../components/FinanceForms';
import './FinancePage.css';

const tabs = ['Overview', 'Transactions', 'Payments & Debts', 'Budget', 'Things to Buy'];
const allocations = { living: 'Living costs', debt: 'Debts', tuition: 'Tuition', bill: 'Recurring bills', other: 'Other expenses' };
const nextMonth = (month, offset) => {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const niceDate = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date needed';
const monthLabel = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const total = (items, key) => items.reduce((sum, item) => sum + item[key], 0);

function Metric({ label, value, hint, className = '' }) {
  return <div className={`finance-summary-card ${className}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

function Section({ title, subtitle, action, children, className = '' }) {
  return <section className={`cockpit-section finance-panel ${className}`}><div className="finance-section-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function Breakdown({ data, currency }) {
  const sum = total(data, 'amount_minor');
  return data.length ? <div className="finance-breakdown" aria-label="Spending by category, largest first">{data.map((item, index) => <div key={item.name} className="finance-category"><div><span><i className={`finance-dot color-${index % 4}`} />{item.name}{index === 0 && <small>Largest</small>}</span><strong>{money(item.amount_minor, currency)}</strong></div><div className="finance-bar" role="img" aria-label={`${item.name}: ${Math.round(item.amount_minor / sum * 100)}% of spending`}><span className={`color-${index % 4}`} style={{ width: `${item.amount_minor / sum * 100}%` }} /></div></div>)}</div> : <p className="finance-empty">Category totals will appear when you record expenses.</p>;
}

function Schedule({ entries, currency, onPay, limit }) {
  const unpaid = entries.filter((p) => p.remaining_minor > 0);
  return unpaid.length ? <div className="finance-schedule">{unpaid.slice(0, limit || unpaid.length).map((p) => <div className={`finance-schedule-row ${p.status}`} key={`${p.obligation_id}-${p.id || p.bill_month || 'single'}`}><div className="finance-date-icon"><CalendarDays size={17} aria-hidden="true" /></div><div className="finance-schedule-copy"><strong>{p.title}</strong><small>{p.label} · {niceDate(p.due_date)}</small><span className={`finance-status ${p.status}`}>{p.urgent ? 'Urgent · ' : ''}{p.status === 'undated' ? 'Set a due date' : p.status === 'upcoming' ? 'Due within 7 days' : p.status}</span></div><div className="finance-row-right"><strong>{money(p.remaining_minor, currency)}</strong><button type="button" className="finance-link" onClick={() => onPay(p)}>Record payment</button></div></div>)}</div> : <p className="finance-empty">No unpaid payments in this schedule.</p>;
}

function TransactionList({ items, currency, onEdit, onRemove, confirmDelete, busy, history = false }) {
  return items.length ? <ul className="finance-transactions">{items.map((item) => <li key={item.id} className="finance-transaction"><span className={`finance-transaction-icon ${item.kind}`} aria-hidden="true">{item.kind === 'income' ? <ArrowDownLeft size={17} /> : item.kind === 'expense' ? <ArrowUpRight size={17} /> : <ArrowLeftRight size={17} />}</span><div className="finance-transaction-copy"><strong>{item.title}</strong><small>{niceDate(item.date)} · {item.category || item.kind}{item.classification ? ` · ${item.classification}` : ''}{item.obligation_id ? ' · Linked payment' : ''}{item.bill_month ? ` · Bill for ${item.bill_month}` : ''}{item.income_source_id ? ` · Income for ${item.income_period}` : ''}</small>{item.description && <p>{item.description}</p>}</div><div className="finance-transaction-side"><strong className={item.kind === 'income' ? 'positive' : ''}>{item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : ''}{money(item.amount_minor, currency)}</strong>{onRemove && <div>{!item.obligation_id && !history && <button type="button" className="finance-link" disabled={busy} onClick={() => onEdit(item)}>Edit</button>}<button type="button" className={`finance-link danger${confirmDelete === `tx-${item.id}` ? ' confirming' : ''}`} disabled={busy} onClick={() => onRemove(item)}>{confirmDelete === `tx-${item.id}` ? 'Confirm' : item.obligation_id ? 'Reverse' : 'Delete'}</button></div>}</div></li>)}</ul> : <p className="finance-empty">No transactions recorded for this month.</p>;
}

export default function FinancePage() {
  const today = getLocalDateStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('all');
  const [historyId, setHistoryId] = useState('all');
  const editorRef = useRef(null);

  useEffect(() => {
    if (editor) editorRef.current?.scrollIntoView({ block: 'start' });
  }, [editor]);

  useEffect(() => {
    let active = true;
    Promise.all([api.getFinanceOverview(month, today), api.getFinanceTransactions(month, 0, 50, filter, category)]).then(([summary, entries]) => {
      if (!active) return;
      setOverview(summary); setTransactions(entries); setHasMore(entries.length === 50); setError('');
    }).catch((cause) => { if (active) setError(cause.message || 'Could not load Finance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, revision, today, filter, category]);

  const refresh = (message = 'Saved.') => { setRevision((old) => old + 1); setActionError(''); setConfirmDelete(''); setSuccess(message); };
  const open = (type, initial = null, selected = null) => { setEditor({ type, initial, selected }); setSuccess(''); setActionError(''); setConfirmDelete(''); };
  const go = (value) => { setTab(value); setEditor(null); setConfirmDelete(''); setSuccess(''); };
  const remove = async (key, action, message = 'Deleted.') => {
    if (confirmDelete !== key) { setConfirmDelete(key); return; }
    if (busy) return;
    setBusy(true); setActionError('');
    try { await action(); refresh(message); }
    catch (cause) { setActionError(cause.message || 'Could not remove this item.'); }
    finally { setBusy(false); }
  };
  const removeTransaction = (item) => remove(`tx-${item.id}`, () => api.deleteFinanceTransaction(item.id), item.obligation_id ? 'Payment reversed. Cash and remaining balance updated.' : 'Transaction deleted. Totals updated.');
  const changeMonth = (value) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < '1900-01' || value > '2100-12') return;
    setMonth(value); setLoading(true); setEditor(null); setConfirmDelete(''); setSuccess('');
  };
  const pay = (entry) => open('payment', overview.obligations.find((o) => o.id === entry.obligation_id), entry);
  const more = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const entries = await api.getFinanceTransactions(month, transactions.length, 50, filter, category);
      setTransactions((old) => [...old, ...entries]); setHasMore(entries.length === 50);
    } catch (cause) { setActionError(cause.message || 'Could not load more.'); }
    finally { setBusy(false); }
  };
  const saveEditor = async (data) => {
    const { type, initial } = editor;
    if (type === 'transaction') {
      if (initial) await api.updateFinanceTransaction(initial.id, data); else await api.createFinanceTransaction(data);
      setMonth(data.date.slice(0, 7));
    } else if (type === 'obligation') {
      if (initial) await api.updateFinanceObligation(initial.id, data); else await api.createFinanceObligation(data);
    } else if (type === 'budget') {
      if (initial) await api.updateFinanceBudgetItem(initial.id, data); else await api.createFinanceBudgetItem(data);
    } else if (type === 'source') {
      if (initial) await api.updateFinanceIncomeSource(initial.id, data); else await api.createFinanceIncomeSource(data);
    } else if (type === 'payment') await api.payFinanceObligation(initial.id, data);
    else if (type === 'receipt') await api.receiveFinanceIncome(initial.id, data);
    else if (type === 'opening') await api.saveFinanceSettings(data);
    else if (type === 'monthIncome') await api.saveFinanceMonthPlan(month, data);
    setEditor(null); refresh(type === 'receipt' ? 'Income received. Your balance has been updated.' : type === 'payment' ? 'Payment recorded once. Cash and remaining balance updated.' : 'Saved. Totals updated.');
  };
  const currency = overview?.settings.currency || 'KZT';
  const budget = overview?.budget;
  const debts = overview?.obligations.filter((o) => o.kind === 'debt') || [];
  const tuition = overview?.obligations.filter((o) => o.kind === 'tuition') || [];
  const unpaid = overview?.schedule.filter((p) => p.remaining_minor > 0) || [];
  const reminders = unpaid.filter((p) => p.status === 'overdue' || p.status === 'upcoming' || p.urgent);
  const visibleSchedule = unpaid.filter((p) => scheduleFilter === 'all' || p.status === scheduleFilter);
  const sourceList = overview?.income_sources.filter((s) => s.active && s.applies_to_month) || [];
  const expectedPending = total(sourceList.filter((s) => !s.received_minor), 'amount_minor');
  const editorProps = editor ? { initial: editor.initial, currency, onSave: saveEditor, onCancel: () => setEditor(null) } : {};
  const editorTitles = { transaction: 'Record a transaction', obligation: 'Manage obligation', payment: 'Record a payment', source: 'Expected income', receipt: 'Mark income received', budget: 'Monthly allocation', opening: 'Set opening balance', monthIncome: 'Monthly income plan' };

  return <div className="finance-page">
    <div className="finance-page-head"><div><p className="cockpit-weekday">YOUR MONEY, IN ONE PLACE</p><h1 className="cockpit-title">Finance</h1><p className="finance-page-intro">A clear view of what you have, owe, and can spend.</p></div><span className="finance-currency">{currency === 'KZT' ? '₸ KZT' : currency}</span></div>
    <nav className="finance-tabs" aria-label="Finance sections">{tabs.map((item) => <button key={item} type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => go(item)}>{item}</button>)}</nav>
    <div className="finance-toolbar"><div className="finance-month-switch"><button type="button" className="icon-btn" aria-label="Previous finance month" disabled={month === '1900-01' || busy} onClick={() => changeMonth(nextMonth(month, -1))}><ChevronLeft size={17} /></button><label className="finance-month-label"><span className="sr-only">Finance month</span><input aria-label="Finance month" type="month" min="1900-01" max="2100-12" value={month} disabled={busy} onChange={(e) => changeMonth(e.target.value)} /></label><button type="button" className="icon-btn" aria-label="Next finance month" disabled={month === '2100-12' || busy} onClick={() => changeMonth(nextMonth(month, 1))}><ChevronRight size={17} /></button></div>{tab !== 'Things to Buy' && <button type="button" className="btn-primary" disabled={loading || !!error || !overview || busy} onClick={() => open(tab === 'Budget' ? 'budget' : tab === 'Payments & Debts' ? 'obligation' : 'transaction')}><Plus size={15} aria-hidden="true" />{tab === 'Budget' ? 'Add allocation' : tab === 'Payments & Debts' ? 'Add obligation' : 'Add transaction'}</button>}</div>
    {success && <p className="finance-success finance-notice" role="status">{success}</p>}
    {actionError && <p className="form-error finance-notice" role="alert">{actionError}</p>}
    {error && <div className="cockpit-section finance-error" role="alert">{error}<button type="button" className="btn-secondary" onClick={() => { setLoading(true); refresh(''); }}>Retry</button></div>}
    {loading ? <div className="cockpit-section finance-loading" role="status">Loading your finances…</div> : overview && !error && <>
      {currency !== 'KZT' && <p className="finance-warning" role="status">Your existing ledger uses {currency}. It has been preserved. KZT starter amounts were not added to avoid mixing currencies.</p>}
      {editor && <div key={`${editor.type}-${editor.initial?.id || "new"}-${editor.selected?.id || editor.selected?.bill_month || ""}`} ref={editorRef} className="finance-editor-anchor"><Section title={editorTitles[editor.type]} className="finance-editor">{editor.type === 'transaction' && <TransactionForm {...editorProps} />}{editor.type === 'obligation' && <ObligationForm {...editorProps} />}{editor.type === 'budget' && <BudgetForm {...editorProps} month={month} />}{editor.type === 'payment' && <PaymentForm {...editorProps} obligation={editor.initial} selected={editor.selected} month={month} />}{editor.type === 'source' && <IncomeSourceForm {...editorProps} />}{editor.type === 'receipt' && <ReceiptForm {...editorProps} source={editor.initial} month={month} />}{editor.type === 'opening' && <OpeningBalanceForm {...editorProps} settings={overview.settings} />}{editor.type === 'monthIncome' && <MonthIncomeForm {...editorProps} amount={budget.expected_income_minor} />}</Section></div>}

      {tab === 'Overview' && <>
        <div className="finance-summary-grid"><Metric className="primary" label="Available balance · now" value={money(overview.balances_minor.cash, currency)} hint="Opening balance + received income − expenses" /><Metric label="Income received" value={money(overview.month.income_minor, currency)} hint={monthLabel(month)} /><Metric label="Expenses" value={money(overview.month.expenses_minor, currency)} hint="Includes repayments once" /><Metric label="Budget remaining" value={money(budget.remaining_minor, currency)} hint={budget.planned_minor ? 'Monthly plan − actual expenses' : 'Add allocations in Budget'} /></div>
        <section className="finance-safe-card"><div className="finance-safe-top"><div><p><ShieldCheck size={17} aria-hidden="true" /> Safe to Spend · now</p><strong>{money(overview.safe_to_spend_minor, currency)}</strong></div><button className="finance-link" type="button" onClick={() => go('Budget')}>View budget</button></div><p>Available cash after {money(overview.reserved_minor, currency)} reserved for unpaid obligations and remaining essential plans this month.</p>{overview.undated_reserve_minor > 0 && <small><CircleHelp size={14} aria-hidden="true" /> Includes {money(overview.undated_reserve_minor, currency)} in undated obligations held conservatively. Add due dates to refine this amount.</small>}{overview.shortfall_minor > 0 && <div className="finance-safe-shortfall">Reserve shortfall: {money(overview.shortfall_minor, currency)}</div>}<small>Expected income is excluded. Essential living costs must be entered in Budget for a complete estimate.</small></section>
        {reminders.length > 0 && <div className="finance-reminder" role="status"><Bell size={18} aria-hidden="true" /><div><strong>{reminders.length} {reminders.length === 1 ? 'payment needs' : 'payments need'} attention</strong><p>{reminders.filter((p) => p.status === 'overdue').length} overdue · {reminders.filter((p) => p.status === 'upcoming').length} due within 7 days</p></div><button className="finance-link" type="button" onClick={() => go('Payments & Debts')}>Review</button></div>}
        <div className="finance-two-column"><Section title="Payments ahead" subtitle="Ordered by urgency and due date" action={<button className="finance-link" type="button" onClick={() => go('Payments & Debts')}>View all</button>}><div className="finance-inline-metrics"><div><span>Consumer debt</span><strong>{money(total(debts, 'remaining_minor'), currency)}</strong></div><div><span>Tuition remaining</span><strong>{money(total(tuition, 'remaining_minor'), currency)}</strong></div></div><Schedule entries={unpaid} currency={currency} onPay={pay} limit={4} /></Section><Section title="Spending by category" subtitle={`${monthLabel(month)} · largest first`}><Breakdown data={overview.month.categories} currency={currency} /><div className="finance-spending-split"><span>Essential <strong>{money(overview.month.essential_minor, currency)}</strong></span><span>Optional <strong>{money(overview.month.optional_minor, currency)}</strong></span></div></Section></div>
        <Section title="Expected income" subtitle={`${money(expectedPending, currency)} pending · excluded from available balance`} action={<button className="finance-link" type="button" onClick={() => open('source')}><Plus size={14} /> Add source</button>}>{overview.income_sources.length ? overview.income_sources.map((source) => <div className="finance-list-row" key={source.id}><div><strong>{source.title}</strong><small>{source.frequency === 'monthly' ? 'Monthly' : 'One time'} · {source.arrival_note || (source.expected_date ? niceDate(source.occurrence_date) : 'Arrival not specified')}{source.expected_date && source.arrival_note ? ` · ${niceDate(source.occurrence_date)}` : ''}</small><span className={`finance-status ${source.received_minor ? 'paid' : 'undated'}`}>{!source.active ? 'Inactive' : source.received_minor ? `Received ${money(source.received_minor, currency)}` : !source.applies_to_month ? 'Expected in another month' : 'Expected · not received'}</span></div><div className="finance-row-right"><strong>{money(source.amount_minor, currency)}</strong><div>{source.active && !source.received_minor && <button className="finance-link" type="button" onClick={() => open('receipt', source)}>Mark received</button>}<button className="finance-link" type="button" onClick={() => open('source', source)}>Edit</button><button className="finance-link danger" type="button" disabled={busy} onClick={() => remove(`source-${source.id}`, () => api.deleteFinanceIncomeSource(source.id))}>{confirmDelete === `source-${source.id}` ? 'Confirm delete' : 'Delete'}</button></div></div></div>) : <p className="finance-empty">Add an expected income source. Record money only when it arrives.</p>}</Section>
        <Section title="Recent transactions" subtitle={monthLabel(month)} action={<button className="finance-link" type="button" onClick={() => go('Transactions')}>View all</button>}><TransactionList items={overview.recent_transactions} currency={currency} /></Section>
        <div className="finance-balance-footer"><span><Wallet size={15} aria-hidden="true" /> Opening balance: {money(overview.settings.opening_cash_minor, currency)}</span><button className="finance-link" type="button" onClick={() => open('opening')}>Edit opening balance</button></div>{overview.balances_minor.emergency !== 0 && <p className="finance-hint">Existing emergency balance: {money(overview.balances_minor.emergency, currency)}. Kept separate from available spending cash.</p>}
      </>}

      {tab === 'Transactions' && <>
        <div className="finance-summary-grid three"><Metric label="Income received" value={money(overview.month.income_minor, currency)} /><Metric label="Essential expenses" value={money(overview.month.essential_minor, currency)} /><Metric label="Optional expenses" value={money(overview.month.optional_minor, currency)} /></div>
        <Section title="Transactions" subtitle="Manual income and expenses. Repayments are linked automatically."><div className="finance-filter-row"><label>Type<select className="select-compact" aria-label="Transaction type" disabled={busy} value={filter} onChange={(e) => { setFilter(e.target.value); setLoading(true); }}><option value="">All transactions</option><option value="income">Income</option><option value="expense">Expenses</option><option value="essential">Essential expenses</option><option value="optional">Optional expenses</option><option value="transfer">Saved transfers</option></select></label><label>Category<select className="select-compact" aria-label="Transaction category" disabled={busy} value={category} onChange={(e) => { setCategory(e.target.value); setLoading(true); }}><option value="">All categories</option>{overview.transaction_categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label></div><TransactionList items={transactions} currency={currency} onEdit={(item) => open('transaction', item)} onRemove={removeTransaction} confirmDelete={confirmDelete} busy={busy} />{hasMore && <button type="button" className="btn-secondary finance-load-more" disabled={busy} onClick={more}>{busy ? 'Loading…' : 'Load more'}</button>}</Section><Section title="Monthly spending breakdown" subtitle="All recorded expenses, including linked payments"><Breakdown data={overview.month.categories} currency={currency} /></Section>
      </>}

      {tab === 'Payments & Debts' && <>
        <div className="finance-summary-grid three"><Metric label="Consumer debt remaining" value={money(total(debts, 'remaining_minor'), currency)} hint="Recurring bills excluded" /><Metric label="Tuition remaining" value={money(total(tuition, 'remaining_minor'), currency)} hint="Historical payments already applied" /><Metric label="Recurring bills / month" value={money(total(overview.obligations.filter((o) => o.kind === 'bill'), 'initial_minor'), currency)} hint="Monthly expenses, separate from debts" /></div>
        <Section title="Payment schedule" subtitle="Due within 7 days and overdue payments are your in-app reminders."><div className="finance-filters" aria-label="Payment schedule filter">{[['all', 'All unpaid'], ['overdue', 'Overdue'], ['upcoming', 'Due within 7 days'], ['undated', 'Dates needed']].map(([value, label]) => <button type="button" key={value} className={scheduleFilter === value ? 'active' : ''} aria-pressed={scheduleFilter === value} onClick={() => setScheduleFilter(value)}>{label}</button>)}</div><Schedule entries={visibleSchedule} currency={currency} onPay={pay} /></Section>
        {[['debt', 'Consumer debts'], ['tuition', 'University tuition'], ['bill', 'Recurring bills'], ['other', 'Other obligations']].map(([kind, label]) => {
          const rows = overview.obligations.filter((o) => o.kind === kind);
          if (!rows.length && kind === 'other') return null;
          return <Section key={kind} title={label}>{rows.length ? <div className="finance-obligations">{rows.map((o) => {
            const paid = o.initial_minor - o.remaining_minor;
            const installments = o.schedule.filter((p) => p.id);
            return <article className="finance-obligation" key={o.id}><div className="finance-section-head"><div><h3>{o.title}</h3><p>{kind === 'bill' ? `${money(o.initial_minor, currency)} / month` : `${money(o.remaining_minor, currency)} remaining of ${money(o.initial_minor, currency)}`}</p></div><div className="finance-obligation-actions"><button className="finance-link" type="button" onClick={() => open('obligation', o)}>Edit</button><button className="finance-link danger" type="button" disabled={busy} onClick={() => remove(`ob-${o.id}`, () => api.deleteFinanceObligation(o.id))}>{confirmDelete === `ob-${o.id}` ? 'Confirm delete' : 'Delete'}</button></div></div>{kind !== 'bill' && <><progress className="finance-progress" max={o.initial_minor} value={paid} aria-label={`${o.title} paid`} /><div className="finance-progress-label"><span>{Math.round(paid / o.initial_minor * 100)}% paid</span><span>{installments.length ? `${installments.filter((p) => !p.remaining_minor).length} of ${installments.length} payments completed` : `${money(paid, currency)} paid`}</span></div></>}{o.historical_paid_minor > 0 && <p className="finance-hint">{money(o.historical_paid_minor, currency)} paid before tracking; no current cash deduction.</p>}{o.terms && <p className="finance-terms">{o.terms}</p>}{!o.terms && kind === 'debt' && <p className="finance-hint">Interest, fees, and additional terms have not been entered.</p>}{kind === 'bill' && <p className="finance-hint">{o.due_date ? `First due ${niceDate(o.due_date)}. Repeats monthly.` : 'Monthly amount saved. Enter a first due date to enable deadline reminders.'}</p>}{installments.length > 0 && <details className="finance-installments"><summary>View {installments.length} installments</summary>{installments.map((p) => <div className="finance-list-row" key={p.id}><div><strong>{p.label}</strong><small>{niceDate(p.due_date)} · {p.status === 'paid' ? 'Paid' : money(p.remaining_minor, currency) + ' remaining'}</small></div><strong>{money(p.amount_minor, currency)}</strong></div>)}</details>}{(o.remaining_minor > 0 || kind === 'bill') && <button className="btn-secondary" type="button" onClick={() => open('payment', o)}>Record payment</button>}</article>;
          })}</div> : <p className="finance-empty">No {label.toLowerCase()} recorded.</p>}</Section>;
        })}
        <Section title="Payment history" subtitle="Reverse a payment to correct it. Reversal restores the remaining balance."><label className="finance-history-filter">Obligation<select className="select-compact" value={historyId} onChange={(e) => setHistoryId(e.target.value)}><option value="all">All obligations</option>{overview.obligations.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label><TransactionList history items={overview.payment_history.filter((p) => historyId === 'all' || String(p.obligation_id) === historyId)} currency={currency} onRemove={removeTransaction} confirmDelete={confirmDelete} busy={busy} />{overview.payment_history.length === 0 && <p className="finance-hint">Historical tuition paid is reflected above. Its payment date was not supplied.</p>}</Section>
      </>}

      {tab === 'Budget' && <>
        <div className="finance-summary-grid"><Metric label="Available cash · now" value={money(overview.balances_minor.cash, currency)} /><Metric label="Payments due / overdue" value={money(budget.payments_remaining_minor, currency)} hint="Includes undated monthly bills" /><Metric label="Basic living plan" value={money(budget.living_essential_minor, currency)} hint="Essential living and other costs" /><Metric label="Safe to Spend · now" value={money(overview.safe_to_spend_minor, currency)} hint="After current-month reserves" /></div>
        <Section title={`${monthLabel(month)} budget`} subtitle="Plan with expected income; available cash only includes received money." action={<button className="finance-link" type="button" onClick={() => open('monthIncome')}>Edit expected income</button>}><div className="finance-inline-metrics four"><div><span>Expected income</span><strong>{money(budget.expected_income_minor, currency)}</strong></div><div><span>Minimum required</span><strong>{money(budget.minimum_required_minor, currency)}</strong></div><div><span>Total planned</span><strong>{money(budget.planned_minor, currency)}</strong></div><div><span>Actual spent</span><strong>{money(budget.actual_minor, currency)}</strong></div></div>{budget.over_income_minor > 0 && <p className="finance-warning" role="status">Your plan exceeds expected or received income by {money(budget.over_income_minor, currency)}.</p>}{budget.undated_reserve_minor > 0 && <p className="finance-hint">{money(budget.undated_reserve_minor, currency)} of undated debt and tuition is outside this monthly plan and held in the Safe to Spend reserve. Enter due dates to allocate it to months.</p>}
          <div className="finance-budget-table" role="table" aria-label="Planned versus actual spending"><div className="finance-budget-header" role="row"><span role="columnheader">Allocation</span><span role="columnheader">Planned</span><span role="columnheader">Actual</span><span role="columnheader">Left</span><span role="columnheader">Actions</span></div>{budget.items.map((item) => <div className="finance-budget-row" role="row" key={item.id}><div role="cell"><strong>{item.title}</strong><small>{allocations[item.allocation]} · {item.classification}{['living', 'other'].includes(item.allocation) ? ` · ${item.category || item.title}` : ''}</small></div><span role="cell" data-label="Planned">{money(item.amount_minor, currency)}</span><span role="cell" data-label="Actual">{money(item.actual_minor, currency)}</span><span role="cell" data-label="Left" className={item.remaining_minor < 0 ? 'finance-negative' : ''}>{money(item.remaining_minor, currency)}</span><div role="cell" className="finance-budget-actions"><button type="button" className="finance-link" onClick={() => open('budget', item)}>Edit</button><button type="button" className="finance-link danger" disabled={busy} onClick={() => remove(`budget-${item.id}`, () => api.deleteFinanceBudgetItem(item.id))}>{confirmDelete === `budget-${item.id}` ? 'Confirm' : 'Delete'}</button></div></div>)}</div>{budget.items.length === 0 && <p className="finance-empty">Add monthly allocations for groceries, transport, rent, or other costs. No living expenses have been assumed.</p>}<p className="finance-hint">Due obligations are included in Total planned and Minimum required automatically, even without a matching allocation. Matching debt, tuition, and bill allocations are counted once. Actual expenses without an allocation still count in the monthly total.</p><div className="finance-budget-total"><span>Monthly budget remaining</span><strong className={budget.remaining_minor < 0 ? 'finance-negative' : ''}>{money(budget.remaining_minor, currency)}</strong></div>
        </Section>
      </>}
      {tab === 'Things to Buy' && <FinanceToBuy currency={currency} />}
    </>}
  </div>;
}
