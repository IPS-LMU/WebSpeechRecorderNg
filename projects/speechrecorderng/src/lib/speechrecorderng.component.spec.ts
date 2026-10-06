import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { SpeechrecorderngComponent} from './speechrecorderng.component';
import {RouterTestingModule} from "@angular/router/testing";
import {SpeechrecorderngService} from "./speechrecorderng.service";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import {SpeechrecorderngModule} from "./speechrecorderng.module";
import {SPR_CFG} from "../../../../src/app/app.config";
import {VERSION} from './spr.module.version';
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

/**
 * The version gate at load (L4, README §5): a script whose `minRecorderVersion` is above this build
 * is *refused*, with the status line naming what it needs — a recorder that ran it anyway would play
 * a silently different session. The plan's M1 row claims the refusal; nothing exercised it.
 */
describe('SpeechrecorderngComponent version gate', () => {
  let component: SpeechrecorderngComponent;
  let fixture: ComponentFixture<SpeechrecorderngComponent>;
  let http: HttpTestingController;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SpeechrecorderngComponent],
      imports: [RouterTestingModule, SpeechrecorderngModule.forRoot(SPR_CFG)],
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SpeechrecorderngComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** A floor one minor above this build, e.g. 3.11.26 -> 3.12. */
  const newerThanThisBuild = () => {
    const [major, minor] = String(VERSION).split('.');
    return `${Number(major)}.${Number(minor) + 1}`;
  };

  const script = (id: string, minRecorderVersion?: string) => ({
    type: 'script',
    scriptId: id,
    ...(minRecorderVersion === undefined ? {} : {minRecorderVersion}),
    sections: [{mode: 'MANUAL', promptphase: 'RECORDING',
      groups: [{order: 'SEQUENTIAL', promptItems: [{itemcode: 'A1', mediaitems: []}]}]}],
  });

  it('refuses a script that needs a newer recorder, and says what it needs', () => {
    const required = newerThanThisBuild();
    component.fetchScript({script: 'needs-newer', sessionId: 'probe'} as never);
    fixture.detectChanges();

    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/script/needs-newer'))
      .flush(script('needs-newer', required));
    fixture.detectChanges();

    const status = component.sm.statusMsg ?? '';
    expect(status).withContext('the operator is told why nothing happens').toContain(required);
    expect(status).withContext('and which recorder would run it').toContain(String(VERSION));
    expect(component.sm.statusAlertType).toBe('error');
    expect(component.sm.statusWaiting).toBe(false);
  });

  it('accepts a script whose floor this recorder meets, and loads it', () => {
    component.fetchScript({script: 'fine', sessionId: 'probe'} as never);
    fixture.detectChanges();

    http.expectOne((request) => request.method === 'GET' && request.url.endsWith('/script/fine'))
      .flush(script('fine', '1.0'));
    fixture.detectChanges();

    expect(component.sm.statusAlertType).withContext('not an error').toBe('info');
    // Whatever else the load fans out, answer it so the spec leaves no request open.
    http.match(() => true).forEach((request) => request.flush({}));
  });
});
