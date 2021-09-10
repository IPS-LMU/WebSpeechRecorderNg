import {AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router} from "@angular/router";

import {DOCUMENT} from "@angular/common";

import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import {Session} from "../session";
import {RecordingFile, RecordingFileDescriptor} from "../../recording";
import {ScriptService} from "../../script/script.service";
import {RecordingService} from "../../recordings/recordings.service";
import {SessionService} from "../session.service";



@Component({
  selector: 'app-sessions',
  templateUrl: 'recording-files.html'
})
export class RecordingFilesComponent implements  OnInit,AfterViewInit {

  projectName:string|null=null;
  sessionId:string|number|null=null;
  //session: Session;
  recordingFiles:Array<RecordingFile>
    displayedColumns: string[] = ['recordingFileId','itemCode','action'];
    dataSource:MatTableDataSource<RecordingFile>;
    @ViewChild(MatSort, { static: true }) sort!: MatSort;
    private d:Document;

  constructor(private route: ActivatedRoute,
              private router: Router,
              private chDetRef:ChangeDetectorRef,
              private renderer:Renderer2,
              @Inject(DOCUMENT) private dAsAny: any,
              private scriptService:ScriptService,
              private recService:RecordingService,
              private sessionService: SessionService) {
      this.d=dAsAny as Document;
      this.recordingFiles=new Array<RecordingFile>()
      this.dataSource=new MatTableDataSource(this.recordingFiles)
  }


  ngOnInit() {
      this.dataSource.sort=this.sort

      this.route.params.subscribe((params: Params) => {
          this.projectName = params['projectName'];
          this.sessionId = params['sessionId'];
          this.fetchRecordingFiles()

      })
  }

  ngAfterViewInit() {

  }


  fetchRecordingFiles(){
    if (this.projectName && this.sessionId!==null) {
      this.recService.recordingFileList(this.projectName,this.sessionId).subscribe(rfds=>{
        console.info("List " + rfds.length + " recordingFiles")
        this.recordingFiles=rfds;
        this.dataSource.data=this.recordingFiles
        //console.log(this.recordingFiles)
        //this.chDetRef.detectChanges()
      })
    }
  }

    toRecordingFileDetail(rf:RecordingFile){
        this.router.navigate(['/spr','db','recordingfile','_view',rf.recordingFileId])
    }

}
