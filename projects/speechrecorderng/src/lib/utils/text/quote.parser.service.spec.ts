import { TestBed } from '@angular/core/testing';

import { QuoteParserService } from './quote.parser.service';

describe('QuoteParserService', () => {
  let service: QuoteParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuoteParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  it('passes unquoted text (single quote char)',()=>{
    const t='Lorem ipsum';
    const ptps=QuoteParserService.parseTextOneQuoteChar(t, "'", '\\', false);
    expect(ptps.length==1 && ptps[0].text===t).toBeTruthy();
  });

  it('separates quoted text (single quote char)',()=>{
    const t='Lorem ipsum \'dolor\' sit amet';
    const ptps=QuoteParserService.parseTextOneQuoteChar(t, "'", '\\', true);
    expect(ptps.length==3).toBeTruthy();
    const tp0=ptps[0];
    expect(tp0.text==='Lorem ipsum ' && !tp0.quoted).toBeTruthy();
    const tp1=ptps[1];
    expect(tp1.text==='dolor' && tp1.quoted).toBeTruthy();
    const tp2=ptps[2];
    expect(tp2.text===' sit amet' && !tp2.quoted).toBeTruthy();
  })

  it('separates quoted text',()=>{
    const t='Lorem ipsum {dolor} sit amet';
    const ptps=QuoteParserService.parseText(t, "{", "}",'\\', true);
    expect(ptps.length==3).toBeTruthy();
    const tp0=ptps[0];
    expect(tp0.text==='Lorem ipsum ' && !tp0.quoted).toBeTruthy();
    const tp1=ptps[1];
    expect(tp1.text==='dolor' && tp1.quoted).toBeTruthy();
    const tp2=ptps[2];
    expect(tp2.text===' sit amet' && !tp2.quoted).toBeTruthy();
  })
});
