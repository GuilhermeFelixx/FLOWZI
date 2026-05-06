// Este script roda invisível em todas as páginas e escuta os atalhos que você digita.
console.log("🚀 QuickText: Extensão ativada. Ouvindo atalhos...");

let snippets = [];
let autoCaptureEnabled = true;
let currentTheme = 'default';

const themes = {
  'default': { bg: '#0F0F0F', accent: '#F2FF44', fg: '#FFFFFF', invert: '#000000' },
  'cyberpunk': { bg: '#0F0F0F', accent: '#00FF9D', fg: '#FFFFFF', invert: '#000000' },
  'matrix': { bg: '#000000', accent: '#00FF41', fg: '#FFFFFF', invert: '#000000' },
  'neon': { bg: '#1A1A2E', accent: '#E94560', fg: '#FFFFFF', invert: '#000000' },
  'dracula': { bg: '#282A36', accent: '#FF79C6', fg: '#F8F8F2', invert: '#000000' },
  'monokai': { bg: '#272822', accent: '#A6E22E', fg: '#F8F8F2', invert: '#000000' },
  'light': { bg: '#FAFAFA', accent: '#FF3B30', fg: '#111111', invert: '#FFFFFF' }
};

function applyContentTheme(themeId) {
  currentTheme = themeId || 'default';
  const themeColors = themes[currentTheme] || themes['default'];
  
  let styleEl = document.getElementById('quicktext-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'quicktext-theme-vars';
    document.head.appendChild(styleEl);
  }
  
  styleEl.innerHTML = `
    :root {
      --quicktext-bg: ${themeColors.bg};
      --quicktext-accent: ${themeColors.accent};
      --quicktext-fg: ${themeColors.fg};
      --quicktext-invert: ${themeColors.invert};
    }
  `;
}

// Busca os atalhos salvos no armazenamento interno da extensão do Chrome
function updateSnippets() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['snippets', 'autoCaptureEnabled', 'theme'], (res) => {
      let loadedSnippets = res.snippets;
      if (!loadedSnippets || loadedSnippets.length === 0) {
        loadedSnippets = [
          {
            id: '1',
            title: 'Saudação Inicial',
            shortcut: '/ola',
            content: 'Olá! Tudo bem? Como posso ajudar você hoje?',
            category: 'Atendimento',
            createdAt: Date.now(),
            useCount: 0,
          },
          {
            id: '2',
            title: 'Despedida',
            shortcut: '/tchau',
            content: 'Agradecemos o contato! Qualquer dúvida, estamos à disposição. Tenha um excelente dia!',
            category: 'Atendimento',
            createdAt: Date.now(),
            useCount: 0,
          }
        ];
        // Save them to sync to popup
        chrome.storage.local.set({ snippets: loadedSnippets });
      }
      snippets = loadedSnippets;
      autoCaptureEnabled = res.autoCaptureEnabled !== false;
      applyContentTheme(res.theme);
    });
  }
}


updateSnippets();

// Atualiza a lista em tempo real se o usuário editar um atalho no Popup
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.snippets) {
        snippets = changes.snippets.newValue;
      }
      if (changes.autoCaptureEnabled) {
        autoCaptureEnabled = changes.autoCaptureEnabled.newValue;
      }
      if (changes.theme) {
        applyContentTheme(changes.theme.newValue);
      }
    }
  });
}

// ------ MAGIC MENU SYSTEM ------
let magicMenuNode = null;
let magicMenuState = {
  active: false,
  query: '',
  target: null,
  selectedIndex: 0,
  filteredSnippets: []
};

