/** Browser driver: attach to a button; fetch, verify, and download committed source as UTF-8 text. */
async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function sameOrigin(url) {
  const resolved = new URL(url, location.href);
  if (resolved.origin !== location.origin || !/^https?:$/.test(resolved.protocol)) throw new Error('Print source code requires same-origin HTTP(S) files.');
  return resolved.href;
}
async function get(url) {
  const response = await fetch(sameOrigin(url), { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error(`Print source code fetch failed: HTTP ${response.status}`);
  return response;
}

export async function fetchVerifiedSourceCode({ manifestUrl, textUrl, expectedRepository, expectedCommit }) {
  if (!manifestUrl || !textUrl) throw new Error('The source code file has not been set up for this page.');
  const [manifestResponse, textResponse] = await Promise.all([get(manifestUrl), get(textUrl)]);
  const manifest = await manifestResponse.json();
  const bytes = new Uint8Array(await textResponse.arrayBuffer());
  if (manifest.format !== 'codex-print-source-code-v1' || !/^[a-f0-9]{40,64}$/.test(manifest.commit)) throw new Error('Invalid source code manifest.');
  if (expectedRepository && manifest.repository !== expectedRepository) throw new Error('Source code repository mismatch.');
  if (expectedCommit && manifest.commit !== expectedCommit) throw new Error('Source code commit mismatch.');
  if (bytes.length !== manifest.byteCount || await sha256(bytes) !== manifest.sha256) throw new Error('Source code bundle integrity check failed.');
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const sourceText = decoder.decode(bytes);
  if (!Array.isArray(manifest.files)) throw new Error('Missing source code inventory.');
  const framing = [`PRINT SOURCE CODE\nFormat: ${manifest.format}\nRepository: ${manifest.repository}\nCommit: ${manifest.commit}\nTree: ${manifest.tree}\nScopes: ${JSON.stringify(manifest.scopes)}\nPolicy: ${JSON.stringify(manifest.policy)}\nInventory: ${JSON.stringify(manifest.files.map(({ startByte, ...entry }) => entry))}\n\n`];
  let included = 0, omitted = 0, previousEnd = 0;
  const seen = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || seen.has(file.path)) throw new Error('Invalid source code inventory path.');
    seen.add(file.path);
    if (file.status === 'omitted' && file.reason) { omitted++; continue; }
    if (file.status !== 'included' || !Number.isSafeInteger(file.startByte) || !Number.isSafeInteger(file.byteCount) || file.byteCount < 0 || file.startByte < previousEnd || file.startByte + file.byteCount > bytes.length) throw new Error('Invalid source code file boundary.');
    if (await sha256(bytes.subarray(file.startByte, file.startByte + file.byteCount)) !== file.sha256) throw new Error(`Source code file integrity check failed: ${file.path}`);
    framing.push(`===== BEGIN FILE ${JSON.stringify(file.path)} | bytes=${file.byteCount} | sha256=${file.sha256} =====\n`, decoder.decode(bytes.subarray(file.startByte, file.startByte + file.byteCount)), `\n===== END FILE ${JSON.stringify(file.path)} =====\n\n`);
    previousEnd = file.startByte + file.byteCount;
    included++;
  }
  if (!included || included !== manifest.includedCount || omitted !== manifest.omittedCount) throw new Error('Source code coverage check failed.');
  framing.push('===== END PRINT SOURCE CODE =====\n');
  if (framing.join('') !== sourceText) throw new Error('Source code inventory or file boundaries do not match the text.');
  return { bytes, manifest };
}

