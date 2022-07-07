import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SpeechrecorderngComponent} from './speechrecorderng.component';
import {RouterTestingModule} from "@angular/router/testing";
import {SpeechrecorderngService} from "./speechrecorderng.service";
import {HttpClientTestingModule} from "@angular/common/http/testing";

describe('SpeechrecorderngComponent', () => {
  let component: SpeechrecorderngComponent;
  let fixture: ComponentFixture<SpeechrecorderngComponent>;

  // beforeEach(waitForAsync(() => {
  //   TestBed.configureTestingModule({
  //     imports: [HttpClientTestingModule,RouterTestingModule],
  //     declarations: [ SpeechrecorderngComponent ]
  //   })
  //   .compileComponents();
  // }));
  //
  // beforeEach(() => {
  //   fixture = TestBed.createComponent(SpeechrecorderngComponent);
  //   component = fixture.componentInstance;
  //   fixture.detectChanges();
  // });
  //
  // it('should create', () => {
  //   expect(component).toBeTruthy();
  // });
});