// Create the menu DOM
function createMagicMenu() {
  if (magicMenuNode) return;
  magicMenuNode = document.createElement('div');
  magicMenuNode.id = 'quicktext-magic-menu';
  magicMenuNode.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    width: 400px;
    max-height: 350px;
    background: var(--quicktext-bg);
    border: 1px solid color-mix(in srgb, var(--quicktext-fg) 10%, transparent);
    box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--quicktext-accent) 20%, transparent);
    border-radius: 0px;
    z-index: 2147483647;
    display: none;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--quicktext-fg);
    overflow: hidden;
  `;
  // header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 12px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--quicktext-invert) 10%, transparent);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
    color: var(--quicktext-invert);
    background-color: var(--quicktext-accent);
    text-transform: uppercase;
    display: flex;
    justify-content: space-between;
  `;
  header.innerHTML = `<span>⚡ MAGIC MENU</span><span id="quicktext-menu-query"></span>`;
  magicMenuNode.appendChild(header);

  const list = document.createElement('div');
  list.id = 'quicktext-list';
  list.style.cssText = `
    overflow-y: auto;
    max-height: 300px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;
  magicMenuNode.appendChild(list);

  document.body.appendChild(magicMenuNode);
}

function openMagicMenu(target, query) {
  createMagicMenu();
  magicMenuState.active = true;
  magicMenuState.target = target;
  magicMenuState.query = query;
  magicMenuState.selectedIndex = 0;
  
  magicMenuNode.style.display = 'flex';
  updateMagicMenu();
}

function closeMagicMenu() {
  magicMenuState.active = false;
  magicMenuState.target = null;
  magicMenuState.query = '';
  if (magicMenuNode) {
    magicMenuNode.style.display = 'none';
  }
}

function updateMagicMenu() {
  if (!magicMenuNode) return;
  
  const querySpan = magicMenuNode.querySelector('#quicktext-menu-query');
  querySpan.innerText = magicMenuState.query;

  // Filter
  const q = magicMenuState.query.toLowerCase();
  magicMenuState.filteredSnippets = snippets.filter(s => {
    return s.title.toLowerCase().includes(q) || s.shortcut.toLowerCase().includes(q);
  });

  const list = magicMenuNode.querySelector('#quicktext-list');
  list.innerHTML = '';

  if (magicMenuState.filteredSnippets.length === 0) {
    list.innerHTML = '<div style="padding: 16px; text-align: center; color: color-mix(in srgb, var(--quicktext-fg) 30%, transparent); font-size: 12px; font-weight: bold; letter-spacing: 1px;">NENHUM ATALHO ENCONTRADO</div>';
    return;
  }

  magicMenuState.filteredSnippets.forEach((snippet, index) => {
    const item = document.createElement('div');
    const isSelected = index === magicMenuState.selectedIndex;
    
    item.style.cssText = `
      padding: 12px;
      background: ${isSelected ? 'color-mix(in srgb, var(--quicktext-fg) 10%, transparent)' : 'transparent'};
      border-left: 3px solid ${isSelected ? 'var(--quicktext-accent)' : 'transparent'};
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.1s;
    `;

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="font-size: 14px; font-weight: 800; color: var(--quicktext-fg);">${snippet.title}</strong>
        ${snippet.shortcut ? `<span style="font-size: 10px; font-family: monospace; color: var(--quicktext-accent); font-weight: 800;">${snippet.shortcut}</span>` : ''}
      </div>
      <div style="font-size: 12px; color: color-mix(in srgb, var(--quicktext-fg) 50%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${snippet.content}
      </div>
    `;

    item.onmouseenter = () => {
      magicMenuState.selectedIndex = index;
      updateMagicMenu();
    };
    
    item.onclick = () => {
      insertSnippetContent(snippet, magicMenuState.target, magicMenuState.query);
      closeMagicMenu();
    };

    list.appendChild(item);
  });
}

// Increment use count
function incrementUseCount(snippetId) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['snippets'], (res) => {
      let currentSnippets = res.snippets || [];
      currentSnippets = currentSnippets.map(s => {
        if (s.id === snippetId) {
          return { ...s, useCount: (s.useCount || 0) + 1 };
        }
        return s;
      });
      chrome.storage.local.set({ snippets: currentSnippets });
    });
  }
}

