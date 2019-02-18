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

    let obs=new Observable<ValidationErrors>(subscriber =>{

        this.projectService.projectExists(ctrl.value).subscribe((exists)=>{
          let vErrs:ValidationErrors={}
          console.log("Does project name "+ctrl.value+ " exist: "+exists)
          if(exists){
            vErrs['name']='Project '+ctrl.value+' already exists!'
          }
          subscriber.next(vErrs);
        },(err)=>{
          subscriber.error(err)
        },()=>{
          console.log("Project name "+ctrl.value+ " check completed.")
          subscriber.complete();
        })
    })

    return obs;

  }
}
