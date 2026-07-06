import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Home } from './home';
import { Balance } from './balance';
import { BalanceStore } from './balance.store';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand and footer chrome', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.nav__name')?.textContent).toContain('Виктор');
    expect(compiled.querySelector('.footer')).toBeTruthy();
  });
});

describe('Home page', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the hero title', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Виктор');
  });

  it('should render four life-sphere sections and the balance CTA', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#mental')).toBeTruthy();
    expect(compiled.querySelector('#family')).toBeTruthy();
    expect(compiled.querySelector('#financial')).toBeTruthy();
    expect(compiled.querySelector('#physical')).toBeTruthy();
    expect(compiled.querySelector('#balance')).toBeTruthy();
  });
});

describe('Balance questionnaire page', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Balance],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should start with the questionnaire, not the wheel', async () => {
    const fixture = TestBed.createComponent(Balance);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.quiz')).toBeTruthy();
    // колесо и ручная настройка недоступны до завершения теста
    expect(compiled.querySelector('.radar__shape')).toBeFalsy();
    expect(compiled.querySelector('.sliders')).toBeFalsy();
  });

  it('should ask for the name first and a birth date in the middle', async () => {
    const fixture = TestBed.createComponent(Balance);
    const comp = fixture.componentInstance as any;
    await fixture.whenStable();

    // первый шаг — имя
    expect(comp.currentStep().kind).toBe('name');
    // дата рождения — где-то в середине, не первый и не последний шаг
    const dateIndex = comp.steps.findIndex((s: any) => s.kind === 'date');
    expect(dateIndex).toBeGreaterThan(0);
    expect(dateIndex).toBeLessThan(comp.steps.length - 1);
  });

  it('should build the wheel, numerology and unlock editing after completion', async () => {
    const fixture = TestBed.createComponent(Balance);
    const comp = fixture.componentInstance as any;
    await fixture.whenStable();

    // проходим все шаги согласно их типу
    for (let i = 0; i < comp.steps.length; i++) {
      const kind = comp.currentStep().kind;
      if (kind === 'name') {
        comp.name.set('Виктор');
        comp.advance();
      } else if (kind === 'date') {
        comp.birthDate.set('1990-05-15');
        comp.advance();
      } else {
        comp.answer(5);
      }
      fixture.detectChanges();
    }
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(comp.store.completed()).toBe(true);
    expect(comp.store.name()).toBe('Виктор');
    expect(compiled.querySelector('.radar__shape')).toBeTruthy();
    expect(compiled.querySelector('.sliders')).toBeTruthy();
    // все ответы «5» → максимальная гармония
    expect(comp.store.harmonyScore()).toBe(100);
    // нумерология рассчитана и показана
    expect(comp.store.numerology()).toBeTruthy();
    expect(compiled.querySelector('.numero')).toBeTruthy();
    expect(comp.store.numerologyInsight()).toBeTruthy();
  });
});

describe('Home balance wheel gating', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('shows the invitation before completion and the interactive wheel after', async () => {
    const store = TestBed.inject(BalanceStore);

    const before = TestBed.createComponent(Home);
    await before.whenStable();
    // до прохождения теста интерактивных ползунков нет
    expect((before.nativeElement as HTMLElement).querySelector('.slider input')).toBeFalsy();

    // тест пройден → колесо становится интерактивным
    store.setResult(
      { mental: 7, family: 4, financial: 8, physical: 5 },
      { name: 'Виктор', birthDate: '1990-05-15' },
    );

    const after = TestBed.createComponent(Home);
    after.detectChanges();
    await after.whenStable();
    const el = after.nativeElement as HTMLElement;
    expect(el.querySelector('.radar__shape')).toBeTruthy();
    expect(el.querySelectorAll('.slider input').length).toBe(4);
    // краткая нумерология присутствует на главной
    expect(el.querySelector('.numero-mini')).toBeTruthy();
  });
});
