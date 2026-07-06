import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CATEGORIES, Category, CategoryId, formatPrice } from './catalog';
import { ProductModalService } from './product-modal.service';
import { BalanceStore } from './balance.store';
import { computeLifePath } from './numerology';

interface Question {
  id: string;
  category: CategoryId;
  text: string;
}

interface ScaleOption {
  value: number;
  label: string;
}

type QuizStep =
  | { kind: 'name' }
  | { kind: 'date' }
  | { kind: 'scale'; q: Question };

/**
 * Опросник основан на методике «Колесо жизни» (Wheel of Life): человек
 * оценивает удовлетворённость в четырёх сферах по шкале, после чего строится
 * колесо баланса. В начале спрашиваем имя, в середине — дату рождения (для
 * нумерологического разбора). По два утверждения на каждую сферу (8 вопросов).
 */
const QUESTIONS: Question[] = [
  { id: 'm1', category: 'mental', text: 'Я чувствую спокойствие и ясность ума большую часть дня.' },
  { id: 'fa1', category: 'family', text: 'Я доволен(льна) отношениями с близкими и временем, которое провожу с ними.' },
  { id: 'fi1', category: 'financial', text: 'Мой доход даёт мне ощущение финансовой уверенности.' },
  { id: 'p1', category: 'physical', text: 'У меня достаточно энергии на протяжении всего дня.' },
  { id: 'm2', category: 'mental', text: 'Я умею справляться со стрессом и восстанавливать внутренние силы.' },
  { id: 'fa2', category: 'family', text: 'В моих близких отношениях есть доверие, тепло и взаимная поддержка.' },
  { id: 'fi2', category: 'financial', text: 'Я контролирую свои расходы и спокоен(йна) за завтрашний день.' },
  { id: 'p2', category: 'physical', text: 'Я забочусь о теле: сон, питание и движение находятся в балансе.' },
];

// Имя — в начале, дата рождения — в середине (после четырёх вопросов).
const STEPS: QuizStep[] = [
  { kind: 'name' },
  { kind: 'scale', q: QUESTIONS[0] },
  { kind: 'scale', q: QUESTIONS[1] },
  { kind: 'scale', q: QUESTIONS[2] },
  { kind: 'scale', q: QUESTIONS[3] },
  { kind: 'date' },
  { kind: 'scale', q: QUESTIONS[4] },
  { kind: 'scale', q: QUESTIONS[5] },
  { kind: 'scale', q: QUESTIONS[6] },
  { kind: 'scale', q: QUESTIONS[7] },
];

const SCALE: ScaleOption[] = [
  { value: 1, label: 'Совсем нет' },
  { value: 2, label: 'Скорее нет' },
  { value: 3, label: 'Отчасти' },
  { value: 4, label: 'Скорее да' },
  { value: 5, label: 'Да, полностью' },
];

@Component({
  selector: 'app-balance',
  imports: [FormsModule, RouterLink],
  templateUrl: './balance.html',
})
export class Balance {
  protected readonly modal = inject(ProductModalService);
  protected readonly store = inject(BalanceStore);

  protected readonly categories = CATEGORIES;
  protected readonly scale = SCALE;
  protected readonly steps = STEPS;
  protected readonly totalSteps = STEPS.length;
  protected readonly formatPrice = formatPrice;
  protected readonly maxDate = this.todayIso();

  // ─── Состояние опросника ──────────────────────────────────────────────
  protected readonly phase = signal<'quiz' | 'result'>(
    this.store.completed() ? 'result' : 'quiz',
  );
  protected readonly step = signal(0);
  protected readonly answers = signal<Record<string, number>>({});
  protected readonly name = signal('');
  protected readonly birthDate = signal('');

  protected readonly currentStep = computed<QuizStep>(() => this.steps[this.step()]);
  protected readonly currentScale = computed<Question | null>(() => {
    const s = this.currentStep();
    return s.kind === 'scale' ? s.q : null;
  });
  protected readonly currentCategory = computed<Category | null>(() => {
    const q = this.currentScale();
    return q ? this.categories.find((c) => c.id === q.category)! : null;
  });
  protected readonly currentAnswer = computed<number | null>(() => {
    const q = this.currentScale();
    return q ? this.answers()[q.id] ?? null : null;
  });

  protected readonly canAdvance = computed<boolean>(() => {
    const s = this.currentStep();
    if (s.kind === 'name') return this.name().trim().length > 0;
    if (s.kind === 'date') return computeLifePath(this.birthDate()) != null;
    return this.currentAnswer() != null;
  });

  protected readonly answeredCount = computed(() => {
    let c = 0;
    if (this.name().trim()) c++;
    if (computeLifePath(this.birthDate()) != null) c++;
    c += QUESTIONS.filter((q) => this.answers()[q.id] != null).length;
    return c;
  });
  protected readonly progressPct = computed(() =>
    Math.round((this.answeredCount() / this.totalSteps) * 100),
  );

  // ─── Логика прохождения ───────────────────────────────────────────────
  answer(value: number): void {
    const s = this.steps[this.step()];
    if (s.kind !== 'scale') return;
    this.answers.update((a) => ({ ...a, [s.q.id]: value }));
    this.advance();
  }

  advance(): void {
    if (!this.canAdvance()) return;
    if (this.step() < this.totalSteps - 1) {
      this.step.update((n) => n + 1);
    } else {
      this.finish();
    }
  }

  back(): void {
    if (this.step() > 0) this.step.update((n) => n - 1);
  }

  restart(): void {
    this.answers.set({});
    this.name.set('');
    this.birthDate.set('');
    this.step.set(0);
    this.store.reset();
    this.phase.set('quiz');
  }

  private finish(): void {
    this.store.setResult(this.computeBalance(), {
      name: this.name().trim(),
      birthDate: this.birthDate(),
    });
    this.phase.set('result');
  }

  /** Переводит ответы (1–5 по сферам) в значения колеса (1–10). */
  private computeBalance(): Record<CategoryId, number> {
    const acc: Record<CategoryId, { sum: number; n: number }> = {
      mental: { sum: 0, n: 0 },
      family: { sum: 0, n: 0 },
      financial: { sum: 0, n: 0 },
      physical: { sum: 0, n: 0 },
    };
    for (const q of QUESTIONS) {
      const v = this.answers()[q.id] ?? 3;
      acc[q.category].sum += v;
      acc[q.category].n += 1;
    }
    const next = {} as Record<CategoryId, number>;
    for (const c of this.categories) {
      const { sum, n } = acc[c.id];
      const avg = n ? sum / n : 3; // 1..5
      next[c.id] = Math.min(10, Math.max(1, Math.round(((avg - 1) / 4) * 9 + 1)));
    }
    return next;
  }

  openRecommended(): void {
    this.modal.open(this.store.recommendedProduct(), this.store.weakestCategory());
  }

  private todayIso(): string {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return '2100-01-01';
    }
  }
}
