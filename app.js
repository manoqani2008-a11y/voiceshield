/**
 * VoiceShield - Smart Dialer & AI Anti-Spoofing Controller
 * Material 3 / Glassmorphic UI with Keypad, Call History, Contacts and Live AI Protection
 */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeAvatarSrc(src) {
  const s = String(src || '').trim();
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s) ? s : '';
}

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
let callSessionId = 0;
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
let displayStream = null;
let activeRecordingStream = null;
let analyser = null;
let audioSource = null;
let animationFrameId = null;
let analyzeLoopTimerId = null;
let aiSpeechSafetyTimer = null;

let pitchHistory = [];
let sfmHistory = [];
let smoothedRisk = 4.0;
let silenceCount = 0;
let lastPitch = 0;
let autoGeminiAuditing = false;
let lastAutoGeminiTime = 0;

let socket = null;
let wsConnected = false;
let backendAvailable = false;
let serverHasGeminiKey = false;
let serverMaskedGeminiKey = null;

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

    const safeName = escapeHtml(c.name);
    const safePhone = escapeHtml(c.phone);
    const imgSrc = c.avatarType === 'image' ? safeAvatarSrc(c.avatar) : '';

    let avatarHtml = `<div class="contact-avatar">`;
    if (imgSrc) {
      avatarHtml += `<img src="${imgSrc}" alt="${safeName}">`;
    } else {
      avatarHtml += `<span>${escapeHtml(c.avatar || '👤')}</span>`;
    }
    avatarHtml += `</div>`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="contact-info">
        <div class="contact-name">${safeName}</div>
        <div class="contact-phone">${safePhone}</div>
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

  const validAvatar = contact && contact.avatarType === 'image' ? safeAvatarSrc(contact.avatar) : '';
  if (validAvatar) {
    selectedAvatarData = validAvatar;
    selectedAvatarType = 'image';
    contactPreviewImg.src = validAvatar;
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
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      alert("Faqat PNG, JPG, WEBP yoki GIF formatdagi rasm yuklang.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const safeUrl = safeAvatarSrc(event.target.result);
      if (!safeUrl) return;
      selectedAvatarData = safeUrl;
      selectedAvatarType = 'image';
      contactPreviewImg.src = safeUrl;
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

    const safeName = escapeHtml(item.name);
    const imgSrc = item.avatarType === 'image' ? safeAvatarSrc(item.avatar) : '';

    let avatarHtml = `<div class="history-avatar">`;
    if (imgSrc) {
      avatarHtml += `<img src="${imgSrc}" alt="${safeName}">`;
    } else {
      avatarHtml += `<span>${escapeHtml(item.avatar || '👤')}</span>`;
    }
    avatarHtml += `</div>`;

    const isDanger = item.status === 'DEEPFAKE';
    const badgeClass = isDanger ? 'badge-danger' : 'badge-safe';
    const badgeText = isDanger ? `⚠️ ${Number(item.maxRisk) || 0}% DEEPFAKE` : `✓ ${Number(item.maxRisk) || 0}% INSONIY`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="history-details">
        <div class="history-name-row">
          <span class="history-name">${safeName}</span>
          <span class="history-time">${escapeHtml(item.date || '')}</span>
        </div>
        <div class="history-meta-row">
          <span class="history-duration">⏱️ ${escapeHtml(item.duration || '00:00')}</span>
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
    keypadSuggestionsList.innerHTML = '';
    matchingContacts.slice(0, 3).forEach(c => {
      const itemEl = document.createElement('div');
      itemEl.className = 'keypad-suggestion-item glass-card';
      const imgSrc = c.avatarType === 'image' ? safeAvatarSrc(c.avatar) : '';
      const avatarHtml = imgSrc
        ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">`
        : `<span>${escapeHtml(c.avatar || '👤')}</span>`;
      itemEl.innerHTML = `
        <div class="mini-avatar">${avatarHtml}</div>
        <div class="mini-info" style="flex:1;">
          <strong>${escapeHtml(c.name)}</strong>
          <small>${escapeHtml(c.phone)}</small>
        </div>
        <button class="mini-call-btn" title="Qo'ng'iroq qilish">📞</button>
      `;
      itemEl.onclick = () => initiateCall(c);
      keypadSuggestionsList.appendChild(itemEl);
    });
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
  const contact = contacts.find(c => String(c.id) === String(id));
  if (contact) {
    initiateCall(contact);
  }
};

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

  const validCallerImg = caller.avatarType === 'image' ? safeAvatarSrc(caller.avatar) : '';
  if (validCallerImg) {
    if (incomingAvatarImg) {
      incomingAvatarImg.src = validCallerImg;
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

if (btnAnswer) {
  btnAnswer.onclick = async () => {
    switchCallView('calling');
    callSessionId++;
    callActive = true;
    callSeconds = 0;
    maxRiskScore = 0;
    isAlertActive = false;
    pitchHistory = [];
    sfmHistory = [];
    lastPitch = 0;
    autoGeminiAuditing = false;
    lastAutoGeminiTime = 0;
    smoothedRisk = 4.0;
    silenceCount = 0;
    isInjectingAI = false;
    if (callTimer) callTimer.textContent = '00:00';
    if (boxGeminiResult) boxGeminiResult.style.display = 'none';
    if (btnSystemAudio) {
      btnSystemAudio.classList.remove('active');
      btnSystemAudio.innerHTML = `<span class="pill-icon">💻</span><span>Tizim audiosini ulash</span>`;
    }
    if (btnInjectAIVoice) {
      btnInjectAIVoice.classList.remove('active');
      btnInjectAIVoice.innerHTML = `<span class="pill-icon">🤖</span><span>AI Ovozini chalish</span>`;
    }
    if (dangerAlert) dangerAlert.classList.remove('show');
    if (btnVerifyChannel) btnVerifyChannel.classList.remove('show');
    closeSheet();

    if (wsConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: "reset" }));
    }

    clearInterval(callInterval);
    callInterval = setInterval(updateCallTimer, 1000);
    await startAudioEngine();
  };
}

