import {Component} from '@angular/core';
import {MatFormField, MatInput} from "@angular/material/input";


@Component({
  selector: 'app-sessions',
  templateUrl: 'sessions.html',
  imports: [
    MatFormField,
    MatInput
  ],
  standalone: true
})
export class SessionsComponent {

  constructor(){
  }
}
