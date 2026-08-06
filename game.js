// ============================================================
//  ฟังก์ชันช่วย
// ============================================================
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function getDifficulty() {
    return DIFFICULTY_PRESETS[gameState.difficulty] || DIFFICULTY_PRESETS.normal;
}

// ============================================================
//  ระบบ Save / Load (localStorage)
// ============================================================
const SAVE_PREFIX = 'siamPM_save_';
const AUTO_SAVE_KEY = 'siamPM_autosave';
const NUM_SLOTS = 3;

function serializeGame() {
    return JSON.stringify({
        gameState: gameState,
        provinces: provinces.map(p => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            happiness: p.happiness,
            infrastructure: p.infrastructure,
            environment: p.environment,
            activePolicies: p.activePolicies
        })),
        eventQueue: eventQueue.map(q => ({
            policyId: q.policy.id,
            provIdx: q.provIdx,
            triggerDate: q.triggerDate.toISOString()
        }))
    });
}

function deserializeGame(dataStr) {
    const data = JSON.parse(dataStr);
    gameState = Object.assign(gameState, data.gameState);
    gameState.date = new Date(data.gameState.date);
    gameState.lastMonth = gameState.date.getMonth();
    // provinces
    for (let i = 0; i < provinces.length && i < data.provinces.length; i++) {
        provinces[i].happiness = data.provinces[i].happiness;
        provinces[i].infrastructure = data.provinces[i].infrastructure;
        provinces[i].environment = data.provinces[i].environment;
        provinces[i].activePolicies = data.provinces[i].activePolicies || [];
    }
    // eventQueue
    eventQueue = data.eventQueue.map(q => ({
        policy: policyDatabase.find(p => p.id === q.policyId) || policyDatabase[0],
        provIdx: q.provIdx,
        triggerDate: new Date(q.triggerDate)
    }));
}

function saveGame(slot) {
    try {
        const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_PREFIX + slot;
        localStorage.setItem(key, serializeGame());
        // บันทึกเมทาดาต้าสำหรับแสดงในหน้าเลือกสล็อต
        const meta = {
            date: gameState.date.toISOString(),
            budget: Math.floor(gameState.budget),
            approval: Math.floor(gameState.approval),
            stability: Math.floor(gameState.stability),
            difficulty: gameState.difficulty
        };
        localStorage.setItem(key + '_meta', JSON.stringify(meta));
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        return false;
    }
}

function loadGame(slot) {
    try {
        const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_PREFIX + slot;
        const data = localStorage.getItem(key);
        if (!data) return false;
        deserializeGame(data);
        gameState.hasStarted = true;
        return true;
    } catch (e) {
        console.error('Load failed:', e);
        return false;
    }
}

function getSlotMeta(slot) {
    try {
        const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_PREFIX + slot;
        const meta = localStorage.getItem(key + '_meta');
        return meta ? JSON.parse(meta) : null;
    } catch (e) {
        return null;
    }
}

function deleteSave(slot) {
    const key = slot === 'auto' ? AUTO_SAVE_KEY : SAVE_PREFIX + slot;
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_meta');
}