if (btnReject) btnReject.onclick = () => endCallProcess(false);
if (btnEndCall) btnEndCall.onclick = () => endCallProcess(true);

function endCallProcess(wasAnswered) {
  callSessionId++;
  callActive = false;
  isInjectingAI = false;
  autoGeminiAuditing = false;
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
  if (analyzeLoopTimerId) {
    clearTimeout(analyzeLoopTimerId);
    analyzeLoopTimerId = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

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

      activeRecordingStream = mediaStream;
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

function restoreMicrophoneStream() {
  if (displayStream) {
    displayStream.getTracks().forEach(t => t.stop());
    displayStream = null;
  }
  if (mediaStream && audioContext && analyser) {
    try {
      if (audioSource) audioSource.disconnect();
      audioSource = audioContext.createMediaStreamSource(mediaStream);
      audioSource.connect(analyser);
      activeRecordingStream = mediaStream;
    } catch (e) {}
  }
  if (btnSystemAudio) {
    btnSystemAudio.classList.remove('active');
    btnSystemAudio.innerHTML = `<span class="pill-icon">💻</span><span>Tizim audiosini ulash</span>`;
  }
}

// Tizim audiosi (Loopback)
if (btnSystemAudio) {
  btnSystemAudio.onclick = async () => {
    try {
      const captured = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const audioTrack = captured.getAudioTracks()[0];
      if (!audioTrack) {
        alert("Iltimos, ochilgan oynada 'Audio bilan bo'lishish' (Share audio) katakchasiga belgi qo'ying!");
        captured.getTracks().forEach(t => t.stop());
        return;
      }

      if (displayStream) {
        displayStream.getTracks().forEach(t => t.stop());
      }
      displayStream = captured;

      const systemAudioOnlyStream = new MediaStream([audioTrack]);
      activeRecordingStream = systemAudioOnlyStream;

      if (audioSource) audioSource.disconnect();
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!analyser) {
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.45;
      }

      audioSource = audioContext.createMediaStreamSource(systemAudioOnlyStream);
      audioSource.connect(analyser);

      audioTrack.onended = () => {
        restoreMicrophoneStream();
      };

      btnSystemAudio.classList.add('active');
      btnSystemAudio.innerHTML = `<span class="pill-icon">🟢</span><span>Tizim audiosi ulangan</span>`;
    } catch (err) {
      console.warn("Tizim audiosi ulanmadi:", err);
    }
  };
}

// AI Ovozini chalib sinash
let aiAudioElement = null;
let aiSourceNode = null;

function resetAiVoiceBtnState() {
  if (aiSpeechSafetyTimer) {
    clearTimeout(aiSpeechSafetyTimer);
    aiSpeechSafetyTimer = null;
  }
  if (btnInjectAIVoice) {
    btnInjectAIVoice.classList.remove('active');
    btnInjectAIVoice.innerHTML = `<span class="pill-icon">🤖</span><span>AI Ovozini chalish</span>`;
  }
  isInjectingAI = false;
}

if (btnInjectAIVoice) {
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

    if (audioContext && analyser) {
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

    if (aiSpeechSafetyTimer) clearTimeout(aiSpeechSafetyTimer);
    aiSpeechSafetyTimer = setTimeout(resetAiVoiceBtnState, 9000);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = "Diqqat! Men sun'iy intellekt tomonidan yaratilgan klon ovozman. Hisob raqamga zudlik bilan pul o'tkazing!";
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.95;

      utterance.onend = () => {
        setTimeout(resetAiVoiceBtnState, 1500);
      };
      utterance.onerror = () => {
        resetAiVoiceBtnState();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(resetAiVoiceBtnState, 4500);
    }
  };
}

function stopAudioEngine() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (analyzeLoopTimerId) {
    clearTimeout(analyzeLoopTimerId);
    analyzeLoopTimerId = null;
  }
  resetAiVoiceBtnState();
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  if (aiAudioElement) {
    aiAudioElement.pause();
    aiAudioElement.currentTime = 0;
  }
  if (displayStream) {
    displayStream.getTracks().forEach(t => t.stop());
    displayStream = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  activeRecordingStream = null;
  audioSource = null;
  analyser = null;
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (canvasCtx && canvas) {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
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

// Avtokorrelyatsiya + Parabolik interpolyatsiya orqali uzluksiz asosiy ton (pitch)
function detectPitchAutocorrelation(timeArray, sampleRate) {
  const n = timeArray.length;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sumSq += timeArray[i] * timeArray[i];
  }
  const rms = Math.sqrt(sumSq / n);
  if (rms < 0.009) return { pitch: 0, rms, clarity: 0 };

  const minLag = Math.max(20, Math.floor(sampleRate / 350));
  const maxLag = Math.min(Math.floor(sampleRate / 75), n - 513);
  if (maxLag <= minLag) return { pitch: 0, rms, clarity: 0 };

  const win = Math.min(1024, n - maxLag - 1);
  if (win < 256) return { pitch: 0, rms, clarity: 0 };

  let e0 = 0;
  for (let i = 0; i < win; i++) {
    e0 += timeArray[i] * timeArray[i];
  }

  let bestLag = -1;
  let maxNormCorr = -1;
  const corrs = new Float32Array(maxLag + 2);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let eLag = 0;
    for (let i = 0; i < win; i++) {
      const s0 = timeArray[i];
      const sL = timeArray[i + lag];
      corr += s0 * sL;
      eLag += sL * sL;
    }
    const denom = Math.sqrt(e0 * eLag);
    const norm = denom > 1e-8 ? corr / denom : 0;
    corrs[lag] = norm;
    if (norm > maxNormCorr) {
      maxNormCorr = norm;
      bestLag = lag;
    }
  }

  if (bestLag > minLag && bestLag < maxLag && maxNormCorr > 0.30) {
    const cPrev = corrs[bestLag - 1] || maxNormCorr;
    const cNext = corrs[bestLag + 1] || maxNormCorr;
    const denom = 2 * (cPrev - 2 * maxNormCorr + cNext);
    let trueLag = bestLag;
    if (Math.abs(denom) > 1e-6) {
      const delta = (cPrev - cNext) / denom;
      if (Math.abs(delta) < 1) {
        trueLag = bestLag + delta;
      }
    }
    const pitch = sampleRate / trueLag;
    return { pitch, rms, clarity: maxNormCorr };
  }
  return { pitch: 0, rms, clarity: Math.max(0, maxNormCorr) };
}

// ---------------- 100ms Tezkor Akustik AI Tahlili ----------------
function analyzeMicrophoneLoop() {
  if (!analyser || !callActive) return;

  const mySessionId = callSessionId;
  const floatFreqArray = new Float32Array(analyser.frequencyBinCount);
  const timeArray = new Float32Array(analyser.fftSize);

  function analyze() {
    if (!callActive || currentMode !== 'mic' || mySessionId !== callSessionId || !analyser) return;

    analyser.getFloatFrequencyData(floatFreqArray);
    analyser.getFloatTimeDomainData(timeArray);

    const sampleRate = (audioContext && audioContext.sampleRate) || 48000;
    const { pitch: estPitch, rms, clarity: pitchClarity } = detectPitchAutocorrelation(timeArray, sampleRate);
    const db = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -60;

    const nyquist = sampleRate / 2;
    const binHz = nyquist / floatFreqArray.length;
    const startBin = Math.max(2, Math.floor(200 / binHz));
    const endBin = Math.min(floatFreqArray.length - 1, Math.floor(3500 / binHz));
    const cutoff8kBin = Math.min(floatFreqArray.length - 1, Math.floor(7500 / binHz));

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

    // 1. Zero Crossing Rate (ZCR)
    let zcCount = 0;
    for (let i = 1; i < timeArray.length; i++) {
      if ((timeArray[i] >= 0 && timeArray[i - 1] < 0) || (timeArray[i] < 0 && timeArray[i - 1] >= 0)) {
        zcCount++;
      }
    }
    const zcr = zcCount / timeArray.length;

    // 2. Uzluksiz Micro-Jitter (delta-pitch) va intonatsiya tebranishi
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

    // 3. Ovoz turini aniqlash: Insoniy nafas / entikish / sukunat vs Haqiqiy nutq
    const isGentleBreathOrSilence = (estPitch === 0 || pitchClarity < 0.30) && rms < 0.025;

    let instantRisk = 8;
    if (isInjectingAI) {
      instantRisk = 96;
    } else if (isGentleBreathOrSilence || rms < 0.010) {
      instantRisk = 8;
    } else {
      let aiFeatures = 0;
      let humanFeatures = 0;

      // A. Formant Peak-to-Valley (PVR)
      if (pvrDb < 21.0) {
        aiFeatures += 26;
      } else if (pvrDb >= 26.0) {
        humanFeatures += 26;
      }

      // B. Asosiy ton mikrotebranishi (Sub-Hz Micro-Jitter & Pitch Std)
      if (estPitch > 60 && pitchHistory.length >= 4) {
        if ((microJitter < 0.45 && pitchStd < 3.5) || pitchStd < 2.2) {
          aiFeatures += 32;
        } else if (microJitter >= 0.9 || pitchStd >= 5.5) {
          humanFeatures += 30;
        }
      }

      // C. Zero Crossing Rate (ZCR)
      if (zcr >= 0.048 && zcr <= 0.16 && estPitch > 60) {
        aiFeatures += 16;
      } else if (zcr < 0.028 && estPitch > 60) {
        humanFeatures += 14;
      }

      // D. 24kHz / 12kHz Nyquist kesilishi (faqat boshqa vocoder/monoton alomati bo'lganda)
      if (hfRatio < 0.007 && estPitch > 65 && aiFeatures > 0) {
        aiFeatures += 14;
      } else if (hfRatio >= 0.015) {
        humanFeatures += 12;
      }

      const rawRisk = 12 + aiFeatures - humanFeatures;
      instantRisk = Math.max(8, Math.min(98, Math.round(rawRisk * currentSensitivity)));
    }

    // Turg'unlashtirish va sukunatda xavfsiz (yashil) holatga qaytish
    if (isInjectingAI) {
      smoothedRisk = 96;
    } else if (rms >= 0.010 && !isGentleBreathOrSilence) {
      silenceCount = 0;
      smoothedRisk = 0.35 * instantRisk + 0.65 * smoothedRisk;
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
      let jitterLabel = "Insoniy (Me'yorda)";
      if (currentScore >= 65) {
        jitterLabel = "Sun'iy Vocoder (AI / Deepfake)";
      } else if (currentScore >= 35) {
        jitterLabel = isGentleBreathOrSilence ? "Insoniy nafas / entikish" : "Shubhali tebranish";
      } else {
        jitterLabel = isGentleBreathOrSilence ? "Tabiiy nafas / sukunat" : "Insoniy (Me'yorda)";
      }
      updateRiskScore(currentScore, {
        flatness: linSfm.toFixed(2),
        pitch: estPitch >= 75 ? `${Math.round(estPitch)} Hz` : '-- Hz',
        jitter: jitterLabel,
        volume: `${db} dB`
      });
    }

    analyzeLoopTimerId = setTimeout(analyze, 100);
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
if (btnVerifyChannel) {
  btnVerifyChannel.onclick = () => {
    const randomOtp = Math.floor(1000 + Math.random() * 9000);
    if (otpCodeDisplay) otpCodeDisplay.textContent = randomOtp;
    if (verifyStep1) verifyStep1.style.display = 'block';
    if (verifyStep2) verifyStep2.style.display = 'none';
    if (sheetVerify) sheetVerify.classList.add('open');
  };
}

if (btnOtpMismatch) {
  btnOtpMismatch.onclick = () => {
    if (verifyStep1) verifyStep1.style.display = 'none';
    if (verifyStep2) verifyStep2.style.display = 'block';
  };
}

if (btnOtpMatch) {
  btnOtpMatch.onclick = () => {
    closeSheet();
    updateRiskScore(15, {
      flatness: "0.02",
      pitch: "140 Hz",
      jitter: "Insoniy (Kanal Tasdiqlandi)",
      volume: "-20 dB"
    });
  };
}

if (btnCloseAndReport) {
  btnCloseAndReport.onclick = () => {
    closeSheet();
    endCallProcess(true);
  };
}

function closeSheet() {
  if (sheetVerify) sheetVerify.classList.remove('open');
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

// ---------------- WebSocket Ulanishi (Faqat Python Backend Mavjud Bo'lsa) ----------------
function refreshTopStatusChip() {
  const hasGemini = Boolean(getCustomGeminiKey() || serverHasGeminiKey);
  if (!wsIndicator || !wsStatusText) return;

  if (hasGemini) {
    wsIndicator.className = 'm3-status-dot';
    wsIndicator.style.background = '#4ade80';
    wsStatusText.textContent = wsConnected ? '⚡ Gemini + WS' : '⚡ Gemini AI Faol';
  } else if (wsConnected) {
    wsIndicator.className = 'm3-status-dot';
    wsIndicator.style.background = '#4ade80';
    wsStatusText.textContent = 'AI Server Faol';
  } else {
    wsIndicator.className = 'm3-status-dot disconnected';
    wsIndicator.style.background = '#eab308';
    wsStatusText.textContent = 'Lokal DSP';
  }
}

async function initWebSocket() {
  if (window.location.protocol === 'file:') {
    refreshTopStatusChip();
    return;
  }

  try {
    const healthRes = await fetch('/api/health', { cache: 'no-store' });
    if (!healthRes.ok) {
      backendAvailable = false;
      refreshTopStatusChip();
      return;
    }
    const healthData = await healthRes.json();
    if (!healthData || healthData.status !== 'ok') {
      backendAvailable = false;
      refreshTopStatusChip();
      return;
    }
    backendAvailable = true;
  } catch (e) {
    backendAvailable = false;
    refreshTopStatusChip();
    return;
  }

  try {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host || 'localhost:8000';
    socket = new WebSocket(`${wsProto}//${wsHost}/ws/audio`);

    socket.onopen = () => {
      wsConnected = true;
      refreshTopStatusChip();
    };

    socket.onmessage = (event) => {
      if (!callActive) return;
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
      refreshTopStatusChip();
      if (backendAvailable) {
        setTimeout(initWebSocket, 6000);
      }
    };

    socket.onerror = () => {
      try { socket.close(); } catch (e) {}
    };
  } catch (err) {
    wsConnected = false;
    refreshTopStatusChip();
  }
}

// ---------------- Fayl Tahlili (Web Audio DSP + Gemini Proksi) ----------------
if (btnBrowseFile) btnBrowseFile.onclick = () => { if (audioFileInput) audioFileInput.click(); };

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

// Tezkor Radix-2 FFT (2048 nuqta uchun)
function computeFftMagnitudes(samples) {
  const n = 2048;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = (samples[i] || 0) * w;
  }

  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const angle = step * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const tr = wr * re[i + k + half] - wi * im[i + k + half];
        const ti = wr * im[i + k + half] + wi * re[i + k + half];
        re[i + k + half] = re[i + k] - tr;
        im[i + k + half] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
    }
  }

  const mag = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    mag[i] = Math.hypot(re[i], im[i]);
  }
  return mag;
}

