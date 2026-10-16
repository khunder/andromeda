import { el } from '../generator';
import { defineInput } from '../registry';

/** A file picked in the form - the shape the container's `files` inputs take. */
export interface IFormFileValue {
  /** data: URL */
  base64: string;
  fileName: string;
  contentType: string;
  size: number;
}

export function isPickedFile(value: unknown): value is IFormFileValue {
  return !!value && typeof value === 'object' && typeof (value as IFormFileValue).base64 === 'string';
}

/** "10MB", "512 KB", 2048 -> bytes */
export function parseSize(size: unknown): number | null {
  if (typeof size === 'number') return size;
  const match = typeof size === 'string' && size.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!match) return null;
  const unit = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[(match[2] || 'B').toUpperCase() as 'B'];
  return Math.round(Number(match[1]) * unit);
}

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;

/**
 * File - a native file picker. A new pick is read in the browser as a data:
 * URL; a stored file variable (a reference, not content) is shown by name and
 * kept as it is unless another file is picked.
 */
export default defineInput({
  type: 'file',
  uiHints: ['input'],
  create(ctx) {
    const { component } = ctx;
    const wrapper = el('div', 'iform-file');
    const input = el('input', ctx.classes.control);
    input.id = ctx.id;
    input.name = component.key ?? '';
    input.type = 'file';
    if (typeof component.accept === 'string') input.accept = component.accept;
    const current = el('small', ctx.classes.description);
    wrapper.append(input, current);

    let value: unknown = null;
    let reading: Promise<void> = Promise.resolve();
    const show = () => {
      const name = isPickedFile(value)
        ? `${value.fileName} (${formatSize(value.size)})`
        : value && typeof value === 'object'
          ? String((value as Record<string, unknown>).fileName ?? (value as Record<string, unknown>).name ?? '')
          : '';
      current.textContent = name ? ctx.t('iform.file.current', 'Current: {{name}}', { name }) : '';
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      reading = new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          value = { base64: String(reader.result), fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size };
          show();
          ctx.changed();
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(file);
      });
    });

    return {
      element: wrapper,
      labelTarget: input,
      getValue: () => value,
      setValue: (next) => {
        value = next ?? null;
        input.value = '';
        show();
      },
      setDisabled: (disabled) => { input.disabled = disabled; },
      focus: () => input.focus(),
      settle: () => reading,
    };
  },
  validate: (value, component, t) => {
    const max = parseSize(component.maxSize ?? component.fileMaxSize);
    if (max != null && isPickedFile(value) && value.size > max) {
      return t('iform.validation.fileSize', 'The file is larger than {{max}}', { max: formatSize(max) });
    }
    return null;
  },
  isEmpty: (value) => value == null,
});
