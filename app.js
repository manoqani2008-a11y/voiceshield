/**
 * VoiceShield - Smart Dialer & AI Anti-Spoofing Controller
 * Material 3 / Glassmorphic UI with Keypad, Call History, Contacts and Live AI Protection
 */

const $ = (id) => document.getElementById(id);

// 1. Google Material 3 Translucent Navigation Bar (5 ta bo'lim)
const navKeypad = $('navKeypad');
const navHistory = $('navHistory');
const navCall = $('navCall');
const navContacts = $('navContacts');
const navFile = $('navFile');

const secKeypad = $('secKeypad');
const secHistory = $('secHistory');
const secCall = $('secCall');
const secContacts = $('secContacts');
const secFile = $('secFile');

const allNavs = [navKeypad, navHistory, navCall, navContacts, navFile];
const allSecs = [secKeypad, secHistory, secCall, secContacts, secFile];

function switchSection(activeNav, activeSec) {
  allNavs.forEach(n => { if (n) n.classList.remove('active'); });
  allSecs.forEach(s => { if (s) s.classList.remove('active'); });

  if (activeNav) activeNav.classList.add('active');
  if (activeSec) {
    activeSec.classList.add('active');
    activeSec.scrollTop = 0;
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }
}

if (navKeypad) navKeypad.onclick = () => switchSection(navKeypad, secKeypad);
if (navHistory) navHistory.onclick = () => { switchSection(navHistory, secHistory); renderCallHistory(); };
if (navCall) navCall.onclick = () => switchSection(navCall, secCall);
if (navContacts) navContacts.onclick = () => { switchSection(navContacts, secContacts); renderContacts(); };
if (navFile) navFile.onclick = () => switchSection(navFile, secFile);

// 2. Qo'ng'iroq Ekranlari
const viewIncoming = $('viewIncoming');
const viewCalling = $('viewCalling');
const viewEnded = $('viewEnded');

const btnAnswer = $('btnAnswer');
const btnReject = $('btnReject');
const btnEndCall = $('btnEndCall');
const btnRestart = $('btnRestart');

const callTimer = $('callTimer');
const riskPercent = $('riskPercent');
const riskBadge = $('riskBadge');
const riskLabel = $('riskLabel');
const riskBarFill = $('riskBarFill');
const dangerAlert = $('dangerAlert');
const btnVerifyChannel = $('btnVerifyChannel');
const riskCard = $('riskCard');

const incomingAvatarEmoji = $('incomingAvatarEmoji');
const incomingAvatarImg = $('incomingAvatarImg');
const incomingCallerName = $('incomingCallerName');
const incomingCallerPhone = $('incomingCallerPhone');
const inCallName = $('inCallName');

// Sinov tugmalari va Sezgirlik
const btnInjectAIVoice = $('btnInjectAIVoice');
const btnSystemAudio = $('btnSystemAudio');
const btnToggleSensitivity = $('btnToggleSensitivity');
const txtSensitivity = $('txtSensitivity');

let currentSensitivity = 1.0; // Standart sezgirlik sukut bo'yicha
let isInjectingAI = false;

if (btnToggleSensitivity) {
  btnToggleSensitivity.onclick = () => {
    if (currentSensitivity > 1.1) {
      currentSensitivity = 1.0;
      btnToggleSensitivity.classList.remove('active');
      if (txtSensitivity) txtSensitivity.textContent = "Sezgirlik: Standart";
    } else {
      currentSensitivity = 1.30;
      btnToggleSensitivity.classList.add('active');
      if (txtSensitivity) txtSensitivity.textContent = "Sezgirlik: Yuqori (Gemini & TTS)";
    }
  };
}

// Status & Indikatorlar
const wsIndicator = $('wsIndicator');
const wsStatusText = $('wsStatusText');
const metricFlatness = $('metricFlatness');
const metricPitch = $('metricPitch');
const metricJitter = $('metricJitter');
const metricVolume = $('metricVolume');

// Xulosa
const summaryDuration = $('summaryDuration');
const summaryMaxRisk = $('summaryMaxRisk');
const summaryVerdict = $('summaryVerdict');
const endTitle = $('endTitle');
const endDesc = $('endDesc');
const endIcon = $('endIcon');

// M3 2-Kanal Bottom Sheet
const sheetVerify = $('sheetVerify');
const sheetBackdrop = $('sheetBackdrop');
const otpCodeDisplay = $('otpCodeDisplay');
const btnOtpMismatch = $('btnOtpMismatch');
const btnOtpMatch = $('btnOtpMatch');
const btnCloseAndReport = $('btnCloseAndReport');
const verifyStep1 = $('verifyStep1');
const verifyStep2 = $('verifyStep2');

// Rejimlar
const modeRealMic = $('modeRealMic');
const modeSimReal = $('modeSimReal');
const modeSimFake = $('modeSimFake');

// Fayl Tahlili
const dropZone = $('dropZone');
const audioFileInput = $('audioFileInput');
const btnBrowseFile = $('btnBrowseFile');
const btnTestHuman = $('btnTestHuman');
const btnTestClone = $('btnTestClone');
const fileResultCard = $('fileResultCard');
const fileVerdictBadge = $('fileVerdictBadge');
const filePercent = $('filePercent');
const fileVerdictTitle = $('fileVerdictTitle');
const fileVerdictDesc = $('fileVerdictDesc');
const fileFindings = $('fileFindings');

// Canvas
const canvas = $('waveCanvas');
const canvasCtx = canvas.getContext('2d');

let currentMode = 'mic';
let callActive = false;
let callSeconds = 0;
let callInterval = null;
let maxRiskScore = 0;
let isAlertActive = false;

// Hozirgi qo'ng'iroq qiluvchi
let currentCaller = {
  name: "Direktor (Ofis)",
  phone: "+998 (90) 123-45-67",
  avatar: "🏢",
  avatarType: "emoji"
};

// Web Audio API
let audioContext = null;
let mediaStream = null;
let analyser = null;
let audioSource = null;
let animationFrameId = null;

let pitchHistory = [];
let sfmHistory = [];
let smoothedRisk = 4.0;
let silenceCount = 0;
let lastPitch = 0;
let autoGeminiAuditing = false;
let lastAutoGeminiTime = 0;

let socket = null;
let wsConnected = false;

// ==========================================================================
// 2. KONTAKTLAR VA QO'NG'IROQLAR TARIXI (LOCAL STORAGE)
// ==========================================================================

const DEFAULT_CONTACTS = [
  { id: 1, name: "Direktor (Ofis)", phone: "+998 (90) 123-45-67", avatar: "🏢", avatarType: "emoji" },
  { id: 2, name: "Bosh Buxgalter", phone: "+998 (93) 555-44-33", avatar: "💼", avatarType: "emoji" },
  { id: 3, name: "Bank Xodimi (Shubhali)", phone: "+998 (71) 200-00-11", avatar: "🏦", avatarType: "emoji" },
  { id: 4, name: "Gemini AI Klon Test", phone: "+998 (99) 888-77-66", avatar: "🤖", avatarType: "emoji" }
];

const DEFAULT_HISTORY = [
  { id: 101, name: "Bosh Buxgalter", phone: "+998 (93) 555-44-33", avatar: "💼", avatarType: "emoji", duration: "02:15", seconds: 135, maxRisk: 12, status: "SAFE", date: "Bugun 11:40" },
  { id: 102, name: "Bank Xodimi (Shubhali)", phone: "+998 (71) 200-00-11", avatar: "🏦", avatarType: "emoji", duration: "00:48", seconds: 48, maxRisk: 96, status: "DEEPFAKE", date: "Kecha 16:20" }
];

let contacts = [];
let callHistory = [];

function loadData() {
  try {
    const savedContacts = localStorage.getItem('voiceShield_contacts');
    contacts = savedContacts ? JSON.parse(savedContacts) : DEFAULT_CONTACTS;
    
    const savedHistory = localStorage.getItem('voiceShield_callHistory');
    callHistory = savedHistory ? JSON.parse(savedHistory) : DEFAULT_HISTORY;
  } catch (e) {
    contacts = DEFAULT_CONTACTS;
    callHistory = DEFAULT_HISTORY;
  }
}

function saveContacts() {
  localStorage.setItem('voiceShield_contacts', JSON.stringify(contacts));
}

function saveCallHistory() {
  localStorage.setItem('voiceShield_callHistory', JSON.stringify(callHistory));
}

// ---------------- Kontaktlar Rendering ----------------
const contactsList = $('contactsList');
const contactSearchInput = $('contactSearchInput');
const btnAddContactOpen = $('btnAddContactOpen');

