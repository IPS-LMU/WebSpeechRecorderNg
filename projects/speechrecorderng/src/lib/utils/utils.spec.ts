/**
 * `messageOf` is what every failure in the recorder's status line goes through, so the cases that
 * used to reach an operator as "[object Object]" are the ones worth pinning: an `HttpErrorResponse`
 * is not an `Error`, and a rejected promise can carry a plain object.
 */
import {HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {messageOf} from './utils';

describe('messageOf', () => {
  it('reads an Error', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
  });

  it('reads an HTTP failure, which is not an Error', () => {
    const response = new HttpErrorResponse({status: 503, statusText: 'Service Unavailable', url: '/api'});
    expect(messageOf(response)).toBe('Http failure response for /api: 503 Service Unavailable');
  });

  it('prefers a message on a plain object', () => {
    expect(messageOf({message: 'the server said so', status: 409})).toBe('the server said so');
  });

  it('falls back to the status when there is no message', () => {
    expect(messageOf({status: 418, statusText: "I'm a teapot"})).toBe("HTTP 418 I'm a teapot");
    expect(messageOf({status: 500})).toBe('HTTP 500');
  });

  it('never returns "[object Object]"', () => {
    const rendered = messageOf({error: 'SCRIPT_DRAFT_CONFLICT', details: {required: '9.9.9'}});
    expect(rendered).not.toContain('[object');
    expect(rendered).toContain('SCRIPT_DRAFT_CONFLICT');
  });

  it('falls back to a plain rendering when there is no JSON form', () => {
    const circular: {self?: unknown} = {};
    circular.self = circular;
    expect(messageOf(circular)).toBe('[object Object]');
    expect(messageOf(() => undefined)).not.toBe('undefined');
  });

  it('passes through strings and empties', () => {
    expect(messageOf('plain')).toBe('plain');
    expect(messageOf(null)).toBe('');
    expect(messageOf(undefined)).toBe('');
  });
});