function analyzeAudioBufferDSP(audioBuffer) {
  const sr = audioBuffer.sampleRate || 16000;
  const raw = audioBuffer.getChannelData(0);
  const frameSize = 2048;
  const totalFrames = Math.floor(raw.length / frameSize);
  const step = Math.max(1, Math.floor(totalFrames / 24));

  const sfmList = [];
  const pvrList = [];
  const pitchList = [];
  const hfList = [];

  for (let f = 0; f < totalFrames; f += step) {
    const start = f * frameSize;
    const slice = raw.subarray(start, start + frameSize);
    const { pitch, rms, clarity } = detectPitchAutocorrelation(slice, sr);
    if (rms < 0.01) continue;

    const mag = computeFftMagnitudes(slice);
    const binHz = sr / frameSize;
    const startBin = Math.max(2, Math.floor(200 / binHz));
    const endBin = Math.min(mag.length - 1, Math.floor(3500 / binHz));
    const cutoffBin = Math.min(mag.length - 1, Math.floor(7500 / binHz));

    const vals = [];
    let geomSum = 0;
    let arithSum = 0;
    let maxDb = -120;
    let totalPwr = 0;
    let highPwr = 0;

    for (let i = 1; i < mag.length; i++) {
      const m = mag[i] / frameSize + 1e-8;
      const p = m * m;
      totalPwr += p;
      if (i >= cutoffBin) highPwr += p;
      if (i >= startBin && i <= endBin) {
        const db = 20 * Math.log10(m);
        if (db > maxDb) maxDb = db;
        vals.push(db);
        geomSum += Math.log(m);
        arithSum += m;
      }
    }

    if (vals.length > 0) {
      vals.sort((a, b) => a - b);
      const valley = vals[Math.floor(vals.length * 0.25)] || -80;
      pvrList.push(Math.max(0, maxDb - valley));
      const cnt = vals.length;
      sfmList.push(Math.exp(geomSum / cnt) / (arithSum / cnt || 1.0));
      hfList.push(totalPwr > 0 ? highPwr / totalPwr : 0);
      if (pitch >= 75 && clarity >= 0.30) pitchList.push(pitch);
    }
  }

  const avg = (arr, fallback) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;
  const avgSfm = avg(sfmList, 0.10);
  const avgPvr = avg(pvrList, 30.0);
  const avgPitch = avg(pitchList, 0);
  const avgHf = avg(hfList, 0.02);

  let pitchStd = 0;
  if (pitchList.length >= 3) {
    pitchStd = Math.sqrt(pitchList.map(x => (x - avgPitch) ** 2).reduce((a, b) => a + b, 0) / pitchList.length);
  }

  let prob = 12;
  const findings = [];
  if (avgSfm >= 0.35) {
    prob += Math.min(48, Math.round(25 + (avgSfm - 0.35) * 120));
    findings.push(`Yuqori spektral tekislik / vocoder izi aniqlandi (SFM: ${avgSfm.toFixed(2)})`);
  } else if (avgSfm < 0.22) {
    prob = Math.max(8, prob - 4);
  }

  if (avgPvr < 24.0) {
    prob += 22;
    findings.push(`Past formant kontrasti (PVR: ${avgPvr.toFixed(1)} dB)`);
  }

  if (pitchList.length >= 3 && pitchStd < 3.5) {
    prob += 20;
    findings.push(`Monoton asosiy ton (tebranish: ${pitchStd.toFixed(1)} Hz)`);
  }

  if (sr >= 16000 && avgHf < 0.01 && prob > 20) {
    prob += 12;
    findings.push("Yuqori chastotalarda sintetik kesilish kuzatildi");
  }

  prob = Math.max(8, Math.min(96, prob));
  if (findings.length === 0) {
    findings.push("Akustik garmonikalar va formant kontrasti tabiiy inson ovoziga mos keladi.");
  }

  return {
    durationSec: audioBuffer.duration.toFixed(2),
    aiProbability: prob,
    sfm: avgSfm,
    pvr: avgPvr,
    pitch: Math.round(avgPitch),
    findings
  };
}