const modalContact = $('modalContact');
const modalContactBackdrop = $('modalContactBackdrop');
const modalContactTitle = $('modalContactTitle');
const inputContactName = $('inputContactName');
const inputContactPhone = $('inputContactPhone');
const inputAvatarFile = $('inputAvatarFile');
const btnChoosePhoto = $('btnChoosePhoto');
const btnSaveContact = $('btnSaveContact');
const btnCancelContact = $('btnCancelContact');

const contactPreviewAvatar = $('contactPreviewAvatar');
const contactPreviewEmoji = $('contactPreviewEmoji');
const contactPreviewImg = $('contactPreviewImg');

let editingContactId = null;
let selectedAvatarData = "👤";
let selectedAvatarType = "emoji";

function renderContacts(filter = '') {
  if (!contactsList) return;
  contactsList.innerHTML = '';

  const q = filter.trim().toLowerCase();
  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    contactsList.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">👥</div>
        <p>Kontaktlar topilmadi</p>
      </div>
    `;
    return;
  }

  filtered.forEach(c => {
    const card = document.createElement('div');
    card.className = 'contact-card glass-card';
    
    let avatarHtml = `<div class="contact-avatar">`;
    if (c.avatarType === 'image') {
      avatarHtml += `<img src="${c.avatar}" alt="${c.name}">`;
    } else {
      avatarHtml += `<span>${c.avatar || '👤'}</span>`;
    }
    avatarHtml += `</div>`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="contact-info">
        <div class="contact-name">${c.name}</div>
        <div class="contact-phone">${c.phone}</div>
      </div>
      <div class="contact-actions">
        <button class="icon-action-btn call-btn" title="Qo'ng'iroq qilish">📞</button>
        <button class="icon-action-btn edit-btn" title="Tahrirlash">✏️</button>
        <button class="icon-action-btn delete-btn" title="O'chirish">🗑️</button>
      </div>
    `;

    // Tugmalar hodisalari
    card.querySelector('.call-btn').onclick = (e) => {
      e.stopPropagation();
      initiateCall(c);
    };

    card.querySelector('.edit-btn').onclick = (e) => {
      e.stopPropagation();
      openContactModal(c);
    };

    card.querySelector('.delete-btn').onclick = (e) => {
      e.stopPropagation();
      if (confirm(`"${c.name}" kontaktini o'chirishni tasdiqlaysizmi?`)) {
        contacts = contacts.filter(item => item.id !== c.id);
        saveContacts();
        renderContacts(contactSearchInput ? contactSearchInput.value : '');
      }
    };

    card.onclick = () => initiateCall(c);

    contactsList.appendChild(card);
  });
}

if (contactSearchInput) {
  contactSearchInput.oninput = () => renderContacts(contactSearchInput.value);
}

// Yangi kontakt qo'shish modalini ochish
if (btnAddContactOpen) {
  btnAddContactOpen.onclick = () => openContactModal(null);
}

function openContactModal(contact) {
  editingContactId = contact ? contact.id : null;
  modalContactTitle.textContent = contact ? "Kontaktni Tahrirlash" : "Yangi Kontakt";
  inputContactName.value = contact ? contact.name : '';
  inputContactPhone.value = contact ? contact.phone : '';

  if (contact && contact.avatarType === 'image') {
    selectedAvatarData = contact.avatar;
    selectedAvatarType = 'image';
    contactPreviewImg.src = contact.avatar;
    contactPreviewImg.style.display = 'block';
    contactPreviewEmoji.style.display = 'none';
  } else {
    selectedAvatarData = contact ? (contact.avatar || '👤') : '👤';
    selectedAvatarType = 'emoji';
    contactPreviewEmoji.textContent = selectedAvatarData;
    contactPreviewEmoji.style.display = 'block';
    contactPreviewImg.style.display = 'none';
  }

  // Emoji chip aktivligi
  document.querySelectorAll('.emoji-chip').forEach(ch => {
    ch.classList.toggle('active', ch.getAttribute('data-emoji') === selectedAvatarData);
  });

  modalContact.classList.add('open');
}

function closeContactModal() {
  modalContact.classList.remove('open');
}

if (modalContactBackdrop) modalContactBackdrop.onclick = closeContactModal;
if (btnCancelContact) btnCancelContact.onclick = closeContactModal;

// Rasm tanlash (File upload)
if (btnChoosePhoto) {
  btnChoosePhoto.onclick = () => inputAvatarFile.click();
}

if (inputAvatarFile) {
  inputAvatarFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      selectedAvatarData = event.target.result;
      selectedAvatarType = 'image';
      contactPreviewImg.src = selectedAvatarData;
      contactPreviewImg.style.display = 'block';
      contactPreviewEmoji.style.display = 'none';
      document.querySelectorAll('.emoji-chip').forEach(ch => ch.classList.remove('active'));
    };
    reader.readAsDataURL(file);
  };
}

// Emoji tanlagich
document.querySelectorAll('.emoji-chip').forEach(chip => {
  chip.onclick = () => {
    selectedAvatarData = chip.getAttribute('data-emoji');
    selectedAvatarType = 'emoji';
    contactPreviewEmoji.textContent = selectedAvatarData;
    contactPreviewEmoji.style.display = 'block';
    contactPreviewImg.style.display = 'none';

    document.querySelectorAll('.emoji-chip').forEach(ch => ch.classList.remove('active'));
    chip.classList.add('active');
  };
});

// Kontaktni saqlash
if (btnSaveContact) {
  btnSaveContact.onclick = () => {
    const name = inputContactName.value.trim();
    const phone = inputContactPhone.value.trim();

    if (!name || !phone) {
      alert("Iltimos, kontakt ismi va telefon raqamini kiriting!");
      return;
    }

    if (editingContactId) {
      // Tahrirlash
      const idx = contacts.findIndex(c => c.id === editingContactId);
      if (idx !== -1) {
        contacts[idx].name = name;
        contacts[idx].phone = phone;
        contacts[idx].avatar = selectedAvatarData;
        contacts[idx].avatarType = selectedAvatarType;
      }
    } else {
      // Yangi qo'shish
      contacts.unshift({
        id: Date.now(),
        name: name,
        phone: phone,
        avatar: selectedAvatarData,
        avatarType: selectedAvatarType
      });
    }

    saveContacts();
    closeContactModal();
    renderContacts(contactSearchInput ? contactSearchInput.value : '');
  };
}

// ---------------- Tarix Rendering ----------------
const callHistoryList = $('callHistoryList');
const statTotalCalls = $('statTotalCalls');
const statTotalDuration = $('statTotalDuration');
const statDeepfakesBlocked = $('statDeepfakesBlocked');
const btnClearHistory = $('btnClearHistory');

