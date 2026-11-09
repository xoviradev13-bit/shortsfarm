// =========================================================================
// SYSTEM LOGS, FILE DEBUGGING, DIAGNOSTICS & ISSUE RESOLUTION
// =========================================================================

let currentLogsSubTab = 'file';
let fileLogSearchDebounce = null;

function switchLogsSubTab(subtab) {
    currentLogsSubTab = subtab;
    const btnFile = document.getElementById('btnTabFileLogs');
    const btnLive = document.getElementById('btnTabLiveLogs');
    const btnDiag = document.getElementById('btnTabDiagnostics');
    const viewFile = document.getElementById('subtabFileLogsView');
    const viewLive = document.getElementById('subtabLiveLogsView');
    const viewDiag = document.getElementById('subtabDiagnosticsView');
    const headerActions = document.getElementById('fileLogHeaderActions');
    const actionButtons = document.getElementById('fileLogActionButtons');

    if (btnFile) btnFile.classList.toggle('active', subtab === 'file');
    if (btnLive) btnLive.classList.toggle('active', subtab === 'live');
    if (btnDiag) btnDiag.classList.toggle('active', subtab === 'diag');

    if (viewFile) viewFile.style.display = subtab === 'file' ? 'block' : 'none';
    if (viewLive) viewLive.style.display = subtab === 'live' ? 'block' : 'none';
    if (viewDiag) viewDiag.style.display = subtab === 'diag' ? 'block' : 'none';
    if (headerActions) headerActions.style.display = subtab === 'file' ? 'inline-flex' : 'none';
    if (actionButtons) actionButtons.style.display = subtab === 'file' ? 'inline-flex' : 'none';

    if (subtab === 'file') {
        loadFileLogs();
    } else if (subtab === 'live') {
        loadDashboardStats();
    } else if (subtab === 'diag') {
        runDiagnosticsCheck(false);
    }
}

async function loadFileLogs() {
    const terminal = document.getElementById('fileLogTerminal');
    const metaInfo = document.getElementById('fileLogMetaInfo');
    const dateSelect = document.getElementById('fileLogDateSelect');
    const level = document.getElementById('fileLogLevelFilter')?.value || 'ALL';
    const limit = document.getElementById('fileLogLimitSelect')?.value || '500';
    const search = (document.getElementById('fileLogSearchInput')?.value || '').trim();
    const selectedFile = dateSelect?.value || 'today';

    if (!terminal) return;

    try {
        const url = `/api/system/logs/file?limit=${limit}&level=${level}&search=${encodeURIComponent(search)}&file=${encodeURIComponent(selectedFile)}`;
        const res = await fetch(url);
        const data = await res.json();

        // Tự động đồng bộ danh sách file log theo ngày và file tổng
        if (dateSelect && Array.isArray(data.available_files) && data.available_files.length > 0) {
            const currentVal = dateSelect.value || selectedFile;
            const newHtml = data.available_files.map(f => {
                const icon = f.is_all ? '📚' : (f.is_today ? '📅' : '🗓️');
                return `<option value="${escapeHtml(f.name)}">${icon} ${escapeHtml(f.label)} (${escapeHtml(f.size_formatted)})</option>`;
            }).join('');

            const hashKey = String(data.available_files.length) + '_' + (data.available_files[0]?.size_formatted || '');
            if (dateSelect.dataset.optionsHash !== hashKey) {
                dateSelect.innerHTML = newHtml;
                dateSelect.dataset.optionsHash = hashKey;
                if (currentVal && Array.from(dateSelect.options).some(o => o.value === currentVal)) {
                    dateSelect.value = currentVal;
                } else {
                    const todayOpt = data.available_files.find(f => f.is_today);
                    if (todayOpt) dateSelect.value = todayOpt.name;
                }
            }
        }

        if (metaInfo && data.file_info) {
            const fname = data.file_info.filename || 'app.log';
            metaInfo.textContent = `${fname} (${data.file_info.size_formatted}) • Cập nhật: ${data.file_info.modified_time || 'N/A'}`;
        }

        if (!data.logs || data.logs.length === 0) {
            terminal.innerHTML = `<div class="enhanced-log-entry" style="color:var(--text-muted); justify-content:center; padding: 30px;">
                <i class="fa-solid fa-file-circle-question"></i> Không có dòng log nào phù hợp với bộ lọc (Mức: ${escapeHtml(level)}, Tìm: "${escapeHtml(search)}")
            </div>`;
            return;
        }

        terminal.innerHTML = data.logs.map(entry => {
            const lvl = (entry.level || 'INFO').toUpperCase();
            const cls = lvl === 'ERROR' || lvl === 'CRITICAL' ? 'lvl-error' : (lvl === 'WARNING' ? 'lvl-warning' : (lvl === 'DEBUG' ? 'lvl-debug' : 'lvl-info'));
            return `
            <div class="enhanced-log-entry ${cls}">
                <span class="log-time">${escapeHtml(entry.time || '')}</span>
                <span class="log-lvl-badge">${escapeHtml(lvl)}</span>
                ${entry.source ? `<span class="log-source">[${escapeHtml(entry.source)}]</span>` : ''}
                <div class="log-msg">${escapeHtml(entry.message || entry.raw || '')}</div>
            </div>
            `;
        }).join('');

        // Auto-scroll to bottom if checked
        const chkScroll = document.getElementById('chkAutoScrollFileLog');
        if (chkScroll && chkScroll.checked) {
            terminal.scrollTop = terminal.scrollHeight;
        }
    } catch (err) {
        terminal.innerHTML = `<div class="enhanced-log-entry lvl-error">
            <span class="log-lvl-badge">ERROR</span>
            <div class="log-msg">Không thể đọc file log từ máy chủ: ${escapeHtml(err.message)}</div>
        </div>`;
    }
}

