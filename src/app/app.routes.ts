import { Routes } from '@angular/router';
import { Home } from './home';
import { Balance } from './balance';

export const routes: Routes = [
  { path: '', component: Home, title: 'Виктор — наставник по четырём сферам жизни' },
  {
    path: 'balance',
    component: Balance,
    title: 'Колесо баланса жизни — диагностика',
  },
  { path: '**', redirectTo: '' },
];