// ============================================================
//  การรับมือกับเหตุการณ์นโยบาย
// ============================================================
function handleEventChoice(choice) {
    if (!currentEventObj || currentEventProvIdx === null) return;

    const p = provinces[currentEventProvIdx];
    const policy = currentEventObj;

    if (choice === 'approve') {
        if (gameState.budget < policy.cost) {
            // อนุญาตให้กู้หนี้เพื่ออนุมัติได้ (ระบบจะจัดการด้านล่าง)
        }

        // ระบบหนี้สาธารณะ — ถ้างบไม่พอให้กู้ส่วนที่ขาด
        if (policy.cost > 0 && gameState.budget < policy.cost) {
            const deficit = policy.cost - gameState.budget;
            gameState.budget = 0;
            gameState.debt += deficit;
            addChatMessage(`⚠️ ต้องกู้หนี้สาธารณะเพิ่ม ${deficit.toFixed(0)}M เพื่อโครงการนี้`, "กระทรวงการคลัง", "system");
        } else if (policy.cost > 0) {
            gameState.budget -= policy.cost;
        } else if (policy.cost < 0) {
            // รัฐได้เงิน
            gameState.budget += Math.abs(policy.cost);
        }

        addChatMessage(`คุณได้ "อนุมัติ" นโยบาย: ${policy.title} (จ.${p.name})`, "ระบบแจ้งเตือน", "system");

        // บันทึกประวัติ
        p.activePolicies.push(policy.title);
        gameState.stats.policiesApproved++;

        // เช็ค Achievement: developer (อนุมัติครบ 25)
        if (gameState.stats.policiesApproved >= 25) checkAchievement('developer');
        // เช็ค Achievement: debtfree (ถ้าเคยมีหนี้แล้วใช้หมด)
        if (gameState.debt === 0 && gameState.stats.debtRepaid > 0) checkAchievement('debtfree');

        if (policy.id === 'protest_angry') {
            gameState.tyrantCounter = 0;
        }

        if (policy.feedback && policy.feedback.approve && gameState.settings.citizenChat) {
            setTimeout(() => {
                const fb = policy.feedback.approve[Math.floor(Math.random() * policy.feedback.approve.length)];
                addChatMessage(fb, `ชาวจ.${p.name}`, 'citizen-pos');
            }, 1000);
        }

        applyEffects(policy.effects.approve, p);
        flashResourceSummary(policy.effects.approve);

    } else if (choice === 'reject') {
        addChatMessage(`คุณ "ไม่อนุมัติ" นโยบาย: ${policy.title} (จ.${p.name})`, "ระบบแจ้งเตือน", "system");
        gameState.stats.policiesRejected++;

        // เช็ค Achievement: environmentalist (ปฏิเสธโครงการทำลายสิ่งแวดล้อม)
        if (policy.effects.approve && policy.effects.approve.env < -10) {
            gameState.stats.ecoRejected = (gameState.stats.ecoRejected || 0) + 1;
            if (gameState.stats.ecoRejected >= 5) checkAchievement('environmentalist');
        }

        if (policy.id === 'protest_angry') {
            gameState.tyrantCounter = (gameState.tyrantCounter || 0) + 1;
            if (gameState.tyrantCounter >= 3) checkAchievement('tyrant');
        }

        if (policy.feedback && policy.feedback.reject && gameState.settings.citizenChat) {
            setTimeout(() => {
                const fb = policy.feedback.reject[Math.floor(Math.random() * policy.feedback.reject.length)];
                const msgType = (policy.effects.reject.happiness < -10 || policy.effects.reject.approval < -10) ? 'citizen-neg' : 'citizen-neu';
                addChatMessage(fb, `ชาวจ.${p.name}`, msgType);
            }, 1000);
        }

        applyEffects(policy.effects.reject, p);
        flashResourceSummary(policy.effects.reject);
    } else if (choice === 'postpone') {
        addChatMessage(`คุณเลือก "เลื่อน" นโยบาย: ${policy.title} ไปอีก 30 วัน`, "ระบบแจ้งเตือน", "system");

        if (gameState.settings.citizenChat) {
            setTimeout(() => {
                addChatMessage("ก็เข้าใจนะว่าต้องรอดูงบประมาณก่อน... หวังว่าจะไม่ลืมพวกเรานะ", `ตัวแทนชาวจ.${p.name}`, "citizen-neu");
            }, 1000);
        }

        const futureDate = new Date(gameState.date);
        futureDate.setDate(futureDate.getDate() + 30);
        eventQueue.push({
            policy: policy,
            provIdx: currentEventProvIdx,
            triggerDate: futureDate
        });
    }

    hideEventModal();
    renderMapMarkers();
    if (selectedProvIndex !== null) selectProvince(selectedProvIndex);
    updateDashboard();
}

function applyEffects(eff, prov) {
    gameState.approval = clamp(gameState.approval + eff.approval, 0, 100);
    prov.happiness = clamp(prov.happiness + eff.happiness, 0, 100);
    prov.infrastructure = clamp(prov.infrastructure + eff.infra, 0, 100);
    prov.environment = clamp(prov.environment + eff.env, 0, 100);
    if (gameState.approval > gameState.stats.maxApproval) {
        gameState.stats.maxApproval = gameState.approval;
    }
}

// ============================================================
//  ระบบสุ่มเรียกเหตุการณ์
// ============================================================
let daysSinceLastEvent = 0;

function triggerRandomEvent() {
    if (document.getElementById('event-modal-overlay').style.display === 'flex') return;

    // ประมวลผลคิวที่ถูกเลื่อน — เอาออกทีเดียวทุกคิวที่ถึงเวลา
    const ready = [];
    for (let i = eventQueue.length - 1; i >= 0; i--) {
        if (gameState.date >= eventQueue[i].triggerDate) {
            ready.unshift(eventQueue.splice(i, 1)[0]);
        }
    }
    // โชว์คิวแรกสุด ที่เหลือเก็บไว้
    if (ready.length > 0) {
        showEventModal(ready[0].policy, ready[0].provIdx);
        for (let i = 1; i < ready.length; i++) eventQueue.push(ready[i]);
        return;
    }

    const diff = getDifficulty();
    if (daysSinceLastEvent > diff.eventInterval && Math.random() < diff.eventChance) {
        daysSinceLastEvent = 0;
        let randomPolicy;

        // เช็คม็อบประท้วง
        if (gameState.approval < diff.protestThreshold && Math.random() < diff.protestChance) {
            randomPolicy = policyDatabase.find(p => p.id === 'protest_angry');
        } else if (gameState.opposition > 60 && Math.random() < 0.25) {
            // ฝ่ายค้านโจมตี
            randomPolicy = policyDatabase.find(p => p.id === 'opposition_attack');
            if (!randomPolicy) {
                const normal = policyDatabase.filter(p => !p.isCrisis);
                randomPolicy = normal[Math.floor(Math.random() * normal.length)];
            }
        } else {
            const normal = policyDatabase.filter(p => !p.isCrisis && p.id !== 'opposition_attack');
            randomPolicy = normal[Math.floor(Math.random() * normal.length)];
        }

        // สุ่มจังหวัด (หลีกเลี่ยงจังหวัดที่กำลังมีอีเวนต์)
        const randomProvIdx = Math.floor(Math.random() * provinces.length);
        showEventModal(randomPolicy, randomProvIdx);
    }
}

