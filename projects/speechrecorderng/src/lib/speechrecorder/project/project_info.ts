import {Component, Input, ChangeDetectionStrategy} from "@angular/core";
import {Project} from "./project";


@Component({
    selector: 'spr-projectinfo',
    template: `
    <table>
      <tr>
        <td>Project:</td>
        <td style="text-align: end">{{project?.name}}</td>
      </tr>
    </table>
  `,
    styles: [`:host {
    flex: 0;
    background-color: white;
  }`, `table {
    width: 100%;
    border: 1px;
    background-color: lightgrey;
    font-weight: bolder;
  }`],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class ProjectInfo {
  @Input() project: Project | undefined;
}
