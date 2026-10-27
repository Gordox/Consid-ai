// Design tokens from docs/design/ui-ux.md §8–10 (board 01-foundations.png).
// The app is dark only (decision A6). Contrast values are recorded in ui-ux.md §9.

export const colors = {
  background: '#111315',
  surface: '#1C2024',
  elevated: '#272D33',
  text: '#F4F2EF',
  secondary: '#B5BDC5',
  disabled: '#77818B',
  accent: '#FF782D',
  // Text and icons on accent. Light text on accent fails contrast (2.36:1) and is not used.
  onAccent: '#17130F',
  focus: '#FFAC7B',
  error: '#FFABA7',
  warning: '#F3C77B',
  success: '#8ED9AB',
  info: '#A5C9EB',
  // Quiet separators only: 1.61:1 against surface is too weak for input boundaries.
  border: '#3A424B',
  // Boundary of active inputs and unselected choices: 3.80:1 on background, 3.35:1 on surface.
  inputBorder: '#68727C',
  // Dims the screen behind a dialog. Not on the board; chosen so the elevated card stands out.
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

// System font (decision A7). Line heights are the board's ratios rounded to whole points.
export const typography = {
  pageTitle: { fontSize: 30, lineHeight: 35, fontWeight: '600' },
  section: { fontSize: 20, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  supporting: { fontSize: 12, lineHeight: 17, fontWeight: '400' },
} as const;

// 4-point base.
export const spacing = {
  fine: 4,
  label: 8,
  small: 12,
  field: 16,
  inset: 24,
  group: 24,
  large: 32,
} as const;

export const radius = {
  small: 8,
  control: 12,
  card: 16,
} as const;

export const sizes = {
  minTouchTarget: 48,
  primaryButtonHeight: 52,
} as const;

// Lucide icons on a 24-unit grid with a 1.7 stroke (decision U9).
export const icons = {
  inline: 16,
  action: 20,
  feature: 24,
  strokeWidth: 1.7,
} as const;
