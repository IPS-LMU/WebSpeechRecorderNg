import { TestBed } from '@angular/core/testing';

import { BundleI18nServiceImpl } from './bundle-i18n-service.service';

describe('BundleI18nService', () => {
  let service: BundleI18nServiceImpl;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BundleI18nServiceImpl);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
