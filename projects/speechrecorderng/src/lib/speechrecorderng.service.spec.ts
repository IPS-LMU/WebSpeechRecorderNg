import { TestBed } from '@angular/core/testing';

import { SpeechrecorderngService } from './speechrecorderng.service';

import {describe,beforeEach,it,expect} from "vitest";

describe('SpeechrecorderngService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [SpeechrecorderngService]
  }));

  it('should be created', () => {
    const service: SpeechrecorderngService = TestBed.inject(SpeechrecorderngService);
    expect(service).toBeTruthy();
  });
});
