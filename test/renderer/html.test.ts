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

  it.each([null, undefined])('rejects a %s interpolation', (value) => {
    expect(() => html`<p>${value}</p>`).toThrow(
      'HTML interpolation cannot be null or undefined',
    );
  });
});
