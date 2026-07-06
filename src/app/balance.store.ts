import { Injectable, computed, effect, signal } from '@angular/core';
import { CATEGORIES, Category, CategoryId, Product } from './catalog';
import { getLifePath, LifePath } from './numerology';

interface StoredState {
  balance: Record<CategoryId, number>;
  completed: boolean;
  name: string;
  birthDate: string;
}

export interface NumerologyInsight {
  path: LifePath;
  sphere: Category;
  score: number;
  level: 'high' | 'mid' | 'low';
  message: string;
}

const STORAGE_KEY = 'viktor-balance';

const DEFAULT_BALANCE: Record<CategoryId, number> = {
  mental: 5,
  family: 5,
  financial: 5,
  physical: 5,
};

/**
 * Единый источник состояния «Колеса баланса».
 *
 * Хранит оценки по четырём сферам и флаг завершения теста. Состояние
 * сохраняется в localStorage, поэтому и страница-опросник, и колесо на главной
 * работают с одними и теми же данными и переживают перезагрузку страницы.
 */
@Injectable({ providedIn: 'root' })
export class BalanceStore {
  private readonly categories = CATEGORIES;

  readonly balance = signal<Record<CategoryId, number>>({ ...DEFAULT_BALANCE });
  /** Тест пройден — только после этого колесо становится интерактивным. */
  readonly completed = signal(false);
  /** Имя пользователя из опросника. */
  readonly name = signal('');
  /** Дата рождения (ISO YYYY-MM-DD) для нумерологического разбора. */
  readonly birthDate = signal('');

  constructor() {
    this.restore();
    // Автосохранение при любом изменении.
    effect(() => {
      const payload: StoredState = {
        balance: this.balance(),
        completed: this.completed(),
        name: this.name(),
        birthDate: this.birthDate(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* localStorage недоступен — игнорируем */
      }
    });
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<StoredState>;
      if (data.balance) {
        const next = { ...DEFAULT_BALANCE };
        for (const c of this.categories) {
          const v = data.balance[c.id];
          if (typeof v === 'number') next[c.id] = Math.min(10, Math.max(1, v));
        }
        this.balance.set(next);
      }
      if (data.completed) this.completed.set(true);
      if (typeof data.name === 'string') this.name.set(data.name);
      if (typeof data.birthDate === 'string') this.birthDate.set(data.birthDate);
    } catch {
      /* повреждённые данные — начинаем с чистого листа */
    }
  }

  setBalance(id: CategoryId, value: number): void {
    this.balance.update((b) => ({ ...b, [id]: Number(value) }));
  }

  /** Записывает результат опросника и открывает ручное редактирование. */
  setResult(
    balance: Record<CategoryId, number>,
    meta: { name: string; birthDate: string },
  ): void {
    this.balance.set({ ...balance });
    this.name.set(meta.name);
    this.birthDate.set(meta.birthDate);
    this.completed.set(true);
  }

  reset(): void {
    this.balance.set({ ...DEFAULT_BALANCE });
    this.name.set('');
    this.birthDate.set('');
    this.completed.set(false);
  }

  // ─── Производные значения колеса ──────────────────────────────────────
  readonly weakestCategory = computed<Category>(() => {
    const b = this.balance();
    let weakest = this.categories[0];
    for (const c of this.categories) {
      if (b[c.id] < b[weakest.id]) weakest = c;
    }
    return weakest;
  });

  readonly recommendedProduct = computed<Product>(() => {
    const cat = this.weakestCategory();
    const withBadge = cat.products.find((p) => p.badge);
    if (withBadge) return withBadge;
    return [...cat.products].sort((a, b) => a.price - b.price)[0];
  });

  readonly harmonyScore = computed<number>(() => {
    const vals = Object.values(this.balance());
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return Math.round(avg * 10);
  });

  /** Координаты вершин радар-графика. Центр 100,100, радиус до 80. */
  readonly radarPoints = computed<string>(() => {
    const b = this.balance();
    const order: CategoryId[] = ['mental', 'financial', 'physical', 'family'];
    const angles = [-90, 0, 90, 180]; // верх, право, низ, лево
    const cx = 100;
    const cy = 100;
    const maxR = 80;
    return order
      .map((id, i) => {
        const r = (b[id] / 10) * maxR;
        const rad = (angles[i] * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  // ─── Нумерология и её связь с колесом ─────────────────────────────────
  /** Число жизненного пути по дате рождения. */
  readonly numerology = computed<LifePath | null>(() => getLifePath(this.birthDate()));

  /**
   * Связь нумерологии с колесом баланса: сопоставляет «природную» сферу числа
   * с тем, насколько она развита на колесе.
   */
  readonly numerologyInsight = computed<NumerologyInsight | null>(() => {
    const path = this.numerology();
    if (!path) return null;
    const sphere = this.categories.find((c) => c.id === path.sphere)!;
    const score = this.balance()[path.sphere];

    let level: NumerologyInsight['level'];
    let message: string;
    if (score >= 7) {
      level = 'high';
      message =
        `Ваша природная сила — «${sphere.title}», и на колесе она развита (${score}/10). ` +
        `Вы живёте в согласии со своей природой — опирайтесь на это как на фундамент.`;
    } else if (score <= 4) {
      level = 'low';
      message =
        `Ваша природная сила — «${sphere.title}», но на колесе это пока самая тихая струна (${score}/10). ` +
        `Именно здесь скрыт ваш нераскрытый потенциал — начните с неё.`;
    } else {
      level = 'mid';
      message =
        `Ваша природная сила — «${sphere.title}» (${score}/10). ` +
        `Есть куда расти — эта сфера откликнется быстрее других.`;
    }
    return { path, sphere, score, level, message };
  });
}
