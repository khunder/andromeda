import type { IFormI18n, Translate } from './types';

function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * A translate function over whatever i18n the host provides (an object with
 * t(), or a key -> text dictionary); without one - or for a missing key - the
 * fallback text is used. "{{name}}" placeholders are filled from params.
 */
export function createTranslate(getI18n: () => IFormI18n | undefined): Translate {
  return (key, fallback, params) => {
    const i18n = getI18n();
    let text: string | undefined;
    if (i18n && typeof (i18n as { t?: unknown }).t === 'function') {
      const translated = (i18n as { t: Translate }).t(key, fallback, params);
      // i18next & co. return the key itself when it's missing
      text = translated && translated !== key ? translated : undefined;
    } else if (i18n) {
      text = (i18n as Record<string, string>)[key];
    }
    return interpolate(text ?? fallback, params);
  };
}
