// ============================================================
//  แผนที่และการ render
// ============================================================
const map = L.map('map', { center: [13.5, 101.0], zoom: 6, minZoom: 5, maxZoom: 12 });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let selectedProvIndex = null;
let currentEventObj = null;
let currentEventProvIdx = null;

// ============================================================
//  แสดงเวลา
// ============================================================
function updateDateDisplay() {
    const d = gameState.date;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const dateStr = `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    document.getElementById('game-date').innerText = dateStr;
}

// ============================================================
//  ควบคุมความเร็วเวลา
// ============================================================
function setTimeSpeed(speed) {
    if (speed === 0) {
        gameState.isPaused = true;
    } else {
        gameState.isPaused = false;
        gameState.speed = speed;
    }

    document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
    if (speed === 0) {
        document.getElementById('btn-pause').classList.add('active');
    } else {
        const btn = document.getElementById(`btn-speed-${speed}`);
        if (btn) btn.classList.add('active');
    }
}

// ============================================================
//  สีตามค่า (0=แดง, 50=เหลือง, 100=เขียว)
// ============================================================
function valueColor(val) {
    const hue = Math.max(0, Math.min(120, val * 1.2));
    return `hsl(${hue}, 80%, 45%)`;
}

// ============================================================
//  Render หมุดบนแผนที่
// ============================================================
function renderMapMarkers() {
    provinces.forEach((p, idx) => {
        if (p.markerObj) map.removeLayer(p.markerObj);

        const colorHex = valueColor(p.happiness);
        const radius = 5 + (p.infrastructure / 15);

        const circle = L.circleMarker([p.lat, p.lng], {
            radius: radius,
            fillColor: colorHex,
            color: p.happiness < 30 ? "#ff0000" : "#ffffff",
            weight: p.happiness < 30 ? 3 : 1.5,
            opacity: 1,
            fillOpacity: 0.8,
            className: p.happiness < 30 ? 'blinking-marker' : ''
        }).addTo(map);

        // Tooltip แสดงครบทุกค่า
        const emo = p.happiness >= 50 ? "😊" : "😡";
        circle.bindTooltip(
            `<b>จ.${p.name}</b><br>${emo} ความสุข: ${Math.floor(p.happiness)}<br>🚂 โครงสร้าง: ${Math.floor(p.infrastructure)}<br>🌳 สิ่งแวดล้อม: ${Math.floor(p.environment)}`,
            { direction: 'top', className: 'custom-tooltip' }
        );

        circle.on('click', () => selectProvince(idx));
        p.markerObj = circle;
    });
}

// ============================================================
//  เลือกจังหวัด
// ============================================================
function selectProvince(idx) {
    selectedProvIndex = idx;
    const p = provinces[idx];

    document.getElementById('sidebar-empty').style.display = 'none';
    document.getElementById('sidebar-content').style.display = 'block';

    document.getElementById('prov-name').innerText = "📍 จ." + p.name;

    document.getElementById('prov-hap').innerText = Math.floor(p.happiness);
    document.getElementById('prov-inf').innerText = Math.floor(p.infrastructure);
    document.getElementById('prov-env').innerText = Math.floor(p.environment);

    // สีทุกค่า
    document.getElementById('prov-hap').style.color = p.happiness < 40 ? 'var(--danger)' : (p.happiness > 70 ? 'var(--success)' : 'var(--warning)');
    document.getElementById('prov-inf').style.color = p.infrastructure < 40 ? 'var(--danger)' : (p.infrastructure > 70 ? 'var(--success)' : 'var(--warning)');
    document.getElementById('prov-env').style.color = p.environment < 40 ? 'var(--danger)' : (p.environment > 70 ? 'var(--success)' : 'var(--warning)');

    // ประวัตินโยบาย
    const polList = document.getElementById('prov-policies-list');
    if (polList) {
        polList.innerHTML = '';
        if (p.activePolicies && p.activePolicies.length > 0) {
            p.activePolicies.forEach(polName => {
                const li = document.createElement('li');
                li.style.marginBottom = '6px';
                li.innerHTML = `✅ ${polName}`;
                polList.appendChild(li);
            });
        } else {
            polList.innerHTML = '<li style="color:#8b949e;">ยังไม่มีนโยบายในพื้นที่นี้</li>';
        }
    }
}

// ============================================================
//  อัปเดต Dashboard
// ============================================================
function updateDashboard() {
    document.getElementById('res-budget').innerText = Math.floor(gameState.budget);
    document.getElementById('res-debt').innerText = gameState.debt.toFixed(0);
    document.getElementById('res-approval').innerText = gameState.approval.toFixed(0);
    document.getElementById('res-stability').innerText = gameState.stability.toFixed(0);

    // สีตามระดับ
    document.getElementById('res-approval').style.color = gameState.approval < 40 ? 'var(--danger)' : (gameState.approval > 70 ? 'var(--success)' : 'white');
    document.getElementById('res-stability').style.color = gameState.stability < 40 ? 'var(--danger)' : (gameState.stability > 70 ? 'var(--success)' : 'white');

    // Progress bar ใต้ตัวเลข
    updateProgressBar('bar-approval', gameState.approval);
    updateProgressBar('bar-stability', gameState.stability);
    updateProgressBar('bar-opposition', gameState.opposition, true);

    // ประชากร
    document.getElementById('res-pop').innerText = (gameState.population / 1000000).toFixed(2);

    // ความสุขเฉลี่ย
    const totalHap = provinces.reduce((sum, p) => sum + p.happiness, 0);
    const avgHap = totalHap / provinces.length;
    document.getElementById('res-avg-hap').innerText = Math.floor(avgHap);
    document.getElementById('res-avg-hap').style.color = avgHap < 40 ? 'var(--danger)' : (avgHap > 70 ? 'var(--success)' : 'white');
    updateProgressBar('bar-avghap', avgHap);

    // ฝ่ายค้าน
    if (document.getElementById('res-opposition')) {
        document.getElementById('res-opposition').innerText = gameState.opposition.toFixed(0);
        document.getElementById('res-opposition').style.color = gameState.opposition > 60 ? 'var(--danger)' : (gameState.opposition > 40 ? 'var(--warning)' : 'var(--success)');
    }

    updateDateDisplay();
}

function updateProgressBar(id, value, invert) {
    const bar = document.getElementById(id);
    if (!bar) return;
    bar.style.width = value + '%';
    // invert = ค่ามากเป็นอันตราย (เช่นฝ่ายค้าน)
    const v = invert ? 100 - value : value;
    const hue = Math.max(0, Math.min(120, v * 1.2));
    bar.style.background = `hsl(${hue}, 80%, 45%)`;
}

// ============================================================
//  ระบบ Chat (เสียงสะท้อนประชาชน)
// ============================================================
function addChatMessage(text, sender, type) {
    if (!gameState.settings.citizenChat) return;
    const chatContainer = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.innerText = sender;

    msgDiv.appendChild(senderDiv);
    msgDiv.appendChild(document.createTextNode(text));

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // จำกัดจำนวนข้อความไม่ให้เยอะเกิน (กัน DOM บวม)
    while (chatContainer.children.length > 50) {
        chatContainer.removeChild(chatContainer.firstChild);
    }
}

// ============================================================
//  Toast ผลกระทบหลังตัดสินใจ
// ============================================================
function flashResourceSummary(eff) {
    const lines = [];
    if (eff.approval) lines.push(`คะแนนนิยม ${eff.approval >= 0 ? '+' : ''}${eff.approval}%`);
    if (eff.happiness) lines.push(`ความสุข ${eff.happiness >= 0 ? '+' : ''}${eff.happiness}`);
    if (eff.infra) lines.push(`โครงสร้าง ${eff.infra >= 0 ? '+' : ''}${eff.infra}`);
    if (eff.env) lines.push(`สิ่งแวดล้อม ${eff.env >= 0 ? '+' : ''}${eff.env}`);
    if (lines.length > 0) showToast(lines.join(' · '));
}

function showToast(text, color) {
    const toast = document.getElementById('generic-toast');
    if (!toast) return;
    toast.innerText = text;
    toast.style.background = color || 'linear-gradient(135deg, #2f81f7 0%, #1f6feb 100%)';
    toast.style.color = '#fff';
    toast.style.display = 'flex';
    toast.style.animation = 'none';
    // รีเซ็ต animation แล้ว trigger ใหม่
    void toast.offsetWidth;
    toast.style.animation = 'toastPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.style.display = 'none', 3000);
}

// ============================================================
//  Event Modal
// ============================================================
function showEventModal(policy, provIdx) {
    setTimeSpeed(0);

    const target = provinces[provIdx];
    map.flyTo([target.lat, target.lng], 8, { duration: 1.5 });

    currentEventObj = policy;
    currentEventProvIdx = provIdx;

    document.getElementById('event-title').innerText = policy.title;
    document.getElementById('event-prov').innerText = provinces[provIdx].name;
    document.getElementById('event-desc').innerText = policy.desc;

    const cost = policy.cost;
    document.getElementById('event-cost').innerText = (cost > 0 ? "-" : "+") + Math.abs(cost);
    document.getElementById('event-cost').style.color = cost > 0 ? "var(--danger)" : "var(--success)";

    const eff = policy.effects.approve;
    document.getElementById('event-app').innerText = (eff.approval >= 0 ? "+" : "") + eff.approval + "%";
    document.getElementById('event-app').style.color = eff.approval >= 0 ? "var(--success)" : "var(--danger)";

    document.getElementById('event-hap').innerText = (eff.happiness >= 0 ? "+" : "") + eff.happiness;
    document.getElementById('event-hap').style.color = eff.happiness >= 0 ? "var(--success)" : "var(--danger)";

    document.getElementById('event-inf').innerText = (eff.infra >= 0 ? "+" : "") + eff.infra;
    document.getElementById('event-inf').style.color = eff.infra >= 0 ? "var(--success)" : "var(--danger)";

    document.getElementById('event-env').innerText = (eff.env >= 0 ? "+" : "") + eff.env;
    document.getElementById('event-env').style.color = eff.env >= 0 ? "var(--success)" : "var(--danger)";

    document.getElementById('event-modal-overlay').style.display = 'flex';
}

function hideEventModal() {
    document.getElementById('event-modal-overlay').style.display = 'none';
    currentEventObj = null;
    currentEventProvIdx = null;
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}

// ============================================================
//  ระบบรัฐมนตรี (Cabinet)
// ============================================================
function openCabinet() {
    setTimeSpeed(0);
    document.getElementById('cabinet-modal').style.display = 'flex';
    renderCabinetList();
}
function closeCabinet() {
    document.getElementById('cabinet-modal').style.display = 'none';
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}
function renderCabinetList() {
    const list = document.getElementById('cabinet-list');
    list.innerHTML = '';

    const ministersDef = [
        { id: 'finance',  name: 'รัฐมนตรีว่าการกระทรวงการคลัง', desc: 'เพิ่มรายได้รายวัน ~15M (หักค่าจ้างแล้วยังได้)', cost: 10 },
        { id: 'interior', name: 'รัฐมนตรีว่าการกระทรวงมหาดไทย', desc: 'เพิ่มความสุขและโครงสร้างพื้นฐานทีละน้อย', cost: 15 },
        { id: 'defense',  name: 'รัฐมนตรีว่าการกระทรวงกลาโหม', desc: 'รับมือม็อบ ลดฝ่ายค้าน เพิ่มความเสถียรภาพ', cost: 20 }
    ];

    ministersDef.forEach(m => {
        const isHired = gameState.ministers[m.id];
        const div = document.createElement('div');
        div.className = 'cabinet-slot';
        div.innerHTML = `
            <div>
                <h4>${m.name}</h4>
                <p>${m.desc} (ค่าจ้าง: ${m.cost}M / วัน)</p>
            </div>
            <div style="text-align:right;">
                ${isHired
                    ? `<button class="btn-fire" onclick="toggleMinister('${m.id}', false)">❌ ไล่ออก</button>`
                    : `<button class="btn-hire" onclick="toggleMinister('${m.id}', true)">✅ แต่งตั้ง</button>`
                }
            </div>
        `;
        list.appendChild(div);
    });
}
function toggleMinister(id, state) {
    gameState.ministers[id] = state;
    renderCabinetList();
    addChatMessage(`คุณได้ ${state ? 'แต่งตั้ง' : 'ไล่ออก'} รัฐมนตรี${id === 'finance' ? 'คลัง' : id === 'interior' ? 'มหาดไทย' : 'กลาโหม'}`, "ทำเนียบรัฐบาล", "system");
}

// ============================================================
//  ระบบจ่ายหนี้ (Repay Debt)
// ============================================================
function repayDebt() {
    if (gameState.debt <= 0) {
        showToast("ไม่มีหนี้สาธารณะค้างอยู่ 😊");
        return;
    }
    const repayAmount = Math.min(gameState.budget, gameState.debt);
    if (repayAmount <= 0) {
        showToast("งบประมาณไม่พอจ่ายหนี้ 💸");
        return;
    }
    gameState.budget -= repayAmount;
    gameState.debt -= repayAmount;
    gameState.stats.debtRepaid += repayAmount;
    addChatMessage(`💵 รัฐบาลใช้หนี้สาธารณะคืน ${repayAmount.toFixed(0)}M`, "กระทรวงการคลัง", "system");
    showToast(`ใช้หนี้คืน ${repayAmount.toFixed(0)}M 💵`);
    updateDashboard();
}

// ============================================================
//  ระบบหนังสือพิมพ์ (Newspaper)
// ============================================================
function showNews(year, headline, bodyText) {
    setTimeSpeed(0);
    document.getElementById('news-date').innerText = `ฉบับสรุปผลงาน 31 ธันวาคม ${year}`;
    document.getElementById('news-headline').innerText = headline;
    document.getElementById('news-body').innerHTML = bodyText;
    document.getElementById('news-modal').style.display = 'flex';
}
function closeNews() {
    document.getElementById('news-modal').style.display = 'none';
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}

// ============================================================
//  ระบบความสำเร็จ (Achievements)
// ============================================================
function checkAchievement(id) {
    if (!gameState.achievements[id]) {
        gameState.achievements[id] = true;
        const toast = document.getElementById('achieve-toast');
        document.getElementById('achieve-name').innerText = achieveDefs[id].name;
        toast.style.display = 'flex';
        toast.style.animation = 'none';
        void toast.offsetWidth;
        toast.style.animation = 'toastPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.style.display = 'none', 4000);
    }
}

function openAchievements() {
    setTimeSpeed(0);
    document.getElementById('achievements-modal').style.display = 'flex';
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';

    Object.keys(achieveDefs).forEach(k => {
        const isUnlocked = gameState.achievements[k];
        const div = document.createElement('div');
        div.style.background = isUnlocked ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '8px';
        div.style.border = isUnlocked ? '1px solid gold' : '1px solid rgba(255,255,255,0.1)';
        div.innerHTML = `
            <div style="font-size:18px; font-weight:bold; color:${isUnlocked ? 'gold' : '#8b949e'}">${isUnlocked ? '🏅' : '🔒'} ${achieveDefs[k].name}</div>
            <div style="font-size:13px; color:#c9d1d9;">${achieveDefs[k].desc}</div>
        `;
        list.appendChild(div);
    });
}
function closeAchievements() {
    document.getElementById('achievements-modal').style.display = 'none';
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}

// ============================================================
//  ระบบ Game Over
// ============================================================
function showGameOver(title, message) {
    setTimeSpeed(0);
    document.getElementById('game-over-title').innerText = title;
    document.getElementById('game-over-title').style.color = title.includes('ชนะ') ? 'var(--success)' : 'var(--danger)';
    document.getElementById('game-over-desc').innerText = message;
    document.getElementById('game-over-modal-overlay').style.display = 'flex';
}

// ============================================================
//  ระบบตั้งค่า (Settings)
// ============================================================
function openSettings() {
    setTimeSpeed(0);
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('setting-chat').checked = gameState.settings.citizenChat;
    document.getElementById('setting-speed').value = gameState.settings.defaultSpeed;
}
function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
    gameState.settings.citizenChat = document.getElementById('setting-chat').checked;
    gameState.settings.defaultSpeed = parseInt(document.getElementById('setting-speed').value);
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}

// ============================================================
//  หน้าเริ่มเกม (Start Screen)
// ============================================================
function showStartScreen() {
    document.getElementById('start-screen').style.display = 'flex';
    // ซ่อน UI เกมหลัก
    document.getElementById('topbar').style.display = 'none';
    document.getElementById('main-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'none';
}
function hideStartScreen() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('main-container').style.display = 'flex';
    document.getElementById('chat-container').style.display = 'flex';
}

function newGame() {
    // เปิดหน้าเลือกระดับความยาก
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('difficulty-menu').style.display = 'block';
    renderDifficultyOptions();
}

function renderDifficultyOptions() {
    const container = document.getElementById('difficulty-options');
    container.innerHTML = '';
    Object.keys(DIFFICULTY_PRESETS).forEach(key => {
        const diff = DIFFICULTY_PRESETS[key];
        const div = document.createElement('div');
        div.className = 'diff-card';
        div.style.borderColor = diff.color;
        div.innerHTML = `
            <h3 style="color:${diff.color}; margin:0 0 8px 0;">${diff.icon} ${diff.name}</h3>
            <p style="color:#8b949e; font-size:13px; margin:0; line-height:1.5;">${diff.desc}</p>
        `;
        div.onclick = () => startNewGame(key);
        container.appendChild(div);
    });
}

function backToStartMenu() {
    document.getElementById('start-menu').style.display = 'block';
    document.getElementById('difficulty-menu').style.display = 'none';
    document.getElementById('load-menu').style.display = 'none';
}

function startNewGame(difficulty) {
    // รีเซ็ตเกมใหม่
    gameState = {
        date: new Date(2025, 0, 1),
        speed: gameState.settings.defaultSpeed || 1,
        isPaused: true,
        hasStarted: true,
        budget: DIFFICULTY_PRESETS[difficulty].startBudget,
        approval: 50.0,
        stability: 70.0,
        population: 70000000,
        electionYear: 2029,
        debt: 0.0,
        difficulty: difficulty,
        opposition: 30,
        lastMonth: 0,
        ministers: { finance: false, interior: false, defense: false },
        achievements: {},
        settings: gameState.settings,
        stats: {
            policiesApproved: 0,
            policiesRejected: 0,
            monthsSurvived: 0,
            maxApproval: 50,
            debtRepaid: 0,
            provincesDeveloped: 0,
            yearsCompleted: 0,
            ecoRejected: 0
        }
    };

    // รีเซ็ตจังหวัด
    provinces.forEach(p => {
        p.happiness = 50 + Math.floor(Math.random() * 20);
        p.infrastructure = (p.infrastructure > 50 ? p.infrastructure : 30 + Math.floor(Math.random() * 20));
        p.environment = (p.environment > 50 ? p.environment : 60 + Math.floor(Math.random() * 20));
        p.activePolicies = [];
    });
    eventQueue = [];
    daysSinceLastEvent = 0;

    hideStartScreen();
    updateDashboard();
    renderMapMarkers();
    setTimeSpeed(0);

    addChatMessage(`🎉 เริ่มเกมใหม่ (ระดับ: ${DIFFICULTY_PRESETS[difficulty].name}) ยินดีต้อนรับท่านนายกรัฐมนตรี!`, "ระบบแจ้งเตือน", "system");

    // แสดง Tutorial ถ้ายังไม่เคยทำ
    if (!gameState.settings.tutorialDone) {
        setTimeout(() => startTutorial(), 500);
    }
}

// ============================================================
//  โหลดเกม (Load Menu)
// ============================================================
function openLoadMenu() {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('load-menu').style.display = 'block';
    renderLoadSlots();
}

function renderLoadSlots() {
    const container = document.getElementById('load-slots');
    container.innerHTML = '';

    // สล็อตอัตโนมัติ
    const autoMeta = getSlotMeta('auto');
    const autoDiv = document.createElement('div');
    autoDiv.className = 'save-slot';
    if (autoMeta) {
        autoDiv.innerHTML = `
            <div class="save-info">
                <div class="save-title">🔄 บันทึกอัตโนมัติ</div>
                <div class="save-detail">${formatSaveDate(autoMeta.date)} · งบ ${autoMeta.budget}M · นิยม ${autoMeta.approval}%</div>
            </div>
            <button class="btn-hire" onclick="loadSlot('auto')">โหลด</button>
        `;
    } else {
        autoDiv.innerHTML = `<div class="save-info"><div class="save-title">🔄 บันทึกอัตโนมัติ</div><div class="save-detail">ยังไม่มีข้อมูล</div></div>`;
    }
    container.appendChild(autoDiv);

    // สล็อต 1-3
    for (let i = 1; i <= NUM_SLOTS; i++) {
        const meta = getSlotMeta(i);
        const div = document.createElement('div');
        div.className = 'save-slot';
        if (meta) {
            div.innerHTML = `
                <div class="save-info">
                    <div class="save-title">💾 สล็อต ${i}</div>
                    <div class="save-detail">${formatSaveDate(meta.date)} · งบ ${meta.budget}M · นิยม ${meta.approval}% · ${DIFFICULTY_PRESETS[meta.difficulty]?.name || ''}</div>
                </div>
                <div class="save-actions">
                    <button class="btn-hire" onclick="loadSlot(${i})">โหลด</button>
                    <button class="btn-fire" onclick="deleteSlot(${i})">ลบ</button>
                </div>
            `;
        } else {
            div.innerHTML = `<div class="save-info"><div class="save-title">💾 สล็อต ${i}</div><div class="save-detail">ว่าง</div></div>`;
        }
        container.appendChild(div);
    }
}

function formatSaveDate(isoStr) {
    const d = new Date(isoStr);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function loadSlot(slot) {
    if (loadGame(slot)) {
        hideStartScreen();
        renderMapMarkers();
        updateDashboard();
        setTimeSpeed(0);
        addChatMessage("📂 โหลดเกมสำเร็จ ยินดีต้อนรับกลับมา ท่านนายกฯ!", "ระบบแจ้งเตือน", "system");
    } else {
        alert("ไม่สามารถโหลดเกมได้");
    }
}

function deleteSlot(slot) {
    if (confirm(`ต้องการลบสล็อต ${slot} ใช่ไหม?`)) {
        deleteSave(slot);
        renderLoadSlots();
    }
}

// ============================================================
//  บันทึกเกม (จากในเกม)
// ============================================================
function openSaveMenu() {
    setTimeSpeed(0);
    document.getElementById('save-modal').style.display = 'flex';
    renderSaveSlotsInGame();
}
function closeSaveMenu() {
    document.getElementById('save-modal').style.display = 'none';
    if (gameState.speed > 0) setTimeSpeed(gameState.speed);
}
function renderSaveSlotsInGame() {
    const container = document.getElementById('save-slots-ingame');
    container.innerHTML = '';
    for (let i = 1; i <= NUM_SLOTS; i++) {
        const meta = getSlotMeta(i);
        const div = document.createElement('div');
        div.className = 'save-slot';
        div.innerHTML = `
            <div class="save-info">
                <div class="save-title">💾 สล็อต ${i}</div>
                <div class="save-detail">${meta ? formatSaveDate(meta.date) + ' · งบ ' + meta.budget + 'M' : 'ว่าง'}</div>
            </div>
            <button class="btn-hire" onclick="saveToSlot(${i})">บันทึก</button>
        `;
        container.appendChild(div);
    }
}
function saveToSlot(slot) {
    if (saveGame(slot)) {
        showToast(`บันทึกเกมลงสล็อต ${slot} แล้ว 💾`);
        renderSaveSlotsInGame();
    } else {
        alert("บันทึกล้มเหลว");
    }
}

// ============================================================
//  Tutorial
// ============================================================
const tutorialSteps = [
    { selector: '#map', title: '🗺️ แผนที่ประเทศไทย', text: 'นี่คือแผนที่ 77 จังหวัด คลิกที่วงกลมเพื่อดูข้อมูลจังหวัด<br>สีเขียว = ประชาชนมีความสุข, สีแดง = ความสุขต่ำ (อันตราย!)' },
    { selector: '#topbar', title: '📊 ทรัพยากรของประเทศ', text: 'ดูงบประมาณ คะแนนนิยม เสถียรภาพ และค่าอื่นๆ ที่นี่<br>ห้ามให้เสถียรภาพตกเป็น 0 ไม่งั้นเกมจะจบ!' },
    { selector: '.time-controls', title: '⏱️ ควบคุมเวลา', text: 'กด ▶ เพื่อเริ่มเวลา, ▶▶ เร็วขึ้น, ⏸️ หยุด<br>เวลาจะหยุดอัตโนมัติเมื่อมีนโยบายมาให้ตัดสินใจ' },
    { selector: '#sidebar', title: '📋 แผงขวา', text: 'เมื่อคลิกจังหวัด ข้อมูลและประวัตินโยบายจะแสดงที่นี่' },
    { selector: '#chat-container', title: '💬 เสียงสะท้อนประชาชน', text: 'ชาวบ้านจะพูดคุยและบ่นกับคุณที่นี่ ฟังเขาบ้างนะ!' },
    { selector: null, title: '🎯 เป้าหมาย', text: 'อยู่รอดจนถึงการเลือกตั้งปี 2029 และชนะ!<br>อย่าให้เสถียรภาพตกเป็น 0 (รัฐประหาร) หรือหนี้ทะลุ 2,000M<br>ขอให้สนุกครับ ท่านนายกฯ!' }
];

let tutorialStep = 0;
function startTutorial() {
    tutorialStep = 0;
    showTutorialStep();
}
function showTutorialStep() {
    const overlay = document.getElementById('tutorial-overlay');
    const step = tutorialSteps[tutorialStep];
    if (!step) {
        endTutorial();
        return;
    }
    document.getElementById('tutorial-title').innerText = step.title;
    document.getElementById('tutorial-text').innerHTML = step.text;
    document.getElementById('tutorial-progress').innerText = `${tutorialStep + 1} / ${tutorialSteps.length}`;
    document.getElementById('tutorial-next').innerText = (tutorialStep === tutorialSteps.length - 1) ? 'เสร็จสิ้น' : 'ถัดไป →';

    overlay.style.display = 'flex';
    highlightElement(step.selector);
}
function nextTutorialStep() {
    tutorialStep++;
    showTutorialStep();
}
function skipTutorial() {
    endTutorial();
}
function endTutorial() {
    document.getElementById('tutorial-overlay').style.display = 'none';
    removeHighlight();
    gameState.settings.tutorialDone = true;
}

function highlightElement(selector) {
    removeHighlight();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
        el.classList.add('tutorial-highlight');
        el.style.zIndex = '6000';
    }
}
function removeHighlight() {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.zIndex = '';
    });
}

// ============================================================
//  เริ่มต้น
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    showStartScreen();
    setTimeSpeed(0);
    updateDashboard();
    renderMapMarkers();
});
