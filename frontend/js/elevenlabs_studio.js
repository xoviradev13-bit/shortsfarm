// =========================================================================
// ELEVENLABS AI VOICE STUDIO & CHANNEL BINDING
// =========================================================================

let studioElevenVoices = [];
let studioCurrentPlayingAudio = null;

async function loadElevenLabsStudio() {
    await Promise.all([
        loadElevenLabsSubscription(),
        loadElevenLabsKeyStatus(),
        loadElevenLabsVoicesGallery(),
        loadChannelsVoiceBinding()
    ]);
}

// 1. Quản lý Quota & Key
async function loadElevenLabsSubscription() {
    try {
        const res = await fetch('/api/v2/voice/elevenlabs/subscription');
        if (!res.ok) return;
        const data = await res.json();

        const badgeTier = document.getElementById('elStudioTierBadge');
        const progressBar = document.getElementById('elStudioQuotaBar');
        const textQuota = document.getElementById('elStudioQuotaText');

        if (data.configured) {
            if (badgeTier) {
                badgeTier.className = 'badge';
                badgeTier.style.background = 'rgba(192, 132, 252, 0.2)';
                badgeTier.style.color = '#c084fc';
                badgeTier.style.border = '1px solid rgba(192, 132, 252, 0.4)';
                badgeTier.innerText = `Gói: ${data.tier || 'Creator'} (${data.status || 'Active'})`;
            }
            if (progressBar && data.character_limit) {
                const pct = Math.min(100, Math.round((data.character_count / data.character_limit) * 100));
                progressBar.style.width = pct + '%';
                progressBar.style.background = pct > 85 ? '#ef4444' : (pct > 60 ? '#f59e0b' : '#c084fc');
            }
            if (textQuota && data.character_limit) {
                textQuota.innerHTML = `Đã dùng <b>${(data.character_count || 0).toLocaleString()}</b> / ${(data.character_limit || 0).toLocaleString()} ký tự (Còn lại: <span style="color:#22c55e; font-weight:700;">${(data.characters_remaining || 0).toLocaleString()}</span>)`;
            }
        } else {
            if (badgeTier) {
                badgeTier.className = 'badge';
                badgeTier.style.background = 'rgba(239, 68, 68, 0.15)';
                badgeTier.style.color = '#ef4444';
                badgeTier.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                badgeTier.innerText = 'Chưa cấu hình API Key';
            }
            if (textQuota) {
                textQuota.innerHTML = '<span style="color:var(--text-muted);">Vui lòng nhập ElevenLabs API Key để kích hoạt phòng thu</span>';
            }
        }
    } catch (e) {
        console.error('Lỗi lấy subscription ElevenLabs:', e);
    }
}

async function loadElevenLabsKeyStatus() {
    try {
        const res = await fetch('/api/v2/voice/elevenlabs/key');
        if (!res.ok) return;
        const data = await res.json();
        const inputKey = document.getElementById('elStudioApiKeyInput');
        if (inputKey && data.configured) {
            inputKey.placeholder = `Đã lưu key: ${data.masked_key}`;
        }
    } catch (e) {}
}

async function saveElevenLabsKeyStudio() {
    const inputKey = document.getElementById('elStudioApiKeyInput');
    const key = inputKey ? inputKey.value.trim() : '';
    if (!key) {
        alert('Vui lòng nhập API Key từ tài khoản ElevenLabs của bạn (https://elevenlabs.io)!');
        return;
    }

    try {
        const res = await fetch('/api/v2/voice/elevenlabs/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });
        const data = await res.json();
        alert(data.message || 'Lưu key thành công!');
        if (inputKey) inputKey.value = '';
        loadElevenLabsStudio();
    } catch (e) {
        alert('Lỗi lưu key: ' + e.message);
    }
}

// 2. Thư viện Giọng Đọc (Voice Gallery Cards)
async function loadElevenLabsVoicesGallery(filterType = 'all') {
    const grid = document.getElementById('elVoiceGalleryGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/v2/voice/elevenlabs/voices');
        if (!res.ok) return;
        const data = await res.json();
        studioElevenVoices = data.voices || [];

        // Đồng bộ vào select box của Studio
        const selVoice = document.getElementById('elStudioVoiceSelect');
        if (selVoice && studioElevenVoices.length > 0) {
            selVoice.innerHTML = studioElevenVoices.map(v => 
                `<option value="${v.voice_id}">${v.name} (${v.labels?.gender === 'female' ? 'Nữ' : 'Nam'} - ${v.description || v.category})</option>`
            ).join('');
        }

        renderVoiceGalleryCards(filterType);
    } catch (e) {
        console.error('Lỗi tải danh sách giọng ElevenLabs:', e);
    }
}