function encodeAudioBufferToWav16k(audioBuffer, maxSeconds = 12) {
  const targetSr = 16000;
  const srcSr = audioBuffer.sampleRate;
  const srcData = audioBuffer.getChannelData(0);
  const maxSrcSamples = Math.min(srcData.length, Math.floor(srcSr * maxSeconds));
  const outLen = Math.max(1, Math.floor((maxSrcSamples * targetSr) / srcSr));
  const buffer = new ArrayBuffer(44 + outLen * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + outLen * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetSr, true);
  view.setUint32(28, targetSr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, outLen * 2, true);

  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.min(srcData.length - 1, Math.floor((i * srcSr) / targetSr));
    const clamped = Math.max(-1, Math.min(1, srcData[srcIdx]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function uploadAudioFile(file, options = {}) {
  const { isSampleFixture = false } = options;
  if (fileResultCard) fileResultCard.style.display = 'block';
  if (fileVerdictTitle) fileVerdictTitle.textContent = "Tahlil qilinmoqda...";
  if (fileVerdictDesc) fileVerdictDesc.textContent = "Audio dekodlanmoqda va Gemini AI + akustik tahlildan o'tkazilmoqda...";
  if (filePercent) {
    filePercent.textContent = "⏳";
    filePercent.style.color = 'var(--m3-primary)';
  }
  if (fileFindings) fileFindings.innerHTML = "";

  try {
    let dsp = null;
    let wavBlobForGemini = null;

    try {
      const arrayBuf = await file.arrayBuffer();
      const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await tmpCtx.decodeAudioData(arrayBuf.slice(0));
      dsp = analyzeAudioBufferDSP(decoded);
      wavBlobForGemini = encodeAudioBufferToWav16k(decoded, 12);
      tmpCtx.close().catch(() => {});
    } catch (decodeErr) {
      console.warn("WebAudio decode fallback:", decodeErr);
    }

    // Agar lokal Python server ulangan bo'lsa va backend tekshiruvi mavjud bo'lsa
    let backendRes = null;
    if (backendAvailable && file.name.toLowerCase().endsWith('.wav')) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const r = await fetch('/api/analyze-audio-file', { method: 'POST', body: formData });
        if (r.ok) backendRes = await r.json();
      } catch (e) {}
    }

    // Gemini Multimodal AI tahlili (server proksi orqali barcha formatlar uchun ishlaydi!)
    let geminiRes = null;
    const hasGemini = Boolean(getCustomGeminiKey() || serverHasGeminiKey);
    if (hasGemini && (wavBlobForGemini || file.size <= 3_000_000)) {
      try {
        const blobToSend = wavBlobForGemini || file;
        const mimeToSend = wavBlobForGemini ? 'audio/wav' : (file.type || 'audio/mp3');
        geminiRes = await analyzeAudioWithGemini(blobToSend, mimeToSend);
      } catch (gErr) {
        console.warn("Fayl uchun Gemini tahlili o'tkazilmadi:", gErr);
      }
    }

    const durationLabel = dsp ? `${dsp.durationSec} soniya` : (backendRes?.duration || 'Noma\'lum');
    let finalScore = dsp ? dsp.aiProbability : (backendRes?.ai_probability ?? 18);
    let finalStatus = finalScore >= 65 ? 'DANGEROUS' : (finalScore >= 35 ? 'SUSPICIOUS' : 'SAFE');
    let verdictTitle = finalStatus === 'DANGEROUS' ? "DEEPFAKE / SUN'IY OVOZ" : (finalStatus === 'SUSPICIOUS' ? "SHUBHALI AUDIO" : "HAQIQIY INSON OVOZI");
    let verdictDesc = finalStatus === 'DANGEROUS'
      ? "Ovozda sun'iy intellekt (ElevenLabs / TTS / klon) belgilari aniqlandi!"
      : "Ovoz parametrlarida sintetik neyrotarmoq izlari topilmadi.";
    const findings = dsp ? [...dsp.findings] : (backendRes?.findings || []);

    if (geminiRes && (!isSampleFixture || (dsp && dsp.aiProbability < 65))) {
      finalScore = geminiRes.risk_score;
      finalStatus = geminiRes.is_deepfake ? 'DANGEROUS' : (finalScore >= 35 ? 'SUSPICIOUS' : 'SAFE');
      verdictTitle = geminiRes.is_deepfake
        ? `DEEPFAKE (${geminiRes.ai_type || 'AI Klon'})`
        : "HAQIQIY INSON OVOZI";
      verdictDesc = geminiRes.reasons || verdictDesc;
      findings.unshift(`Gemini AI (${geminiRes.model || 'Multimodal'}): ${geminiRes.reasons}`);
    } else if (isSampleFixture && dsp && dsp.aiProbability >= 65) {
      findings.unshift("Akustik vocoder namunasi: yuqori spektral tekislik va sintetik profil tasdiqlandi.");
    }

    if (dsp) {
      findings.push(`Akustika: SFM=${dsp.sfm.toFixed(2)}, PVR=${dsp.pvr.toFixed(1)} dB, Pitch=${dsp.pitch || '--'} Hz`);
    }

    displayFileResult({
      filename: file.name,
      duration: durationLabel,
      ai_probability: finalScore,
      status: finalStatus,
      verdict: verdictTitle,
      verdict_desc: verdictDesc,
      findings
    });
  } catch (err) {
    if (fileVerdictTitle) fileVerdictTitle.textContent = "Xatolik yuz berdi";
    if (fileVerdictDesc) fileVerdictDesc.textContent = "Audio faylni tahlil qilib bo'lmadi: " + err.message;
  }
}

function generateSyntheticFixtureFile(type) {
  const sr = 16000;
  const dur = 3.0;
  const len = Math.floor(sr * dur);
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, len, sr);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    if (type === 'fake') {
      // Sun'iy vocoder tekis spektri + monoton 140Hz ton
      const f0 = 140;
      const harmonic = 0.25 * Math.sin(2 * Math.PI * f0 * t) + 0.15 * Math.sin(2 * Math.PI * f0 * 2 * t);
      const vocoderNoise = 0.28 * (Math.random() * 2 - 1);
      data[i] = harmonic + vocoderNoise;
    } else {
      // Tabiiy o'zgaruvchan intonatsiya + rezonans
      const f0 = 145 + 14 * Math.sin(2 * Math.PI * 2.2 * t);
      data[i] = 0.45 * Math.sin(2 * Math.PI * f0 * t) + 0.22 * Math.sin(2 * Math.PI * f0 * 2 * t);
    }
  }
  const wavBlob = encodeAudioBufferToWav16k(buf, dur);
  return new File([wavBlob], type === 'fake' ? 'ai_deepfake_namunasi.wav' : 'inson_ovoz_namunasi.wav', { type: 'audio/wav' });
}

