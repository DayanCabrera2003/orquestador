import { ApiError } from '../api/http';
import { t, tMaybe } from '../i18n/t';
import { useUi } from './uiStore';

/** Muestra un error al usuario con el texto que corresponde a su código. */
export function reportError(error: unknown): void {
  const code = error instanceof ApiError ? error.code : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const text = code
    ? tMaybe(`errors.${code}`, 'errors.generic', { message })
    : t('errors.generic', { message });
  useUi.getState().toast(text);
}
