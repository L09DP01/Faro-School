function getLuminance(hex) {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = [
  { fgName: "White (#FFFFFF)", fg: "#FFFFFF", bgName: "Orange (#FF7F0E)", bg: "#FF7F0E", context: "White text on primary button" },
  { fgName: "White (#FFFFFF)", fg: "#FFFFFF", bgName: "Orange-strong (#E56A00)", bg: "#E56A00", context: "White text on stronger orange" },
  { fgName: "Navy (#0B1F4B)", fg: "#0B1F4B", bgName: "Orange (#FF7F0E)", bg: "#FF7F0E", context: "Navy text on orange button" },
  { fgName: "Navy-deep (#031047)", fg: "#031047", bgName: "Orange (#FF7F0E)", bg: "#FF7F0E", context: "Navy-deep text on orange button" },
  { fgName: "Orange (#FF7F0E)", fg: "#FF7F0E", bgName: "White (#FFFFFF)", bg: "#FFFFFF", context: "Orange text on white background" },
  { fgName: "Orange-strong (#E56A00)", fg: "#E56A00", bgName: "White (#FFFFFF)", bg: "#FFFFFF", context: "Orange-strong text on white background" },
  { fgName: "Blue (#1F5BDB)", fg: "#1F5BDB", bgName: "White (#FFFFFF)", bg: "#FFFFFF", context: "Blue links on white background" },
  { fgName: "Blue (#1F5BDB)", fg: "#1F5BDB", bgName: "Page BG (#F8FAFF)", bg: "#F8FAFF", context: "Blue links on page background" },
  { fgName: "Muted (#5B6478)", fg: "#5B6478", bgName: "White (#FFFFFF)", bg: "#FFFFFF", context: "Muted secondary text on white" },
  { fgName: "Muted (#5B6478)", fg: "#5B6478", bgName: "Page BG (#F8FAFF)", bg: "#F8FAFF", context: "Muted secondary text on page BG" },
  { fgName: "Ink (#101828)", fg: "#101828", bgName: "White (#FFFFFF)", bg: "#FFFFFF", context: "Body text on white" },
  { fgName: "Ink (#101828)", fg: "#101828", bgName: "Page BG (#F8FAFF)", bg: "#F8FAFF", context: "Body text on page BG" },
  { fgName: "White (#FFFFFF)", fg: "#FFFFFF", bgName: "Navy-deep (#031047)", bg: "#031047", context: "White text on footer/sidebar" },
  { fgName: "White (#FFFFFF)", fg: "#FFFFFF", bgName: "Navy (#0B1F4B)", bg: "#0B1F4B", context: "White text on navy surface" },
];

const results = pairs.map((p) => {
  const ratio = getContrast(p.fg, p.bg);
  return {
    Context: p.context,
    Foreground: p.fgName,
    Background: p.bgName,
    "Ratio:1": ratio.toFixed(2),
    "Normal AA (4.5)": ratio >= 4.5 ? "PASS" : "FAIL",
    "Large/Bold AA (3.0)": ratio >= 3.0 ? "PASS" : "FAIL",
  };
});

console.table(results);
