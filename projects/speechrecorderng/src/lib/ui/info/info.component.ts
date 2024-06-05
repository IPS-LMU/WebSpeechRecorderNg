import { Component } from '@angular/core';
import {MatCard, MatCardContent, MatCardTitle} from "@angular/material/card";
import {MatDialogTitle} from "@angular/material/dialog";
import {NgIf} from "@angular/common";
import {UserAgentBuilder} from "../../utils/ua-parser";

@Component({
  selector: 'lib-info',
  standalone: true,
    imports: [
        MatCard,
        MatCardContent,
        MatCardTitle,
        MatDialogTitle,
        NgIf
    ],
  templateUrl: './info.component.html',
  styleUrl: './info.component.css'
})
export class InfoComponent {
  ua=UserAgentBuilder.userAgent();
  constructor() {
  }

  protected readonly navigator = navigator;
}
