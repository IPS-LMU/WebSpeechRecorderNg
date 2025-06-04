import {Component, inject} from '@angular/core';
import { VERSION } from '../../projects/speechrecorderng/src/lib/spr.module.version'
import {ResponsiveComponent} from "../../projects/speechrecorderng/src/lib/ui/responsive_component";
import {BreakpointObserver} from "@angular/cdk/layout";
import {BundleI18nService} from "../../projects/speechrecorderng/src/lib/i18n/bundle-i18n.service";


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent extends ResponsiveComponent{

  sprVersion=VERSION;
  title='SpeechRecorder Angular Demo'
  shortTitle='SpeechRecorder'
  bs=inject(BundleI18nService);
  constructor(protected bpo:BreakpointObserver) {
    super(bpo);

  }
}
