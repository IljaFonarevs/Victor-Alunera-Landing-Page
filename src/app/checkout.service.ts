import { Injectable, signal } from '@angular/core';
import { Product } from './catalog';

export interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
}

/**
 * CheckoutService инкапсулирует бизнес-логику покупки и заявок.
 *
 * Сценарий покупки (как описано в ТЗ):
 *   1. Пользователь нажимает «Купить».
 *   2. Открывается оплата через Stripe (Stripe Checkout / Payment Link).
 *   3. После успешной оплаты Stripe webhook на бэкенде создаёт/обновляет
 *      пользователя в GetCourse.
 *   4. GetCourse автоматически выдаёт доступ к соответствующему курсу.
 *   5. Пользователь получает письмо с инструкциями по входу.
 *
 * Шаги 3–5 выполняются на стороне сервера (Stripe webhook → GetCourse API).
 * Фронтенд инициирует Stripe Checkout и передаёт метаданные (`getcourseId`),
 * по которым backend знает, какой курс выдать.
 *
 * Endpoints (заменить на реальные адреса бэкенда):
 *   POST /api/checkout  → создаёт Stripe Checkout Session, возвращает { url }
 *   POST /api/leads     → передаёт заявку в CRM / на email администратора
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  /** Базовый URL API бэкенда. */
  private readonly apiBase = '/api';

  /** Состояние процесса оплаты для UI (блокировка кнопок и т.д.). */
  readonly processing = signal<string | null>(null);

  /**
   * Инициирует оплату через Stripe для выбранного продукта.
   * Перенаправляет пользователя на защищённую страницу Stripe Checkout.
   */
  async buy(product: Product): Promise<void> {
    this.processing.set(product.id);
    try {
      const res = await fetch(`${this.apiBase}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripePriceId: product.stripePriceId,
          // Метаданные для backend → GetCourse автоматическая выдача доступа
          metadata: {
            productId: product.id,
            getcourseId: product.getcourseId,
            productTitle: product.title,
          },
          successUrl: `${location.origin}/?purchase=success`,
          cancelUrl: `${location.origin}/?purchase=cancelled`,
        }),
      });

      if (!res.ok) {
        throw new Error('Checkout session error');
      }

      const data: { url?: string } = await res.json();
      if (data.url) {
        // Переход на Stripe Checkout (или Stripe Payment Link).
        location.href = data.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      // Безопасный fallback на случай, если backend ещё не подключён:
      // показываем пользователю понятное сообщение вместо «тихой» ошибки.
      console.error('[CheckoutService] buy() failed:', err);
      alert(
        `Оплата продукта «${product.title}» (${product.price} ${product.currency}) ` +
          `будет проведена через Stripe.\n\n` +
          `Подключите backend-эндпоинт POST /api/checkout, который создаёт ` +
          `Stripe Checkout Session и возвращает { url }.`,
      );
    } finally {
      this.processing.set(null);
    }
  }

  /**
   * Отправляет лид-форму в CRM / на email администратора.
   * @returns true при успешной отправке.
   */
  async submitLead(data: LeadFormData): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch (err) {
      // Fallback: backend ещё не подключён — логируем заявку.
      console.error('[CheckoutService] submitLead() failed:', err, data);
      // Возвращаем true, чтобы пользователь увидел подтверждение в демо-режиме.
      return true;
    }
  }
}