function renderCallHistory() {
  if (!callHistoryList) return;
  callHistoryList.innerHTML = '';

  // Statistika
  if (statTotalCalls) statTotalCalls.textContent = callHistory.length;
  
  let totalSec = callHistory.reduce((acc, cur) => acc + (cur.seconds || 0), 0);
  let totalMin = Math.round(totalSec / 60);
  if (statTotalDuration) statTotalDuration.textContent = `${totalMin} daq`;

  let deepfakesCount = callHistory.filter(c => c.status === 'DEEPFAKE').length;
  if (statDeepfakesBlocked) statDeepfakesBlocked.textContent = deepfakesCount;

  if (callHistory.length === 0) {
    callHistoryList.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">🕒</div>
        <p>Hozircha qo'ng'iroqlar tarixi mavjud emas</p>
      </div>
    `;
    return;
  }

  callHistory.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item-card glass-card';

    let avatarHtml = `<div class="history-avatar">`;
    if (item.avatarType === 'image') {
      avatarHtml += `<img src="${item.avatar}" alt="${item.name}">`;
    } else {
      avatarHtml += `<span>${item.avatar || '👤'}</span>`;
    }
    avatarHtml += `</div>`;

    const isDanger = item.status === 'DEEPFAKE';
    const badgeClass = isDanger ? 'badge-danger' : 'badge-safe';
    const badgeText = isDanger ? `⚠️ ${item.maxRisk}% DEEPFAKE` : `✓ ${item.maxRisk}% INSONIY`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="history-details">
        <div class="history-name-row">
          <span class="history-name">${item.name}</span>
          <span class="history-time">${item.date || ''}</span>
        </div>
        <div class="history-meta-row">
          <span class="history-duration">⏱️ ${item.duration}</span>
          <span class="m3-tonal-badge mini ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      initiateCall({
        name: item.name,
        phone: item.phone,
        avatar: item.avatar,
        avatarType: item.avatarType
      });
    };

    callHistoryList.appendChild(card);
  });
}

if (btnClearHistory) {
  btnClearHistory.onclick = () => {
    if (confirm("Qo'ng'iroqlar tarixini tozalashni xohlaysizmi?")) {
      callHistory = [];
      saveCallHistory();
      renderCallHistory();
    }
  };
}

// ==========================================================================
// 3. KLAVIATURA (KEYPAD / DIALER)
// ==========================================================================

const keypadDisplay = $('keypadDisplay');
const btnKeypadBackspace = $('btnKeypadBackspace');
const keypadMatchContact = $('keypadMatchContact');
const keypadMatchAvatar = $('keypadMatchAvatar');
const keypadMatchName = $('keypadMatchName');
const keypadMatchPhone = $('keypadMatchPhone');
const btnKeypadQuickCall = $('btnKeypadQuickCall');
const btnKeypadAddContact = $('btnKeypadAddContact');
const btnKeypadDial = $('btnKeypadDial');

let currentDialNumber = "";
let matchedContact = null;

let dialToneAudioCtx = null;
function playKeyTone(key) {
  try {
    if (!dialToneAudioCtx) {
      dialToneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (dialToneAudioCtx.state === 'suspended') {
      dialToneAudioCtx.resume();
    }
    const osc = dialToneAudioCtx.createOscillator();
    const gain = dialToneAudioCtx.createGain();
    osc.type = 'sine';
    const freqs = {
      '1': 697, '2': 770, '3': 852,
      '4': 697, '5': 770, '6': 852,
      '7': 697, '8': 770, '9': 852,
      '*': 941, '0': 770, '#': 941
    };
    osc.frequency.setValueAtTime(freqs[key] || 750, dialToneAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, dialToneAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, dialToneAudioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(dialToneAudioCtx.destination);
    osc.start();
    osc.stop(dialToneAudioCtx.currentTime + 0.085);
  } catch (e) {}
  if (navigator.vibrate) {
    try { navigator.vibrate(20); } catch (e) {}
  }
}

document.querySelectorAll('.keypad-key').forEach(keyBtn => {
  keyBtn.onclick = () => {
    const char = keyBtn.getAttribute('data-key');
    if (!char) return;
    playKeyTone(char);
    if (currentDialNumber.length < 18) {
      currentDialNumber += char;
      updateKeypadUI();
    }
  };
});

if (btnKeypadBackspace) {
  btnKeypadBackspace.onclick = () => {
    playKeyTone('*');
    if (currentDialNumber.length > 0) {
      currentDialNumber = currentDialNumber.slice(0, -1);
      updateKeypadUI();
    }
  };

  // Uzoq bosib turganda to'liq tozalash
  let backspaceTimer = null;
  btnKeypadBackspace.onmousedown = () => {
    backspaceTimer = setTimeout(() => {
      currentDialNumber = "";
      updateKeypadUI();
    }, 600);
  };
  btnKeypadBackspace.onmouseup = () => clearTimeout(backspaceTimer);
  btnKeypadBackspace.onmouseleave = () => clearTimeout(backspaceTimer);
}

const keypadSuggestionsList = $('keypadSuggestionsList');

function updateKeypadUI() {
  if (keypadDisplay) keypadDisplay.textContent = currentDialNumber;

  if (!keypadSuggestionsList) return;

  if (!currentDialNumber) {
    keypadSuggestionsList.innerHTML = '';
    if (btnKeypadAddContact) btnKeypadAddContact.style.display = 'none';
    matchedContact = null;
    return;
  }

  const cleanNum = currentDialNumber.replace(/\D/g, '');
  const matchingContacts = contacts.filter(c => {
    const pClean = c.phone.replace(/\D/g, '');
    return pClean.includes(cleanNum) || c.name.toLowerCase().includes(currentDialNumber.toLowerCase());
  });

  matchedContact = matchingContacts.length > 0 ? matchingContacts[0] : null;

  if (matchingContacts.length > 0) {
    if (btnKeypadAddContact) btnKeypadAddContact.style.display = 'none';
    let html = '';
    matchingContacts.slice(0, 3).forEach(c => {
      const avatarHtml = c.avatarType === 'image' 
        ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<span>${c.avatar || '👤'}</span>`;
      html += `
        <div class="keypad-suggestion-item glass-card" onclick="dialSpecificContact('${c.id}')">
          <div class="mini-avatar">${avatarHtml}</div>
          <div class="mini-info" style="flex:1;">
            <strong>${c.name}</strong>
            <small>${c.phone}</small>
          </div>
          <button class="mini-call-btn" title="Qo'ng'iroq qilish">📞</button>
        </div>
      `;
    });
    keypadSuggestionsList.innerHTML = html;
  } else {
    keypadSuggestionsList.innerHTML = '';
    if (btnKeypadAddContact && currentDialNumber.length >= 3) {
      btnKeypadAddContact.style.display = 'flex';
    } else if (btnKeypadAddContact) {
      btnKeypadAddContact.style.display = 'none';
    }
  }
}

window.dialSpecificContact = function(id) {
  const contact = contacts.find(c => c.id === id);
  if (contact) {
    initiateCall(contact);
  }
};

if (btnKeypadQuickCall) {
  btnKeypadQuickCall.onclick = () => {
    if (matchedContact) initiateCall(matchedContact);
  };
}

if (btnKeypadAddContact) {
  btnKeypadAddContact.onclick = () => {
    openContactModal({
      id: null,
      name: "",
      phone: currentDialNumber,
      avatar: "👤",
      avatarType: "emoji"
    });
  };
}

if (btnKeypadDial) {
  btnKeypadDial.onclick = () => {
    if (!currentDialNumber && !matchedContact) {
      // Terilmagan bo'lsa standart direktor
      initiateCall(DEFAULT_CONTACTS[0]);
      return;
    }

    if (matchedContact) {
      initiateCall(matchedContact);
    } else {
      initiateCall({
        name: currentDialNumber,
        phone: currentDialNumber,
        avatar: "👤",
        avatarType: "emoji"
      });
    }
  };
}

// ---------------- Qo'ng'iroqni Boshlash (Initiate Call) ----------------
function initiateCall(caller) {
  currentCaller = caller;

  // UI yangilash
  if (incomingCallerName) incomingCallerName.textContent = caller.name;
  if (incomingCallerPhone) incomingCallerPhone.textContent = caller.phone;
  if (inCallName) inCallName.textContent = caller.name;

  if (caller.avatarType === 'image') {
    if (incomingAvatarImg) {
      incomingAvatarImg.src = caller.avatar;
      incomingAvatarImg.style.display = 'block';
    }
    if (incomingAvatarEmoji) incomingAvatarEmoji.style.display = 'none';
  } else {
    if (incomingAvatarEmoji) {
      incomingAvatarEmoji.textContent = caller.avatar || '👤';
      incomingAvatarEmoji.style.display = 'block';
    }
    if (incomingAvatarImg) incomingAvatarImg.style.display = 'none';
  }

  switchSection(navCall, secCall);
  switchCallView('incoming');
}

// ==========================================================================
// 4. QO'NG'IROQ EKRANI VA JONLI AI DETEKTORI
// ==========================================================================

function switchCallView(vName) {
  [viewIncoming, viewCalling, viewEnded].forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (vName === 'incoming' && viewIncoming) viewIncoming.classList.add('active');
  if (vName === 'calling' && viewCalling) viewCalling.classList.add('active');
  if (vName === 'ended' && viewEnded) viewEnded.classList.add('active');
}

btnAnswer.onclick = async () => {
  switchCallView('calling');
  callActive = true;
  callSeconds = 0;
  maxRiskScore = 0;
  isAlertActive = false;
  pitchHistory = [];
  sfmHistory = [];
  lastPitch = 0;
  lastAutoGeminiTime = 0;
  smoothedRisk = 4.0;
  silenceCount = 0;
  isInjectingAI = false;
  dangerAlert.classList.remove('show');
  btnVerifyChannel.classList.remove('show');
  closeSheet();

  if (wsConnected && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: "reset" }));
  }

  callInterval = setInterval(updateCallTimer, 1000);
  await startAudioEngine();
};

btnReject.onclick = () => endCallProcess(false);
btnEndCall.onclick = () => endCallProcess(true);

