/** Arabic uses Arabic-Indic digits consistently across CLDR/ICU versions. */
export function formatNumber(value: number, language: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(language, {
    ...(language.split('-')[0] === 'ar' ? { numberingSystem: 'arab' } : {}),
    ...options,
  }).format(value);
}
