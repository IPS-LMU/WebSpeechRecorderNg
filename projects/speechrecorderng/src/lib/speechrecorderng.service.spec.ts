import { TestBed } from '@angular/core/testing';

import { SpeechrecorderngService } from './speechrecorderng.service';

describe('SpeechrecorderngService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SpeechrecorderngService = TestBed.get(SpeechrecorderngService);
    expect(service).toBeTruthy();
  });
});
