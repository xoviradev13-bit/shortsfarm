// =========================================================================
// VIDEO MANAGER & MULTI-DOWNLOADER & ELEVENLABS VOICE LOGIC
// =========================================================================

let scannedVideoFiles = [];
let allElevenVoices = [];

// 1. Quản lý Chế độ Quét RSS
async function loadRssScanMode() {
    try {
        const res = await fetch('/api/v2/pipeline/rss_status');
        if (!res.ok) return;
        const data = await res.json();
        const sw = document.getElementById('toggleRssScanSwitch');
        const lbl = document.getElementById('lblRssStatus');
        if (sw && data.rss_scan_enabled !== undefined) {
            sw.checked = data.rss_scan_enabled;
            if (lbl) {
                lbl.innerText = data.rss_scan_enabled ? 'RSS: BẬT' : 'RSS: ĐÃ TẮT';
                lbl.style.color = data.rss_scan_enabled ? '#38bdf8' : '#f87171';
            }
        }
    } catch (e) {
        console.error('Lỗi lấy trạng thái RSS:', e);
    }
}

async function toggleRssScanMode(enabled) {
    try {
        const res = await fetch('/api/v2/pipeline/toggle_rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        const data = await res.json();
        const lbl = document.getElementById('lblRssStatus');
        if (lbl) {
            lbl.innerText = enabled ? 'RSS: BẬT' : 'RSS: ĐÃ TẮT';
            lbl.style.color = enabled ? '#38bdf8' : '#f87171';
        }
        if (typeof showToast === 'function') {
            showToast(data.message, enabled ? 'success' : 'warning');
        }
    } catch (e) {
        alert('Lỗi chuyển chế độ RSS: ' + e.message);
    }
}

// 2. Nạp Thư Mục Video Cục Bộ
async function scanSelectedFolder() {
    const folderInput = document.getElementById('inputLocalFolderPath');
    const folderPath = folderInput ? folderInput.value.trim() : '';
    if (!folderPath) {
        alert('Vui lòng nhập đường dẫn thư mục trên máy tính (ví dụ: D:/Videos hoặc data/downloads)!');
        return;
    }

    const resBox = document.getElementById('scanFolderResultBox');
    const btnIngest = document.getElementById('btnIngestVideos');
    if (resBox) {
        resBox.style.display = 'block';
        resBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Đang quét các file video...';
    }

    try {
        const res = await fetch('/api/v2/pipeline/scan_folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: folderPath })
        });
        const data = await res.json();
        scannedVideoFiles = (data.files || []).map(f => f.file_path);

        if (scannedVideoFiles.length === 0) {
            resBox.innerHTML = '<span class="text-warning"><i class="fa-solid fa-circle-exclamation me-1"></i> Không tìm thấy file video nào (.mp4, .mov, .mkv, .avi) trong thư mục này!</span>';
            if (btnIngest) btnIngest.disabled = true;
        } else {
            resBox.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Tìm thấy <b>${scannedVideoFiles.length} video</b> hợp lệ:</span><br>` +
                data.files.slice(0, 5).map(f => `• ${f.file_name} (${f.size_mb} MB)`).join('<br>') +
                (data.files.length > 5 ? `<br><i>... và ${data.files.length - 5} file khác</i>` : '');
            if (btnIngest) btnIngest.disabled = false;
        }
    } catch (e) {
        if (resBox) resBox.innerHTML = '<span class="text-danger">Lỗi quét thư mục: ' + e.message + '</span>';
    }
}

async function ingestScannedVideos() {
    if (scannedVideoFiles.length === 0) return;
    const btnIngest = document.getElementById('btnIngestVideos');
    if (btnIngest) {
        btnIngest.disabled = true;
        btnIngest.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Đang nạp video...';
    }

    try {
        const res = await fetch('/api/v2/pipeline/ingest_videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file_paths: scannedVideoFiles,
                channel_id: 'LOCAL_IMPORT',
                auto_render: true
            })
        });
        const data = await res.json();
        alert(data.message || `Đã nạp ${data.added_count} video vào hàng đợi!`);
        scannedVideoFiles = [];
        const resBox = document.getElementById('scanFolderResultBox');
        if (resBox) resBox.style.display = 'none';
        if (btnIngest) {
            btnIngest.disabled = true;
            btnIngest.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Nạp Toàn Bộ Vào Hàng Đợi Render AI';
        }
        loadVideoLibraryTable();
    } catch (e) {
        alert('Lỗi nạp video: ' + e.message);
        if (btnIngest) btnIngest.disabled = false;
    }
}

// 3. Tải Video 7 Nền Tảng (Clean Watermark)
async function triggerMultiDownload() {
    const inputUrl = document.getElementById('inputMultiDownloadUrl');
    const url = inputUrl ? inputUrl.value.trim() : '';
    if (!url) {
        alert('Vui lòng dán link video từ Douyin, Xiaohongshu, YouTube, Facebook, Instagram, Weibo hoặc Bilibili!');
        return;
    }

    const btn = document.getElementById('btnTriggerMultiDownload');
    const alertBox = document.getElementById('multiDownloadStatusAlert');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    }
    if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Đang phân tích link và bóc tách luồng video không logo...';
    }

    try {
        const res = await fetch('/api/v2/downloader/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            alertBox.innerHTML = `<span class="text-success fw-bold"><i class="fa-solid fa-circle-check me-1"></i> Tải thành công [${(data.platform || 'VIDEO').toUpperCase()}]:</span><br><b>${data.title || 'Video'}</b><br><span class="text-muted text-[11px]">${data.file_path}</span>`;
            if (inputUrl) inputUrl.value = '';
            loadVideoLibraryTable();
        } else {
            alertBox.innerHTML = `<span class="text-danger"><i class="fa-solid fa-triangle-exclamation me-1"></i> Tải thất bại: ${data.detail || data.message || 'Lỗi không xác định'}</span>`;
        }
    } catch (e) {
        if (alertBox) alertBox.innerHTML = `<span class="text-danger">Lỗi: ${e.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Tải Ngay';
        }
    }
}

// 4. ElevenLabs Voice Management
async function loadElevenLabsInfo() {
    try {
        // Kiểm tra Key
        const resKey = await fetch('/api/v2/voice/elevenlabs/key');
        if (resKey.ok) {
            const dataKey = await resKey.json();
            const badge = document.getElementById('badgeElevenStatus');
            const inputKey = document.getElementById('inputElevenApiKey');
            if (badge) {
                if (dataKey.configured) {
                    badge.className = 'badge bg-success/20 text-success border border-success/30';
                    badge.innerText = `● Đã kích hoạt (${dataKey.masked_key})`;
                } else {
                    badge.className = 'badge bg-slate-800 text-slate-400 border border-slate-700';
                    badge.innerText = 'Chưa cấu hình API Key';
                }
            }
        }

        // Tải danh sách giọng đọc
        const resVoices = await fetch('/api/v2/voice/elevenlabs/voices');
        if (resVoices.ok) {
            const dataVoices = await resVoices.json();
            allElevenVoices = dataVoices.voices || [];
            const sel = document.getElementById('selectElevenVoiceList');
            if (sel && allElevenVoices.length > 0) {
                sel.innerHTML = allElevenVoices.map(v => 
                    `<option value="${v.voice_id}">${v.name} (${v.description || v.category})</option>`
                ).join('');
            }
        }

        // Tải danh sách Kênh để gán giọng
        const resChannels = await fetch('/api/channels');
        if (resChannels.ok) {
            const channels = await resChannels.json();
            const selCh = document.getElementById('selectChannelForVoice');
            if (selCh && Array.isArray(channels)) {
                if (channels.length === 0) {
                    selCh.innerHTML = '<option value="">Chưa có kênh nào. Hãy thêm kênh trong tab Kênh Nguồn</option>';
                } else {
                    selCh.innerHTML = channels.map(c => 
                        `<option value="${c.channel_id}">${c.title || c.channel_id} (Giọng: ${c.tts_engine || 'edge-tts'})</option>`
                    ).join('');
                }
            }
        }
    } catch (e) {
        console.error('Lỗi tải thông tin ElevenLabs:', e);
    }
}

async function saveElevenApiKey() {
    const input = document.getElementById('inputElevenApiKey');
    const key = input ? input.value.trim() : '';
    if (!key) {
        alert('Vui lòng nhập ElevenLabs API Key!');
        return;
    }

    try {
        const res = await fetch('/api/v2/voice/elevenlabs/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: key })
        });
        const data = await res.json();
        alert(data.message || 'Lưu thành công!');
        if (input) input.value = '';
        loadElevenLabsInfo();
    } catch (e) {
        alert('Lỗi lưu key: ' + e.message);
    }
}

