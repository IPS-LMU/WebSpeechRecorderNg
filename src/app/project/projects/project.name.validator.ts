import {ProjectService} from "../../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {AbstractControl, AsyncValidator, ValidationErrors} from "@angular/forms";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";

@Injectable({ providedIn: 'root' })
export class UniqueProjectNameValidator implements AsyncValidator {
  constructor(private projectService: ProjectService) {}

  validate(ctrl: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {

    // see https://stackoverflow.com/questions/48864049/mat-error-doesnt-show-up-on-error
    // without this method call it does not work properly
    ctrl.markAsTouched();

    let obs=new Observable<ValidationErrors>(subscriber =>{

        this.projectService.projectExists(ctrl.value).subscribe((exists)=>{
          //ctrl.markAsPending()
          let vErrs:ValidationErrors={}
          //console.log("Does project name "+ctrl.value+ " exist: "+exists)
          if(exists){
            vErrs['name']='Project '+ctrl.value+' already exists!'
          }
          subscriber.next(vErrs);
        },(err)=>{
          subscriber.error(err)
        },()=>{
          //console.log("Project name "+ctrl.value+ " check completed.")
          subscriber.complete();
        })
    })

    return obs;

  }
}
