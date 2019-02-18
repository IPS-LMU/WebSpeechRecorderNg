import {ProjectService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {AbstractControl, AsyncValidator, ValidationErrors} from "@angular/forms";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";

@Injectable({ providedIn: 'root' })
export class UniqueProjectNameValidator implements AsyncValidator {
  constructor(private projectService: ProjectService) {}

  validate(ctrl: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {
    // return this.projectService.isAlterEgoTaken(ctrl.value).pipe(
    //   map(isTaken => (isTaken ? { uniqueAlterEgo: true } : null)),
    //   catchError(() => null)
    // );
    //

    return this.projectService.projectObservable(ctrl.value);


  }
}
