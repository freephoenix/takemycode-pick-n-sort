import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RightPanel } from './right-panel';

describe('RightPanel', () => {
  let component: RightPanel;
  let fixture: ComponentFixture<RightPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RightPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(RightPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
