// tests/unit/render.test.ts
import { describe, expect, it } from 'vitest';
import { renderMarkdownMath } from '@/lib/render';

describe('renderMarkdownMath', () => {
  it('インライン数式とディスプレイ数式を描画する', () => {
    const html = renderMarkdownMath('関数 $y=x^2$ は\n\n$$a_1+b_2$$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
  });
  it('数式中の _ や * を Markdown の強調と誤解釈しない', () => {
    const html = renderMarkdownMath('$a_1 * b_2$ と $c_3$');
    expect(html).not.toContain('<em>');
  });
  it('生HTMLとリンクを無害化する', () => {
    const html = renderMarkdownMath('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href=');
  });
  it('strict では TeX の構文エラーを例外にする', () => {
    expect(() => renderMarkdownMath('$\\frac{1$', { strict: true })).toThrow();
  });
});
