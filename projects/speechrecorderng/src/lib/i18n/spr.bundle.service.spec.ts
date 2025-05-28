import { TestBed } from '@angular/core/testing';

import { SprBundleService } from './spr.bundle.service';

describe('SprBundleService', () => {
  let service: SprBundleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SprBundleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
