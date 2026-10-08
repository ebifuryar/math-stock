// src/components/MathText.tsx
import { memo, useMemo } from 'react';
import { renderMarkdownMath } from '@/lib/render';

type Props = { source: string; className?: string; inline?: boolean };

/**
 * Markdown + TeX を描画する。HTML は renderMarkdownMath が生HTML・リンクを無害化したもの。
 * 同じ問題を再表示するたびに KaTeX を走らせないよう memo 化している。
 */
export const MathText = memo(function MathText({ source, className = '', inline = false }: Props) {
  const html = useMemo(() => renderMarkdownMath(source), [source]);
  const Tag = inline ? 'span' : 'div';
  return <Tag className={`math-text ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});