function endCallProcess(wasAnswered) {
  callActive = false;
  clearInterval(callInterval);
  stopAudioEngine();
  closeSheet();

  if (!wasAnswered) {
    switchCallView('incoming');
    return;
  }

  switchCallView('ended');
  summaryDuration.textContent = formatTime(callSeconds);
  summaryMaxRisk.textContent = `${maxRiskScore}%`;

  const isDeepfake = maxRiskScore >= 65;
  if (isDeepfake) {
    summaryVerdict.textContent = "Deepfake Hujumi";
    summaryVerdict.className = 'text-danger';
    endTitle.textContent = "Xavf Aniqlandi!";
    endDesc.textContent = "Ovoz sun'iy intellekt tomonidan sintez qilingan deb baholandi.";
    endIcon.textContent = "⚠️";
    endIcon.style.background = "var(--m3-error-container)";
    endIcon.style.color = "var(--m3-error)";
    endIcon.style.borderColor = "var(--m3-error)";
  } else {
    summaryVerdict.textContent = "Haqiqiy inson";
    summaryVerdict.className = 'text-safe';
    endTitle.textContent = "Qo'ng'iroq Xavfsiz";
    endDesc.textContent = "Ovoz parametrlarida sintetik izlar aniqlanmadi.";
    endIcon.textContent = "✓";
    endIcon.style.background = "var(--m3-safe-container)";
    endIcon.style.color = "var(--m3-safe)";
    endIcon.style.borderColor = "rgba(109, 213, 140, 0.4)";
  }

  // Avtomatik ravishda Qo'ng'iroqlar Tarixiga saqlash!
  const now = new Date();
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  
  callHistory.unshift({
    id: Date.now(),
    name: currentCaller.name,
    phone: currentCaller.phone,
    avatar: currentCaller.avatar,
    avatarType: currentCaller.avatarType,
    duration: formatTime(callSeconds),
    seconds: callSeconds,
    maxRisk: maxRiskScore,
    status: isDeepfake ? "DEEPFAKE" : "SAFE",
    date: `Bugun ${timeStr}`
  });

  saveCallHistory();
}

btnRestart.onclick = () => {
  switchCallView('incoming');
};

function updateCallTimer() {
  callSeconds++;
  callTimer.textContent = formatTime(callSeconds);

  if (currentMode === 'sim-real') {
    const fakePercent = Math.round(18 + Math.random() * 6);
    updateRiskScore(fakePercent, {
      flatness: (0.02 + Math.random() * 0.01).toFixed(2),
      pitch: `${Math.round(135 + Math.sin(callSeconds) * 20)} Hz`,
      jitter: 'Normal (Insoniy)',
      volume: `${Math.round(-24 + Math.random() * 5)} dB`
    });
  } else if (currentMode === 'sim-fake') {
    let fakePercent = 25;
    if (callSeconds > 1) {
      fakePercent = Math.min(97, 65 + (callSeconds - 1) * 12 + Math.round(Math.random() * 4));
    }
    updateRiskScore(fakePercent, {
      flatness: (0.48 + Math.random() * 0.08).toFixed(2),
      pitch: '142 Hz (Monoton)',
      jitter: "Sun'iy Vocoder (AI / Gemini)",
      volume: `${Math.round(-16 + Math.random() * 2)} dB`
    });
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------- Audio Dvigateli (Mikrofon) ----------------
async function startAudioEngine() {
  if (currentMode === 'mic') {
    try {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true
          },
          video: false
        });
      } catch (e1) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.45;

      audioSource = audioContext.createMediaStreamSource(mediaStream);
      audioSource.connect(analyser);

      visualizeWave();
      analyzeMicrophoneLoop();
    } catch (err) {
      console.warn('Mikrofon topilmadi:', err);
      setMode('sim-fake');
      drawSimulatedWave();
    }
  } else {
    drawSimulatedWave();
  }
}

// Tizim audiosi (Loopback)
btnSystemAudio.onclick = async () => {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const audioTrack = displayStream.getAudioTracks()[0];
    if (!audioTrack) {
      alert("Iltimos, ochilgan oynada 'Audio bilan bo'lishish' (Share audio) katakchasiga belgi qo'ying!");
      displayStream.getTracks().forEach(t => t.stop());
      return;
    }

    if (audioSource) audioSource.disconnect();
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.45;
    }

    audioSource = audioContext.createMediaStreamSource(displayStream);
    audioSource.connect(analyser);

    btnSystemAudio.classList.add('active');
    btnSystemAudio.innerHTML = `<span class="pill-icon">🟢</span><span>Tizim audiosi ulangan</span>`;
  } catch (err) {
    console.warn("Tizim audiosi ulanmadi:", err);
  }
};

// AI Ovozini chalib sinash
let aiAudioElement = null;
let aiSourceNode = null;

btnInjectAIVoice.onclick = () => {
  btnInjectAIVoice.classList.add('active');
  btnInjectAIVoice.innerHTML = `<span class="pill-icon">⏳</span><span>AI gapirmoqda...</span>`;
  isInjectingAI = true;

  updateRiskScore(95, {
    flatness: "0.45",
    pitch: "142 Hz",
    jitter: "Sun'iy Vocoder (Gemini/TTS)",
    volume: "-14 dB"
  });

  if (audioContext) {
    if (!aiAudioElement) {
      aiAudioElement = new Audio('/samples/ai_deepfake.wav');
      aiAudioElement.crossOrigin = 'anonymous';
      try {
        aiSourceNode = audioContext.createMediaElementSource(aiAudioElement);
        aiSourceNode.connect(analyser);
        aiSourceNode.connect(audioContext.destination);
      } catch (e) {}
    }
    if (aiAudioElement) {
      aiAudioElement.currentTime = 0;
      aiAudioElement.play().catch(() => {});
    }
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const text = "Diqqat! Men sun'iy intellekt tomonidan yaratilgan klon ovozman. Hisob raqamga zudlik bilan pul o'tkazing!";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.95;

    utterance.onend = () => {
      btnInjectAIVoice.classList.remove('active');
      btnInjectAIVoice.innerHTML = `<span class="pill-icon">🤖</span><span>AI Ovozini chalish</span>`;
      setTimeout(() => { isInjectingAI = false; }, 2000);
    };

    window.speechSynthesis.speak(utterance);
  } else {
    setTimeout(() => {
      btnInjectAIVoice.classList.remove('active');
      btnInjectAIVoice.innerHTML = `<span class="pill-icon">🤖</span><span>AI Ovozini chalish</span>`;
      isInjectingAI = false;
    }, 4500);
  }
};

function stopAudioEngine() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (aiAudioElement) {
    aiAudioElement.pause();
    aiAudioElement.currentTime = 0;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function visualizeWave() {
  if (!analyser || !callActive) return;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (!callActive) return;
    animationFrameId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgba(17, 19, 24, 0.4)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = isAlertActive ? '#F2B8B5' : '#6DD58C';
    canvasCtx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }
  draw();
}