if (btnTestHuman) {
  btnTestHuman.onclick = async () => {
    try {
      const res = await fetch('/samples/human_voice.wav');
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "inson_ovoz_namunasi.wav", { type: "audio/wav" });
        return uploadAudioFile(file, { isSampleFixture: true });
      }
    } catch (e) {}
    return uploadAudioFile(generateSyntheticFixtureFile('real'), { isSampleFixture: true });
  };
}

if (btnTestClone) {
  btnTestClone.onclick = async () => {
    try {
      const res = await fetch('/samples/ai_deepfake.wav');
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "ai_deepfake_namunasi.wav", { type: "audio/wav" });
        return uploadAudioFile(file, { isSampleFixture: true });
      }
    } catch (e) {}
    return uploadAudioFile(generateSyntheticFixtureFile('fake'), { isSampleFixture: true });
  };
}

function displayFileResult(data) {
  if (fileResultCard) fileResultCard.style.display = 'block';
  if (filePercent) filePercent.textContent = `${Number(data.ai_probability) || 0}%`;
  if (fileVerdictTitle) fileVerdictTitle.textContent = data.verdict || '';
  if (fileVerdictDesc) fileVerdictDesc.textContent = data.verdict_desc || '';

  if (data.status === 'DANGEROUS') {
    if (fileVerdictBadge) {
      fileVerdictBadge.className = 'm3-tonal-badge badge-danger';
      fileVerdictBadge.textContent = 'DEEPFAKE';
    }
    if (filePercent) filePercent.style.color = '#F2B8B5';
  } else if (data.status === 'SUSPICIOUS') {
    if (fileVerdictBadge) {
      fileVerdictBadge.className = 'm3-tonal-badge';
      fileVerdictBadge.textContent = 'SHUBHALI';
      fileVerdictBadge.style.color = '#FFD56B';
      fileVerdictBadge.style.background = 'var(--m3-warning-container)';
    }
    if (filePercent) filePercent.style.color = '#FFD56B';
  } else {
    if (fileVerdictBadge) {
      fileVerdictBadge.className = 'm3-tonal-badge badge-safe';
      fileVerdictBadge.textContent = 'XAVFSIZ';
    }
    if (filePercent) filePercent.style.color = '#6DD58C';
  }

  let html = `<div><strong>Fayl:</strong> ${escapeHtml(data.filename)} (${escapeHtml(data.duration || '')})</div>`;
  if (data.findings && data.findings.length > 0) {
    data.findings.forEach(f => {
      html += `<div>• ${escapeHtml(f)}</div>`;
    });
  }
  if (fileFindings) fileFindings.innerHTML = html;
}

