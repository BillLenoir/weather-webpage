// The stylesheet, inlined in one <style> block so a page stays one object with
// one cache policy. One sheet serves both documents: the root index carries
// selectors it never uses, which is cheaper than two sheets that drift.
//
// The CSS is written literally in the template and never interpolated. `esc` is
// right for text and attribute values and wrong for style content — an
// interpolated `[data-period='night']` arrives as `[data-period=&#39;night&#39;]`
// and the rule is silently dead. Nothing here has a value to substitute, so the
// sheet is a constant and the question never comes up.
//
// `data-period` is the only thing that can change a colour: every colour inside
// a section reads a custom property set by the period, and the page frame around
// the sections is fixed. The frame stays light on purpose. A page that inverted
// itself as a whole would have to pick one period for three locations that can
// be in three different ones.
import { html, SafeHtml } from './html';

// Annotated, not inferred: SafeHtmlValue is deliberately unexported, so the
// inferred type has no name the declaration emitter can write and it tries to
// inline the class's private brand instead (TS4094).
export const STYLES: SafeHtml = html`<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0 auto;
    max-width: 32rem;
    padding: 1rem;
    background: #eef1f5;
    color: #1c2128;
    font:
      1rem/1.4 system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.2rem;
  }

  /* A card, and the two tables inside it are flush: the border radius clips
     them, the caption is out of flow, and the only thing between them is a
     rule. They are two tables because their fields don't align, and they read
     as one block because a reader doesn't care why. */
  section {
    overflow: hidden;
    margin-bottom: 0.75rem;
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
  }

  section[data-period='day'] {
    --bg: #d9e8f6;
    --fg: #16242f;
    --muted: #4b5d6b;
    --rule: #bad0e3;
  }

  section[data-period='night'] {
    --bg: #1d2735;
    --fg: #e6edf5;
    --muted: #98a7b8;
    --rule: #33404f;
  }

  /* 0.5rem matches the cells' horizontal padding, so the heading, the observed
     time and the first column all start on the same line. */
  section h2 {
    margin: 0;
    padding: 0.55rem 0.5rem 0;
    font-size: 1rem;
  }

  section p {
    margin: 0;
    padding: 0 0.5rem 0.5rem;
    color: var(--muted);
    font-size: 0.75rem;
  }

  /* Hidden, still the table's accessible name. Every caption on this site is
     hidden, so this is the element and not a class the renderer has to apply.
     Absolute rather than a 1px box: out of flow is what keeps the two tables
     touching. */
  caption {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    padding: 0;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  table + table {
    border-top: 1px solid var(--rule);
  }

  /* Nothing is nowrap. Six columns don't fit a narrow phone at a readable size,
     so the condition label wraps and the table stays inside the viewport. The
     cost is that "14 NW" can break across two lines at the very bottom of the
     range; unbreakable wind would need a class from renderTable, and a column
     that overflows the screen is worse than a wind reading on two lines. */
  th,
  td {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    font-weight: normal;
    text-align: left;
  }

  thead th {
    color: var(--muted);
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  tbody th {
    font-weight: 600;
  }

  tbody tr + tr {
    border-top: 1px solid var(--rule);
  }

  footer {
    color: #5d6873;
    font-size: 0.75rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    margin-top: 0.4rem;
  }

  a {
    color: #1a4f7a;
  }

  /* The one width that doesn't fit: at 320px the six headers plus their padding
     overrun the viewport, and HUMIDITY is a single word that can't wrap to make
     room. Buying back the padding is enough. */
  @media (max-width: 24rem) {
    body {
      padding: 0.5rem;
    }

    th,
    td {
      padding: 0.3rem;
    }
  }
</style>`;