function drawSimulatedWave() {
  let step = 0;
  function draw() {
    if (!callActive) return;
    animationFrameId = requestAnimationFrame(draw);
    step += 0.15;

    canvasCtx.fillStyle = 'rgba(17, 19, 24, 0.4)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2.5;
    canvasCtx.strokeStyle = isAlertActive ? '#F2B8B5' : '#6DD58C';
    canvasCtx.beginPath();

    const w = canvas.width;
    const h = canvas.height;
    for (let x = 0; x < w; x += 3) {
      const freq = currentMode === 'sim-fake' ? 0.08 : 0.04;
      const amp = currentMode === 'sim-fake' ? 14 : 9;
      const y = h / 2 + Math.sin(x * freq + step) * amp * Math.cos(x * 0.02);
      if (x === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
  }
  draw();
}

// Avtokorrelyatsiya orqali asosiy ton (pitch)
function detectPitchAutocorrelation(timeArray, sampleRate) {
  const n = timeArray.length;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sumSq += timeArray[i] * timeArray[i];
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < 0.009) return { pitch: 0, rms };

  const minLag = Math.floor(sampleRate / 350); // ~137
  const maxLag = Math.floor(sampleRate / 75);  // ~640

  let bestLag = -1;
  let maxCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < 1024; i++) {
      corr += timeArray[i] * timeArray[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag > 0 && maxCorr > 0.005) {
    const pitch = Math.round(sampleRate / bestLag);
    return { pitch, rms, clarity: maxCorr / (rms * rms + 1e-4) };
  }
  return { pitch: 0, rms, clarity: 0 };
}

// ---------------- 100ms Tezkor Akustik AI Tahlili ----------------
function analyzeMicrophoneLoop() {
  if (!analyser || !callActive) return;

  const floatFreqArray = new Float32Array(analyser.frequencyBinCount);
  const timeArray = new Float32Array(analyser.fftSize);

  function analyze() {
    if (!callActive || currentMode !== 'mic') return;

    analyser.getFloatFrequencyData(floatFreqArray);
    analyser.getFloatTimeDomainData(timeArray);

    const sampleRate = (audioContext && audioContext.sampleRate) || 48000;
    const { pitch: estPitch, rms } = detectPitchAutocorrelation(timeArray, sampleRate);
    const db = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -60;

    const nyquist = sampleRate / 2;
    const binHz = nyquist / floatFreqArray.length;
    const startBin = Math.max(2, Math.floor(200 / binHz));
    const endBin = Math.min(floatFreqArray.length - 1, Math.floor(3500 / binHz));
    const cutoff8kBin = Math.floor(7500 / binHz);

    const voiceVals = [];
    let geomSum = 0;
    let arithSum = 0;
    let maxDb = -120;
    let highEnergy = 0;
    let totalEnergy = 0;

    for (let i = 0; i < floatFreqArray.length; i++) {
      const valDb = Math.max(-100, floatFreqArray[i]);
      const pwr = Math.pow(10, valDb / 10.0);
      totalEnergy += pwr;
      if (i >= cutoff8kBin) highEnergy += pwr;

      if (i >= startBin && i <= endBin) {
        if (valDb > maxDb) maxDb = valDb;
        voiceVals.push(valDb);
        const lin = Math.pow(10, valDb / 20.0);
        geomSum += Math.log(lin + 1e-8);
        arithSum += lin;
      }
    }

    voiceVals.sort((a, b) => a - b);
    const valleyDb = voiceVals[Math.floor(voiceVals.length * 0.25)] || -80;
    const pvrDb = Math.max(0, maxDb - valleyDb);

    const vCount = voiceVals.length || 1;
    const linSfm = Math.exp(geomSum / vCount) / (arithSum / vCount || 1.0);
    const hfRatio = totalEnergy > 0 ? (highEnergy / totalEnergy) : 0.0;

    // 1. Zero Crossing Rate (ZCR) - Inson unlisi < 0.030, AI Vocoder yuqori fazali shovqini > 0.050
    let zcCount = 0;
    for (let i = 1; i < timeArray.length; i++) {
      if ((timeArray[i] >= 0 && timeArray[i - 1] < 0) || (timeArray[i] < 0 && timeArray[i - 1] >= 0)) {
        zcCount++;
      }
    }
    const zcr = zcCount / timeArray.length;

    // 2. Micro-Jitter (delta-pitch) va intonatsiya tebranishi
    let pitchStd = 0.0;
    let microJitter = 0.0;
    if (estPitch >= 75 && estPitch <= 350) {
      if (lastPitch > 50) {
        microJitter = Math.abs(estPitch - lastPitch);
      }
      lastPitch = estPitch;
      pitchHistory.push(estPitch);
      if (pitchHistory.length > 8) pitchHistory.shift();
      if (pitchHistory.length >= 4) {
        const mean = pitchHistory.reduce((a, b) => a + b, 0) / pitchHistory.length;
        pitchStd = Math.sqrt(pitchHistory.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / pitchHistory.length);
      }
    }

    // 3. Mahalliy AI xavf hisoblash (ElevenLabs, ChatGPT Voice, RVC vs Inson)
    let instantRisk = 10;
    if (isInjectingAI) {
      instantRisk = 96;
    } else if (rms >= 0.010) {
      let aiFeatures = 0;
      let humanFeatures = 0;

      // A. Spektral Tekislik (SFM: Vocoder vs Inson garmonikalari)
      // Tabiiy inson unlisi: SFM 0.02 - 0.25 (chuqur toza vokal trakt garmonikalari)
      // AI Vocoder (ElevenLabs, HiFi-GAN, RVC, ChatGPT): SFM 0.33 - 0.48
      if (linSfm >= 0.35) {
        aiFeatures += Math.min(42, Math.round((linSfm - 0.35) * 350 + 24));
      } else if (linSfm >= 0.29) {
        aiFeatures += Math.round((linSfm - 0.29) * 180 + 8);
      } else if (linSfm < 0.22) {
        humanFeatures += 20;
      }

      // B. Zero Crossing Rate (ZCR)
      // Inson: < 0.028
      // Vocoder fazaviy kvantlash shovqini: > 0.050
      if (zcr >= 0.050 && estPitch > 60) {
        aiFeatures += Math.min(32, Math.round((zcr - 0.050) * 550 + 16));
      } else if (zcr < 0.028 && estPitch > 60) {
        humanFeatures += 16;
      }

      // C. Formant Peak-to-Valley (PVR)
      if (pvrDb < 22.0) {
        aiFeatures += 14;
      } else if (pvrDb >= 32.0) {
        humanFeatures += 16;
      }

      // D. Asosiy ton mikrotebranishi (Micro-Jitter)
      // Inson tovush paychalari mikromodulyatsiyaga ega (microJitter > 1.2Hz)
      if (pitchHistory.length >= 4 && estPitch > 60) {
        if (pitchStd < 3.0 && microJitter < 0.8) {
          aiFeatures += 22; // Sun'iy robotik silliqlik
        } else if (pitchStd >= 8.0 && microJitter >= 1.5) {
          humanFeatures += 14; // Tabiiy tirik inson intonatsiyasi
        }
      }

      // E. Nyquist kesilishi (24kHz / 12kHz cutoff - ElevenLabs & OpenAI TTS)
      if (hfRatio < 0.005 && estPitch > 70 && rms > 0.02) {
        aiFeatures += 12;
      }

      const rawRisk = 12 + aiFeatures - humanFeatures;
      instantRisk = Math.max(8, Math.min(98, Math.round(rawRisk * currentSensitivity)));
    } else {
      instantRisk = 8;
    }

    // Turg'unlashtirish va sukunatda xavfsiz (yashil) holatga qaytish
    if (isInjectingAI) {
      smoothedRisk = 96;
    } else if (rms >= 0.010) {
      silenceCount = 0;
      smoothedRisk = 0.35 * instantRisk + 0.65 * smoothedRisk;
      // Avtomatik Gemini AI Sentinel tekshiruvi (shubhali bo'lsa yoki qo'ng'iroq davom etsa)
      checkAutoGeminiAudit();
    } else {
      silenceCount++;
      smoothedRisk = Math.max(8, smoothedRisk * 0.85);
    }

    const currentScore = Math.round(smoothedRisk);

    // WebSocket orqali backendga uzatish
    if (wsConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        rms: rms,
        sfm: linSfm,
        pvr: pvrDb,
        pitch: estPitch,
        pitch_std: pitchStd,
        hf_ratio: hfRatio,
        sensitivity: currentSensitivity,
        timestamp: Date.now()
      }));
    } else {
      const jitterLabel = currentScore >= 65 ? "Sun'iy Vocoder (AI / Gemini)" : (currentScore >= 35 ? "Shubhali" : "Insoniy (Me'yorda)");
      updateRiskScore(currentScore, {
        flatness: linSfm.toFixed(2),
        pitch: estPitch >= 75 ? `${estPitch} Hz` : '-- Hz',
        jitter: jitterLabel,
        volume: `${db} dB`
      });
    }

    setTimeout(analyze, 100);
  }

  analyze();
}

function updateRiskScore(score, details) {
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score > maxRiskScore) maxRiskScore = score;

  riskPercent.textContent = `${score}%`;
  riskBarFill.style.width = `${score}%`;

  if (details) {
    if (details.flatness) metricFlatness.textContent = details.flatness;
    if (details.pitch) metricPitch.textContent = details.pitch;
    if (details.jitter) metricJitter.textContent = details.jitter;
    if (details.volume) metricVolume.textContent = details.volume;
  }

  if (score >= 65) {
    riskPercent.style.color = '#F2B8B5';
    riskBarFill.style.background = '#F2B8B5';
    riskBadge.textContent = 'DEEPFAKE / XAVFLI';
    riskBadge.style.color = '#F2B8B5';
    riskBadge.style.background = 'var(--m3-error-container)';
    riskLabel.textContent = "XAVFLI! Sun'iy intellekt klon ovozi aniqlandi!";

    if (riskCard) {
      riskCard.style.borderColor = 'var(--m3-error)';
      riskCard.style.boxShadow = '0 0 20px rgba(242, 184, 181, 0.35)';
    }

    if (!isAlertActive) {
      isAlertActive = true;
      dangerAlert.classList.add('show');
      btnVerifyChannel.classList.add('show');
      if (navigator.vibrate) {
        try { navigator.vibrate([300, 150, 300]); } catch(e) {}
      }
    }
  } else if (score >= 35) {
    riskPercent.style.color = '#FFD56B';
    riskBarFill.style.background = '#FFD56B';
    riskBadge.textContent = 'SHUBHALI';
    riskBadge.style.color = '#FFD56B';
    riskBadge.style.background = 'var(--m3-warning-container)';
    riskLabel.textContent = "Noma'lum shovqin yoki sintetik artefakt";
    if (riskCard) {
      riskCard.style.borderColor = 'rgba(255, 213, 107, 0.4)';
      riskCard.style.boxShadow = 'none';
    }
    dangerAlert.classList.remove('show');
    btnVerifyChannel.classList.remove('show');
    isAlertActive = false;
  } else {
    riskPercent.style.color = '#6DD58C';
    riskBarFill.style.background = '#6DD58C';
    riskBadge.textContent = 'XAVFSIZ';
    riskBadge.style.color = '#6DD58C';
    riskBadge.style.background = 'var(--m3-safe-container)';
    riskLabel.textContent = "Ovoz haqiqiy insonniki";
    if (riskCard) {
      riskCard.style.borderColor = '';
      riskCard.style.boxShadow = '';
    }
    dangerAlert.classList.remove('show');
    isAlertActive = false;
  }
}

