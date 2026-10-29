// Design tokens: exact values from docs/design/tokens.json (v2.1), behaviour in
// docs/design/ui-ux.md §3–5. The app is dark only. Contrast ratios are recorded in ui-ux.md §3.

export const colors = {
  background: '#111315',
  surface: '#1C2024',
  elevated: '#272D33',
  text: '#F4F2EF',
  secondary: '#B5BDC5',
  muted: '#929DA8',
  accent: '#FF782D',
  accentPressed: '#E96820',
  // Text and icons on accent. Light text on accent fails contrast (2.36:1) and is never used.
  onAccent: '#17130F',
  accentSurface: '#33241C',
  // Decorative separators only; too weak to be the only boundary of a control.
  border: '#3A424B',
  // Boundary of inputs and unselected controls: 3.80:1 on background, 3.35:1 on surface.
  inputBorder: '#68727C',
  focus: '#FFAC7B',
  success: '#8ED9AB',
  successSurface: '#1D3027',
  warning: '#F3C77B',
  warningSurface: '#332C20',
  error: '#FFABA7',
  errorSurface: '#352426',
  info: '#A5C9EB',
  infoSurface: '#202D39',
  disabledSurface: '#272D33',
  disabledText: '#929DA8',
  // Modal overlay, 72 % black.
  scrim: '#000000B8',
} as const;

// System font. tokens.json asks for weight 650 on titles; React Native accepts only hundreds, so
// 600 is used (ui-ux.md §4 allows this). Native text scaling stays enabled everywhere.
export const typography = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: '600' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.6 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  // Eyebrow labels such as "SESSION SUBTOTAL": micro, spaced, uppercase.
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // The large score in a summary: an explicit local exception (ui-ux.md §4).
  score: { fontSize: 48, lineHeight: 58, fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const;

// Scale 4, 8, 12, 16, 20, 24, 32, 40, 48.
export const spacing = {
  fine: 4,
  label: 8,
  small: 12,
  field: 16,
  // Screen horizontal inset.
  inset: 20,
  group: 24,
  large: 32,
  xlarge: 40,
} as const;

export const radius = {
  small: 8,
  control: 12,
  card: 16,
  sheet: 24,
  pill: 999,
} as const;

export const sizes = {
  minTouchTarget: 48,
  primaryButtonHeight: 52,
  inputMinHeight: 56,
} as const;

// Lucide icons on a 24-unit grid.
export const icons = {
  inline: 16,
  action: 20,
  feature: 24,
  strokeWidth: 1.75,
} as const;

export const motion = {
  press: 100,
  transition: 180,
  sheet: 220,
} as const;
