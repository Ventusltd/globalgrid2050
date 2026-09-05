import { mountTeleprinter } from './teleprinter/controls.js';
const base = new URL('./teleprinter/', import.meta.url);
try {
  const response = await fetch(new URL('landing-source-pin.json', base), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Source code is still being prepared.');
  const pin = await response.json();
  if (pin.generation !== '202609051945' || pin.app !== 'landing' || !/^[a-f0-9]{40}$/.test(pin.commit) || pin.repository !== 'https://github.com/Ventusltd/testcode') throw new Error('The source code version could not be checked.');
  mountTeleprinter({ printButtons: undefined, appName: "Test Code", manifestUrl: new URL('landing-source-code.manifest.json', base), textUrl: new URL('landing-source-code.txt', base), expectedCommit: pin.commit, expectedRepository: pin.repository });
} catch (error) {
  const note = document.createElement('p'); note.setAttribute('role', 'status'); note.textContent = 'Print options: ' + error.message; document.body.append(note);
}