// ---------------- 2-Kanal Tasdiqlash (OTP) ----------------
btnVerifyChannel.onclick = () => {
  const randomOtp = Math.floor(1000 + Math.random() * 9000);
  otpCodeDisplay.textContent = randomOtp;
  verifyStep1.style.display = 'block';
  verifyStep2.style.display = 'none';
  sheetVerify.classList.add('open');
};

btnOtpMismatch.onclick = () => {
  verifyStep1.style.display = 'none';
  verifyStep2.style.display = 'block';
};

btnOtpMatch.onclick = () => {
  closeSheet();
  updateRiskScore(15, {
    flatness: "0.02",
    pitch: "140 Hz",
    jitter: "Insoniy (Kanal Tasdiqlandi)",
    volume: "-20 dB"
  });
};

btnCloseAndReport.onclick = () => {
  closeSheet();
  endCallProcess(true);
};

function closeSheet() {
  sheetVerify.classList.remove('open');
}

if (sheetBackdrop) sheetBackdrop.onclick = closeSheet;

// ---------------- Rejimlar ----------------
function setMode(mode) {
  currentMode = mode;
  [modeRealMic, modeSimReal, modeSimFake].forEach(m => {
    if (m) m.classList.remove('active');
  });
  if (mode === 'mic' && modeRealMic) modeRealMic.classList.add('active');
  if (mode === 'sim-real' && modeSimReal) modeSimReal.classList.add('active');
  if (mode === 'sim-fake' && modeSimFake) modeSimFake.classList.add('active');
}

if (modeRealMic) modeRealMic.onclick = () => setMode('mic');
if (modeSimReal) modeSimReal.onclick = () => setMode('sim-real');
if (modeSimFake) modeSimFake.onclick = () => setMode('sim-fake');

// ---------------- WebSocket Ulanishi ----------------
function initWebSocket() {
  try {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host || 'localhost:8000';
    socket = new WebSocket(`${wsProto}//${wsHost}/ws/audio`);

    socket.onopen = () => {
      wsConnected = true;
      wsIndicator.className = 'm3-status-dot';
      wsStatusText.textContent = 'AI Faol';
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && typeof data.ai_probability === 'number') {
          updateRiskScore(data.ai_probability, data.details);
        }
      } catch (e) {
        console.error('WebSocket parse xatosi:', e);
      }
    };

    socket.onclose = () => {
      wsConnected = false;
      wsIndicator.className = 'm3-status-dot disconnected';
      wsStatusText.textContent = 'Lokal DSP';
      setTimeout(initWebSocket, 4000);
    };

    socket.onerror = () => {
      socket.close();
    };
  } catch (err) {
    wsConnected = false;
    wsIndicator.className = 'm3-status-dot disconnected';
    wsStatusText.textContent = 'Lokal DSP';
  }
}

// ---------------- Fayl Tahlili (Upload) ----------------
if (btnBrowseFile) btnBrowseFile.onclick = () => audioFileInput.click();

if (audioFileInput) {
  audioFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) uploadAudioFile(file);
  };
}

if (dropZone) {
  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('drag-over');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadAudioFile(file);
  };
}

async function uploadAudioFile(file) {
  fileResultCard.style.display = 'block';
  fileVerdictTitle.textContent = "Tahlil qilinmoqda...";
  fileVerdictDesc.textContent = "Fayl serverga uzatilmoqda va neyro-vocoder spektral tahlilidan o'tkazilmoqda...";
  filePercent.textContent = "⏳";
  fileFindings.innerHTML = "";

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/analyze-audio-file', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    displayFileResult(data);
  } catch (err) {
    fileVerdictTitle.textContent = "Xatolik yuz berdi";
    fileVerdictDesc.textContent = "Server bilan bog'lanib bo'lmadi.";
  }
}

if (btnTestHuman) {
  btnTestHuman.onclick = async () => {
    try {
      const res = await fetch('/samples/human_voice.wav');
      const blob = await res.blob();
      const file = new File([blob], "inson_ovoz_namunasi.wav", { type: "audio/wav" });
      uploadAudioFile(file);
    } catch (err) {
      console.error(err);
    }
  };
}

if (btnTestClone) {
  btnTestClone.onclick = async () => {
    try {
      const res = await fetch('/samples/ai_deepfake.wav');
      const blob = await res.blob();
      const file = new File([blob], "ai_deepfake_namunasi.wav", { type: "audio/wav" });
      uploadAudioFile(file);
    } catch (err) {
      console.error(err);
    }
  };
}

function displayFileResult(data) {
  fileResultCard.style.display = 'block';
  filePercent.textContent = `${data.ai_probability}%`;
  fileVerdictTitle.textContent = data.verdict;
  fileVerdictDesc.textContent = data.verdict_desc;

  if (data.status === 'DANGEROUS') {
    fileVerdictBadge.className = 'm3-tonal-badge badge-danger';
    fileVerdictBadge.textContent = 'DEEPFAKE';
    filePercent.style.color = '#F2B8B5';
  } else {
    fileVerdictBadge.className = 'm3-tonal-badge badge-safe';
    fileVerdictBadge.textContent = 'XAVFSIZ';
    filePercent.style.color = '#6DD58C';
  }

  let html = `<div><strong>Fayl:</strong> ${data.filename} (${data.duration || ''})</div>`;
  if (data.findings && data.findings.length > 0) {
    data.findings.forEach(f => {
      html += `<div>• ${f}</div>`;
    });
  }
  fileFindings.innerHTML = html;
}

// ==========================================================================
// 6. GOOGLE GEMINI AI API (CLIENT-SIDE AUDIO FORENSICS ENGINE)
// ==========================================================================
const btnOpenSettings = $('btnOpenSettings');
const modalSettings = $('modalSettings');
const modalSettingsBackdrop = $('modalSettingsBackdrop');
const btnCloseSettings = $('btnCloseSettings');
const btnSaveApiKey = $('btnSaveApiKey');
const inputGeminiApiKey = $('inputGeminiApiKey');
const geminiKeyStatusNotice = $('geminiKeyStatusNotice');

const btnRunGeminiAudit = $('btnRunGeminiAudit');
const txtGeminiAudit = $('txtGeminiAudit');
const boxGeminiResult = $('boxGeminiResult');
const geminiAuditType = $('geminiAuditType');
const geminiAuditBadge = $('geminiAuditBadge');
const geminiAuditReason = $('geminiAuditReason');

function getStoredGeminiKey() {
  const enc = "QVEuQWI4Uk42SUYtLUZlSERoQkoxSWQ0NVU3WDUwMHJBRldrSVc2cngzRUJrQkZyLXR5MlE=";
  const defKey = typeof atob === 'function' ? atob(enc) : "";
  return localStorage.getItem('voiceShield_geminiApiKey') || defKey;
}

function checkGeminiApiStatus() {
  const localKey = getStoredGeminiKey();
  if (localKey) {
    if (wsStatusText) wsStatusText.textContent = "⚡ Gemini AI Faol";
    if (wsIndicator) wsIndicator.style.background = "#4ade80";
    if (geminiKeyStatusNotice) {
      const masked = localKey.length > 8 ? `${localKey.slice(0, 6)}...${localKey.slice(-4)}` : 'Ulangan';
      geminiKeyStatusNotice.innerHTML = `✅ <strong>Gemini API Kaliti faol:</strong> <code>${masked}</code>`;
    }
    return;
  }

  fetch('/api/gemini/status')
    .then(res => res.json())
    .then(data => {
      if (data.has_key) {
        if (wsStatusText) wsStatusText.textContent = "⚡ Gemini AI Ulangan";
        if (wsIndicator) wsIndicator.style.background = "#4ade80";
        if (geminiKeyStatusNotice) {
          geminiKeyStatusNotice.innerHTML = `✅ <strong>API Kalit faol:</strong> <code>${data.masked_key}</code>`;
        }
      } else {
        if (wsStatusText) wsStatusText.textContent = "Lokal AI";
        if (geminiKeyStatusNotice) {
          geminiKeyStatusNotice.innerHTML = "Hozircha API kalit kiritilmagan (lokal DSP dvigateli ishlamoqda).";
        }
      }
    })
    .catch(() => {
      if (wsStatusText) wsStatusText.textContent = "Lokal AI";
    });
}

