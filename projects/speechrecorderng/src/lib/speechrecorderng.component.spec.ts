import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SpeechrecorderngComponent} from './speechrecorderng.component';
import {RouterTestingModule} from "@angular/router/testing";
import {SpeechrecorderngService} from "./speechrecorderng.service";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {SpeechrecorderngModule} from "./speechrecorderng.module";
import {SPR_CFG} from "../../../../src/app/app.config";

describe('SpeechrecorderngComponent', () => {
  let component: SpeechrecorderngComponent;
  let fixture: ComponentFixture<SpeechrecorderngComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule,RouterTestingModule,SpeechrecorderngModule.forRoot(SPR_CFG)],
      declarations: [ SpeechrecorderngComponent ]
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