// Insert logic
function insertSnippetContent(snippet, target, queryToReplace) {
  const textToInsert = snippet.content;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  const isContentEditable = target.isContentEditable;

  if (isInput) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    const textBefore = target.value.substring(0, start - queryToReplace.length);
    const textAfter = target.value.substring(end);

    target.value = textBefore + textToInsert + textAfter;
    target.selectionStart = target.selectionEnd = textBefore.length + textToInsert.length;
    
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (isContentEditable) {
    for(let i = 0; i < queryToReplace.length; i++) {
      document.execCommand('delete', false, null);
    }
    document.execCommand('insertText', false, textToInsert);
  }
  
  incrementUseCount(snippet.id);
}

// Keydown interception for Magic Menu
document.addEventListener('keydown', (e) => {
  if (magicMenuState.active) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      magicMenuState.selectedIndex = (magicMenuState.selectedIndex + 1) % magicMenuState.filteredSnippets.length;
      updateMagicMenu();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      magicMenuState.selectedIndex = (magicMenuState.selectedIndex - 1 + magicMenuState.filteredSnippets.length) % magicMenuState.filteredSnippets.length;
      updateMagicMenu();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (magicMenuState.filteredSnippets.length > 0) {
        insertSnippetContent(magicMenuState.filteredSnippets[magicMenuState.selectedIndex], magicMenuState.target, magicMenuState.query);
      }
      closeMagicMenu();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMagicMenu();
    }
  }
}, true);


// Overlay state
let isSnipping = false;

// ------ QUICK NOTE SYSTEM ------
let quickNoteNode = null;
let quickNoteActive = false;

