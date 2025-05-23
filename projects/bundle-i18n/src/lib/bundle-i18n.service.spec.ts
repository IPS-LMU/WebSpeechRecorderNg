import { TestBed } from '@angular/core/testing';

import { BundleI18nService } from './bundle-i18n.service';

describe('BundleI18nService', () => {
  let service: BundleI18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BundleI18nService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
