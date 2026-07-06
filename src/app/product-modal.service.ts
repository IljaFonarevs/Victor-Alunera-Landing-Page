import { Injectable, signal } from '@angular/core';
import { Category, Product } from './catalog';

/**
 * Общее состояние модального окна продукта.
 *
 * Модалка рендерится один раз в корневом компоненте-оболочке (App), а открывать
 * её могут разные страницы: карточки продуктов на главной и рекомендация из
 * «Колеса баланса». Поэтому состояние вынесено в общий сервис.
 */
@Injectable({ providedIn: 'root' })
export class ProductModalService {
  readonly product = signal<Product | null>(null);
  readonly category = signal<Category | null>(null);

  open(product: Product, category: Category): void {
    this.product.set(product);
    this.category.set(category);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.product.set(null);
    this.category.set(null);
    document.body.style.overflow = '';
  }
}
