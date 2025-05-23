import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BundleI18nComponent } from './bundle-i18n.component';

describe('BundleI18nComponent', () => {
  let component: BundleI18nComponent;
  let fixture: ComponentFixture<BundleI18nComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BundleI18nComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BundleI18nComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
