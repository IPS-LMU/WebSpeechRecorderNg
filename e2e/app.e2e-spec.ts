import { WebSpeechRecorderNgPage } from './app.po';

describe('web-speech-recorder-ng App', () => {
  let page: WebSpeechRecorderNgPage;

  beforeEach(() => {
    page = new WebSpeechRecorderNgPage();
  });

  it('should display welcome message', done => {
    page.navigateTo();
    page.getParagraphText()
      .then(msg => expect(msg).toEqual('Welcome to app!!'))
      .then(done, done.fail);
  });
});