// ============================================================
//  Game Loop
// ============================================================
let lastTick = 0;
function gameLoop(timestamp) {
    if (!lastTick) lastTick = timestamp;

    const interval = 1000 / gameState.speed;

    if (gameState.hasStarted && !gameState.isPaused && timestamp - lastTick > interval) {
        lastTick = timestamp;

        // 1. เพิ่มวัน
        gameState.date.setDate(gameState.date.getDate() + 1);
        daysSinceLastEvent++;

        const diff = getDifficulty();

        // 2. รายได้รายวัน — ขึ้นกับโครงสร้างพื้นฐานเฉลี่ย
        const totalInf = provinces.reduce((sum, p) => sum + p.infrastructure, 0);
        const avgInf = totalInf / provinces.length;
        const income = (diff.baseIncome + (avgInf / 100) * 10) * diff.incomeMult;
        gameState.budget += income;

        // 3. บัฟรัฐมนตรี (แยกชัดเจน)
        if (gameState.ministers.finance) {
            gameState.budget += 15 * diff.incomeMult;   // +รายได้
            gameState.budget -= 10;                      // เงินเดือน
        }
        if (gameState.ministers.interior) {
            gameState.budget -= 15;                      // เงินเดือน
            provinces.forEach(p => {
                if (Math.random() < 0.15) {
                    p.happiness = Math.min(100, p.happiness + 0.15);
                    p.infrastructure = Math.min(100, p.infrastructure + 0.1);
                }
            });
        }
        if (gameState.ministers.defense) {
            gameState.budget -= 20;                      // เงินเดือน
            gameState.stability = Math.min(100, gameState.stability + 0.25);
            gameState.opposition = Math.max(0, gameState.opposition - 0.05);
        }

        // 4. ดอกเบี้ยหนี้สาธารณะ
        if (gameState.debt > 0) {
            gameState.debt += gameState.debt * diff.debtInterest;
        }

        // 5. ฝ่ายค้าน — คะแนนนิยมต่ำ = ฝ่ายค้านแรงขึ้น
        if (gameState.approval < 40) {
            gameState.opposition = clamp(gameState.opposition + (40 - gameState.approval) * 0.005, 0, 100);
        } else if (gameState.approval > 60) {
            gameState.opposition = clamp(gameState.opposition - 0.1, 0, 100);
        }

        // 6. ความสุขเฉลี่ย และประชากร
        const totalHap = provinces.reduce((sum, p) => sum + p.happiness, 0);
        const avgHap = totalHap / provinces.length;

        if (avgHap > 60) {
            gameState.population += Math.floor(Math.random() * 5000);
        } else if (avgHap < 40) {
            gameState.population -= Math.floor(Math.random() * 3000);
        }

        // 7. เปลี่ยนเดือน — การเสื่อมสภาพเล็กน้อย + นับเดือน
        const currentMonth = gameState.date.getMonth();
        if (currentMonth !== gameState.lastMonth) {
            gameState.lastMonth = currentMonth;
            gameState.stats.monthsSurvived++;
            // ค่อยๆ เสื่อมสภาพ (สมจริง แต่น้อย)
            provinces.forEach(p => {
                p.happiness = clamp(p.happiness - diff.decayRate, 0, 100);
                p.infrastructure = clamp(p.infrastructure - diff.decayRate * 0.5, 0, 100);
                p.environment = clamp(p.environment - diff.decayRate * 0.3, 0, 100);
            });
        }

        // 8. หนังสือพิมพ์สิ้นปี
        if (gameState.date.getMonth() === 11 && gameState.date.getDate() === 31) {
            gameState.stats.yearsCompleted++;
            const headline = getYearEndHeadline(avgHap);
            showNews(gameState.date.getFullYear(), headline.headline, headline.body);
        }

        // 9. เช็ค Achievements
        if (gameState.approval >= 90) checkAchievement('beloved');
        if (gameState.debt >= 1500) checkAchievement('debtor');
        if (gameState.stats.monthsSurvived >= 12) checkAchievement('survivor');

        // 10. เสถียรภาพค่อยๆ ปรับเข้าค่าเฉลี่ย (คะแนนนิยม + ความสุข)/2 และลดตามฝ่ายค้าน
        let targetStability = (gameState.approval + avgHap) / 2 - (gameState.opposition * 0.2);
        if (gameState.stability < targetStability) gameState.stability += 0.15;
        if (gameState.stability > targetStability) gameState.stability -= 0.15;

        // 11. สุ่มเหตุการณ์
        triggerRandomEvent();

        // 12. บันทึกอัตโนมัติทุก 7 วัน
        if (gameState.date.getDate() % 7 === 0) {
            saveGame('auto');
        }

        updateDashboard();

        // 13. เช็ค Game Over
        if (gameState.stability <= 0) {
            showGameOver("🪖 รัฐประหาร!", "กองทัพทนความไร้เสถียรภาพไม่ไหวและได้เข้ายึดอำนาจ รัฐบาลของคุณสิ้นสุดลงแล้ว");
            gameState.hasStarted = false;
            return;
        }
        if (gameState.debt >= 2000) {
            showGameOver("💸 ประเทศถูกยึดทรัพย์!", "หนี้สาธารณะทะลุ 2,000 ล้านบาท IMF เข้าควบคุมกิจการประเทศ รัฐบาลต้องลาออกทันที");
            gameState.hasStarted = false;
            return;
        }

        // 14. เช็คการเลือกตั้ง
        if (gameState.date.getFullYear() >= gameState.electionYear && gameState.date.getMonth() === 0 && gameState.date.getDate() === 1) {
            if (gameState.approval > 50) {
                checkAchievement('reelection');
                showGameOver("✅ ชนะการเลือกตั้ง!", `ประชาชนไว้วางใจให้คุณเป็นนายกฯ ต่อไปในอีก 4 ปีข้างหน้า! (ยินดีด้วย คุณจบเกมรอบนี้แล้ว)`);
            } else {
                showGameOver("❌ พ่ายแพ้การเลือกตั้ง", `ประชาชนหมดความเชื่อมั่น คุณสอบตกในการเลือกตั้งและต้องลงจากตำแหน่ง`);
            }
            gameState.hasStarted = false;
            return;
        }
    }

    requestAnimationFrame(gameLoop);
}

