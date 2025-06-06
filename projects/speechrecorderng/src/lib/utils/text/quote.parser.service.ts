import { Injectable } from '@angular/core';
export class TextPart {

  constructor(private _text: string, private _quoted = false) {
  }

  get text() {
    return this._text;
  }

  get quoted(): boolean {
    return this._quoted;
  }

}

@Injectable({
  providedIn: 'root'
})
export class QuoteParserService {

  static parseTextOneQuoteChar(text: string, quoteChar: string, escapeChar: string|null, unquote: boolean):Array<TextPart> {
    let i = 0;
    let quoted = false;
    let charEscape = false;
    const textPartList = new Array<TextPart>();
    let currPart = '';
    while (i < text.length) {
      let c = text.charAt(i);
      let isEscChar = (escapeChar != null && c == escapeChar);
      if (c == quoteChar && !charEscape) {
        if (!unquote) {
          currPart=currPart.concat(c);
        }
        let tp = new TextPart(currPart.toString(), quoted);
        textPartList.push(tp);
        currPart = '';
        quoted = !quoted;
      } else {
        if (!isEscChar) {
          currPart=currPart.concat(c);
        }
      }
      charEscape = isEscChar;
      i++;
    }
// last part
    let tp = new TextPart(currPart.toString(), quoted);
    textPartList.push(tp);
    return textPartList;
  }

  static parseText(text: string, quoteBegChar: string, quoteEndChar:string,escapeChar: string|null, unquote: boolean):Array<TextPart> {
    let i = 0;
    let quoted = false;
    let charEscape = false;
    const textPartList = new Array<TextPart>();
    let currPart = '';
    while (i < text.length) {
      let c = text.charAt(i);
      let isEscChar = (escapeChar != null && c == escapeChar);
      if (c == quoteBegChar && !charEscape) {
        if (!unquote) {
          currPart=currPart.concat(c);
        }
        let tp = new TextPart(currPart.toString(), quoted);
        textPartList.push(tp);
        currPart = '';
        quoted = true;
      } else if (c == quoteEndChar && !charEscape) {
        if (!unquote) {
          currPart=currPart.concat(c);
        }
        let tp = new TextPart(currPart.toString(), quoted);
        textPartList.push(tp);
        currPart = '';
        quoted = false;
      }else {
        if (!isEscChar) {
          currPart=currPart.concat(c);
        }
      }
      charEscape = isEscChar;
      i++;
    }
// last part
    const tp = new TextPart(currPart.toString(), quoted);
    textPartList.push(tp);
    return textPartList;
  }
}

