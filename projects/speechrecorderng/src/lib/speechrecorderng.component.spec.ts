import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SpeechrecorderngComponent} from './speechrecorderng.component';
import {RouterTestingModule} from "@angular/router/testing";
import {SpeechrecorderngService} from "./speechrecorderng.service";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import {SpeechrecorderngModule} from "./speechrecorderng.module";
import {SPR_CFG} from "../../../../src/app/app.config";
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SpeechrecorderngComponent', () => {
  let component: SpeechrecorderngComponent;
  let fixture: ComponentFixture<SpeechrecorderngComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    declarations: [SpeechrecorderngComponent],
    imports: [RouterTestingModule, SpeechrecorderngModule.forRoot(SPR_CFG)],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  }));
  //
  beforeEach(() => {
    fixture = TestBed.createComponent(SpeechrecorderngComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  //
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
