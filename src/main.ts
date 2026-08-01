import { App } from './components/App';
import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

const root = document.getElementById('app');
if (root) {
  new App(root);
}