function getYearEndHeadline(avgHap) {
    if (avgHap > 70 && gameState.approval > 70) {
        return {
            headline: "ยุคทองของชาติ! ประชาชนยกนิ้วให้รัฐบาล",
            body: "ปีนี้ถือเป็นปีที่ยอดเยี่ยมที่สุด ความสุขของประชาชนพุ่งสูงสุดเป็นประวัติการณ์ ทั่วประเทศเต็มไปด้วยรอยยิ้มและการเติบโตทางเศรษฐกิจ!"
        };
    } else if (gameState.debt > 1000) {
        return {
            headline: "วิกฤตหนี้ล้นพ้นตัว! รัฐบาลจ่อล้มละลาย",
            body: "หนี้สาธารณะทะยานทะลุเพดาน ประชาชนต่างหวาดผวาว่าประเทศจะต้องตกเป็นเมืองขึ้นทางเศรษฐกิจ หากไม่รีบแก้ไข ปีหน้าอาจต้องจบลงด้วยการล้มละลาย!"
        };
    } else if (gameState.stability < 30) {
        return {
            headline: "การเมืองระอุ! กองทัพจับตาดูอย่างใกล้ชิด",
            body: "การประท้วงที่ลุกลามและความวุ่นวายรายวันทำให้ความเชื่อมั่นในรัฐบาลตกต่ำถึงขีดสุด มีข่าวลือหนาหูว่าทหารอาจออกมาจัดระเบียบในเร็วๆ นี้"
        };
    } else if (gameState.opposition > 70) {
        return {
            headline: "ฝ่ายค้านคุกคามรัฐบาล! เสียงโวยวายในสภา",
            body: "ฝ่ายค้านที่แข็งแกร่งขึ้นเรื่อยๆ ออกมาโจมตีนโยบายรัฐบาลอย่างหนัก การอภิปรายไม่ไว้วางใจใกล้เข้ามาแล้ว"
        };
    } else {
        return {
            headline: "ผ่านพ้นไปอีกปี กับความทรงจำที่หลากหลาย",
            body: "รัฐบาลยังคงประคองตัวรอดมาได้ในปีนี้ แม้จะมีอุปสรรคมากมาย แต่ก็ยังไม่มีวิกฤตใหญ่ใดๆ มาล้มล้างได้ ต้องรอดูผลงานในปีหน้าต่อไป"
        };
    }
}

// เริ่มเกมลูป
requestAnimationFrame(gameLoop);
