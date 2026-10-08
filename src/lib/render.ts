// src/lib/render.ts
// Markdown + TeX を HTML に変換する。
// 問題データはビルド時にこの関数で事前レンダリングし、端末では KaTeX の再計算を不要にする
// （スマホでの表示速度を優先）。AI採点のフィードバックなど実行時の文字列にも同じ関数を使う。
import katex from 'katex';
import { Marked } from 'marked';

const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    // 生HTMLは出力しない。外部（AI応答）由来の文字列でもスクリプト注入を起こさないため。
    html: ({ text }) => escapeHtml(text),
    // 教材にリンクや外部画像は不要。javascript: URL などを持ち込ませないよう文字列だけ残す。
    link: ({ text }) => escapeHtml(text),
    image: ({ text }) => escapeHtml(text),
  },
});

// marked は NUL 文字を置換してしまうため、Markdown 記法と衝突しない英字列を使う
const PLACEHOLDER = (i: number) => `KTXMATH${i}KTXEND`;

export class RenderError extends Error {}

/**
 * `$$...$$`（ディスプレイ）と `$...$`（インライン）を先に KaTeX で描画してプレースホルダに退避し、
 * 残りを Markdown として処理してから戻す。Markdown 側が `_` や `*` を強調と誤解釈するのを防ぐため。
 * strict=true のときは TeX の構文エラーで例外を投げる（ビルド時の検査用）。
 */
export function renderMarkdownMath(source: string, options: { strict?: boolean } = {}): string {
  const rendered: string[] = [];
  const renderTex = (tex: string, displayMode: boolean) => {
    try {
      const html = katex.renderToString(tex, {
        displayMode,
        throwOnError: options.strict ?? false,
        strict: 'ignore',
        output: 'html',
      });
      rendered.push(html);
    } catch (e) {
      throw new RenderError(`TeX の構文エラー: ${tex}\n${(e as Error).message}`);
    }
    return PLACEHOLDER(rendered.length - 1);
  };

  const withPlaceholders = source
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `\n\n${renderTex(tex.trim(), true)}\n\n`)
    .replace(/(?<![\\$])\$([^$\n]+?)\$/g, (_, tex: string) => renderTex(tex.trim(), false));

  const html = marked.parse(withPlaceholders) as string;
  return html.replace(/KTXMATH(\d+)KTXEND/g, (_, i: string) => rendered[Number(i)] ?? '');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
