import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CATEGORIES,
  SOCIAL_LINKS,
  FEATURED_CONTENT,
  Category,
  CategoryId,
  Product,
} from './catalog';
import { CheckoutService, LeadFormData } from './checkout.service';

interface BalanceScore {
  id: CategoryId;
  value: number;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[attr.data-theme]': 'theme()',
  },
})
export class App {
  protected readonly checkout = inject(CheckoutService);

  // ─── Контент ──────────────────────────────────────────────────────────
  protected readonly categories = CATEGORIES;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly featured = FEATURED_CONTENT;

  protected readonly stats = [
    { value: '12+', label: 'лет практики' },
    { value: '40 000', label: 'учеников' },
    { value: '4', label: 'сферы жизни' },
    { value: '4.9', label: 'средняя оценка' },
  ];

  protected readonly currentYear = new Date().getFullYear();

  // ─── Тема (уникальная фича №1: тёмная/светлая) ─────────────────────────
  protected readonly theme = signal<'light' | 'dark'>(this.readInitialTheme());

  private readInitialTheme(): 'light' | 'dark' {
    try {
      const saved = localStorage.getItem('viktor-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      const prefersDark =
        typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    try {
      localStorage.setItem('viktor-theme', next);
    } catch {
      /* localStorage недоступен — игнорируем */
    }
  }

  // ─── Навигация ────────────────────────────────────────────────────────
  protected readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  scrollTo(id: string): void {
    this.closeMenu();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  // ─── Модальное окно продукта ──────────────────────────────────────────
  protected readonly activeProduct = signal<Product | null>(null);
  protected readonly activeCategory = signal<Category | null>(null);

  openProduct(product: Product, category: Category): void {
    this.activeProduct.set(product);
    this.activeCategory.set(category);
    document.body.style.overflow = 'hidden';
  }

  closeProduct(): void {
    this.activeProduct.set(null);
    this.activeCategory.set(null);
    document.body.style.overflow = '';
  }

  buyActiveProduct(): void {
    const product = this.activeProduct();
    if (product) {
      this.checkout.buy(product);
    }
  }

  // ─── Уникальная фича №2: интерактивное «Колесо баланса» ────────────────
  // Пользователь оценивает 4 сферы (1–10), видит живой SVG-график и получает
  // персональную рекомендацию продукта из самой «проседающей» сферы.
  protected readonly balance = signal<Record<CategoryId, number>>({
    mental: 6,
    family: 5,
    financial: 4,
    physical: 7,
  });

  setBalance(id: CategoryId, value: number): void {
    this.balance.update((b) => ({ ...b, [id]: Number(value) }));
  }

  /** Отсортированные значения сфер. */
  protected readonly balanceScores = computed<BalanceScore[]>(() =>
    this.categories.map((c) => ({ id: c.id, value: this.balance()[c.id] })),
  );

  /** Самая слабая сфера — для рекомендации. */
  protected readonly weakestCategory = computed<Category>(() => {
    const b = this.balance();
    let weakest = this.categories[0];
    for (const c of this.categories) {
      if (b[c.id] < b[weakest.id]) weakest = c;
    }
    return weakest;
  });

  /** Рекомендованный продукт: продукт с бейджем или самый доступный. */
  protected readonly recommendedProduct = computed<Product>(() => {
    const cat = this.weakestCategory();
    const withBadge = cat.products.find((p) => p.badge);
    if (withBadge) return withBadge;
    return [...cat.products].sort((a, b) => a.price - b.price)[0];
  });

  /** Средний балл гармонии (для подписи). */
  protected readonly harmonyScore = computed<number>(() => {
    const vals = Object.values(this.balance());
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return Math.round(avg * 10);
  });

  /**
   * Координаты вершин радар-графика (4 оси по сторонам света).
   * Возвращает строку points для <polygon>. Центр 100,100, радиус до 80.
   */
  protected readonly radarPoints = computed<string>(() => {
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

  openRecommended(): void {
    const cat = this.weakestCategory();
    const product = this.recommendedProduct();
    this.openProduct(product, cat);
  }

  // ─── Лид-форма ────────────────────────────────────────────────────────
  protected readonly lead = signal<LeadFormData>({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  protected readonly leadSent = signal(false);
  protected readonly leadSending = signal(false);

  async submitLead(): Promise<void> {
    this.leadSending.set(true);
    const ok = await this.checkout.submitLead(this.lead());
    this.leadSending.set(false);
    if (ok) {
      this.leadSent.set(true);
      this.lead.set({ name: '', email: '', phone: '', message: '' });
    }
  }

  // ─── Утилиты ──────────────────────────────────────────────────────────
  formatPrice(product: Product): string {
    const symbol = product.currency === 'USD' ? '$' : product.currency;
    return `${product.price} ${symbol}`;
  }
}
