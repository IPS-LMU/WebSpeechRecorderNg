import { TestBed } from '@angular/core/testing';
import { describe, beforeEach,it, expect } from 'vitest';
import { SpeechrecorderngComponent} from './speechrecorderng.component';
import {RouterTestingModule} from "@angular/router/testing";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import {SpeechrecorderngModule} from "./speechrecorderng.module";
import {SPR_CFG} from "../../../../src/app/app.config";
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';


describe('SpeechrecorderngComponent', () => {

  beforeEach(async() => {
    await TestBed.configureTestingModule({
    imports: [RouterTestingModule, SpeechrecorderngModule.forRoot(SPR_CFG)],
    providers: [provideHttpClient(withXhr(), withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(SpeechrecorderngComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });



});