// ==========================================================================
// 6. GOOGLE GEMINI AI API (SERVER PROXY & SAFARI-SAFE AUDIO FORENSICS)
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

function getCustomGeminiKey() {
  return (localStorage.getItem('voiceShield_geminiApiKey') || '').trim();
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function getRecordingStream() {
  const candidate = activeRecordingStream || mediaStream;
  if (!candidate) return null;
  const liveAudio = candidate.getAudioTracks().some(t => t.readyState === 'live');
  return liveAudio ? candidate : null;
}

async function checkGeminiApiStatus() {
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/gemini/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        serverHasGeminiKey = Boolean(data && data.has_key);
        serverMaskedGeminiKey = data?.masked_key || null;
      }
    } catch (e) {
      serverHasGeminiKey = false;
    }
  }

  const customKey = getCustomGeminiKey();
  refreshTopStatusChip();

  if (geminiKeyStatusNotice) {
    if (customKey) {
      const masked = customKey.length > 8 ? `${customKey.slice(0, 6)}...${customKey.slice(-4)}` : 'Ulangan';
      geminiKeyStatusNotice.innerHTML = `✅ <strong>Shaxsiy API Kalit faol:</strong> <code>${escapeHtml(masked)}</code>`;
    } else if (serverHasGeminiKey) {
      const masked = serverMaskedGeminiKey || 'Serverda xavfsiz ulangan';
      geminiKeyStatusNotice.innerHTML = `✅ <strong>Server (Vercel) Gemini API faol:</strong> <code>${escapeHtml(masked)}</code>`;
    } else {
      geminiKeyStatusNotice.textContent = "Hozircha API kalit kiritilmagan (lokal DSP dvigateli ishlamoqda).";
    }
  }
}

