export const qiuColors = {
  brand: '#1677ff',
  success: '#2f9e44',
  warning: '#f59f00',
  danger: '#d64545',
  text: '#1f2328',
  textSecondary: '#667085',
  border: '#d0d7de',
  surface: '#ffffff',
  surfaceMuted: '#f6f8fa'
} as const;

export const qiuRadius = {
  sm: 4,
  md: 6,
  lg: 8
} as const;

export const qiuAntTheme = {
  token: {
    colorPrimary: qiuColors.brand,
    borderRadius: qiuRadius.md,
    borderRadiusLG: qiuRadius.lg,
    colorText: qiuColors.text,
    colorTextSecondary: qiuColors.textSecondary,
    colorBorder: qiuColors.border
  }
} as const;
