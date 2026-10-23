import {ChangeDetectionStrategy, Component} from '@angular/core';
import {LeftPanel} from './components/left-panel/left-panel';
import {RightPanel} from './components/right-panel/right-panel';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LeftPanel, RightPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
}
