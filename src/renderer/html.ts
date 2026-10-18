// HTML escaping and safe markup composition for the renderer.
//
// Scope: `esc` is correct for HTML text and for quoted attribute values. It is
// NOT sufficient anywhere else — a URL in href/src (a `javascript:` scheme
// survives escaping untouched), content inside <style>, or anything in a
// script context. None of those exist today: the pages carry no client-side JS
// and their styles are static. If that changes, this is not the tool for it.

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// One pass with a lookup map. Replacing '&' in a separate pass would
// double-escape the entities the other replacements had just inserted.
export const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ENTITIES[char]);

class SafeHtmlValue {
  static unwrap(value: SafeHtmlValue): string {
    return value.#html;
  }

  readonly #html: string;

  constructor(html: string) {
    this.#html = html;
  }
}

export type SafeHtml = SafeHtmlValue;

export const toHtmlString = (safe: SafeHtml): string =>
  SafeHtmlValue.unwrap(safe);

const coerce = (value: unknown, index: number): string => {
  if (value === null || value === undefined) {
    throw new TypeError(`html: interpolation ${index} is ${value}`);
  }

  if (typeof value === 'string') return esc(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`html: interpolation ${index} is ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') {
    throw new TypeError(`html: interpolation ${index} is boolean ${value}`);
  }
  if (value instanceof SafeHtmlValue) return SafeHtmlValue.unwrap(value);
  if (Array.isArray(value)) {
    return value.map((item) => coerce(item, index)).join('');
  }

  const description =
    typeof value === 'object'
      ? Object.prototype.toString.call(value)
      : typeof value;
  throw new TypeError(
    `html: interpolation ${index} is unsupported ${description}`,
  );
};

export const html = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeHtml => {
  let result = strings[0] ?? '';

  for (const [index, value] of values.entries()) {
    result += coerce(value, index + 1);
    result += strings[index + 1] ?? '';
  }

  return new SafeHtmlValue(result);
};