function handleFileLogSearch(e) {
    if (e.key === 'Enter') {
        loadFileLogs();
        return;
    }
    clearTimeout(fileLogSearchDebounce);
    fileLogSearchDebounce = setTimeout(() => {
        loadFileLogs();
    }, 400);
}

async function confirmClearFileLog() {
    const dateSelect = document.getElementById('fileLogDateSelect');
    const selectedFile = dateSelect?.value || 'today';
    const selectedText = dateSelect?.options[dateSelect.selectedIndex]?.text || selectedFile;

    const ok = await showConfirmDialog({
        title: 'Làm Sạch File Log',
        message: `Bạn có chắc chắn muốn làm sạch toàn bộ nội dung file log:\n"${selectedText}"?`,
        details: 'Thao tác này sẽ xóa trắng nội dung của tệp nhật ký đã chọn trên ổ đĩa.',
        confirmText: 'Làm Sạch Log',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;
    try {
        const res = await fetch('/api/system/logs/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: selectedFile })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('✅ Đã làm sạch file log thành công!');
            loadFileLogs();
        } else {
            showToast('Lỗi khi làm sạch file log', true);
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, true);
    }
}

async function downloadLogFile() {
    try {
        const dateSelect = document.getElementById('fileLogDateSelect');
        const selectedFile = dateSelect?.value || 'today';

        showToast('Đang tải dữ liệu file log hệ thống...');
        const res = await fetch(`/api/system/logs/download?file=${encodeURIComponent(selectedFile)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast('Lỗi tải file log: ' + (err.detail || 'Không tìm thấy file log trên hệ thống!'), true);
            return;
        }
        const blob = await res.blob();
        if (blob.size === 0) {
            showToast('File log hiện tại đang trống!', true);
            return;
        }

        let defaultFilename = selectedFile;
        if (!defaultFilename || defaultFilename === 'today') {
            const dateStr = new Date().toISOString().split('T')[0];
            defaultFilename = `app_${dateStr}.log`;
        } else if (!defaultFilename.endsWith('.log')) {
            defaultFilename = `${defaultFilename}.log`;
        }

        // 1. Mở cửa sổ "Save As" (chọn thư mục lưu) của Windows tương tự chức năng Xuất CSV (Excel)
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: defaultFilename,
                    types: [
                        {
                            description: 'Tệp Log Hệ Thống (*.log)',
                            accept: { 'text/plain': ['.log'] }
                        },
                        {
                            description: 'Tệp Văn Bản (*.txt)',
                            accept: { 'text/plain': ['.txt'] }
                        }
                    ]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                showToast(`✅ Đã tải file log thành công (${(blob.size / 1024).toFixed(1)} KB)!`);
                return;
            } catch (pickerErr) {
                if (pickerErr.name === 'AbortError') return;
                console.warn('showSaveFilePicker failed, falling back to blob download:', pickerErr);
            }
        }

        // 2. Dự phòng: Tự động tải xuống qua Blob URL
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', defaultFilename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`✅ Đã tải file log thành công (${(blob.size / 1024).toFixed(1)} KB)!`);
    } catch (err) {
        console.error('Lỗi download log file:', err);
        showToast('Lỗi khi tải file log: ' + err.message, true);
    }
}

async function openLogFolder() {
    try {
        const res = await fetch('/api/system/logs/open-folder', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('📂 Đã mở thư mục chứa file log trên Windows Explorer!');
        } else {
            showToast('Không thể mở thư mục: ' + (data.detail || 'Lỗi không xác định'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối khi mở thư mục log: ' + err.message, true);
    }
}

// =========================================================================
// SYSTEM ACTIVE ISSUES MODAL & RESOLUTION
// =========================================================================

function openSystemIssuesModal() {
    const modal = document.getElementById('modalSystemIssues');
    if (modal) {
        modal.classList.add('show');
        modal.classList.add('active');
        loadSystemIssues();
    }
}

function closeSystemIssuesModal() {
    const modal = document.getElementById('modalSystemIssues');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.remove('active');
    }
}

async function loadSystemIssues() {
    const body = document.getElementById('systemIssuesModalBody');
    const badge = document.getElementById('issuesSummaryBadge');
    if (!body) return;

    body.innerHTML = `<div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 32px; color: var(--accent-cyan); margin-bottom: 12px;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
        <h4 style="margin: 0; font-size: 15px; font-weight: 600;">Đang quét toàn diện các cảnh báo & sự cố...</h4>
        <p class="mt-2" style="color: var(--text-muted); font-size: 13px;">Kiểm tra tài khoản TikTok, proxy, lỗi video YouTube, render và hạn ngạch AI.</p>
    </div>`;

    try {
        const res = await fetch('/api/system/active-issues');
        const data = await res.json();

        if (badge) {
            badge.textContent = `Tổng cộng: ${data.total_count} vấn đề (${data.has_critical ? 'Có lỗi nghiêm trọng' : 'Chỉ cảnh báo'})`;
        }

        if (!data.issues || data.issues.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px;">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <h4 style="color: var(--text-primary); font-size: 17px; margin-bottom: 6px;">Hệ Thống Hoạt Động Hoàn Hảo!</h4>
                    <p style="color: var(--text-muted); font-size: 13.5px; max-width: 480px; margin: 0 auto;">
                        Không phát hiện lỗi tải video, proxy chết, tài khoản bị khóa hay hết hạn mức AI nào. Toàn bộ tiến trình Auto-Pilot đang sẵn sàng.
                    </p>
                </div>
            `;
            return;
        }

        body.innerHTML = data.issues.map(issue => {
            const isErr = issue.severity === 'error';
            let icon = 'fa-triangle-exclamation text-warning';
            let actionBtn = '';

            if (issue.category === 'tiktok_account') {
                icon = isErr ? 'fa-ban text-danger' : 'fa-user-shield text-warning';
                actionBtn = `<button class="btn btn-xs btn-secondary" onclick="closeSystemIssuesModal(); switchTab('tab-gpm-farm');"><i class="fa-solid fa-users-gear"></i> Mở Nick</button>`;
            } else if (issue.category === 'video_error') {
                icon = 'fa-video-slash text-danger';
                actionBtn = `<button class="btn btn-xs btn-secondary" onclick="closeSystemIssuesModal(); switchTab('tab-sources');"><i class="fa-brands fa-youtube"></i> Xem Nguồn</button>`;
            } else if (issue.category === 'upload_failure') {
                icon = 'fa-upload text-danger';
                actionBtn = `<button class="btn btn-xs btn-secondary" onclick="closeSystemIssuesModal(); switchTab('tab-pipeline-queue');"><i class="fa-solid fa-list-check"></i> Hàng Đợi</button>`;
            } else if (issue.category === 'ai_limit') {
                icon = 'fa-brain text-warning';
                actionBtn = `<button class="btn btn-xs btn-secondary" onclick="closeSystemIssuesModal(); switchTab('tab-settings');"><i class="fa-solid fa-gear"></i> Cài Đặt AI</button>`;
            } else if (issue.category === 'system_service') {
                icon = 'fa-power-off text-warning';
                actionBtn = `<button class="btn btn-xs btn-secondary" onclick="syncGPMProfiles(this)"><i class="fa-solid fa-rotate"></i> Kết Nối Lại</button>`;
            }

            return `
            <div class="issue-card ${isErr ? 'error' : 'warning'}">
                <div style="font-size: 22px; flex-shrink: 0;">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="issue-card-content">
                    <div class="issue-card-header">
                        <span class="issue-card-title">${escapeHtml(issue.title)}</span>
                        ${issue.target ? `<span class="issue-card-target">${escapeHtml(issue.target)}</span>` : ''}
                        <span class="issue-card-time"><i class="fa-regular fa-clock"></i> ${escapeHtml(issue.time || '')}</span>
                    </div>
                    <div class="issue-card-msg">${escapeHtml(issue.message)}</div>
                </div>
                ${actionBtn ? `<div class="issue-card-action">${actionBtn}</div>` : ''}
            </div>
            `;
        }).join('');

    } catch (err) {
        body.innerHTML = `<div class="diag-action-item error">
            <div class="diag-action-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="diag-action-content">
                <h5>Lỗi truy vấn cảnh báo hệ thống</h5>
                <p>${escapeHtml(err.message)}</p>
            </div>
        </div>`;
    }
}

// =========================================================================
// SYSTEM DIAGNOSTICS MODAL & EMBEDDED TAB
// =========================================================================

function openDiagnosticsModal() {
    const modal = document.getElementById('modalDiagnostics');
    if (modal) {
        modal.classList.add('show');
        modal.classList.add('active');
        runDiagnosticsCheck(true);
    }
}

function closeDiagnosticsModal() {
    const modal = document.getElementById('modalDiagnostics');
    if (modal) {
        modal.classList.remove('show');
        modal.classList.remove('active');
    }
}

async function runDiagnosticsCheck(inModal = true) {
    const targetEl = inModal
        ? document.getElementById('diagnosticsModalBody')
        : document.getElementById('diagnosticsContentArea');
    const timeBadge = inModal ? document.getElementById('diagLastCheckedTime') : null;
    const topbarBtn = document.getElementById('btnDiagnostics');

    if (topbarBtn) {
        topbarBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Đang Chẩn Đoán...`;
    }

    if (!targetEl) return;

    targetEl.innerHTML = `
        <div style="text-align: center; padding: 45px 20px;">
            <div style="font-size: 38px; color: var(--accent-cyan); margin-bottom: 14px;">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
            </div>
            <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">Đang Quét Toàn Diện Môi Trường Cài Đặt...</h4>
            <p style="margin: 8px auto 0 auto; max-width: 500px; color: var(--text-muted); font-size: 13px; line-height: 1.5;">
                Kiểm tra FFmpeg video engine, NVIDIA GPU NVENC, Node.js yt-dlp, Playwright automation, Local API, AI Keys và quyền ghi thư mục lưu trữ.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 6px 16px; border-radius: 20px; background: rgba(0,242,254,0.1); border: 1px solid rgba(0,242,254,0.3); font-size: 12px; color: var(--accent-cyan);">
                <i class="fa-solid fa-bolt fa-fade"></i> Vui lòng đợi trong giây lát...
            </div>
        </div>
    `;

    try {
        const res = await fetch('/api/system/diagnostics');
        if (!res.ok) {
            throw new Error(`Máy chủ phản hồi mã lỗi ${res.status}. Vui lòng thử lại sau giây lát.`);
        }
        const data = await res.json();
        if (!data || !data.checks) {
            throw new Error(data && data.detail ? data.detail : 'Dữ liệu chẩn đoán từ máy chủ không hợp lệ.');
        }

        if (timeBadge) {
            timeBadge.textContent = `Hệ điều hành: ${data.checks.python?.os || 'Windows'}`;
        }

        const overall = data.overall_status;
        const bannerColor = overall === 'ok' ? 'rgba(16, 185, 129, 0.15)' : (overall === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)');
        const bannerBorder = overall === 'ok' ? '#10b981' : (overall === 'warning' ? '#f59e0b' : '#ef4444');
        const bannerIcon = overall === 'ok' ? 'fa-circle-check text-success' : (overall === 'warning' ? 'fa-triangle-exclamation text-warning' : 'fa-circle-xmark text-danger');
        const bannerTitle = overall === 'ok' ? 'MÔI TRƯỜNG HOẠT ĐỘNG HOÀN TOÀN TỐT' : (overall === 'warning' ? 'MÔI TRƯỜNG HOẠT ĐỘNG TẠM THỜI (CÓ LƯU Ý)' : 'CẦN KHẮC PHỤC CÀI ĐẶT TRÊN MÁY TÍNH');

        let html = `
            <div style="background: ${bannerColor}; border: 1px solid ${bannerBorder}; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 14px;">
                <div style="font-size: 26px;"><i class="fa-solid ${bannerIcon}"></i></div>
                <div>
                    <h4 style="margin: 0; font-size: 15px; font-weight: 700;">${bannerTitle}</h4>
                    <p style="margin: 2px 0 0 0; font-size: 12.5px; opacity: 0.9;">
                        ${overall === 'ok' ? 'Tất cả các thành phần FFmpeg, GPU, Node.js, Playwright và API Keys đều hoạt động bình thường.' : 'Vui lòng xem các khuyến nghị và hướng dẫn bên dưới để đảm bảo ứng dụng không gặp lỗi.'}
                    </p>
                </div>
            </div>
        `;

        // Render Action Items callouts if any
        if (data.action_items && data.action_items.length > 0) {
            html += `<h5 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Lưu Ý Cần Khắc Phục (${data.action_items.length})</h5>`;
            html += data.action_items.map(item => `
                <div class="diag-action-item ${item.type}">
                    <div class="diag-action-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
                    <div class="diag-action-content">
                        <h5>${escapeHtml(item.title)} <span style="font-size: 11px; font-weight: normal; opacity: 0.8;">(${escapeHtml(item.category)})</span></h5>
                        <p>${escapeHtml(item.message)}</p>
                    </div>
                </div>
            `).join('');
        }

        // Render Component Cards Grid
        html += `<h5 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 18px 0 10px 0;">Chi Tiết Từng Phân Hệ</h5>`;
        html += `<div class="diag-grid">`;

        // Card 1: FFmpeg & NVENC
        const ff = data.checks.ffmpeg;
        const isFfOk = ff && (ff.status === 'ok' || ff.status === 'info');
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-solid fa-film text-accent"></i> FFmpeg & Render</span>
                    <span class="badge ${isFfOk ? 'badge-success' : 'badge-danger'}">${isFfOk ? (ff.nvenc_accelerated ? 'GPU NVENC' : 'Sẵn Sàng') : 'Thiếu'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Bộ mã hóa:</span> <span class="diag-meta-value">${escapeHtml(ff.encoder || 'libx264')}</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">GPU NVENC:</span> <span class="diag-meta-value">${ff.nvenc_accelerated ? '✅ Hỗ trợ' : '⚪ Không (Dùng CPU)'}</span></div>
                    <div class="diag-meta-row" style="font-size: 11px;"><span class="diag-meta-label">Phiên bản:</span> <span class="diag-meta-value" style="font-size: 11px;">${escapeHtml((ff.version || '').slice(0, 35))}</span></div>
                </div>
            </div>
        `;

        // Card 2: Node.js (yt-dlp)
        const node = data.checks.nodejs;
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-brands fa-node-js" style="color:#22c55e;"></i> Node.js Runtime</span>
                    <span class="badge ${node.installed ? 'badge-success' : 'badge-warning'}">${node.installed ? 'Sẵn Sàng' : 'Chưa Cài'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Tác vụ:</span> <span class="diag-meta-value">Giải mã chữ ký YouTube</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">Phiên bản:</span> <span class="diag-meta-value">${escapeHtml(node.version || 'Chưa cài')}</span></div>
                    <div class="diag-meta-row" style="font-size: 11px;"><span class="diag-meta-label">Đường dẫn:</span> <span class="diag-meta-value" style="font-size: 10px;">${escapeHtml((node.path || '').slice(-30))}</span></div>
                </div>
            </div>
        `;

        // Card 3: Playwright Automation
        const pw = data.checks.playwright;
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-solid fa-robot" style="color:#ec4899;"></i> Playwright Browser</span>
                    <span class="badge ${pw.installed ? 'badge-success' : 'badge-danger'}">${pw.installed ? 'Đã Cài' : 'Thiếu'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Tác vụ:</span> <span class="diag-meta-value">Tự đăng Tài Khoản</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">Trạng thái:</span> <span class="diag-meta-value">${escapeHtml(pw.detail || 'OK')}</span></div>
                </div>
            </div>
        `;


        // Card 5: AI Cloud Providers
        const ai = data.checks.ai;
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-solid fa-brain" style="color:#a855f7;"></i> AI Cloud & Models</span>
                    <span class="badge ${ai.status === 'ok' ? 'badge-success' : 'badge-warning'}">${ai.status === 'ok' ? 'Đã Nhập Key' : 'Chưa Có Key'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Provider chính:</span> <span class="diag-meta-value">${escapeHtml((ai.active_provider || '').toUpperCase())}</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">DeepSeek / Gemini:</span> <span class="diag-meta-value">${ai.has_deepseek ? '✅ DeepSeek' : '⚪'} ${ai.has_gemini ? '✅ Gemini' : '⚪'}</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">faster-whisper:</span> <span class="diag-meta-value">${ai.whisper_installed ? '✅ Sẵn sàng (' + ai.whisper_model_size + ')' : '⚪ Chưa cài'}</span></div>
                </div>
            </div>
        `;

        // Card 6: YouTube Data API v3
        const yt = data.checks.youtube;
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> YouTube API Keys</span>
                    <span class="badge ${yt.configured ? 'badge-success' : 'badge-warning'}">${yt.configured ? `${yt.key_count} Key(s)` : 'Chưa Có'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Tác vụ:</span> <span class="diag-meta-value">Quét ngách & theo dõi kênh</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">Dung lượng:</span> <span class="diag-meta-value">${yt.key_count * 10000} units/ngày</span></div>
                </div>
            </div>
        `;

        // Card 7: Storage & Permissions
        const st = data.checks.storage;
        const py = data.checks.python;
        html += `
            <div class="diag-card">
                <div class="diag-card-header">
                    <span class="diag-card-title"><i class="fa-solid fa-hard-drive" style="color:#eab308;"></i> Dung Lượng & Ổ Đĩa</span>
                    <span class="badge ${st.status === 'ok' ? 'badge-success' : 'badge-danger'}">${st.status === 'ok' ? 'Quyền Ghi OK' : 'Lỗi Quyền Ghi'}</span>
                </div>
                <div class="diag-card-body">
                    <div class="diag-meta-row"><span class="diag-meta-label">Dung lượng trống:</span> <span class="diag-meta-value">${py.disk_free_gb} GB (${py.disk_percent_free}% còn lại)</span></div>
                    <div class="diag-meta-row"><span class="diag-meta-label">Thư mục log:</span> <span class="diag-meta-value">data/logs (OK)</span></div>
                </div>
            </div>
        `;

        html += `</div>`;

        targetEl.innerHTML = html;

    } catch (err) {
        targetEl.innerHTML = `<div class="diag-action-item error">
            <div class="diag-action-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="diag-action-content">
                <h5>Không thể chạy chẩn đoán hệ thống</h5>
                <p>${escapeHtml(err.message)}</p>
            </div>
        </div>`;
    } finally {
        if (topbarBtn) {
            topbarBtn.innerHTML = `<i class="fa-solid fa-stethoscope"></i> Chẩn Đoán`;
        }
    }
}

// ==========================================================================
// --- AUDIO STUDIO (KHO ÂM THANH & BGM PLAYLIST) ---

// Module Window Exposures
window.closeDiagnosticsModal = closeDiagnosticsModal;
window.closeSystemIssuesModal = closeSystemIssuesModal;
window.confirmClearFileLog = confirmClearFileLog;
window.downloadLogFile = downloadLogFile;
window.handleFileLogSearch = handleFileLogSearch;
window.loadFileLogs = loadFileLogs;
window.loadSystemIssues = loadSystemIssues;
window.openDiagnosticsModal = openDiagnosticsModal;
window.openLogFolder = openLogFolder;
window.openSystemIssuesModal = openSystemIssuesModal;
window.runDiagnosticsCheck = runDiagnosticsCheck;
window.switchLogsSubTab = switchLogsSubTab;
