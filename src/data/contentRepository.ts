// src/data/contentRepository.ts
// 教材データ（public/data/*.json）の取得。Service Worker がプリキャッシュするのでオフラインでも読める。
// 取得結果はメモリにも保持し、画面遷移のたびに JSON を再解析しないようにする。
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import {
  catalogSchema,
  manifestSchema,
  unitFileSchema,
  type Catalog,
  type Manifest,
  type Problem,
} from '@/domain/schema';

const BASE = `${import.meta.env.BASE_URL}data/`;

async function fetchJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (e) {
    throw new AppError('教材データを読み込めませんでした。', '通信状態を確認して再読み込みしてください。', { cause: e });
  }
  if (!res.ok) {
    throw new AppError(`教材データの取得に失敗しました（${res.status}）。`, 'アプリを再読み込みしてください。');
  }
  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) {
    throw new AppError('教材データの形式が正しくありません。', 'アプリを最新版に更新してください。', {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

let manifestPromise: Promise<Manifest> | undefined;
let catalogPromise: Promise<Catalog> | undefined;
const unitPromises = new Map<string, Promise<Problem[]>>();

// 失敗した Promise をキャッシュに残すと再試行できなくなるので、失敗時は破棄する
function memo<T>(get: () => Promise<T> | undefined, set: (p: Promise<T> | undefined) => void, load: () => Promise<T>) {
  const existing = get();
  if (existing) return existing;
  const p = load().catch((e: unknown) => {
    set(undefined);
    throw e;
  });
  set(p);
  return p;
}

export function getManifest(): Promise<Manifest> {
  return memo(
    () => manifestPromise,
    (p) => (manifestPromise = p),
    () => fetchJson('manifest.json', manifestSchema),
  );
}

export function getCatalog(): Promise<Catalog> {
  return memo(
    () => catalogPromise,
    (p) => (catalogPromise = p),
    () => fetchJson('catalog.json', catalogSchema),
  );
}

export async function getUnitProblems(unitId: string): Promise<Problem[]> {
  const manifest = await getManifest();
  const entry = manifest.units.find((u) => u.id === unitId);
  if (!entry) throw new AppError(`単元が見つかりません: ${unitId}`);
  return memo(
    () => unitPromises.get(unitId),
    (p) => (p ? unitPromises.set(unitId, p) : unitPromises.delete(unitId)),
    async () => (await fetchJson(entry.path, unitFileSchema)).problems,
  );
}

export async function getAllProblems(): Promise<Problem[]> {
  const manifest = await getManifest();
  const lists = await Promise.all(manifest.units.map((u) => getUnitProblems(u.id)));
  return lists.flat();
}

export async function getProblem(problemId: string): Promise<Problem> {
  const all = await getAllProblems();
  const p = all.find((x) => x.id === problemId);
  if (!p) throw new AppError(`問題が見つかりません: ${problemId}`, '教材が更新され、問題が削除された可能性があります。');
  return p;
}