function previewElevenVoiceAudio() {
    const sel = document.getElementById('selectElevenVoiceList');
    const voiceId = sel ? sel.value : '';
    const voiceObj = allElevenVoices.find(v => v.voice_id === voiceId);

    const player = document.getElementById('audioVoicePreviewPlayer');
    if (player && voiceObj && voiceObj.preview_url) {
        player.src = voiceObj.preview_url;
        player.style.display = 'inline-block';
        player.play();
    } else {
        alert('Giọng đọc này không có link nghe thử trực tiếp. Hãy bấm "Đọc Thử" bên phải để sinh âm thanh!');
    }
}

async function bindVoiceToSelectedChannel() {
    const selCh = document.getElementById('selectChannelForVoice');
    const selVoice = document.getElementById('selectElevenVoiceList');
    const channelId = selCh ? selCh.value : '';
    const voiceId = selVoice ? selVoice.value : '';

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
                tts_engine: 'elevenlabs',
                elevenlabs_voice_id: voiceId,
                elevenlabs_model: 'eleven_multilingual_v2'
            })
        });
        const data = await res.json();
        alert(data.message || 'Đã gán giọng ElevenLabs cho kênh thành công!');
        loadElevenLabsInfo();
    } catch (e) {
        alert('Lỗi gán giọng đọc: ' + e.message);
    }
}

