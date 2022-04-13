import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportSessionComponent } from './export-session.component';

describe('ExportSessionComponent', () => {
  let component: ExportSessionComponent;
  let fixture: ComponentFixture<ExportSessionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExportSessionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExportSessionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
