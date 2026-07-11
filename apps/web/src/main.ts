import { mount } from 'svelte';
import App from './App.svelte';
import './lib/theme/tokens.css';
import { applyTheme, resolveThemeName } from './lib/theme';

// Applied immediately so the Lobby (which has no room, hence no
// room.settings.theme) still honors a `?theme=` preview override; RoomShell
// re-applies once the room doc loads (Master Plan v2, R2).
applyTheme(resolveThemeName(null));

const target = document.getElementById('app');
if (!target) throw new Error('#app root element not found');

mount(App, { target });
