// tests/unit/scratch.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { exportBackup, getScratch, importBackup, resetAllProgress, saveScratch } from '@/data/progressRepository';
import { isBlankPages, type ScratchPage } from '@/domain/scratch';

const pen: ScratchPage = [{ tool: 'pen', color: '#0f172a', width: 0.006, points: [0.1, 0.1, 0.2, 0.3] }];
const eraser: ScratchPage = [{ tool: 'eraser', color: '#000000', width: 0.05, points: [0.1, 0.1] }];

beforeEach(async () => {
  await resetAllProgress();
});

describe('計算メモ', () => {
  it('問題ごとに保存して読み出せる', async () => {
    await saveScratch('p1', [pen, []]);
    expect(await getScratch('p1')).toEqual([pen, []]);
    expect(await getScratch('p2')).toBeUndefined();
  });

  it('何も書かれていないメモは保存せず、既存のメモも消す', async () => {
    await saveScratch('p1', [pen]);
    await saveScratch('p1', [[], eraser]);
    expect(await db.scratchpads.count()).toBe(0);
  });

  it('消しゴムだけのページは空とみなす', () => {
    expect(isBlankPages([[], eraser])).toBe(true);
    expect(isBlankPages([eraser, pen])).toBe(false);
  });

  it('バックアップに含まれ、読み込みで復元される', async () => {
    await saveScratch('p1', [pen]);
    const blob = await exportBackup();
    await resetAllProgress();
    expect(await getScratch('p1')).toBeUndefined();
    await importBackup(new File([await blob.text()], 'backup.json'));
    expect(await getScratch('p1')).toEqual([pen]);
    expect((await db.scratchpads.get('p1'))?.updatedAt).toBeInstanceOf(Date);
  });

  it('計算メモの無い古いバックアップも読み込める', async () => {
    const blob = await exportBackup();
    const old = JSON.parse(await blob.text()) as Record<string, unknown>;
    delete old.scratchpads;
    await expect(importBackup(new File([JSON.stringify(old)], 'old.json'))).resolves.toEqual({ attempts: 0 });
  });
});
