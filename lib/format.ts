export const tick = (x: number) => Math.round(x / 0.05) * 0.05;
export const money = (x: number) => "₹" + Math.round(x).toLocaleString("en-IN");
export const fmt = (x: number, d = 2) =>
  Number(x).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
export const volFmt = (v: number) =>
  v >= 1e7 ? (v / 1e7).toFixed(2) + " Cr" : v >= 1e5 ? (v / 1e5).toFixed(2) + " L" : v.toLocaleString("en-IN");