function createQuickNote() {
  if (quickNoteNode) return;
  quickNoteNode = document.createElement('div');
  quickNoteNode.id = 'quicktext-quick-note';
  quickNoteNode.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.7);
    z-index: 2147483647;
    display: none;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    width: 600px;
    background: color-mix(in srgb, var(--quicktext-bg) 95%, transparent);
    border: 1px solid color-mix(in srgb, var(--quicktext-accent) 20%, transparent);
    box-shadow: 0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px color-mix(in srgb, var(--quicktext-accent) 30%, transparent), 0 0 40px color-mix(in srgb, var(--quicktext-accent) 5%, transparent);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    color: #E0E0E0;
    overflow: hidden;
    backdrop-filter: blur(20px);
    transform: scale(0.95) translateY(20px);
    opacity: 0;
    animation: quicktext-magic-entrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  `;

  if (!document.getElementById('quicktext-magic-styles')) {
    const style = document.createElement('style');
    style.id = 'quicktext-magic-styles';
    style.innerHTML = `
      @keyframes quicktext-magic-entrance { 
        to { opacity: 1; transform: scale(1) translateY(0); } 
      }
    `;
    document.head.appendChild(style);
  }

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px 24px;
    border-bottom: 1px solid color-mix(in srgb, var(--quicktext-fg) 5%, transparent);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 3px;
    color: var(--quicktext-accent);
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-transform: uppercase;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">⚡</span> MENU MÁGICO / CRIAR NOTA
    </div>
    <span style="opacity: 0.4; font-size: 9px; letter-spacing: 1px;">ESC PARA FECHAR</span>
  `;
  
  const body = document.createElement('div');
  body.style.cssText = `padding: 24px; display: flex; flex-direction: column; gap: 16px;`;

  const titleInput = document.createElement('input');
  titleInput.placeholder = 'Dê um título para sua nota...';
  titleInput.style.cssText = `
    background: transparent;
    border: none;
    border-bottom: 2px solid rgba(255,255,255,0.1);
    padding: 8px 0;
    color: var(--quicktext-fg);
    font-size: 24px;
    font-weight: 900;
    outline: none;
    transition: all 0.2s;
  `;
  titleInput.onfocus = () => titleInput.style.borderColor = 'var(--quicktext-accent)';
  titleInput.onblur = () => titleInput.style.borderColor = 'rgba(255,255,255,0.1)';

  const contentInput = document.createElement('textarea');
  contentInput.placeholder = 'Digite aqui... (Aceita texto livre)\\nPressione Ctrl+Enter para salvar rapidamente';
  contentInput.rows = 6;
  contentInput.style.cssText = `
    background: color-mix(in srgb, var(--quicktext-fg) 10%, transparent);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 16px;
    color: color-mix(in srgb, var(--quicktext-fg) 90%, transparent);
    font-size: 15px;
    line-height: 1.6;
    outline: none;
    resize: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: all 0.2s;
  `;
  contentInput.onfocus = () => {
    contentInput.style.borderColor = 'color-mix(in srgb, var(--quicktext-accent) 50%, transparent)';
    contentInput.style.background = 'color-mix(in srgb, var(--quicktext-fg) 20%, transparent)';
  };
  contentInput.onblur = () => {
    contentInput.style.borderColor = 'rgba(255,255,255,0.05)';
    contentInput.style.background = 'rgba(0,0,0,0.3)';
  };

  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = 'SALVAR NOTA AGORA <span style="opacity: 0.5; font-size: 10px; margin-left: 8px;">Ctrl+Enter</span>';
  saveBtn.style.cssText = `
    background: var(--quicktext-accent);
    color: var(--quicktext-invert);
    border: none;
    border-radius: 8px;
    padding: 16px;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
    margin-top: 8px;
  `;
  saveBtn.onmouseenter = () => saveBtn.style.opacity = '0.8';
  saveBtn.onmouseleave = () => saveBtn.style.opacity = '1';

  const saveNote = () => {
    const title = titleInput.value.trim() || 'Nota Rápida';
    const content = contentInput.value.trim();
    if (!content) return;

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['notes'], (res) => {
        const notes = res.notes || [];
        const newNote = {
          id: crypto.randomUUID(),
          title,
          content,
          tags: [], // Assuming 'tags' field
          createdAt: Date.now()
        };
        chrome.storage.local.set({ notes: [...notes, newNote] }, () => {
          closeQuickNote();
          showToast('Nota salva com sucesso! 🚀');
        });
      });
    }
  };

  saveBtn.onclick = saveNote;

  body.appendChild(titleInput);
  body.appendChild(contentInput);
  body.appendChild(saveBtn);
  
  modal.appendChild(header);
  modal.appendChild(body);
  quickNoteNode.appendChild(modal);

  quickNoteNode.onclick = (e) => {
    if (e.target === quickNoteNode) {
       closeQuickNote();
    }
  };

  document.body.appendChild(quickNoteNode);

  // Keybindings inside modal
  const handleKeys = (e) => {
    if (!quickNoteActive) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeQuickNote();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNote();
    }
  };
  
  // We attach it to the modal inputs since global keydown might be intercepted
  titleInput.addEventListener('keydown', handleKeys);
  contentInput.addEventListener('keydown', handleKeys);
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.innerText = msg;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: var(--quicktext-accent); color: var(--quicktext-invert);
    padding: 12px 20px; font-size: 12px; font-weight: 900; letter-spacing: 1px;
    box-shadow: 0 10px 20px rgba(0,0,0,0.5); z-index: 2147483647;
    animation: quicktext-fadein 0.3s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'quicktext-fadeout 0.3s forwards';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);

  if (!document.getElementById('quicktext-toast-styles')) {
     const style = document.createElement('style');
     style.id = 'quicktext-toast-styles';
     style.innerHTML = `
       @keyframes quicktext-fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
       @keyframes quicktext-fadeout { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
     `;
     document.head.appendChild(style);
  }
}

function openQuickNote() {
  createQuickNote();
  quickNoteActive = true;
  quickNoteNode.style.display = 'flex';
  const titleInput = quickNoteNode.querySelector('input');
  const contentInput = quickNoteNode.querySelector('textarea');
  titleInput.value = '';
  contentInput.value = '';
  titleInput.focus();
}

function closeQuickNote() {
  if (!quickNoteNode) return;
  quickNoteActive = false;
  quickNoteNode.style.display = 'none';
}