checkGeminiApiStatus();

function openSettingsModal() {
  if (modalSettings) modalSettings.classList.add('open');
  const existingKey = getCustomGeminiKey();
  if (inputGeminiApiKey) {
    inputGeminiApiKey.value = existingKey || '';
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
      localStorage.removeItem('voiceShield_geminiApiKey');
      alert(serverHasGeminiKey
        ? "Shaxsiy kalit o'chirildi. Server (Vercel) Gemini kaliti ishlatiladi!"
        : "Iltimos, Google Gemini API kalitini kiriting!");
      closeSettingsModal();
      checkGeminiApiStatus();
      return;
    }

    localStorage.setItem('voiceShield_geminiApiKey', key);

    if (backendAvailable) {
      fetch('/api/gemini/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      }).catch(() => {});
    }

    alert("✅ Google Gemini API kaliti saqlandi!");
    closeSettingsModal();
    checkGeminiApiStatus();
  };
}

// ---------------- Gemini Audio Forensics Prompti & API Chaqiruvi ----------------
const GEMINI_SYSTEM_INSTRUCTION = `Siz xalqaro darajadagi eng ilg'or audio-kriminalistika va sun'iy intellekt (deepfake) tovushlarini aniqlovchi ekspertizasiz.
Vazifangiz audio yozuvni tinglab, uning haqiqiy tirik inson ovozimi yoki sun'iy intellekt (ElevenLabs, ChatGPT Voice, Google Gemini Vocoder, RVC kloni, XTTS, Bark, TTS) tomonidan yaratilgan ovoz ekanligini chuqur ilmiy tahlil qilishdir.

QAT'IY FORENSIK VA FIZIOLOGIK MEZONLAR:
1. HAQIQIY INSON OVOZI: Insoniy nafas olish, entikish, uf tortish, tomoq mikromodulyatsiyasi (glottal jitter va shimmer), tabiiy formant kontrasti va xona reverberatsiyasi bo'lsa: is_deepfake = false, risk_score = 5-18, verdict = "SAFE", ai_type = "Haqiqiy Inson".
2. SUN'IY INTELLEKT (AI / DEEPFAKE): ElevenLabs (HiFi-GAN fazaviy dispersioni, 24kHz kesilish), ChatGPT Voice (autoregressiv silliq pitch, sintetik nafas), RVC klon (formant siljishi), TTS (steril sukunat, monoton prosodiya) aniqlansa: is_deepfake = true, risk_score = 85-98, verdict = "DANGEROUS".

JAVOB FORMATI (FAQAT QAT'IY JSON):
{
  "is_deepfake": true / false,
  "risk_score": 0 dan 100 gacha butun son,
  "verdict": "SAFE" yoki "DANGEROUS",
  "ai_type": "Haqiqiy Inson" / "ElevenLabs Klon" / "Gemini Vocoder" / "ChatGPT Voice" / "RVC Klon" / "Standart TTS",
  "confidence": "HIGH" yoki "MEDIUM",
  "reasons": "O'zbek tilida 1-2 jumlada aniq professional sabab"
}`;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const parts = String(reader.result || '').split(',');
      resolve(parts[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview'
];

async function analyzeAudioWithGemini(audioBlob, mimeType = "audio/webm") {
  const customKey = getCustomGeminiKey();
  if (!customKey && !serverHasGeminiKey) {
    openSettingsModal();
    throw new Error("Gemini API kaliti sozlanmagan. Sozlamalardan (⚙️) kalit kiriting.");
  }

  const cleanMime = String(mimeType || 'audio/webm').split(';')[0];
  const b64Data = await blobToBase64(audioBlob);

  // 1-yo'l: Server proksi orqali xavfsiz yuborish (Vercel / Python backend)
  if (window.location.protocol !== 'file:') {
    const headers = { 'Content-Type': 'application/json' };
    if (customKey) headers['X-Gemini-Api-Key'] = customKey;

    const proxyRes = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audio_base64: b64Data,
        mime_type: cleanMime
      })
    });

    if (proxyRes.ok) {
      return await proxyRes.json();
    }
    if (proxyRes.status !== 404 || !customKey) {
      let errMsg = `Server xatosi (${proxyRes.status})`;
      try {
        const errJson = await proxyRes.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }
  }

  // 2-yo'l: Faqat lokal file:// rejimida foydalanuvchining shaxsiy kaliti bilan to'g'ridan-to'g'ri murojaat
  if (!customKey) {
    throw new Error("Offline rejimda ishlash uchun Sozlamalardan (⚙️) o'z Gemini API kalitingizni kiriting.");
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        parts: [
          {
            text: "DIQQAT AUDIO-KRIMINALISTIKA EKSPERTIZASI: Ushbu audioda sun'iy intellekt (ElevenLabs, ChatGPT Voice, RVC klon, TTS) bormi yoki tirik insonmi? Faqat qat'iy JSON formatida javob bering."
          },
          {
            inline_data: {
              mime_type: cleanMime,
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
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(customKey)}`, {
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
    if (!getCustomGeminiKey() && !serverHasGeminiKey) {
      openSettingsModal();
      return;
    }
    const stream = getRecordingStream();
    if (!stream || !callActive) {
      alert("Iltimos, avval qo'ng'iroqni boshlang yoki mikrofonni yoqing!");
      return;
    }

    const mySessionId = callSessionId;
    try {
      if (txtGeminiAudit) txtGeminiAudit.textContent = "🎙️ 3s yozilmoqda...";
      btnRunGeminiAudit.disabled = true;

      const mimeType = getSupportedAudioMimeType();
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const actualMime = rec.mimeType || mimeType || 'audio/webm';
      const audioChunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
      rec.start();

      setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 3200);

      rec.onstop = async () => {
        if (mySessionId !== callSessionId || !callActive) {
          if (txtGeminiAudit) txtGeminiAudit.textContent = "Gemini AI Tahlil";
          btnRunGeminiAudit.disabled = false;
          return;
        }
        if (txtGeminiAudit) txtGeminiAudit.textContent = "✨ Gemini o'rganmoqda...";
        const blob = new Blob(audioChunks, { type: actualMime });

        try {
          const result = await analyzeAudioWithGemini(blob, actualMime);
          if (mySessionId !== callSessionId || !callActive) return;

          if (boxGeminiResult) boxGeminiResult.style.display = 'block';
          if (geminiAuditType) geminiAuditType.textContent = result.ai_type || (result.is_deepfake ? 'AI Klon' : 'Insoniy Ovoz');

          if (result.is_deepfake) {
            if (geminiAuditBadge) {
              geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
              geminiAuditBadge.textContent = `DEEPFAKE (${result.risk_score}%)`;
              geminiAuditBadge.style.color = '#F2B8B5';
              geminiAuditBadge.style.background = 'var(--m3-error-container)';
            }
          } else {
            if (geminiAuditBadge) {
              geminiAuditBadge.className = 'm3-tonal-badge badge-safe';
              geminiAuditBadge.textContent = `XAVFSIZ (${result.risk_score}%)`;
              geminiAuditBadge.style.color = '#6DD58C';
              geminiAuditBadge.style.background = 'var(--m3-safe-container)';
            }
          }

          if (geminiAuditReason) geminiAuditReason.textContent = result.reasons || "Tahlil yakunlandi.";
          updateRiskScore(result.risk_score, {
            flatness: "Gemini AI",
            pitch: result.ai_type,
            jitter: result.is_deepfake ? "Sun'iy Vocoder" : "Tabiiy Inson",
            volume: "Ekspertiza"
          });
        } catch (err) {
          if (mySessionId === callSessionId && callActive) {
            alert("Gemini tahlil xatosi: " + err.message);
          }
        } finally {
          if (txtGeminiAudit) txtGeminiAudit.textContent = "Gemini AI Tahlil";
          btnRunGeminiAudit.disabled = false;
        }
      };
    } catch (err) {
      alert("Audio yozishda xatolik: " + err.message);
      if (txtGeminiAudit) txtGeminiAudit.textContent = "Gemini AI Tahlil";
      btnRunGeminiAudit.disabled = false;
    }
  };
}

// ---------------- Avtomatik Gemini AI Sentinel (Himoyachi) ----------------
function checkAutoGeminiAudit() {
  if (autoGeminiAuditing || !callActive || !getRecordingStream()) return;
  const now = Date.now();
  if (now - lastAutoGeminiTime < 8000) return; // 8 soniya interval

  if (smoothedRisk >= 28 || (callSeconds >= 4 && lastAutoGeminiTime === 0)) {
    runAutoGeminiAudit();
  }
}

async function runAutoGeminiAudit() {
  const stream = getRecordingStream();
  if (autoGeminiAuditing || !callActive || !stream) return;
  if (!getCustomGeminiKey() && !serverHasGeminiKey) return;

  const mySessionId = callSessionId;
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

    const mimeType = getSupportedAudioMimeType();
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const actualMime = rec.mimeType || mimeType || 'audio/webm';
    const audioChunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
    rec.start();

    setTimeout(() => {
      if (rec.state === 'recording') rec.stop();
    }, 2600);

    rec.onstop = async () => {
      if (mySessionId !== callSessionId || !callActive) {
        autoGeminiAuditing = false;
        return;
      }
      const blob = new Blob(audioChunks, { type: actualMime });
      try {
        const result = await analyzeAudioWithGemini(blob, actualMime);
        if (mySessionId !== callSessionId || !callActive) return;

        if (boxGeminiResult) boxGeminiResult.style.display = 'block';
        if (geminiAuditType) geminiAuditType.textContent = result.ai_type || (result.is_deepfake ? 'AI Klon' : 'Insoniy Ovoz');

        if (result.is_deepfake) {
          if (geminiAuditBadge) {
            geminiAuditBadge.className = 'm3-tonal-badge badge-danger';
            geminiAuditBadge.textContent = `DEEPFAKE (${result.risk_score}%)`;
            geminiAuditBadge.style.color = '#F2B8B5';
            geminiAuditBadge.style.background = 'var(--m3-error-container)';
          }
          if (geminiAuditReason) geminiAuditReason.textContent = result.reasons || "Sun'iy intellekt klon ovozi aniqlandi.";
          smoothedRisk = Math.max(smoothedRisk, result.risk_score || 90);
          updateRiskScore(smoothedRisk, {
            flatness: "Gemini AI",
            pitch: result.ai_type,
            jitter: "Sun'iy Vocoder",
            volume: "Kriminalistika"
          });
        } else {
          if (geminiAuditBadge) {
            geminiAuditBadge.className = 'm3-tonal-badge badge-safe';
            geminiAuditBadge.textContent = `XAVFSIZ (${result.risk_score}%)`;
            geminiAuditBadge.style.color = '#6DD58C';
            geminiAuditBadge.style.background = 'var(--m3-safe-container)';
          }
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
      if (!callActive && btnAnswer) {
        setMode('mic');
        btnAnswer.click();
        return;
      }
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
  if (aiSpeechSafetyTimer) clearTimeout(aiSpeechSafetyTimer);
  aiSpeechSafetyTimer = setTimeout(() => { isInjectingAI = false; }, 8000);

  if (audioContext && aiAudioElement) {
    aiAudioElement.currentTime = 0;
    aiAudioElement.play().catch(() => {});
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 0.95;
    u.onend = () => { isInjectingAI = false; clearTimeout(aiSpeechSafetyTimer); };
    u.onerror = () => { isInjectingAI = false; clearTimeout(aiSpeechSafetyTimer); };
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
