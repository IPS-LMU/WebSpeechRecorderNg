import { Component } from '@angular/core';
import {MatCard, MatCardContent, MatCardTitle} from "@angular/material/card";
import {MatDialogActions, MatDialogClose, MatDialogTitle} from "@angular/material/dialog";
import {NgIf} from "@angular/common";
import {UserAgentBuilder} from "../../utils/ua-parser";
import {MatButton} from "@angular/material/button";

@Component({
  selector: 'lib-info',
  standalone: true,
    imports: [
        MatCard,
        MatCardContent,
        MatCardTitle,
        MatDialogTitle,
        NgIf,
        MatButton,
        MatDialogActions,
        MatDialogClose
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
