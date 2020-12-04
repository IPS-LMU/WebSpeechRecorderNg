import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SpeechrecorderngComponent} from './speechrecorderng.component';

describe('SpeechrecorderngComponent', () => {
  let component: SpeechrecorderngComponent;
  let fixture: ComponentFixture<SpeechrecorderngComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ SpeechrecorderngComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SpeechrecorderngComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
