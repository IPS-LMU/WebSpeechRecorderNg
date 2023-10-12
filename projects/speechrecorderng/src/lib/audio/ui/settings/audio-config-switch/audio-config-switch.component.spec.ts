import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioConfigSwitchComponent } from './audio-config-switch.component';

describe('AudioConfigSwitchComponent', () => {
  let component: AudioConfigSwitchComponent;
  let fixture: ComponentFixture<AudioConfigSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AudioConfigSwitchComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AudioConfigSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