function renderVoiceGalleryCards(filter = 'all') {
    const grid = document.getElementById('elVoiceGalleryGrid');
    if (!grid) return;

    let filtered = studioElevenVoices;
    if (filter === 'male') {
        filtered = studioElevenVoices.filter(v => v.labels?.gender === 'male');
    } else if (filter === 'female') {
        filtered = studioElevenVoices.filter(v => v.labels?.gender === 'female');
    } else if (filter === 'cloned') {
        filtered = studioElevenVoices.filter(v => v.category === 'cloned' || v.category === 'custom');
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted);">Không tìm thấy giọng đọc nào trong danh mục này.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(v => {
        const isFemale = v.labels?.gender === 'female';
        const genderColor = isFemale ? '#ec4899' : '#38bdf8';
        const genderIcon = isFemale ? 'fa-venus' : 'fa-mars';
        const genderText = isFemale ? 'Nữ' : 'Nam';

        return `
            <div class="glass-panel" style="padding: 16px; border-radius: 10px; transition: transform 0.2s, border-color 0.2s; position: relative;" onmouseover="this.style.borderColor='rgba(192, 132, 252, 0.6)'" onmouseout="this.style.borderColor='var(--border-color)'">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${genderColor}20; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${genderColor}; font-size: 13px;">
                            ${v.name ? v.name.slice(0, 2).toUpperCase() : 'EL'}
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${v.name}</div>
                            <span style="font-size: 11px; color: ${genderColor};"><i class="fa-solid ${genderIcon}"></i> ${genderText} ${v.labels?.accent ? '• ' + v.labels.accent : ''}</span>
                        </div>
                    </div>
                    <span class="badge" style="font-size: 9.5px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border-color);">
                        ${v.category || 'premade'}
                    </span>
                </div>

                <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.45; margin-bottom: 12px; height: 36px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${v.description || 'Giọng đọc siêu thực chuẩn Studio của ElevenLabs'}
                </p>

                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" type="button" onclick="playVoiceDemoSample('${v.voice_id}', '${v.preview_url || ''}')"
                            style="flex: 1; height: 30px; font-size: 11.5px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                        <i class="fa-solid fa-play" id="iconPlayDemo_${v.voice_id}" style="color: #c084fc;"></i> Nghe Thử
                    </button>
                    <button class="btn btn-secondary btn-sm" type="button" onclick="selectVoiceForStudio('${v.voice_id}')"
                            style="flex: 1; height: 30px; font-size: 11.5px; padding: 0 8px; font-weight: 600; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
                        <i class="fa-solid fa-check"></i> Chọn Giọng
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filterVoiceGallery(type, btn) {
    document.querySelectorAll('.el-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '';
        b.style.color = '';
        b.style.borderColor = '';
    });
    if (btn) {
        btn.classList.add('active');
    }
    renderVoiceGalleryCards(type);
}

function playVoiceDemoSample(voiceId, previewUrl) {
    if (studioCurrentPlayingAudio) {
        studioCurrentPlayingAudio.pause();
        document.querySelectorAll('[id^="iconPlayDemo_"]').forEach(i => i.className = 'fa-solid fa-play');
    }

    if (!previewUrl || previewUrl === 'undefined') {
        alert('Giọng này không có mẫu thu sẵn. Bạn hãy bấm "Tạo Giọng Đọc Thử Nghiệm" ở khung bên trái để nghe!');
        return;
    }

    const audio = new Audio(previewUrl);
    studioCurrentPlayingAudio = audio;
    const icon = document.getElementById('iconPlayDemo_' + voiceId);
    if (icon) icon.className = 'fa-solid fa-pause';

    audio.play();
    audio.onended = () => {
        if (icon) icon.className = 'fa-solid fa-play';
    };
}

function selectVoiceForStudio(voiceId) {
    const selVoice = document.getElementById('elStudioVoiceSelect');
    if (selVoice) selVoice.value = voiceId;

    const selBindVoice = document.getElementById('elBindVoiceSelect');
    if (selBindVoice) selBindVoice.value = voiceId;

    // Scroll nhẹ lên khu vực studio
    const studioBox = document.getElementById('elStudioLabBox');
    if (studioBox) {
        studioBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        studioBox.style.borderColor = '#c084fc';
        setTimeout(() => studioBox.style.borderColor = 'var(--border-color)', 1500);
    }
}

// 3. Studio Tạo Giọng Đọc (Text-to-Speech Lab)
async function generateElevenStudioAudio() {
    const textInput = document.getElementById('elStudioTextInput');
    const selVoice = document.getElementById('elStudioVoiceSelect');
    const selModel = document.getElementById('elStudioModelSelect');
    const sliderStability = document.getElementById('elStudioStability');
    const sliderSimilarity = document.getElementById('elStudioSimilarity');

    const text = textInput ? textInput.value.trim() : '';
    if (!text) {
        alert('Vui lòng nhập đoạn văn bản bạn muốn tạo giọng đọc!');
        return;
    }

    const voiceId = selVoice ? selVoice.value : 'pNInz6obpgDQGcFmaJgB';
    const modelId = selModel ? selModel.value : 'eleven_multilingual_v2';
    const stability = sliderStability ? parseFloat(sliderStability.value) : 0.5;
    const similarity = sliderSimilarity ? parseFloat(sliderSimilarity.value) : 0.75;

    const btn = document.getElementById('btnElStudioGenerate');
    const alertBox = document.getElementById('elStudioAudioPlayerBox');
    const player = document.getElementById('elStudioAudioElement');
    const downloadLink = document.getElementById('elStudioDownloadLink');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Đang kết nối ElevenLabs tạo âm thanh...';
    }

    try {
        const res = await fetch('/api/v2/voice/elevenlabs/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                voice_id: voiceId,
                model_id: modelId,
                stability,
                similarity_boost: similarity
            })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            const fileName = data.file_path.split(/[\\\\/]/).pop();
            const mediaUrl = `/media/downloads/${fileName}`;

            if (alertBox) alertBox.style.display = 'block';
            if (player) {
                player.src = mediaUrl;
                player.play().catch(() => {});
            }
            if (downloadLink) {
                downloadLink.href = mediaUrl;
                downloadLink.download = fileName;
            }
            loadElevenLabsSubscription(); // Cập nhật lại số ký tự đã dùng
        } else {
            alert('Lỗi tạo giọng đọc: ' + (data.detail || data.message || 'Không thể tạo âm thanh'));
        }
    } catch (e) {
        alert('Lỗi gọi API ElevenLabs: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Tạo Giọng Đọc AI Ngay';
        }
    }
}

// 4. Kết Nối & Gán Vào Kênh / Chiến Dịch
async function loadChannelsVoiceBinding() {
    try {
        const res = await fetch('/api/channels');
        if (!res.ok) return;
        const channels = await res.json();

        const selCh = document.getElementById('elBindChannelSelect');
        const tbody = document.getElementById('elChannelBindingsTableBody');

        if (selCh && Array.isArray(channels)) {
            selCh.innerHTML = channels.map(c => 
                `<option value="${c.channel_id}">${c.title || c.channel_id} (Hiện tại: ${c.tts_engine || 'edge-tts'})</option>`
            ).join('');
        }

        if (tbody && Array.isArray(channels)) {
            if (channels.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">Chưa có kênh nào. Hãy thêm kênh trong tab Kênh Nguồn!</td></tr>`;
                return;
            }

            tbody.innerHTML = channels.map(c => {
                const isEleven = c.tts_engine === 'elevenlabs';
                const engineBadge = isEleven
                    ? '<span class="badge" style="background: rgba(192, 132, 252, 0.2); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.4); font-size: 11px;">ElevenLabs AI</span>'
                    : '<span class="badge" style="background: rgba(255, 255, 255, 0.08); color: var(--text-muted); font-size: 11px;">Edge-TTS (Free)</span>';

                const matchedVoice = studioElevenVoices.find(v => v.voice_id === c.elevenlabs_voice_id);
                const voiceName = isEleven 
                    ? (matchedVoice ? matchedVoice.name : (c.elevenlabs_voice_id ? c.elevenlabs_voice_id.slice(0, 10) + '...' : 'Adam'))
                    : (c.narration_language || 'Mặc định');

                return `
                    <tr>
                        <td style="font-weight: 600; color: white;">
                            <div style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.title || c.channel_id}</div>
                            <span style="font-size: 10.5px; color: var(--text-muted);">${c.channel_id}</span>
                        </td>
                        <td>${engineBadge}</td>
                        <td style="font-size: 12px; color: ${isEleven ? '#c084fc' : 'var(--text-primary)'}; font-weight: 600;">
                            ${voiceName}
                        </td>
                        <td style="text-align: right;">
                            <button class="btn btn-secondary btn-sm" type="button" onclick="quickAssignVoiceToChannel('${c.channel_id}')"
                                    style="height: 28px; font-size: 11px; padding: 0 10px; color: #38bdf8;">
                                <i class="fa-solid fa-link"></i> Đổi Giọng
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (e) {
        console.error('Lỗi tải danh sách kênh cho ElevenLabs:', e);
    }
}

async function bindVoiceToChannelAction() {
    const selCh = document.getElementById('elBindChannelSelect');
    const selVoice = document.getElementById('elBindVoiceSelect');
    const selEngine = document.getElementById('elBindEngineSelect');

    const channelId = selCh ? selCh.value : '';
    const voiceId = selVoice ? selVoice.value : 'pNInz6obpgDQGcFmaJgB';
    const engine = selEngine ? selEngine.value : 'elevenlabs';

    if (!channelId) {
        alert('Vui lòng chọn Kênh cần gán giọng đọc!');
        return;
    }

    try {
        const res = await fetch('/api/v2/channels/voice_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel_id: channelId,
                tts_engine: engine,
                elevenlabs_voice_id: voiceId,
                elevenlabs_model: 'eleven_multilingual_v2'
            })
        });
        const data = await res.json();
        alert(data.message || 'Đã cập nhật giọng đọc thành công cho kênh!');
        loadChannelsVoiceBinding();
    } catch (e) {
        alert('Lỗi gán giọng đọc: ' + e.message);
    }
}

function quickAssignVoiceToChannel(channelId) {
    const selCh = document.getElementById('elBindChannelSelect');
    if (selCh) selCh.value = channelId;

    const bindBox = document.getElementById('elBindCardBox');
    if (bindBox) {
        bindBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bindBox.style.borderColor = '#38bdf8';
        setTimeout(() => bindBox.style.borderColor = 'var(--border-color)', 1500);
    }
}