async function generateTestTtsSpeech() {
    const input = document.getElementById('inputTestTtsSentence');
    const selVoice = document.getElementById('selectElevenVoiceList');
    const text = input ? input.value.trim() : '';
    const voiceId = selVoice ? selVoice.value : 'pNInz6obpgDQGcFmaJgB';

    if (!text) return;
    const alertBox = document.getElementById('testTtsResultAlert');
    if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang gọi ElevenLabs sinh giọng đọc...';
    }

    try {
        const res = await fetch('/api/v2/voice/elevenlabs/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice_id: voiceId })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            alertBox.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check me-1"></i> Đã tạo xong audio: ${data.file_path}</span>`;
            const player = document.getElementById('audioVoicePreviewPlayer');
            if (player) {
                player.src = `/media/downloads/${data.file_path.split(/[\\\\/]/).pop()}`;
                player.style.display = 'inline-block';
                player.play().catch(() => {});
            }
        } else {
            alertBox.innerHTML = `<span class="text-danger">Lỗi: ${data.detail || data.message}</span>`;
        }
    } catch (e) {
        if (alertBox) alertBox.innerHTML = `<span class="text-danger">Lỗi: ${e.message}</span>`;
    }
}

// 5. Quản Lý Danh Sách Video (Video Library Table)
async function loadVideoLibraryTable() {
    const tbody = document.getElementById('videoLibraryTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/v2/videos/library?limit=150');
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation me-1"></i> Lỗi tải danh sách video: ${escapeHtml(errData.detail || res.statusText)}</td></tr>`;
            return;
        }
        const data = await res.json();
        const list = data.videos || [];

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-film" style="margin-right:6px;"></i> Chưa có video nào trong kho. Hãy nạp thư mục hoặc tải video từ Douyin, YouTube, Facebook ở trên!</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(v => {
            const statusBadge = v.status === 'rendered' 
                ? '<span class="badge badge-success" style="font-size:11px;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i>Đã Render AI</span>'
                : v.status === 'rendering'
                ? '<span class="badge" style="background:rgba(245, 158, 11, 0.2); color:#fbbf24; font-size:11px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i>Đang Render</span>'
                : v.status === 'uploaded'
                ? '<span class="badge" style="background:rgba(56, 189, 248, 0.2); color:#38bdf8; font-size:11px;"><i class="fa-solid fa-cloud-arrow-up" style="margin-right:4px;"></i>Đã Đăng</span>'
                : '<span class="badge" style="background:rgba(255, 255, 255, 0.08); color:var(--text-muted); font-size:11px;"><i class="fa-solid fa-download" style="margin-right:4px;"></i>Đã Tải Sẵn</span>';

            const existsBadge = v.file_exists 
                ? '<span style="color:#22c55e; font-size:11.5px; font-weight:600;"><i class="fa-solid fa-check"></i> Có file</span>'
                : '<span style="color:#ef4444; font-size:11.5px; font-weight:600;"><i class="fa-solid fa-xmark"></i> Mất file</span>';

            const sourceText = v.source_name || v.channel_title || v.channel_display_name || v.channel_id || 'Direct Links';
            const isDirect = (v.source_type === 'direct') || sourceText.toLowerCase().includes('direct');
            const isYt = (v.source_type === 'youtube') || (!isDirect && sourceText !== 'LOCAL');

            const sourceBadge = isDirect
                ? `<span class="badge" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.3); font-size:11px;"><i class="fa-solid fa-link" style="margin-right:4px;"></i>Direct Links</span>`
                : isYt
                ? `<span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#f87171; border:1px solid rgba(239, 68, 68, 0.3); font-size:11px;" title="${escapeHtml(sourceText)}"><i class="fa-brands fa-youtube" style="margin-right:4px;"></i>${escapeHtml(sourceText)}</span>`
                : `<span class="badge" style="background:rgba(245, 158, 11, 0.15); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.3); font-size:11px;"><i class="fa-solid fa-folder" style="margin-right:4px;"></i>${escapeHtml(sourceText)}</span>`;

            const vKey = v.yt_video_id || v.id;

            return `
                <tr>
                    <td style="color:var(--text-muted); font-family:monospace; font-size:12px;">#${v.id}</td>
                    <td>
                        <div style="font-weight:600; color:white; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(v.title || '')}">${escapeHtml(v.title || 'Video #' + v.id)}</div>
                        <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">${escapeHtml(v.yt_video_id || '')}</span>
                    </td>
                    <td>${sourceBadge}</td>
                    <td style="color:var(--text-primary); font-size:12px; font-weight:500;">${v.size_mb ? v.size_mb + ' MB' : (v.duration ? v.duration + 's' : 'N/A')}</td>
                    <td>${statusBadge}</td>
                    <td>${existsBadge}</td>
                    <td data-col="col-actions" style="text-align:right;">
                        <div class="action-dropdown-wrap">
                            <button type="button" class="btn-more-actions" id="btn-more-video-${v.id}" 
                                onclick="toggleActionMenu(event, 'video-${v.id}')" 
                                title="Tùy chọn thao tác">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                            <div class="action-dropdown-menu" id="action-menu-video-${v.id}">
                                <button type="button" class="action-dropdown-item" onclick="switchTab('tab-video-studio'); selectStudioVideo('${vKey}'); closeAllActionMenus();">
                                    <i class="fa-solid fa-wand-magic-sparkles text-cyan"></i> Mở Biên Tập 9:16
                                </button>
                                <button type="button" class="action-dropdown-item" onclick="copyVideoFilePath('${escapeHtml(v.download_path || '')}'); closeAllActionMenus();">
                                    <i class="fa-solid fa-copy text-gold"></i> Sao Chép Đường Dẫn
                                </button>
                                <button type="button" class="action-dropdown-item text-danger" onclick="deleteVideoLibraryItem(${v.id}); closeAllActionMenus();">
                                    <i class="fa-solid fa-trash-can"></i> Xóa Video
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('Lỗi tải video library:', e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;"><i class="fa-solid fa-circle-exclamation me-1"></i> Lỗi kết nối: ${e.message}</td></tr>`;
        }
    }
}

async function deleteVideoLibraryItem(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa video #' + id + ' khỏi hệ thống?')) return;
    try {
        const res = await fetch(`/api/v2/videos/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadVideoLibraryTable();
        }
    } catch (e) {
        alert('Lỗi xóa video: ' + e.message);
    }
}

// Lắng nghe sự kiện chuyển Tab để nạp dữ liệu
document.addEventListener('DOMContentLoaded', () => {
    loadRssScanMode();
    loadElevenLabsInfo();
    loadVideoLibraryTable();

    // Hook tab clicks
    document.querySelectorAll('[data-tab="tab-video-manager"]').forEach(btn => {
        btn.addEventListener('click', () => {
            loadRssScanMode();
            loadElevenLabsInfo();
            loadVideoLibraryTable();
        });
    });
});