async function startScreenSnip() {
  if (isSnipping) return;
  isSnipping = true;

  chrome.runtime.sendMessage({ action: 'GET_TAB_IMAGE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("QuickText: Erro de RPC:", chrome.runtime.lastError.message);
      isSnipping = false;
      return;
    }
    if (!response || response.error || !response.dataUrl) {
      console.error("QuickText: Nenhuma imagem retornada ou erro:", response?.error);
      alert("Erro ao capturar tela: " + (response?.error || 'Imagem vazia'));
      isSnipping = false;
      return;
    }
    const dataUrl = response.dataUrl;

    const overlay = document.createElement('div');
    overlay.id = 'quicktext-crop-overlay';
    // We add a dark background. The selection box will have a white border and be transparent, showing the page underneath.
    // To do this properly, we use clip-path or multiple divs. A classic trick is multiple borders, but an easier way is 
    // to put the screenshot as a full-screen image, dim it, and the selection is the bright screenshot!
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: ${window.innerWidth}px; height: ${window.innerHeight}px;
      z-index: 2147483647; cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>') 12 12, crosshair !important; user-select: none;
      background-image: url(${dataUrl});
      background-size: ${window.innerWidth}px ${window.innerHeight}px;
      background-repeat: no-repeat;
    `;

    const dimmer = document.createElement('div');
    dimmer.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); pointer-events: none;
    `;
    overlay.appendChild(dimmer);

    const selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: absolute; border: 1px dashed #cccccc;
      display: none; pointer-events: none;
      background-image: url(${dataUrl});
      background-size: ${window.innerWidth}px ${window.innerHeight}px;
      background-repeat: no-repeat;
      background-position: 0 0;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 0 5px rgba(0,0,0,0.5);
    `;
    overlay.appendChild(selectionBox);

    document.body.appendChild(overlay);

    let startX, startY, isDragging = false;

    const onMouseDown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
      // Align the bright background to the cutout
      selectionBox.style.backgroundPosition = `-${startX}px -${startY}px`;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const currentY = e.clientY;
      
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(startX - currentX);
      const height = Math.abs(startY - currentY);

      selectionBox.style.left = x + 'px';
      selectionBox.style.top = y + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
      selectionBox.style.backgroundPosition = `-${x}px -${y}px`;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      const width = parseInt(selectionBox.style.width || '0');
      const height = parseInt(selectionBox.style.height || '0');
      
      if (width < 10 && height < 10) {
        // Canceled or too small
        document.body.removeChild(overlay);
        isSnipping = false;
        return;
      }

      // Limpa os listeners de drag
      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('mouseup', onMouseUp);

      const x = parseInt(selectionBox.style.left);
      const y = parseInt(selectionBox.style.top);

      // Adiciona o Toolbar!
      const toolbar = document.createElement('div');
      toolbar.style.cssText = `
        position: absolute; right: 0; bottom: -40px; display: flex; gap: 8px;
        background: var(--quicktext-bg, #0F0F0F); padding: 6px; border-radius: 4px; z-index: 9999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto;
      `;

      // Impede clique no toolbar de fechar tudo
      toolbar.onmousedown = (ev) => ev.stopPropagation();

      const btnStyle = "background: none; border: none; color: white; cursor: pointer; padding: 6px 12px; font-size: 11px; font-weight: 800; border-radius: 4px; text-transform: uppercase; transition: opacity 0.2s;";
      
      const btnCopy = document.createElement('button');
      btnCopy.innerText = "Copiar";
      btnCopy.style.cssText = btnStyle + " background: #0088ff;";
      
      const btnEdit = document.createElement('button');
      btnEdit.innerText = "Editar Tab";
      btnEdit.style.cssText = btnStyle + " background: var(--quicktext-accent, #F2FF44); color: #000;";
      
      const btnClose = document.createElement('button');
      btnClose.innerText = "✕";
      btnClose.style.cssText = btnStyle + " background: #ff4444;";

      // Função de corte
      const doCrop = (callback) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const dpr = window.devicePixelRatio || 1;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          const ctx = canvas.getContext('2d');
          
          ctx.drawImage(img, x * dpr, y * dpr, width * dpr, height * dpr, 0, 0, canvas.width, canvas.height);
          const croppedDataUrl = canvas.toDataURL('image/png');
          callback(canvas, croppedDataUrl);
        };
        img.src = dataUrl;
      };

      btnCopy.onclick = () => {
         doCrop((canvas, croppedDataUrl) => {
            try {
              canvas.toBlob((blob) => {
                if (blob) {
                  const item = new ClipboardItem({ 'image/png': blob });
                  navigator.clipboard.write([item]).then(() => {
                    showToast('Imagem copiada para a área de transferência! ✅');
                    document.body.removeChild(overlay);
                    isSnipping = false;
                  }).catch(e => {
                    console.log('Clipboard write failed manually', e);
                    alert("Erro ao copiar imagem. Permissão de área de transferência negada?");
                  });
                }
              }, 'image/png');
            } catch (e) {
              console.log('Clipboard error', e);
            }
         });
      };

      btnEdit.onclick = () => {
         doCrop((canvas, croppedDataUrl) => {
            chrome.runtime.sendMessage({ action: 'PROCESS_SCREENSHOT', dataUrl: croppedDataUrl }, () => {
               if (chrome.runtime.lastError) console.log('sendMessage error', chrome.runtime.lastError.message);
            });
            document.body.removeChild(overlay);
            isSnipping = false;
         });
      };

      btnClose.onclick = () => {
         document.body.removeChild(overlay);
         isSnipping = false;
      };

      toolbar.appendChild(btnCopy);
      toolbar.appendChild(btnEdit);
      toolbar.appendChild(btnClose);
      
      // Permitir interação na area e adicionar as ferramentas
      selectionBox.style.pointerEvents = 'auto';
      selectionBox.appendChild(toolbar);
    };

    // Quit on Esc
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', onKeyDown);
        isSnipping = false;
      }
    };

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  });
}

// Listen for explicit commands from background
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_SNIP') {
      if (autoCaptureEnabled) {
        startScreenSnip();
      }
    } else if (request.action === 'GET_PAGE_INFO') {
      let selectedText = window.getSelection()?.toString() || '';
      
      // Get favicon
      let faviconUrl = '';
      const iconElement = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
      if (iconElement) {
        faviconUrl = iconElement.href;
      } else {
        faviconUrl = window.location.origin + '/favicon.ico';
      }
      
      sendResponse({
        title: document.title,
        url: window.location.href,
        selectedText: selectedText,
        faviconUrl: faviconUrl
      });
    }
    return true; // Keep message channel open for async if needed
  });
}

// Escuta a digitação nos campos de texto da página
document.addEventListener('keyup', async (e) => {
  if (e.key === 'PrintScreen') {
    if (autoCaptureEnabled && typeof chrome !== 'undefined' && chrome.runtime) {
      e.preventDefault();
      startScreenSnip();
    }
    return;
  }

  // Atalho para NOTA RÁPIDA: Alt + N
  if (e.altKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openQuickNote();
    return;
  }

  const target = e.target;
  if (!target) return;

  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  const isContentEditable = target.isContentEditable;

  if (!isInput && !isContentEditable) return;

  // Ignore navigation keys if menu is active
  if (magicMenuState.active && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
    return;
  }

  let text = '';
  if (isInput) {
    text = target.value.substring(0, target.selectionStart);
  } else if (isContentEditable) {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(target);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      text = preCaretRange.toString();
    }
  }

  if (!text) {
    if (magicMenuState.active) closeMagicMenu();
    return;
  }

  // Auto-replace by exact shortcut
  const textLower = text.toLowerCase();
  const matchingSnippet = snippets.find(s => s.shortcut && textLower.endsWith(s.shortcut.toLowerCase()));
  if (matchingSnippet) {
    if (magicMenuState.active) closeMagicMenu();
    insertSnippetContent(matchingSnippet, target, matchingSnippet.shortcut);
    return;
  }

  // MAGIC MENU TRIGGER
  const origWords = text.trimEnd().split(/\s+/);
  const lastWord = origWords[origWords.length - 1] || '';

  if (lastWord.startsWith('/')) {
    openMagicMenu(target, lastWord);
  } else {
    closeMagicMenu();
  }

}, true);
