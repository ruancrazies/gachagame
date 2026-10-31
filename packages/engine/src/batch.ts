import type { GameConfig, Hero } from '@gacha/shared';
import { createRng, type Rng } from './rng';
import { simulate } from './simulate';
import { unitFromHero } from './stats';
import type { GridSlot, TeamInput } from './types';

export interface BatchOptions {
  games: number;
  /** Seed gốc; trận thứ i dùng seed `${seed}:${i}`, nên cùng tham số thì báo cáo giống hệt. */
  seed: string | number;
  level: number;
  star: number;
  teamSize: number;
  /** Chỉ lấy nhân vật thuộc các bậc hiếm này (rỗng hoặc bỏ trống = tất cả). */
  rarities?: string[];
  /** Lệch khỏi 50% quá ngưỡng này thì đánh dấu cảnh báo (0.15 nghĩa là ngoài 35%–65%). */
  tolerance?: number;
}

export interface WinRateRow {
  key: string;
  appearances: number;
  wins: number;
  /** wins / appearances; tính trên các trận có người thắng (bỏ trận hòa). */
  rate: number;
  flagged: boolean;
}

export interface BatchReport {
  options: Required<Omit<BatchOptions, 'rarities'>> & { rarities: string[] };
  games: number;
  winsA: number;
  winsB: number;
  draws: number;
  timeouts: number;
  rounds: { average: number; max: number };
  maxRoundsAllowed: number;
  byElement: WinRateRow[];
  byRole: WinRateRow[];
  byRarity: WinRateRow[];
  byRow: WinRateRow[];
  byHero: WinRateRow[];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function randomTeam(pool: Hero[], size: number, config: GameConfig, opts: BatchOptions, rng: Rng): TeamInput {
  const { rows, cols } = config.rules.battle.grid;
  const cells: GridSlot[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) cells.push({ row, col });
  const heroes = shuffle(pool, rng).slice(0, size);
  const slots = shuffle(cells, rng);
  return heroes.map((hero, i) => unitFromHero(hero, { level: opts.level, star: opts.star, slot: slots[i] as GridSlot }, config));
}

/** Chạy hàng loạt trận ngẫu nhiên (hai đội lấy ngẫu nhiên, đặt vào ô ngẫu nhiên) và gom tỉ lệ thắng theo hệ, vai trò, bậc hiếm, hàng, nhân vật. */
export function runBatch(config: GameConfig, options: BatchOptions): BatchReport {
  const tolerance = options.tolerance ?? 0.15;
  const rarities = options.rarities ?? [];
  const pool = config.heroes.heroes.filter((h) => rarities.length === 0 || rarities.includes(h.rarity));
  if (pool.length < options.teamSize) {
    throw new RangeError(`chỉ có ${pool.length} nhân vật phù hợp, không đủ lập đội ${options.teamSize} người`);
  }
  const maxRounds = config.rules.battle.maxRounds;
  const sampler = createRng(`${options.seed}:teams`);

  type Tally = Map<string, { appearances: number; wins: number }>;
  const tallies: Record<'element' | 'role' | 'rarity' | 'row' | 'hero', Tally> = {
    element: new Map(),
    role: new Map(),
    rarity: new Map(),
    row: new Map(),
    hero: new Map(),
  };
  const heroById = new Map(config.heroes.heroes.map((h) => [h.id, h]));
  const bump = (kind: keyof typeof tallies, key: string, won: boolean) => {
    const t = tallies[kind];
    const cur = t.get(key) ?? { appearances: 0, wins: 0 };
    cur.appearances += 1;
    if (won) cur.wins += 1;
    t.set(key, cur);
  };

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let timeouts = 0;
  let roundSum = 0;
  let roundMax = 0;

  for (let i = 0; i < options.games; i++) {
    const teamA = randomTeam(pool, options.teamSize, config, options, sampler);
    const teamB = randomTeam(pool, options.teamSize, config, options, sampler);
    const result = simulate(teamA, teamB, config, `${options.seed}:${i}`);

    roundSum += result.rounds;
    roundMax = Math.max(roundMax, result.rounds);
    if (result.endReason === 'timeout') timeouts++;
    if (result.winner === 'draw') {
      draws++;
      continue;
    }
    if (result.winner === 'A') winsA++;
    else winsB++;

    const teams = { A: teamA, B: teamB };
    for (const unit of result.initial) {
      const index = Number(unit.id.slice(1)) - 1;
      const input = teams[unit.side][index];
      const hero = heroById.get(unit.heroId);
      if (!input || !hero) continue;
      const won = unit.side === result.winner;
      bump('element', hero.element, won);
      bump('role', hero.role, won);
      bump('rarity', hero.rarity, won);
      bump('row', `hàng ${input.slot.row + 1}`, won);
      bump('hero', hero.id, won);
    }
  }

  const rows = (tally: Tally): WinRateRow[] =>
    [...tally.entries()]
      .map(([key, v]) => {
        const rate = v.appearances > 0 ? v.wins / v.appearances : 0;
        return { key, appearances: v.appearances, wins: v.wins, rate, flagged: Math.abs(rate - 0.5) > tolerance };
      })
      .sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key));

  return {
    options: { ...options, tolerance, rarities },
    games: options.games,
    winsA,
    winsB,
    draws,
    timeouts,
    rounds: { average: options.games > 0 ? roundSum / options.games : 0, max: roundMax },
    maxRoundsAllowed: maxRounds,
    byElement: rows(tallies.element),
    byRole: rows(tallies.role),
    byRarity: rows(tallies.rarity),
    byRow: rows(tallies.row).sort((a, b) => a.key.localeCompare(b.key)),
    byHero: rows(tallies.hero),
  };
}

export function formatBatchReport(report: BatchReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const o = report.options;
  const lines: string[] = [];
  lines.push(
    `Báo cáo mô phỏng: ${report.games} trận, seed "${o.seed}", cấp ${o.level}, ★${o.star}, đội ${o.teamSize} người` +
      (o.rarities.length > 0 ? `, chỉ bậc ${o.rarities.join('/')}` : ''),
  );
  lines.push(
    `Đội A (tấn công) thắng ${pct(report.winsA / report.games)}, đội B (phòng thủ) thắng ${pct(report.winsB / report.games)}, hòa ${report.draws}`,
  );
  lines.push(
    `Số hiệp trung bình ${report.rounds.average.toFixed(1)}, nhiều nhất ${report.rounds.max}/${report.maxRoundsAllowed}; hết hiệp chưa phân thắng bại: ${report.timeouts} trận`,
  );
  const section = (title: string, rows: WinRateRow[]) => {
    lines.push('', `${title} (⚠ nếu lệch quá ${pct(o.tolerance)} khỏi 50%)`);
    for (const r of rows) {
      lines.push(`  ${r.key.padEnd(14)} ${pct(r.rate).padStart(6)}  (${r.wins}/${r.appearances})${r.flagged ? '  ⚠' : ''}`);
    }
  };
  section('Theo hệ', report.byElement);
  section('Theo vai trò', report.byRole);
  section('Theo bậc hiếm', report.byRarity);
  section('Theo hàng trong lưới', report.byRow);
  section('Theo nhân vật', report.byHero);
  return lines.join('\n');
}
