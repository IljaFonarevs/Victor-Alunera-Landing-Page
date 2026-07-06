import {
  Component,
  signal,
  inject,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CATEGORIES,
  SOCIAL_LINKS,
  FEATURED_CONTENT,
  formatPrice,
} from './catalog';
import { CheckoutService, LeadFormData } from './checkout.service';
import { ProductModalService } from './product-modal.service';
import { BalanceStore } from './balance.store';

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
})
export class Home {
  protected readonly checkout = inject(CheckoutService);
  protected readonly modal = inject(ProductModalService);
  protected readonly store = inject(BalanceStore);

  // ─── Контент ──────────────────────────────────────────────────────────
  protected readonly categories = CATEGORIES;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly featured = FEATURED_CONTENT;
  protected readonly formatPrice = formatPrice;

  protected readonly stats = [
    { value: '12+', label: 'лет практики' },
    { value: '40 000', label: 'учеников' },
    { value: '4', label: 'сферы жизни' },
    { value: '4.9', label: 'средняя оценка' },
  ];

  constructor() {
    this.initConstellationParallax();
    this.initScrollReveal();
    this.initContactSpotlight();
  }

  // ─── Навигация по секциям страницы ────────────────────────────────────
  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  // ─── Колесо баланса на главной (после прохождения теста) ───────────────
  openRecommended(): void {
    this.modal.open(this.store.recommendedProduct(), this.store.weakestCategory());
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

  // ─── Параллакс созвездий: звёзды постоянно тянутся к курсору ───────────
  private initConstellationParallax(): void {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const pointer = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const current = new WeakMap<HTMLElement, { x: number; y: number }>();

      const onMove = (e: PointerEvent) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      // Портрет в герое наклоняется вслед за курсором (3D-параллакс)
      const portrait = document.querySelector<HTMLElement>('.hero__portrait');
      const portraitState = { x: 0, y: 0 };

      let rafId = 0;
      const tick = () => {
        const wraps = document.querySelectorAll<HTMLElement>('.constellation-wrap');
        wraps.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;

          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // целевое смещение -1…1 относительно центра созвездия
          const tx = Math.max(-1, Math.min(1, (pointer.x - cx) / (window.innerWidth / 2)));
          const ty = Math.max(-1, Math.min(1, (pointer.y - cy) / (window.innerHeight / 2)));

          const s = current.get(el) ?? { x: 0, y: 0 };
          // плавная интерполяция к цели — всегда в движении
          s.x += (tx - s.x) * 0.18;
          s.y += (ty - s.y) * 0.18;
          current.set(el, s);

          el.style.setProperty('--mx', s.x.toFixed(4));
          el.style.setProperty('--my', s.y.toFixed(4));
        });

        // Наклон портрета относительно центра экрана
        if (portrait) {
          const r = portrait.getBoundingClientRect();
          if (r.bottom > 0 && r.top < window.innerHeight) {
            const tx = Math.max(-1, Math.min(1, (pointer.x - window.innerWidth / 2) / (window.innerWidth / 2)));
            const ty = Math.max(-1, Math.min(1, (pointer.y - window.innerHeight / 2) / (window.innerHeight / 2)));
            portraitState.x += (tx - portraitState.x) * 0.12;
            portraitState.y += (ty - portraitState.y) * 0.12;
            portrait.style.setProperty('--px', portraitState.x.toFixed(4));
            portrait.style.setProperty('--py', portraitState.y.toFixed(4));
          }
        }

        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      destroyRef.onDestroy(() => {
        window.removeEventListener('pointermove', onMove);
        cancelAnimationFrame(rafId);
      });
    });
  }

  /**
   * Плавное появление элементов с классом `.reveal` при попадании во вьюпорт.
   */
  private initScrollReveal(): void {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const targets = document.querySelectorAll<HTMLElement>('.reveal');
      if (targets.length === 0) return;

      if (typeof IntersectionObserver === 'undefined') {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.2 },
      );

      targets.forEach((el) => observer.observe(el));
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /**
   * Интерактивный «прожектор» на портрете в контактах: цвет проявляется
   * круглой маской в точке курсора. Позиция передаётся в CSS через --sx/--sy.
   */
  private initContactSpotlight(): void {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const fig = document.querySelector<HTMLElement>('.contact__portrait');
      if (!fig) return;

      const onMove = (e: PointerEvent) => {
        const r = fig.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        fig.style.setProperty('--sx', `${x.toFixed(2)}%`);
        fig.style.setProperty('--sy', `${y.toFixed(2)}%`);
      };

      fig.addEventListener('pointermove', onMove, { passive: true });
      destroyRef.onDestroy(() => fig.removeEventListener('pointermove', onMove));
    });
  }
}
