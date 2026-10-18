import { esc, html, toHtmlString } from '../../src/renderer/html';

describe('esc', () => {
  it.each<[string, string]>([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapes %s', (input, expected) => {
    expect(esc(input)).toBe(expected);
  });

  it('escapes every special character in one string', () => {
    expect(esc(`Tom & "Jerry" <it's>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;it&#39;s&gt;',
    );
  });

  it('leaves a string with nothing to escape unchanged', () => {
    expect(esc('Centreville, VA — 72° Mon')).toBe('Centreville, VA — 72° Mon');
  });

  it('neutralizes a script tag', () => {
    expect(esc('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  // The ordering trap: a separate pass for '&' would leave this as '&lt;'.
  it('escapes an ampersand that is already part of an entity', () => {
    expect(esc('&lt;')).toBe('&amp;lt;');
  });
});

describe('html', () => {
  it('escapes interpolated values and preserves template markup', () => {
    const result = html`<p>${'<unsafe>'}</p>`;

    expect(toHtmlString(result)).toBe('<p>&lt;unsafe&gt;</p>');
  });

  it('passes nested safe markup through without escaping it again', () => {
    const inner = html`<strong>${'<&'}</strong>`;
    const outer = html`<div>${inner}</div>`;

    expect(toHtmlString(outer)).toBe('<div><strong>&lt;&amp;</strong></div>');
  });

  it('converts finite numbers and joins arrays without separators', () => {
    const result = html`${12}${['<a>', 3, html`<b>ok</b>`]}`;

    expect(toHtmlString(result)).toBe('12&lt;a&gt;3<b>ok</b>');
  });

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [false, 'boolean false'],
    [true, 'boolean true'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
    [Number.NEGATIVE_INFINITY, '-Infinity'],
  ])('rejects %s with its interpolation index', (value, description) => {
    expect(() => html`${'first'} ${value}`).toThrow(
      `html: interpolation 2 is ${description}`,
    );
  });

  it('reports the top-level interpolation index for invalid array items', () => {
    expect(() => html`${'first'} ${['ok', false]}`).toThrow(
      'html: interpolation 2 is boolean false',
    );
  });
});
