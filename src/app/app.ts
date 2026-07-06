import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CATEGORIES, SOCIAL_LINKS, formatPrice } from './catalog';
import { CheckoutService } from './checkout.service';
import { ProductModalService } from './product-modal.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  host: {
    '[attr.data-theme]': 'theme()',
  },
})
export class App {
  private readonly router = inject(Router);
  protected readonly checkout = inject(CheckoutService);
  protected readonly modal = inject(ProductModalService);

  // ─── Данные для навигации и футера ────────────────────────────────────
  protected readonly categories = CATEGORIES;
  protected readonly socials = SOCIAL_LINKS;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly formatPrice = formatPrice;

  // ─── Тема (тёмная/светлая) ────────────────────────────────────────────
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

  // ─── Мобильное меню ───────────────────────────────────────────────────
  protected readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /**
   * Переход к секции главной страницы. Если мы уже на главной — плавная
   * прокрутка; если на другой странице (например «/balance») — навигация на
   * главную с якорем, дальше сработает anchorScrolling роутера.
   */
  go(id: string): void {
    this.closeMenu();
    if (this.router.url.split(/[?#]/)[0] === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      this.router.navigate(['/'], { fragment: id });
    }
  }
}