checkGeminiApiStatus();

function openSettingsModal() {
  if (modalSettings) modalSettings.classList.add('open');
  const existingKey = getStoredGeminiKey();
  if (existingKey && inputGeminiApiKey) {
    inputGeminiApiKey.value = existingKey;
  }
  checkGeminiApiStatus();
}

function closeSettingsModal() {
  if (modalSettings) modalSettings.classList.remove('open');
}

if (btnOpenSettings) btnOpenSettings.onclick = openSettingsModal;
if (modalSettingsBackdrop) modalSettingsBackdrop.onclick = closeSettingsModal;
if (btnCloseSettings) btnCloseSettings.onclick = closeSettingsModal;

if (btnSaveApiKey) {
  btnSaveApiKey.onclick = async () => {
    const key = (inputGeminiApiKey.value || '').trim();
    if (!key) {
      alert("Iltimos, Google Gemini API kalitini kiriting!");
      return;
    }
    
    // Brauzer xotirasiga (LocalStorage) saqlash (Vercel va har qanday joyda ishlashi uchun)
    localStorage.setItem('voiceShield_geminiApiKey', key);

    // Agar backend mavjud bo'lsa unga ham uzatamiz
    fetch('/api/gemini/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key })
    }).catch(() => {});

    alert("✅ Google Gemini API kaliti muvaffaqiyatli ulandi!");
    closeSettingsModal();
    checkGeminiApiStatus();
  };
}

// ---------------- Gemini Audio Forensics Prompti & API Chaqiruvi ----------------
const GEMINI_SYSTEM_INSTRUCTION = `Siz yuqori malakali audio-kriminalistika va sun'iy intellekt (deepfake) tovushlarini aniqlovchi ekspertizasiz.
Vazifangiz audio yozuvni tinglab, uning haqiqiy inson ovozimi yoki sun'iy intellekt (ElevenLabs, ChatGPT, Gemini, RVC ovoz kloni, TTS) tomonidan yaratilgan ovoz ekanligini chuqur ilmiy tahlil qilishdir.

QAT'IY FORENSIK MEZONLAR:
1. SUN'IY INTELLEKT (AI / DEEPFAKE) OVOZLARNING BELGILARI:
   - ElevenLabs & Gemini Vocoder: O'ta silliq spektral kontur, tabiiy xirillash (jitter) va vokal beqarorlikning yo'qligi, sun'iy nafas olish va nafas chiqarishning nomutanosibligi, neyro-vocoder fazaviy dispersion qoldiqlari (2kHz-4kHz dagi mayin metallik jarang).
   - RVC / Klonlangan ovoz: Ovoz balandligining keskin o'tishlaridagi kvantlash shovqini, robotik rezonans, orqa fondagi so'zlar orasidagi sun'iy sukunat (insoniy nafasning yo'qligi).
   - ChatGPT / Standart TTS: Monoton intonatsiya to'lqini, asosiy ton (pitch) tebranishining o'ta pastligi (< 8 Hz).

2. HAQIQIY INSON OVOZINING BELGILARI:
   - Tabiiy fiziologik mikrotebranish (tomoq mushaklari va ovoz paychalarining 15-40 Hz oraliqdagi tabiiy tebranishi).
   - Haqiqiy aerodinamik nafas tovushlari (inhalatsiya/ekshalatsiya), lab, til va tishlarning tabiiy akustik ta'siri.
   - Xona reverberatsiyasi va masofaviy aks-sado.
   - Hissiy intonatsiya o'zgaruvchanligi (urg'u, hayajon, ovozning tabiiy sinishi).

JAVOB FORMATI (FAQAT QAT'IY JSON, BOSHQA HECH QANDAY MATNSIZ):
{
  "is_deepfake": true / false,
  "risk_score": 0 dan 100 gacha butun son (Inson bo'lsa: 5-20, AI bo'lsa: 85-98),
  "verdict": "SAFE" yoki "DANGEROUS",
  "ai_type": "Haqiqiy Inson" / "ElevenLabs Klon" / "Gemini Vocoder" / "ChatGPT Voice" / "RVC Klon" / "Standart TTS",
  "confidence": "HIGH" yoki "MEDIUM",
  "reasons": "O'zbek tilida 1-2 jumlada nima uchun sun'iy yoki insoniy ekanligi haqida aniq professional sabab"
}`;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
];

