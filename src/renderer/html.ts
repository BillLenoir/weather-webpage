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

export const html = (
  strings: TemplateStringsArray,
  ...values: unknown[]
): SafeHtml => {
  let result = strings[0] ?? '';

  for (const [index, value] of values.entries()) {
    if (value === null || value === undefined) {
      throw new TypeError('HTML interpolation cannot be null or undefined');
    }

    result +=
      value instanceof SafeHtmlValue
        ? SafeHtmlValue.unwrap(value)
        : esc(String(value));
    result += strings[index + 1] ?? '';
  }

  return new SafeHtmlValue(result);
};