/** Verified download/copy/share controls. Returned cleanup removes listeners and generated fallback. */
export function attachPrintSourceCode({ button, copyButton, shareButton, status, fallbackContainer, manifestUrl, textUrl, expectedRepository, expectedCommit, filename = 'source-code.txt', prepareSource, onError } = {}) {
  if (!button || typeof button.addEventListener !== 'function') throw new Error('Print source code requires a button element.');
  const instructions = 'Attach this text file in ChatGPT, or copy and paste its contents.';
  const ownedStatus = !status;
  if (!status) { status = document.createElement('p'); button.insertAdjacentElement('afterend', status); }
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = instructions;
  const controls = [button, copyButton, shareButton].filter(Boolean);
  const initialDisabled = controls.map(item => item.disabled);
  const listeners = [];
  let fallback;
  let busy = false;
  let prepared;
  let detached = false;
  const safeFilename = `${filename.replace(/\.txt$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.txt`;
  const manualCopy = text => {
    if (!fallback) {
      fallback = document.createElement('div');
      const label = document.createElement('p');
      label.textContent = 'Select all the source code below, then copy it and paste it into ChatGPT.';
      const area = document.createElement('textarea');
      area.readOnly = true;
      area.rows = 14;
      area.style.width = '100%';
      area.setAttribute('aria-label', 'Complete source code. Select all and copy.');
      fallback.append(label, area);
      (fallbackContainer || button.parentElement || document.body).append(fallback);
    }
    const area = fallback.querySelector('textarea');
    area.value = text;
    area.focus();
    area.select();
    status.textContent = 'Automatic copy is unavailable. The complete source code is ready below for you to select and copy.';
  };
  const bind = (control, label, action) => {
    if (!control) return;
    control.textContent = label;
    control.setAttribute('aria-label', label);
    const click = async () => {
    if (busy || control.disabled || !prepared) return;
    busy = true;
    const wasDisabled = controls.map(item => item.disabled);
    for (const item of controls) { item.disabled = true; item.setAttribute('aria-busy', 'true'); }
    try {
      // Preparation finished before the click: clipboard/share runs in this user gesture.
      const { bytes } = prepared;
      if (action === 'copy') {
        const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(text);
          status.textContent = 'Source code copied. Paste it into ChatGPT.';
        } catch { manualCopy(text); }
      } else if (action === 'share') {
        const file = new File([bytes], safeFilename, { type: 'text/plain;charset=utf-8' });
        if (!navigator.canShare?.({ files: [file] })) {
          status.textContent = `File sharing is unavailable here. Use Print source code or Copy source code. ${instructions}`;
        } else {
          await navigator.share({ files: [file], title: 'Source code' });
          status.textContent = `Share action completed. ${instructions}`;
        }
      } else {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = safeFilename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent = `Text file download requested. ${instructions}`;
      }
    } catch (error) {
      if (error.name === 'AbortError') status.textContent = `Sharing cancelled. ${instructions}`;
      else {
        status.textContent = `Could not prepare source code: ${error.message}`;
        control.dispatchEvent(new CustomEvent('sourcecodeerror', { detail: error }));
        if (onError) onError(error);
        else console.error('Print source code:', error);
      }
    } finally {
      controls.forEach((item, index) => { item.disabled = wasDisabled[index]; item.removeAttribute('aria-busy'); });
      busy = false;
    }
    };
    control.addEventListener('click', click);
    listeners.push([control, click]);
  };
  bind(button, 'Print source code', 'download');
  bind(copyButton, 'Copy source code', 'copy');
  if (shareButton) {
    shareButton.hidden = !(typeof navigator.share === 'function' && typeof navigator.canShare === 'function');
    bind(shareButton, 'Share source code', 'share');
  }
  for (const item of controls) { item.disabled = true; item.setAttribute('aria-busy', 'true'); }
  status.textContent = 'Preparing the complete source code…';
  const ready = fetchVerifiedSourceCode({ manifestUrl, textUrl, expectedRepository, expectedCommit }).then(async result => {
    if (prepareSource) {
      status.textContent = 'Collecting the current screen state and its dependencies…';
      result = await prepareSource(result);
      if (!(result?.bytes instanceof Uint8Array) || !result.manifest) throw new Error('The current screen source could not be prepared.');
    }
    if (detached) return null;
    prepared = result;
    controls.forEach((item, index) => { item.disabled = initialDisabled[index]; item.removeAttribute('aria-busy'); });
    status.textContent = result.manifest.format === 'codex-runtime-source-v1'
      ? `Source code ready with the current screen state and ${result.manifest.counts.included} dependency responses. ${result.manifest.failures.length} resources could not be read; any gaps are listed in the file. ${instructions}`
      : `Source code ready: ${result.manifest.includedCount} files, ${result.bytes.length} bytes. ${instructions}`;
    return result;
  }).catch(error => {
    if (!detached) {
      for (const item of controls) item.removeAttribute('aria-busy');
      status.textContent = 'The complete source code could not be prepared. Reload the page to try again.';
      button.dispatchEvent(new CustomEvent('sourcecodeerror', { detail: error }));
      if (onError) onError(error);
      else console.error('Print source code:', error);
    }
    return null;
  });
  const detach = () => {
    detached = true;
    for (const [control, listener] of listeners) control.removeEventListener('click', listener);
    controls.forEach((item, index) => { item.disabled = initialDisabled[index]; item.removeAttribute('aria-busy'); });
    fallback?.remove();
    if (ownedStatus) status.remove();
  };
  detach.ready = ready;
  return detach;
}

export const attachSourceCodeControls = attachPrintSourceCode;
