export function money(minor, currency = 'KZT') {
  const sign = minor < 0 ? '−' : '';
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100).toLocaleString('en-US');
  const cents = absolute % 100;
  const value = `${sign}${whole}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
  return currency === 'KZT' ? `${value} ₸` : currency === 'USD' ? `${sign}$${whole}${cents ? `.${String(cents).padStart(2, '0')}` : ''}` : `${value} €`;
}

export function amountText(minor) {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}

export function toMinor(value) {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) throw new Error('Enter an amount such as 2500 or 2500.50.');
  const [whole, fraction = ''] = cleaned.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount <= 0 || amount > 10 ** 13) throw new Error('Enter an amount greater than zero.');
  return amount;
}

export function toBalanceMinor(value, allowNegative = false) {
  const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
  if (/^0+(\.0{1,2})?$/.test(cleaned)) return 0;
  if (allowNegative && cleaned.startsWith('-')) return -toMinor(cleaned.slice(1));
  return toMinor(cleaned);
}
