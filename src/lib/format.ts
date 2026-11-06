const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** "$1,284.45". Negative values render as "−$0.85" (true minus sign) to match the design. */
export function formatUsd(amount: number): string {
  return amount < 0 ? `−${USD.format(Math.abs(amount))}` : USD.format(amount);
}

/** "+$4.05" / "−$0.85" for savings deltas. */
export function formatSignedUsd(amount: number): string {
  return amount < 0 ? formatUsd(amount) : `+${formatUsd(amount)}`;
}