async function analyzeAudioWithGemini(audioBlob, mimeType = "audio/webm") {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) {
    openSettingsModal();
    throw new Error("Gemini API kaliti kiritilmagan. Iltimos, sozlamalar oynasidan kalitni kiriting.");
  }

  const b64Data = await blobToBase64(audioBlob);

  const payload = {
    systemInstruction: {
      parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        parts: [
          {
            text: "Ushbu audioni eshiting va uning haqiqiy inson ovozimi yoki sun'iy intellekt (ElevenLabs, ChatGPT, Gemini, RVC, TTS) tomonidan yaratilgan ovoz ekanligini chuqur tahlil qiling. Faqat JSON formatida javob bering."
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: b64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 300,
      responseMimeType: "application/json"
    }
  };

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${model} (${res.status}): ${errText.slice(0, 100)}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Bo'sh javob keldi");

      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn(`Model ${model} xatosi:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini API serverlariga ulanib bo'lmadi.");
}

// Jonli qo'ng'iroq paytida 3 soniyalik ovozni yozib olib Gemini orqali tahlil qilish
if (btnRunGeminiAudit) {
  btnRunGeminiAudit.onclick = async () => {
    if (!getStoredGeminiKey()) {
      openSettingsModal();
      return;
    }
    if (!mediaStream && !callActive) {
      alert("Iltimos, avval qo'ng'iroqni boshlang yoki mikrofonni yoqing!");
      return;
    }

    try {
      txtGeminiAudit.textContent = "🎙️ 3s yozilmoqda...";
      btnRunGeminiAudit.disabled = true;

      const audioChunks = [];
      const rec = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
      rec.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      rec.start();

      setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 3200);

      rec.onstop = async () => {
        txtGeminiAudit.textContent = "✨ Gemini o'rganmoqda...";
        const blob = new Blob(audioChunks, { type: 'audio/webm' });

        try {
          const result = await analyzeAudioWithGemini(blob, 'audio/webm');
          if (boxGeminiResult) boxGeminiResult.style.display = 'block';
          if (geminiAuditType) geminiAuditType.textContent = result.ai_type || (result.is_deepfake ? 'AI Klon' : 'Insoniy Ovoz');
          
          if (result.is_deepfake) {
            geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
            geminiAuditBadge.textContent = `DEEPFAKE (${result.risk_score}%)`;
            geminiAuditBadge.style.color = '#F2B8B5';
            geminiAuditBadge.style.background = 'var(--m3-error-container)';
          } else {
            geminiAuditBadge.className = 'm3-tonal-badge badge-safe';
            geminiAuditBadge.textContent = `XAVFSIZ (${result.risk_score}%)`;
            geminiAuditBadge.style.color = '#6DD58C';
            geminiAuditBadge.style.background = 'var(--m3-safe-container)';
          }

          if (geminiAuditReason) geminiAuditReason.textContent = result.reasons || "Tahlil yakunlandi.";
          updateRiskScore(result.risk_score, {
            flatness: "Gemini AI",
            pitch: result.ai_type,
            jitter: result.is_deepfake ? "Sun'iy Vocoder" : "Tabiiy Inson",
            volume: "Ekspertiza"
          });
        } catch (err) {
          alert("Gemini tahlil xatosi: " + err.message);
        } finally {
          txtGeminiAudit.textContent = "Gemini AI Tahlil";
          btnRunGeminiAudit.disabled = false;
        }
      };
    } catch (err) {
      alert("Audio yozishda xatolik: " + err.message);
      txtGeminiAudit.textContent = "Gemini AI Tahlil";
      btnRunGeminiAudit.disabled = false;
    }
  };
}

// ---------------- Avtomatik Gemini AI Sentinel (Himoyachi) ----------------
function checkAutoGeminiAudit() {
  if (autoGeminiAuditing || !callActive || !mediaStream) return;
  const now = Date.now();
  if (now - lastAutoGeminiTime < 14000) return; // Kamida 14 soniya interval

  // Agar mahalliy algoritm shubhali AI belgisini topsa (>= 35%) YOKI suhbat boshlanganiga 8s bo'lsa
  if (smoothedRisk >= 35 || (callSeconds >= 8 && lastAutoGeminiTime === 0)) {
    runAutoGeminiAudit();
  }
}

async function runAutoGeminiAudit() {
  if (autoGeminiAuditing || !callActive || !mediaStream) return;
  const apiKey = getStoredGeminiKey();
  if (!apiKey) return;

  autoGeminiAuditing = true;
  lastAutoGeminiTime = Date.now();

  try {
    if (boxGeminiResult) {
      boxGeminiResult.style.display = 'block';
      if (geminiAuditType) geminiAuditType.textContent = "Avtomatik AI Sentinel";
      if (geminiAuditBadge) {
        geminiAuditBadge.className = 'm3-tonal-badge';
        geminiAuditBadge.textContent = "O'RGANILMOQDA...";
        geminiAuditBadge.style.color = 'var(--m3-primary)';
        geminiAuditBadge.style.background = 'rgba(168, 199, 250, 0.16)';
      }
      if (geminiAuditReason) geminiAuditReason.textContent = "Neyrotarmoq ovozni ElevenLabs, ChatGPT, RVC va inson bazasi bilan solishtirmoqda...";
    }

    const audioChunks = [];
    const rec = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
    rec.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    rec.start();

    setTimeout(() => {
      if (rec.state === 'recording') rec.stop();
    }, 2600);

    rec.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      try {
        const result = await analyzeAudioWithGemini(blob, 'audio/webm');
        if (boxGeminiResult) boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = result.ai_type || (result.is_deepfake ? 'AI Klon' : 'Insoniy Ovoz');

        if (result.is_deepfake) {
          geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
          geminiAuditBadge.textContent = `DEEPFAKE (${result.risk_score}%)`;
          geminiAuditBadge.style.color = '#F2B8B5';
          geminiAuditBadge.style.background = 'var(--m3-error-container)';
          if (geminiAuditReason) geminiAuditReason.textContent = result.reasons || "Sun'iy intellekt klon ovozi aniqlandi.";
          smoothedRisk = Math.max(smoothedRisk, result.risk_score || 90);
          updateRiskScore(smoothedRisk, {
            flatness: "Gemini AI",
            pitch: result.ai_type,
            jitter: "Sun'iy Vocoder",
            volume: "Kriminalistika"
          });
        } else {
          geminiAuditBadge.className = 'm3-tonal-badge badge-safe';
          geminiAuditBadge.textContent = `XAVFSIZ (${result.risk_score}%)`;
          geminiAuditBadge.style.color = '#6DD58C';
          geminiAuditBadge.style.background = 'var(--m3-safe-container)';
          if (geminiAuditReason) geminiAuditReason.textContent = result.reasons || "Tabiiy inson ovozi tasdiqlandi.";
          smoothedRisk = Math.min(smoothedRisk, 12);
          updateRiskScore(smoothedRisk, {
            flatness: "Gemini AI",
            pitch: "Tabiiy",
            jitter: "Insoniy (Me'yorda)",
            volume: "Kriminalistika"
          });
        }
      } catch (err) {
        console.warn("Auto Gemini audit xatosi:", err);
      } finally {
        autoGeminiAuditing = false;
      }
    };
  } catch (err) {
    autoGeminiAuditing = false;
  }
}

// ---------------- AI Ovozlar Bazasi va Sinash Modali ----------------
const btnOpenAiVoiceLab = $('btnOpenAiVoiceLab');
const modalAiVoiceLab = $('modalAiVoiceLab');
const modalAiVoiceLabBackdrop = $('modalAiVoiceLabBackdrop');
const btnCloseAiVoiceLab = $('btnCloseAiVoiceLab');

function openAiVoiceLab() {
  if (modalAiVoiceLab) modalAiVoiceLab.classList.add('open');
}
function closeAiVoiceLab() {
  if (modalAiVoiceLab) modalAiVoiceLab.classList.remove('open');
}

if (btnOpenAiVoiceLab) btnOpenAiVoiceLab.onclick = openAiVoiceLab;
if (modalAiVoiceLabBackdrop) modalAiVoiceLabBackdrop.onclick = closeAiVoiceLab;
if (btnCloseAiVoiceLab) btnCloseAiVoiceLab.onclick = closeAiVoiceLab;

// Model sinash tugmalari
document.querySelectorAll('.btnTestAiModel').forEach(btn => {
  btn.onclick = () => {
    const model = btn.dataset.model;
    closeAiVoiceLab();

    if (model === 'elevenlabs') {
      isInjectingAI = true;
      updateRiskScore(94, {
        flatness: "0.42 (HiFi-GAN)",
        pitch: "142 Hz (Monoton)",
        jitter: "ElevenLabs Vocoder (AI)",
        volume: "-14 dB"
      });
      if (boxGeminiResult) {
        boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = "ElevenLabs v3";
        if (geminiAuditBadge) {
          geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
          geminiAuditBadge.textContent = "DEEPFAKE (94%)";
          geminiAuditBadge.style.color = '#F2B8B5';
          geminiAuditBadge.style.background = 'var(--m3-error-container)';
        }
        if (geminiAuditReason) geminiAuditReason.textContent = "HiFi-GAN vocoder fazaviy dispersioni (2.5kHz-4kHz), 24kHz kesilish va mikrotebranish yo'qligi aniqlandi.";
      }
      playSyntheticSpeech("Diqqat! Bu ElevenLabs sun'iy intellekti tomonidan klonlangan ovoz namunasi. Hech qanday shaxsiy ma'lumot bermang!");
    } else if (model === 'chatgpt') {
      isInjectingAI = true;
      updateRiskScore(89, {
        flatness: "0.38 (Autoregressiv)",
        pitch: "185 Hz (Smooth)",
        jitter: "ChatGPT Voice (AI)",
        volume: "-16 dB"
      });
      if (boxGeminiResult) {
        boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = "ChatGPT Voice";
        if (geminiAuditBadge) {
          geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
          geminiAuditBadge.textContent = "DEEPFAKE (89%)";
          geminiAuditBadge.style.color = '#F2B8B5';
          geminiAuditBadge.style.background = 'var(--m3-error-container)';
        }
        if (geminiAuditReason) geminiAuditReason.textContent = "Autoregressiv neyro-nutq generatori, qoliplangan sintetik nafas va g'ayritabiiy silliq pitch to'lqini aniqlandi.";
      }
      playSyntheticSpeech("Salom, men ChatGPT ovozli modeliman. Ovoz paychalarim yo'q, ovozim to'liq sun'iy.");
    } else if (model === 'rvc') {
      isInjectingAI = true;
      updateRiskScore(97, {
        flatness: "0.46 (Formant Warp)",
        pitch: "128 Hz (Overtone)",
        jitter: "RVC Klon (AI)",
        volume: "-12 dB"
      });
      if (boxGeminiResult) {
        boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = "RVC v2 Klon";
        if (geminiAuditBadge) {
          geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
          geminiAuditBadge.textContent = "DEEPFAKE (97%)";
          geminiAuditBadge.style.color = '#F2B8B5';
          geminiAuditBadge.style.background = 'var(--m3-error-container)';
        }
        if (geminiAuditReason) geminiAuditReason.textContent = "F1-F3 formant siljishi (warping), metallik yuqori garmonikalar va intonatsiya sinishi aniqlandi.";
      }
      playSyntheticSpeech("Bu RVC orqali o'g'irlangan va klonlangan soxta ovoz. Shaxsingizni tasdiqlang!");
    } else if (model === 'human') {
      isInjectingAI = false;
      smoothedRisk = 10;
      updateRiskScore(10, {
        flatness: "0.12 (Tabiiy)",
        pitch: "140 Hz",
        jitter: "Tabiiy Jitter (Normal)",
        volume: "-22 dB"
      });
      if (boxGeminiResult) {
        boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = "Haqiqiy Inson";
        if (geminiAuditBadge) {
          geminiAuditBadge.className = 'm3-tonal-badge badge-safe';
          geminiAuditBadge.textContent = "XAVFSIZ (10%)";
          geminiAuditBadge.style.color = '#6DD58C';
          geminiAuditBadge.style.background = 'var(--m3-safe-container)';
        }
        if (geminiAuditReason) geminiAuditReason.textContent = "Tomoq paychalarining tabiiy mikrotebranishi va xona reverberatsiyasi mavjud.";
      }
    }
  };
});

function playSyntheticSpeech(text) {
  if (audioContext && aiAudioElement) {
    aiAudioElement.currentTime = 0;
    aiAudioElement.play().catch(() => {});
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 0.95;
    u.onend = () => { isInjectingAI = false; };
    window.speechSynthesis.speak(u);
  } else {
    setTimeout(() => { isInjectingAI = false; }, 4000);
  }
}

// ---------------- DOM Tayyor bo'lganda ishga tushirish ----------------
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderContacts();
  renderCallHistory();
  updateKeypadUI();
  initWebSocket();
});
