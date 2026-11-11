// ==========================================================================

// cachedAudioCategories is declared globally at top of app.js
let currentSelectedAudioCategory = 'general';
let rawAudioSearchResults = [];
let audioSortField = 'default';
let audioSortAsc = false;
let audioFilterDuration = 'all';
let audioFilterDownload = 'all';
let audioFilterKeyword = '';

let currentPreviewAudio = null;
let currentPlayingBtnId = null;
let currentPreviewMode = null; // 'html5' | 'iframe'

// Chuyển đổi Sub-tab trong Kho Âm Thanh
function switchAudioSubTab(sub) {
    const btnSearch = document.getElementById('btnAudioSubnavSearch');
    const btnLibrary = document.getElementById('btnAudioSubnavLibrary');
    const viewSearch = document.getElementById('audioSubViewSearch');
    const viewLibrary = document.getElementById('audioSubViewLibrary');

    if (sub === 'search') {
        btnSearch?.classList.add('active');
        btnLibrary?.classList.remove('active');
        if (viewSearch) viewSearch.style.display = 'block';
        if (viewLibrary) viewLibrary.style.display = 'none';
    } else {
        btnLibrary?.classList.add('active');
        btnSearch?.classList.remove('active');
        if (viewSearch) viewSearch.style.display = 'none';
        if (viewLibrary) viewLibrary.style.display = 'block';
        loadAudioCategories();
    }
}

// 1. Tải danh sách thư mục nhạc nền (Categories)
async function loadAudioCategories() {
    try {
        const res = await fetch('/api/audio/categories');
        const data = await res.json();
        if (data.status === 'success') {
            cachedAudioCategories = data.categories || [];
            renderAudioCategoryChips(cachedAudioCategories);
            populateAllBgmSelects(cachedAudioCategories);

            // Cập nhật tổng số bài hát trên badge
            const totalTracks = cachedAudioCategories.reduce((sum, c) => sum + (c.track_count || 0), 0);
            const badge = document.getElementById('audioLibraryTotalCountBadge');
            if (badge) badge.textContent = totalTracks;

            // Load bài hát cho category hiện tại
            if (!cachedAudioCategories.some(c => c.id === currentSelectedAudioCategory)) {
                currentSelectedAudioCategory = cachedAudioCategories[0]?.id || 'general';
            }
            loadAudioTracks(currentSelectedAudioCategory);
        }
    } catch (err) {
        console.error('Lỗi tải danh mục âm thanh:', err);
    }
}

// Render các chip thư mục nhạc (hỗ trợ 200+ thư mục với popover)
let popoverFolderSearchTerm = '';

function renderAudioCategoryChips(categories) {
    const container = document.getElementById('audioCategoryChipsContainer');
    if (!container) return;

    if (!categories.length) {
        container.innerHTML = '<span class="text-muted">Chưa có thư mục nhạc nào.</span>';
        return;
    }

    const maxVisible = 10;
    const visibleChips = categories.slice(0, maxVisible);
    const overflowChips = categories.slice(maxVisible);
    const isOverflowSelected = overflowChips.some(c => c.id === currentSelectedAudioCategory);

    let html = visibleChips.map(cat => {
        const isSelected = cat.id === currentSelectedAudioCategory;
        const dispName = escapeHtml(cat.display_name || cat.name);
        return `
            <div class="audio-chip-wrapper ${isSelected ? 'active' : ''}">
                <button type="button" class="audio-chip ${isSelected ? 'active' : ''}"
                    onclick="selectAudioCategory('${escapeHtml(cat.id)}')">
                    <i class="fa-solid fa-folder"></i>
                    <span>${dispName}</span>
                    <span class="audio-chip-count">${cat.track_count} bài • ${cat.total_size_mb} MB</span>
                </button>
                <div class="audio-chip-actions">
                    <button type="button" class="chip-action-btn has-tooltip tooltip-top" title="Đổi tên thư mục" data-tooltip="Đổi tên thư mục"
                        onclick="event.stopPropagation(); openEditCategoryModal('${escapeHtml(cat.id)}', '${dispName}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="chip-action-btn danger has-tooltip tooltip-top" title="Xóa thư mục" data-tooltip="Xóa thư mục"
                        onclick="event.stopPropagation(); deleteCategoryPrompt('${escapeHtml(cat.id)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (overflowChips.length > 0) {
        html += `
            <div class="audio-more-folders-wrap">
                <button type="button" class="audio-chip audio-chip-more ${isOverflowSelected ? 'active' : ''}"
                    id="btnMoreAudioFolders" onclick="toggleAudioFoldersPopover(event)">
                    <i class="fa-solid fa-folder-tree"></i>
                    <span>+${overflowChips.length} Thư Mục Khác</span>
                    <i class="fa-solid fa-chevron-down" style="font-size:10px; margin-left:4px;"></i>
                </button>
                <div class="audio-folders-popover" id="audioFoldersPopover" style="display:none;" onclick="event.stopPropagation()">
                    <div class="audio-popover-header">
                        <div class="audio-popover-search">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" id="popoverFolderSearch" placeholder="Tìm kiếm trong ${categories.length} thư mục..."
                                value="${escapeHtml(popoverFolderSearchTerm)}"
                                oninput="filterAudioFoldersPopover(this.value)">
                        </div>
                    </div>
                    <div class="audio-popover-list" id="audioPopoverList">
                        <!-- Popover items -->
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    if (overflowChips.length > 0) {
        renderAudioPopoverItems();
    }
}

function renderAudioPopoverItems() {
    const listEl = document.getElementById('audioPopoverList');
    if (!listEl) return;

    let items = cachedAudioCategories;
    if (popoverFolderSearchTerm) {
        const kw = popoverFolderSearchTerm.toLowerCase();
        items = cachedAudioCategories.filter(c => (c.name || '').toLowerCase().includes(kw) || (c.display_name || '').toLowerCase().includes(kw));
    } else {
        items = cachedAudioCategories.slice(10);
    }

    if (!items.length) {
        listEl.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px;">Không tìm thấy thư mục nào phù hợp.</div>';
        return;
    }

    listEl.innerHTML = items.map(cat => {
        const isSelected = cat.id === currentSelectedAudioCategory;
        const dispName = escapeHtml(cat.display_name || cat.name);
        return `
            <div class="audio-popover-item ${isSelected ? 'active' : ''}" onclick="selectAudioCategory('${escapeHtml(cat.id)}'); closeAudioFoldersPopover();">
                <div class="audio-popover-item-info">
                    <i class="fa-solid fa-folder text-cyan"></i>
                    <div class="audio-popover-item-texts">
                        <span class="audio-popover-item-name" title="${dispName}">${dispName}</span>
                        <span class="audio-popover-item-meta">${cat.track_count} bài • ${cat.total_size_mb} MB</span>
                    </div>
                </div>
                <div class="audio-popover-item-actions">
                    <button type="button" class="btn-icon-xs has-tooltip tooltip-side-left" 
                        title="Đổi tên thư mục" data-tooltip="Đổi tên thư mục"
                        onclick="event.stopPropagation(); openEditCategoryModal('${escapeHtml(cat.id)}', '${dispName}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="btn-icon-xs text-danger has-tooltip tooltip-side-left" 
                        title="Xóa thư mục" data-tooltip="Xóa thư mục"
                        onclick="event.stopPropagation(); deleteCategoryPrompt('${escapeHtml(cat.id)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filterAudioFoldersPopover(keyword) {
    popoverFolderSearchTerm = keyword.trim();
    renderAudioPopoverItems();
}

function toggleAudioFoldersPopover(event) {
    if (event) event.stopPropagation();
    const pop = document.getElementById('audioFoldersPopover');
    if (!pop) return;
    const isShowing = pop.style.display !== 'none';
    if (isShowing) {
        closeAudioFoldersPopover();
    } else {
        pop.style.display = 'block';
        const inp = document.getElementById('popoverFolderSearch');
        if (inp) inp.focus();
        document.removeEventListener('click', onDocClickCloseAudioPopover);
        setTimeout(() => {
            document.addEventListener('click', onDocClickCloseAudioPopover);
        }, 10);
    }
}

function closeAudioFoldersPopover() {
    const pop = document.getElementById('audioFoldersPopover');
    if (pop) pop.style.display = 'none';
    document.removeEventListener('click', onDocClickCloseAudioPopover);
}

function onDocClickCloseAudioPopover(e) {
    const pop = document.getElementById('audioFoldersPopover');
    const btn = document.getElementById('btnMoreAudioFolders');
    if (pop && !pop.contains(e.target) && (!btn || !btn.contains(e.target))) {
        closeAudioFoldersPopover();
    }
}

// Modal đổi tên thư mục nhạc
function openEditCategoryModal(catId, currentDisplayName) {
    const cat = cachedAudioCategories.find(c => c.id === catId);
    const oldIdInput = document.getElementById('editCategoryOldId');
    const dispInput = document.getElementById('editCategoryDisplayName');
    const folderInput = document.getElementById('editCategoryFolderName');
    const modal = document.getElementById('modalEditAudioCategory');

    if (!modal) return;
    if (oldIdInput) oldIdInput.value = catId;
    if (dispInput) dispInput.value = currentDisplayName || (cat ? (cat.display_name || cat.name) : catId);
    if (folderInput) folderInput.value = cat ? cat.name : catId;

    modal.classList.add('active');
}

function closeEditCategoryModal() {
    const modal = document.getElementById('modalEditAudioCategory');
    if (modal) modal.classList.remove('active');
}

async function saveCategoryRename() {
    const oldId = document.getElementById('editCategoryOldId')?.value.trim();
    const displayName = document.getElementById('editCategoryDisplayName')?.value.trim();
    const folderInput = document.getElementById('editCategoryFolderName');
    const folderName = folderInput ? folderInput.value.trim() : '';
    const btn = document.getElementById('btnSaveCategoryRename');

    if (!oldId) {
        showToast('Không xác định được thư mục cần đổi tên!', 'error');
        return;
    }
    if (!folderName) {
        markInputError('editCategoryFolderName', 'Vui lòng nhập tên thư mục mới!');
        return;
    }
    if (!isValidFolderName(folderName)) {
        markInputError('editCategoryFolderName', 'Tên thư mục không được chứa ký tự đặc biệt (/ \\ : * ? " < > |)!');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    try {
        const res = await fetch('/api/audio/categories/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_id: oldId, new_name: folderName, display_name: displayName })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('✅ Đã đổi tên thư mục nhạc thành công!', 'success');
            closeEditCategoryModal();
            if (currentSelectedAudioCategory === oldId) {
                currentSelectedAudioCategory = data.category.id;
            }
            await loadAudioCategories();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Không thể đổi tên thư mục'), 'error');
        }
    } catch (err) {
        showToast('Lỗi khi đổi tên thư mục: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu Thay Đổi';
        }
    }
}

async function deleteCategoryPrompt(catId) {
    const cat = cachedAudioCategories.find(c => c.id === catId);
    const rawName = cat ? (cat.display_name || cat.name) : catId;
    const catName = rawName.length > 36 ? rawName.slice(0, 33) + '...' : rawName;
    const trackCount = cat ? cat.track_count : 0;

    const ok = await showConfirmDialog({
        title: 'Xóa Thư Mục Nhạc Nền',
        message: `Bạn có chắc chắn muốn xóa thư mục nhạc "${catName}"?`,
        details: `Lưu ý: Tất cả ${trackCount} bài hát trong thư mục này sẽ bị xóa khỏi máy tính!`,
        confirmText: 'Xóa Thư Mục',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    try {
        const res = await fetch(`/api/audio/categories/${encodeURIComponent(catId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Đã xóa thư mục "${catName}"!`);
            if (currentSelectedAudioCategory === catId) {
                currentSelectedAudioCategory = 'general';
            }
            await loadAudioCategories();
        } else {
            showToast(data.detail || 'Không thể xóa thư mục', true);
        }
    } catch (err) {
        showToast('Lỗi khi xóa thư mục nhạc: ' + err.message, true);
    }
}

// Modal Cài đặt Audio Studio
async function openAudioSettingsModal() {
    const modal = document.getElementById('modalAudioSettings');
    if (!modal) return;
    modal.classList.add('active');

    try {
        const res = await fetch('/api/audio/settings');
        const data = await res.json();
        if (data.status === 'success') {
            const dirInput = document.getElementById('settingAudioMusicDir');
            const maxInput = document.getElementById('settingAudioMaxSize');
            const bitSelect = document.getElementById('settingAudioBitrate');
            const resSelect = document.getElementById('settingAudioMaxResults');
            const normCheck = document.getElementById('settingAudioNormalize');

            if (dirInput) dirInput.value = data.music_dir || '';
            if (maxInput) maxInput.value = data.max_size_mb || 50;
            if (bitSelect) bitSelect.value = data.default_bitrate || '192k';
            if (resSelect) resSelect.value = data.max_search_results || 50;
            if (normCheck) normCheck.checked = Boolean(data.normalize_audio);
        }
    } catch (err) {
        console.error('Lỗi nạp cài đặt audio:', err);
    }
}

function closeAudioSettingsModal() {
    const modal = document.getElementById('modalAudioSettings');
    if (modal) modal.classList.remove('active');
}

async function saveAudioSettings() {
    const dirInput = document.getElementById('settingAudioMusicDir');
    const maxInput = document.getElementById('settingAudioMaxSize');
    const bitSelect = document.getElementById('settingAudioBitrate');
    const resSelect = document.getElementById('settingAudioMaxResults');
    const normCheck = document.getElementById('settingAudioNormalize');
    const btn = document.getElementById('btnSaveAudioSettings');

    const maxSize = maxInput ? parseInt(maxInput.value, 10) : 50;
    const maxResults = resSelect ? parseInt(resSelect.value, 10) : 50;

    if (isNaN(maxSize) || maxSize < 1 || maxSize > 500) {
        markInputError('settingAudioMaxSize', 'Dung lượng tối đa phải từ 1 đến 500 MB!');
        return;
    }
    if (isNaN(maxResults) || maxResults < 1 || maxResults > 100) {
        markInputError('settingAudioMaxResults', 'Số kết quả tìm kiếm tối đa phải từ 1 đến 100!');
        return;
    }

    const payload = {
        music_dir: dirInput ? dirInput.value.trim() : null,
        max_size_mb: maxSize,
        default_bitrate: bitSelect ? bitSelect.value : '192k',
        max_search_results: maxResults,
        normalize_audio: normCheck ? normCheck.checked : true
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    try {
        const res = await fetch('/api/audio/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('✅ Đã lưu cài đặt Audio thành công!', 'success');
            closeAudioSettingsModal();
            await loadAudioCategories();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Không thể lưu cài đặt'), 'error');
        }
    } catch (err) {
        showToast('Lỗi khi lưu cài đặt audio: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Lưu Cài Đặt';
        }
    }
}

// Chọn một danh mục nhạc để xem
function selectAudioCategory(catId) {
    currentSelectedAudioCategory = catId;
    renderAudioCategoryChips(cachedAudioCategories);
    const cat = cachedAudioCategories.find(c => c.id === catId);
    const titleEl = document.getElementById('currentCategoryTitle');
    const uploadTargetEl = document.getElementById('currentUploadTargetCategoryName');
    if (titleEl) titleEl.textContent = cat ? (cat.display_name || cat.name) : catId;
    if (uploadTargetEl) uploadTargetEl.textContent = cat ? cat.name : catId;
    loadAudioTracks(catId);
}

// Tải bài hát trong một danh mục
async function loadAudioTracks(category) {
    const tbody = document.getElementById('localTracksBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Đang nạp danh sách bài hát...</td></tr>';

    try {
        const res = await fetch(`/api/audio/tracks?category=${encodeURIComponent(category)}`);
        const data = await res.json();
        if (data.status === 'success') {
            const tracks = data.tracks || [];
            const countEl = document.getElementById('currentCategoryTrackCount');
            if (countEl) countEl.textContent = `${tracks.length} bài`;
            renderLocalTracksTable(tracks);
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Lỗi khi nạp bài hát: ${escapeHtml(err.message)}</td></tr>`;
    }
}

// Render bảng bài hát local
function renderLocalTracksTable(tracks) {
    const tbody = document.getElementById('localTracksBody');
    if (!tbody) return;

    if (!tracks.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><i class="fa-solid fa-music fa-2x mb-2" style="opacity:0.3;"></i><br>Chưa có file nhạc nào trong thư mục này. Hãy kéo thả file MP3 hoặc tải từ YouTube!</td></tr>';
        return;
    }

    tbody.innerHTML = tracks.map((t, idx) => {
        const btnId = `btnPlayLocal_${idx}`;
        return `
            <tr>
                <td>
                    <div class="table-text-truncate" style="max-width: 260px; font-weight:600; color:var(--text-primary);" title="${escapeHtml(t.filename)}">
                        <i class="fa-solid fa-file-audio text-cyan" style="margin-right:6px;"></i>
                        ${escapeHtml(t.filename)}
                    </div>
                </td>
                <td><span class="badge badge-info">${escapeHtml(t.ext.toUpperCase())}</span></td>
                <td>${t.size_mb} MB</td>
                <td>${escapeHtml(t.modified_at)}</td>
                <td class="text-center">
                    <button type="button" class="audio-preview-btn has-tooltip" id="${btnId}"
                        onclick="togglePlayAudioPreview('${escapeHtml(t.stream_url)}', '${btnId}', '${escapeHtml(t.filename).replace(/'/g, "\\'")}', '', '')"
                        data-tooltip="Bấm để Nghe Thử / Tạm Dừng">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-danger has-tooltip tooltip-side-left"
                        onclick="deleteAudioTrack('${escapeHtml(t.category)}', '${escapeHtml(t.filename)}')"
                        data-tooltip="Xóa file nhạc này">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Làm mới thư viện nhạc
function refreshAudioLibrary() {
    loadAudioCategories();
    showToast('Đã làm mới thư viện nhạc!');
}

// Xóa bài hát local
async function deleteAudioTrack(category, filename) {
    const rawName = filename || '';
    const dispFile = rawName.length > 36 ? rawName.slice(0, 33) + '...' : rawName;
    const ok = await showConfirmDialog({
        title: 'Xóa File Nhạc Khỏi Thư Viện',
        message: `Bạn có chắc muốn xóa file nhạc "${dispFile}"?`,
        details: 'Tệp MP3 sẽ bị xóa vĩnh viễn khỏi máy tính.',
        confirmText: 'Xóa Bài Hát',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    try {
        const res = await fetch('/api/audio/tracks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, filename })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Đã xóa file nhạc thành công!');
            stopAudioPreview();
            loadAudioCategories();
        } else {
            showToast(data.detail || 'Lỗi khi xóa bài hát', true);
        }
    } catch (err) {
        showToast('Lỗi khi xóa: ' + err.message, true);
    }
}

// --------------------------------------------------------------------------
// --- HỆ THỐNG PHÁT / NGHE THỬ ÂM THANH (PREVIEW DOCK & YOUTUBE PLAYER) ---
// --------------------------------------------------------------------------

// Dừng hoàn toàn nghe thử
function stopAudioPreview() {
    if (currentPreviewAudio) {
        try {
            currentPreviewAudio.pause();
            currentPreviewAudio.src = '';
            currentPreviewAudio.load();
        } catch (_) { }
        currentPreviewAudio = null;
    }

    const container = document.getElementById('audioDockYtContainer');
    if (container) {
        container.innerHTML = '';
    }

    if (currentPlayingBtnId) {
        const prevBtn = document.getElementById(currentPlayingBtnId);
        if (prevBtn) {
            prevBtn.classList.remove('playing');
            prevBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        currentPlayingBtnId = null;
    }

    currentPreviewMode = null;

    const dock = document.getElementById('audioPreviewDock');
    if (dock) dock.style.display = 'none';
}

// Hiển thị Dock nghe thử
function showAudioPreviewDock({ title, sub, thumb, isLoading }) {
    const dock = document.getElementById('audioPreviewDock');
    if (!dock) return;

    dock.style.display = 'block';

    const titleEl = document.getElementById('audioDockTitle');
    const subEl = document.getElementById('audioDockSub');
    const thumbImg = document.getElementById('audioDockThumb');
    const iconFallback = document.getElementById('audioDockIconFallback');
    const playPauseBtn = document.getElementById('btnDockPlayPause');
    const eq = document.getElementById('audioDockEqualizer');

    if (titleEl) {
        titleEl.textContent = title || 'Đang kết nối âm thanh...';
        titleEl.title = title || '';
    }
    if (subEl) subEl.textContent = sub || 'BGM Preview';

    if (thumb && thumbImg) {
        thumbImg.src = thumb;
        thumbImg.style.display = 'block';
        if (iconFallback) iconFallback.style.display = 'none';
    } else {
        if (thumbImg) thumbImg.style.display = 'none';
        if (iconFallback) iconFallback.style.display = 'flex';
    }

    if (playPauseBtn) {
        playPauseBtn.innerHTML = isLoading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : '<i class="fa-solid fa-pause"></i>';
    }
    if (eq) {
        eq.classList.remove('paused');
    }
}

// Cập nhật trạng thái Dock
function updateAudioPreviewDockState(isPlaying, updatedTitle) {
    const playPauseBtn = document.getElementById('btnDockPlayPause');
    const eq = document.getElementById('audioDockEqualizer');
    const titleEl = document.getElementById('audioDockTitle');

    if (updatedTitle && titleEl) {
        titleEl.textContent = updatedTitle;
        titleEl.title = updatedTitle;
    }

    if (playPauseBtn) {
        playPauseBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    }
    if (eq) {
        if (isPlaying) eq.classList.remove('paused');
        else eq.classList.add('paused');
    }
}

// Bật / tắt tạm dừng từ Dock
function toggleDockPlayPause() {
    const playPauseBtn = document.getElementById('btnDockPlayPause');
    const rowBtn = document.getElementById(currentPlayingBtnId);

    if (currentPreviewMode === 'html5' && currentPreviewAudio) {
        if (currentPreviewAudio.paused) {
            currentPreviewAudio.play().then(() => {
                updateAudioPreviewDockState(true);
                if (rowBtn) {
                    rowBtn.classList.add('playing');
                    rowBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                }
            }).catch(e => showToast('Không thể tiếp tục phát: ' + e.message, true));
        } else {
            currentPreviewAudio.pause();
            updateAudioPreviewDockState(false);
            if (rowBtn) {
                rowBtn.classList.remove('playing');
                rowBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        }
    } else if (currentPreviewMode === 'iframe') {
        const iframe = document.getElementById('ytAudioPreviewIframe');
        const isPaused = playPauseBtn && playPauseBtn.innerHTML.includes('fa-play');

        if (isPaused) {
            iframe?.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            updateAudioPreviewDockState(true);
            if (rowBtn) {
                rowBtn.classList.add('playing');
                rowBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
        } else {
            iframe?.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            updateAudioPreviewDockState(false);
            if (rowBtn) {
                rowBtn.classList.remove('playing');
                rowBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        }
    }
}

// Đóng Dock
function closeAudioPreviewDock() {
    stopAudioPreview();
}

// Phát âm thanh YouTube qua iframe (Fallback 100% không bao giờ lỗi CORS/bot)
function playViaYouTubeIframe(videoId, btnId, trackTitle, trackThumb) {
    if (!videoId) {
        showToast('Không tìm thấy Video ID để phát', true);
        stopAudioPreview();
        return;
    }

    const container = document.getElementById('audioDockYtContainer');
    if (!container) return;

    // Chèn iframe YouTube với autoplay và enablejsapi để điều khiển postMessage
    container.innerHTML = `
        <iframe id="ytAudioPreviewIframe"
            src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&controls=0"
            allow="autoplay; encrypted-media"
            style="width: 200px; height: 120px; border:0;">
        </iframe>
    `;

    currentPreviewMode = 'iframe';
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.classList.add('playing');
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    updateAudioPreviewDockState(true, trackTitle);
}

// Phát / Dừng nghe thử âm thanh (Tự động nhận diện YouTube URL hoặc Local Stream)
async function togglePlayAudioPreview(streamUrl, btnId, trackTitle, trackThumb, videoId) {
    const btn = document.getElementById(btnId);

    // Nếu đang phát bài này -> Dừng
    if (currentPlayingBtnId === btnId) {
        stopAudioPreview();
        return;
    }

    // Nếu đang phát bài khác -> Dừng bài cũ trước
    stopAudioPreview();

    currentPlayingBtnId = btnId;
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    const isYouTube = streamUrl && (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be') || videoId);
    let cleanVideoId = videoId;
    if (isYouTube && !cleanVideoId) {
        const m = streamUrl.match(/(?:v=|\/|be\/)([a-zA-Z0-9_-]{11})/);
        cleanVideoId = m ? m[1] : '';
    }

    // Mở Dock với trạng thái đang kết nối
    showAudioPreviewDock({
        title: trackTitle || (isYouTube ? 'YouTube Audio' : 'Nhạc Nền Thư Viện'),
        sub: isYouTube ? 'YouTube No-Copyright' : 'Thư viện BGM',
        thumb: trackThumb || '',
        isLoading: true
    });

    if (isYouTube) {
        // Cố gắng lấy Direct Stream URL qua backend để phát nhẹ nhàng qua HTML5
        try {
            const resp = await fetch(`/api/audio/yt-stream-url?url=${encodeURIComponent(streamUrl || cleanVideoId)}`);
            const data = await resp.json();

            if (data && data.stream_url) {
                try {
                    const audio = new Audio(data.stream_url);
                    audio.onended = () => stopAudioPreview();
                    audio.onerror = () => {
                        // Nếu direct stream lỗi CORS hoặc network, fallback ngay sang iframe
                        playViaYouTubeIframe(cleanVideoId || data.video_id, btnId, trackTitle, trackThumb);
                    };

                    await audio.play();
                    currentPreviewAudio = audio;
                    currentPreviewMode = 'html5';

                    if (btn) {
                        btn.classList.add('playing');
                        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                    }
                    updateAudioPreviewDockState(true, data.title || trackTitle);
                    return;
                } catch (playErr) {
                    console.warn('HTML5 audio play failed, falling back to YouTube iframe:', playErr);
                }
            }

            // Fallback: Phát qua embedded iframe
            playViaYouTubeIframe(cleanVideoId || (data ? data.video_id : ''), btnId, trackTitle, trackThumb);

        } catch (err) {
            console.warn('Error resolving YouTube stream, falling back to iframe:', err);
            playViaYouTubeIframe(cleanVideoId, btnId, trackTitle, trackThumb);
        }
    } else {
        // Local audio file stream
        try {
            const audio = new Audio(streamUrl);
            audio.onended = () => stopAudioPreview();
            audio.onerror = (e) => {
                showToast('Không thể phát file âm thanh: ' + (e.message || 'Lỗi định dạng'), true);
                stopAudioPreview();
            };

            await audio.play();
            currentPreviewAudio = audio;
            currentPreviewMode = 'html5';

            if (btn) {
                btn.classList.add('playing');
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }
            updateAudioPreviewDockState(true, trackTitle);
        } catch (err) {
            showToast('Không thể phát âm thanh: ' + err.message, true);
            stopAudioPreview();
        }
    }
}

// Modal Tạo Thư Mục Nhạc Mới
function openCreateAudioCategoryModal() {
    document.getElementById('newCategoryFolderInput').value = '';
    document.getElementById('newCategoryDisplayInput').value = '';
    document.getElementById('modalCreateAudioCategory').classList.add('active');
}

function closeCreateAudioCategoryModal() {
    document.getElementById('modalCreateAudioCategory').classList.remove('active');
}

async function submitCreateAudioCategory() {
    const folderInput = document.getElementById('newCategoryFolderInput');
    const folder = folderInput ? folderInput.value.trim() : '';
    const display = document.getElementById('newCategoryDisplayInput')?.value.trim() || '';
    if (!folder) {
        markInputError('newCategoryFolderInput', 'Vui lòng nhập tên thư mục nhạc!');
        return;
    }
    if (!isValidFolderName(folder)) {
        markInputError('newCategoryFolderInput', 'Tên thư mục không được chứa ký tự đặc biệt (/ \\ : * ? " < > |)!');
        return;
    }

    try {
        const res = await fetch('/api/audio/categories/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: folder, display_name: display || folder })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ Đã tạo thư mục nhạc "${folder}" thành công!`, 'success');
            closeCreateAudioCategoryModal();
            currentSelectedAudioCategory = data.category.id;
            loadAudioCategories();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Không thể tạo thư mục'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
    }
}

// Xử lý kéo thả Upload file nhạc
async function handleAudioFilesSelected(files) {
    if (!files || !files.length) {
        showToast('Vui lòng chọn ít nhất 1 file âm thanh!', 'warning');
        return;
    }

    const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const invalidFiles = Array.from(files).filter(f => !validExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (invalidFiles.length > 0) {
        showToast(`⚠️ Có ${invalidFiles.length} file không phải định dạng âm thanh hỗ trợ (.mp3, .wav, .aac, .m4a, .flac)!`, 'warning');
        return;
    }

    const targetCategory = currentSelectedAudioCategory || 'general';
    const formData = new FormData();
    formData.append('category', targetCategory);
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    showToast(`Đang tải lên ${files.length} file nhạc vào [${targetCategory}]...`);

    try {
        const res = await fetch('/api/audio/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ Tải lên thành công ${data.uploaded_count} bài hát!`, 'success');
            loadAudioCategories();
        } else {
            const errs = data.errors ? data.errors.join('; ') : (data.detail || data.message || 'Lỗi tải lên');
            showToast(`Lỗi: ${errs}`, 'error');
        }
    } catch (err) {
        showToast('Lỗi tải lên file nhạc: ' + err.message, 'error');
    } finally {
        const input = document.getElementById('audioFileInput');
        if (input) input.value = '';
    }
}

// Tải nhanh từ YouTube URL trực tiếp trong Thư viện
async function downloadDirectYtAudio() {
    const input = document.getElementById('directYtAudioUrl');
    const btn = document.getElementById('btnDirectDownloadYtAudio');
    const url = input?.value.trim();
    if (!url) {
        markInputError('directYtAudioUrl', 'Vui lòng nhập link YouTube cần tải nhạc MP3!');
        return;
    }
    if (!isValidYouTubeUrl(url)) {
        markInputError('directYtAudioUrl', 'Link YouTube không đúng định dạng!');
        return;
    }

    const targetCategory = currentSelectedAudioCategory || 'general';
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải MP3...';
    }

    try {
        const res = await fetch('/api/audio/download-yt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, category: targetCategory })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ Đã tải thành công: ${data.title}!`, 'success');
            if (input) input.value = '';
            loadAudioCategories();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Lỗi khi tải từ YouTube'), 'error');
        }
    } catch (err) {
        showToast('Lỗi tải từ YouTube: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// --------------------------------------------------------------------------
// --- TÌM KIẾM YOUTUBE NO-COPYRIGHT AUDIO (SUB-VIEW 1) ---
// --------------------------------------------------------------------------

async function searchYouTubeAudio() {
    const kwInput = document.getElementById('audioSearchKeyword');
    const limitSelect = document.getElementById('audioSearchLimit');
    const btn = document.getElementById('btnSearchAudio');
    const tbody = document.getElementById('audioSearchResultsBody');

    const keyword = kwInput ? kwInput.value.trim() : '';
    const maxResults = limitSelect ? parseInt(limitSelect.value, 10) : 50;

    if (!keyword) {
        markInputError('audioSearchKeyword', 'Vui lòng nhập từ khóa tìm kiếm âm thanh!');
        return;
    }
    if (isNaN(maxResults) || maxResults < 1 || maxResults > 100) {
        markInputError('audioSearchLimit', 'Số lượng bài hát quét phải từ 1 đến 100!');
        return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét nhạc...';
    }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><i class="fa-solid fa-spinner fa-spin fa-2x mb-3 text-cyan"></i><br>Đang tìm kiếm nhạc No-Copyright trên YouTube...</td></tr>';

    try {
        const res = await fetch('/api/audio/search-youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, max_results: maxResults })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            rawAudioSearchResults = data.tracks || [];
            // Reset filters
            audioSortField = 'default';
            audioSortAsc = false;
            audioFilterDuration = 'all';
            audioFilterDownload = 'all';
            audioFilterKeyword = '';

            const sortSel = document.getElementById('audioSortSelect');
            if (sortSel) sortSel.value = 'default';
            const durSel = document.getElementById('audioFilterDurationSelect');
            if (durSel) durSel.value = 'all';
            const dlSel = document.getElementById('audioFilterDownloadSelect');
            if (dlSel) dlSel.value = 'all';
            const kwInp = document.getElementById('audioFilterKeywordInput');
            if (kwInp) kwInp.value = '';

            updateAudioSortDirectionBtn();
            updateAudioHeaderSortIcons();
            renderAudioSearchResults();
            showToast(`✅ Đã tìm thấy ${rawAudioSearchResults.length} bài hát No-Copyright!`, 'success');
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">Lỗi khi tìm kiếm: ${escapeHtml(data.detail || data.message || 'Không xác định')}</td></tr>`;
            showToast('Lỗi tìm kiếm: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">Lỗi: ${escapeHtml(err.message)}</td></tr>`;
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Xử lý sắp xếp và bộ lọc kết quả tìm kiếm
function handleAudioSortChange(field) {
    audioSortField = field;
    if (field !== 'default') {
        if (['duration', 'view_count', 'upload_date'].includes(field)) {
            audioSortAsc = false;
        } else {
            audioSortAsc = true;
        }
    }
    updateAudioSortDirectionBtn();
    updateAudioHeaderSortIcons();
    renderAudioSearchResults();
}

function toggleAudioSortDirection() {
    audioSortAsc = !audioSortAsc;
    updateAudioSortDirectionBtn();
    updateAudioHeaderSortIcons();
    renderAudioSearchResults();
}

function handleAudioHeaderSort(field) {
    if (audioSortField === field) {
        audioSortAsc = !audioSortAsc;
    } else {
        audioSortField = field;
        if (['duration', 'view_count', 'upload_date'].includes(field)) {
            audioSortAsc = false;
        } else {
            audioSortAsc = true;
        }
    }
    const sortSel = document.getElementById('audioSortSelect');
    if (sortSel) sortSel.value = audioSortField;
    updateAudioSortDirectionBtn();
    updateAudioHeaderSortIcons();
    renderAudioSearchResults();
}

function updateAudioHeaderSortIcons() {
    const headers = [
        { id: 'th-audio-title', field: 'title' },
        { id: 'th-audio-uploader', field: 'uploader' },
        { id: 'th-audio-duration', field: 'duration' },
        { id: 'th-audio-views', field: 'view_count' },
        { id: 'th-audio-date', field: 'upload_date' }
    ];

    headers.forEach(h => {
        const th = document.getElementById(h.id);
        if (!th) return;
        const icon = th.querySelector('.sort-icon');
        if (audioSortField === h.field) {
            th.classList.add('sorted-active');
            if (icon) {
                icon.className = audioSortAsc
                    ? 'fa-solid fa-arrow-up-short-wide sort-icon'
                    : 'fa-solid fa-arrow-down-wide-short sort-icon';
            }
        } else {
            th.classList.remove('sorted-active');
            if (icon) icon.className = 'fa-solid fa-sort sort-icon';
        }
    });
}

function updateAudioSortDirectionBtn() {
    const icon = document.getElementById('audioSortDirIcon');
    const text = document.getElementById('audioSortDirText');
    if (audioSortAsc) {
        if (icon) icon.className = 'fa-solid fa-arrow-up-wide-short';
        if (text) text.textContent = 'Tăng dần';
    } else {
        if (icon) icon.className = 'fa-solid fa-arrow-down-wide-short';
        if (text) text.textContent = 'Giảm dần';
    }

    const btn = document.getElementById('btnAudioSortDirection');
    if (btn) {
        if (audioSortField === 'default') {
            btn.style.opacity = '0.45';
            btn.style.pointerEvents = 'none';
        } else {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    }
}

function handleAudioFilterDurationChange(val) {
    audioFilterDuration = val;
    renderAudioSearchResults();
}

function handleAudioFilterDownloadChange(val) {
    audioFilterDownload = val;
    renderAudioSearchResults();
}

function handleAudioFilterKeywordChange(val) {
    audioFilterKeyword = val.toLowerCase().trim();
    renderAudioSearchResults();
}

// Render bảng kết quả tìm kiếm YouTube
function renderAudioSearchResults() {
    const tbody = document.getElementById('audioSearchResultsBody');
    const countEl = document.getElementById('audioSearchResultsCount');
    if (!tbody) return;

    if (!rawAudioSearchResults.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Không tìm thấy bài hát nào phù hợp.</td></tr>';
        if (countEl) countEl.textContent = '0 Bài Hát';
        return;
    }

    // 1. Filter
    let list = rawAudioSearchResults.filter(item => {
        // Duration filter
        if (audioFilterDuration === 'short' && item.duration >= 120) return false;
        if (audioFilterDuration === 'medium' && (item.duration < 120 || item.duration > 300)) return false;
        if (audioFilterDuration === 'long' && item.duration <= 300) return false;

        // Download status filter
        if (audioFilterDownload === 'downloaded' && !item.is_downloaded) return false;
        if (audioFilterDownload === 'not_downloaded' && item.is_downloaded) return false;

        // Keyword filter
        if (audioFilterKeyword) {
            const text = `${item.title} ${item.uploader}`.toLowerCase();
            if (!text.includes(audioFilterKeyword)) return false;
        }
        return true;
    });

    // 2. Sort
    if (audioSortField !== 'default') {
        list.sort((a, b) => {
            let va = a[audioSortField];
            let vb = b[audioSortField];
            if (typeof va === 'string') {
                return audioSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return audioSortAsc ? (va - vb) : (vb - va);
        });
    }

    if (countEl) countEl.textContent = `${list.length} / ${rawAudioSearchResults.length} Bài`;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Không có bài nào thỏa mãn bộ lọc hiện tại.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((item, idx) => {
        const btnId = `btnPlayYt_${idx}`;
        const escapedTitle = escapeHtml(item.title).replace(/'/g, "\\'");
        const escapedUrl = escapeHtml(item.url).replace(/'/g, "\\'");
        const isDownloadedBadge = item.is_downloaded
            ? '<span class="badge badge-success" style="font-size:10px;"><i class="fa-solid fa-check"></i> Đã có trong kho</span>'
            : '';

        return `
            <tr>
                <td data-col="col-title">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <img src="${escapeHtml(item.thumbnail)}" alt="Thumb" class="audio-thumb-img" onerror="this.src='/logo/app-logo.png'">
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            <div class="table-text-truncate" style="font-weight:600; color:#fff; max-width:250px;" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                            ${isDownloadedBadge}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="table-text-truncate" style="max-width:160px;" title="${escapeHtml(item.uploader)}">
                        <i class="fa-brands fa-youtube text-danger" style="margin-right:4px;"></i>
                        ${escapeHtml(item.uploader)}
                    </div>
                </td>
                <td><span class="badge badge-secondary">${item.duration_string}</span></td>
                <td>${item.views_formatted}</td>
                <td>${escapeHtml(item.upload_date || '--')}</td>
                <td class="text-center">
                    <button type="button" class="audio-preview-btn has-tooltip" id="${btnId}"
                        onclick="togglePlayAudioPreview('${escapeHtml(item.url)}', '${btnId}', '${escapedTitle}', '${escapeHtml(item.thumbnail)}', '${item.id}')"
                        data-tooltip="Bấm để Nghe Thử">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-primary has-tooltip tooltip-side-left"
                        onclick="openDownloadAudioCategoryModal('${escapedUrl}', '${item.id}', '${escapedTitle}')"
                        data-tooltip="Tải MP3 vào Playlist">
                        <i class="fa-solid fa-cloud-arrow-down"></i> Tải Về
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Modal Chọn Playlist để tải từ kết quả tìm kiếm YouTube
function openDownloadAudioCategoryModal(url, id, title, isManualUrl = false) {
    const urlInputGroup = document.getElementById('downloadAudioUrlInputGroup');
    const customUrlInput = document.getElementById('downloadAudioTrackCustomUrl');
    const hiddenUrlInput = document.getElementById('downloadAudioTrackUrl');
    const hiddenIdInput = document.getElementById('downloadAudioTrackId');
    const subTitle = document.getElementById('downloadAudioTrackTitleSub');

    if (hiddenUrlInput) hiddenUrlInput.value = url || '';
    if (hiddenIdInput) hiddenIdInput.value = id || '';

    if (isManualUrl) {
        if (urlInputGroup) urlInputGroup.style.display = 'block';
        if (customUrlInput) {
            customUrlInput.value = url || '';
            setTimeout(() => customUrlInput.focus(), 100);
        }
        if (subTitle) {
            subTitle.textContent = 'Dán link YouTube để tự động bóc tách MP3 vào Playlist';
            subTitle.title = 'Dán link YouTube để tự động bóc tách MP3 vào Playlist';
        }
    } else {
        if (urlInputGroup) urlInputGroup.style.display = 'none';
        if (subTitle) {
            subTitle.textContent = title || 'Đang chọn bài hát...';
            subTitle.title = title || '';
        }
    }

    // Nạp danh sách categories vào dropdown
    const select = document.getElementById('downloadAudioTargetCategorySelect');
    if (select) {
        if (!cachedAudioCategories.length) {
            select.innerHTML = '<option value="general">Nhạc Nền Tổng Hợp (general)</option>';
        } else {
            select.innerHTML = cachedAudioCategories.map(c => `
                <option value="${escapeHtml(c.id)}" ${c.id === currentSelectedAudioCategory ? 'selected' : ''}>
                    ${escapeHtml(c.display_name || c.name)} (${c.track_count} bài)
                </option>
            `).join('');
        }
    }

    document.getElementById('modalDownloadAudioCategory').classList.add('active');
}

function closeDownloadAudioCategoryModal() {
    document.getElementById('modalDownloadAudioCategory').classList.remove('active');
}

async function confirmDownloadAudioTrack(btn) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Tải Nhạc Nền BGM')) {
        return;
    }
    const urlInputGroup = document.getElementById('downloadAudioUrlInputGroup');
    const isManual = urlInputGroup && urlInputGroup.style.display !== 'none';
    const targetInputId = isManual ? 'downloadAudioTrackCustomUrl' : 'downloadAudioTrackUrl';
    const rawUrl = (document.getElementById(targetInputId)?.value || '').trim();

    if (!rawUrl) {
        markInputError(targetInputId, 'Vui lòng nhập link YouTube cần tải MP3!');
        return;
    }
    if (!isValidYouTubeUrl(rawUrl)) {
        markInputError(targetInputId, 'Link YouTube không đúng định dạng!');
        return;
    }

    const targetCategory = document.getElementById('downloadAudioTargetCategorySelect')?.value || 'general';
    const videoId = document.getElementById('downloadAudioTrackId')?.value;

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải MP3...';
    }

    try {
        const res = await fetch('/api/audio/download-yt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: rawUrl, category: targetCategory })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ Đã tải thành công "${data.title || 'bài hát'}" vào [${targetCategory}]!`, 'success');
            closeDownloadAudioCategoryModal();

            // Đánh dấu is_downloaded = true trong bảng kết quả nếu có videoId
            if (videoId) {
                const item = rawAudioSearchResults.find(x => x.id === videoId);
                if (item) item.is_downloaded = true;
                renderAudioSearchResults();
            }

            // Cập nhật lại thư viện nếu đang mở
            loadAudioCategories();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Lỗi khi tải bài hát'), 'error');
        }
    } catch (err) {
        showToast('Lỗi tải bài hát: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// --------------------------------------------------------------------------
// --- TÍCH HỢP CÀI ĐẶT BGM VÀO KÊNH, STUDIO & CHIẾN DỊCH ---
// --------------------------------------------------------------------------

function populateAllBgmSelects(categories) {
    const cats = categories || cachedAudioCategories || [];

    const makeOptions = (defaultLabel, currentVal, includeInherit = false) => {
        let html = `<option value="">${escapeHtml(defaultLabel)}</option>`;
        if (includeInherit) {
            const isInherit = currentVal === 'inherit' ? 'selected' : '';
            html += `<option value="inherit" ${isInherit}>-- Theo cài đặt BGM của từng Kênh nguồn --</option>`;
        }
        const isAuto = currentVal === 'auto' ? 'selected' : '';
        html += `<option value="auto" ${isAuto}>🤖 Tự Động Chọn Theo Nội Dung (AI Smart Mood)</option>`;
        cats.forEach(c => {
            const isSel = c.id === currentVal ? 'selected' : '';
            html += `<option value="${escapeHtml(c.id)}" ${isSel}>${escapeHtml(c.display_name || c.name)} (${c.track_count || 0} bài)</option>`;
        });
        return html;
    };

    // 1. Modal Kênh YouTube
    const chSel = document.getElementById('settingBgmFolder');
    if (chSel) {
        const val = (chSel.value && chSel.value.trim() !== '') ? chSel.value.trim() : 'inherit';
        let html = `<option value="inherit" ${val === 'inherit' ? 'selected' : ''}>-- 🔗 Kế Thừa Từ Cài Đặt Chiến Dịch (Mặc Định) --</option>`;
        html += `<option value="auto" ${val === 'auto' ? 'selected' : ''}>🤖 Tự Động Chọn Theo Nội Dung (AI Smart Mood)</option>`;
        html += `<option value="none" ${val === 'none' ? 'selected' : ''}>-- 🚫 Tắt Nhạc Nền Riêng Cho Kênh Này --</option>`;
        cats.forEach(c => {
            const isSel = c.id === val ? 'selected' : '';
            html += `<option value="${escapeHtml(c.id)}" ${isSel}>${escapeHtml(c.display_name || c.name)} (${c.track_count || 0} bài)</option>`;
        });
        chSel.innerHTML = html;
        chSel.value = val;
    }

    // 2. Video Studio Recipe
    const stSel = document.getElementById('studioBgmFolder');
    if (stSel) {
        const val = stSel.value;
        stSel.innerHTML = makeOptions('-- Tắt / Không Dùng Nhạc Nền --', val, false);
        if (val) stSel.value = val;
    }

    // 3. New Campaign Modal
    const newCampSel = document.getElementById('campaignBgmFolder');
    if (newCampSel) {
        const val = newCampSel.value;
        newCampSel.innerHTML = makeOptions('-- Tắt / Không Dùng Nhạc Nền --', val, true);
        if (val) newCampSel.value = val;
    }

    // 4. Edit Campaign Modal
    const editCampSel = document.getElementById('editCampaignBgmFolder');
    if (editCampSel) {
        const val = editCampSel.value;
        editCampSel.innerHTML = makeOptions('-- Tắt / Không Dùng Nhạc Nền --', val, true);
        if (val) editCampSel.value = val;
    }
}

async function populateChannelBgmSelect(selectedFolder, selectedVolume) {
    const select = document.getElementById('settingBgmFolder');
    const volInput = document.getElementById('settingBgmVolume');
    const volLabel = document.getElementById('settingBgmVolumeVal');

    if (volInput) volInput.value = selectedVolume != null ? selectedVolume : 0.15;
    if (volLabel) volLabel.textContent = Math.round((selectedVolume != null ? selectedVolume : 0.15) * 100) + '%';

    try {
        if (!cachedAudioCategories.length) {
            const res = await fetch('/api/audio/categories');
            const data = await res.json();
            if (data.status === 'success') cachedAudioCategories = data.categories || [];
        }

        if (select) {
            const targetVal = (selectedFolder && selectedFolder.trim() !== '') ? selectedFolder.trim() : 'inherit';
            let html = `<option value="inherit" ${targetVal === 'inherit' ? 'selected' : ''}>-- 🔗 Kế Thừa Từ Cài Đặt Chiến Dịch (Mặc Định) --</option>`;
            html += `<option value="auto" ${targetVal === 'auto' ? 'selected' : ''}>🤖 Tự Động Chọn Theo Nội Dung (AI Smart Mood)</option>`;
            html += `<option value="none" ${targetVal === 'none' ? 'selected' : ''}>-- 🚫 Tắt Nhạc Nền Riêng Cho Kênh Này --</option>`;
            cachedAudioCategories.forEach(c => {
                const isSel = (c.id === targetVal) ? 'selected' : '';
                html += `<option value="${escapeHtml(c.id)}" ${isSel}>${escapeHtml(c.display_name || c.name)} (${c.track_count || 0} bài)</option>`;
            });
            select.innerHTML = html;
            select.value = targetVal;
        }
    } catch (err) {
        console.error('Lỗi populate BGM categories cho kênh:', err);
    }
}

// Khởi tạo kéo thả Upload file khi tài liệu sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('audioUploadDropzone');
    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleAudioFilesSelected(files);
        }, false);
    }
});


// --- A/B Testing Variants Report Modal (Gap 3 & Gap 5) ---
function openVariantsReportModal() {
    const modal = document.getElementById('modalVariantsReport');
    if (modal) modal.style.display = 'flex';
    loadVariantsReport();
}

function closeVariantsReportModal() {
    const modal = document.getElementById('modalVariantsReport');
    if (modal) modal.style.display = 'none';
}

async function loadVariantsReport() {
    const container = document.getElementById('variantsReportModalBody');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích chỉ số A/B Testing...</div>';

    try {
        const res = await fetch('/api/analytics/variants-report');
        if (!res.ok) throw new Error('Không thể tải báo cáo A/B Testing');
        const data = await res.json();

        const variants = data.variants || {};
        const topHooks = data.top_performing_hooks || [];
        const winning = data.winning_variant;
        const recommendation = data.recommendation || 'Chưa đủ dữ liệu thống kê video để đưa ra kết luận.';

        let html = '';

        // 1. Recommendation Banner
        html += `
        <div style="background:linear-gradient(135deg, rgba(168,85,247,0.15), rgba(0,242,254,0.1)); border:1px solid rgba(168,85,247,0.3); border-radius:8px; padding:14px 16px; margin-bottom:18px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge" style="background:#a855f7; color:#fff; font-size:11px; padding:3px 8px;">
                    <i class="fa-solid fa-trophy"></i> Winner: ${winning || 'Đang theo dõi'}
                </span>
                <span style="font-size:13px; font-weight:700; color:#fff;">Kết Luận Thuật Toán TikTok A/B Testing</span>
            </div>
            <p style="font-size:12.5px; color:var(--text-muted); margin:0; line-height:1.5;">${recommendation}</p>
        </div>`;

        // 2. Comparison Grid (VarA, VarB, VarC)
        const variantConfigs = [
            { key: 'VarA', label: 'Var A: Góc Tò Mò', sub: 'Curiosity Angle', color: '#38bdf8' },
            { key: 'VarB', label: 'Var B: Góc Tranh Luận', sub: 'Controversy Angle', color: '#f59e0b' },
            { key: 'VarC', label: 'Var C: Góc Cao Trào', sub: 'Climax Angle', color: '#ec4899' }
        ];

        html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; margin-bottom:20px;">';
        variantConfigs.forEach(vc => {
            const vData = variants[vc.key] || { total_posts: 0, total_views: 0, avg_views: 0, retention_rate_3s: 0, avg_completion_rate: 0 };
            const isWinner = winning === vc.key;
            html += `
            <div style="background:rgba(255,255,255,0.03); border:1px solid ${isWinner ? vc.color : 'rgba(255,255,255,0.08)'}; border-radius:8px; padding:14px; position:relative;">
                ${isWinner ? `<span style="position:absolute; top:8px; right:8px; background:${vc.color}; color:#000; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px;">WINNER</span>` : ''}
                <div style="font-weight:700; font-size:13px; color:${vc.color}; margin-bottom:2px;">${vc.label}</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:10px;">${vc.sub}</div>
                
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
                    <span style="color:var(--text-muted);">Số clip đã đăng:</span>
                    <strong style="color:#fff;">${vData.total_posts}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
                    <span style="color:var(--text-muted);">Lượt view trung bình:</span>
                    <strong style="color:#fff;">${Math.round(vData.avg_views || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
                    <span style="color:var(--text-muted);">Giữ chân 3s đầu:</span>
                    <strong style="color:${vData.retention_rate_3s >= 60 ? '#10b981' : '#f59e0b'};">${vData.retention_rate_3s || 0}%</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px;">
                    <span style="color:var(--text-muted);">Tỷ lệ xem hết:</span>
                    <strong style="color:#fff;">${vData.avg_completion_rate || 0}%</strong>
                </div>
            </div>`;
        });
        html += '</div>';

        // 3. Top Winning Hooks Table
        html += `
        <div style="margin-top:10px;">
            <h4 style="font-size:13px; color:#fff; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-bolt text-yellow"></i> Top Các Câu Hook 3.5s Có Lượt View Cao Nhất
            </h4>`;

        if (topHooks.length === 0) {
            html += '<div class="text-center py-3 text-muted" style="font-size:12px; background:rgba(255,255,255,0.02); border-radius:6px;">Chưa có dữ liệu thống kê câu hook. Hệ thống sẽ tích lũy sau các đợt quét video.</div>';
        } else {
            html += '<div style="overflow-x:auto;"><table class="table" style="font-size:12px; width:100%;">';
            html += '<thead><tr><th>Câu Hook 3.5s</th><th>Biến thể</th><th>Lượt Xem</th><th>Retention 3s</th></tr></thead><tbody>';
            topHooks.forEach(th => {
                const ret3s = th.views_count > 0 ? Math.round((th.views_3s_count / th.views_count) * 100) : 0;
                html += `
                <tr>
                    <td style="font-weight:700; color:#fff;">${th.hook_copy || 'N/A'}</td>
                    <td><span class="badge badge-info" style="font-size:10px;">${th.variant_tag || 'Standard'}</span></td>
                    <td style="color:#00f2fe;">${(th.views_count || 0).toLocaleString()}</td>
                    <td style="color:${ret3s >= 60 ? '#10b981' : '#f59e0b'};">${ret3s}%</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="text-center py-4 text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi tải báo cáo: ${e.message}</div>`;
    }
}

function syncCampaignVariantModeUI(type, mode) {
    const isVariants = (mode === 'variants');
    const pfx = (type === 'edit') ? 'editCampaign' : 'campaign';

    const hookAngleWrap = document.getElementById(`${pfx}HookAngleWrap`);
    const noticeWrap = document.getElementById(`${pfx}VariantsNoticeWrap`);
    const clipsCol = document.getElementById(`${pfx}ClipsColWrap`);
    const genCheck = document.getElementById(`${pfx}GenerateVariants`);
    const partSwitch = document.getElementById(`${pfx}AddPartLabelSwitch`);

    if (genCheck) genCheck.checked = isVariants;

    if (isVariants) {
        if (hookAngleWrap) hookAngleWrap.style.display = 'none';
        if (noticeWrap) noticeWrap.style.display = 'block';
        if (clipsCol) clipsCol.style.display = 'none';
        if (partSwitch) partSwitch.checked = false;
    } else {
        if (hookAngleWrap) hookAngleWrap.style.display = 'block';
        if (noticeWrap) noticeWrap.style.display = 'none';
        if (clipsCol) clipsCol.style.display = 'block';
        if (partSwitch) partSwitch.checked = true;
    }
}

function syncChannelVariantModeUI(mode) {
    const hookAngleWrap = document.getElementById('settingChannelHookAngleWrap');
    const noticeWrap = document.getElementById('settingChannelVariantsNoticeWrap');
    if (mode === 'variants') {
        if (hookAngleWrap) hookAngleWrap.style.display = 'none';
        if (noticeWrap) noticeWrap.style.display = 'block';
    } else {
        if (hookAngleWrap) hookAngleWrap.style.display = 'block';
        if (noticeWrap) noticeWrap.style.display = 'none';
    }
}


/* ─── CAMPAIGN MODAL TABS & MULTI-SOURCE & RSS MANAGEMENT ─── */
/* ─── SOURCE STEP TABS (YouTube / Folder) inside Campaign Modals ─── */
function switchSourceStepTab(prefix, tabName) {
    // tabName is 'yt' or 'folder'
    const tabs = ['yt', 'folder'];
    tabs.forEach(t => {
        const btn = document.getElementById(`${prefix}SourceTabBtn_${t}`);
        const pane = document.getElementById(`${prefix}SourcePane_${t}`);
        if (btn) {
            if (t === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (pane) {
            pane.style.display = (t === tabName) ? 'block' : 'none';
        }
    });
}
window.switchSourceStepTab = switchSourceStepTab;

function updateSourceModeBadge(prefix) {
    const badge = document.getElementById(`${prefix}SourceModeBadge`);
    if (!badge) return;

    const chPrefix = (prefix === 'new') ? '' : 'edit-';
    const chClass = (prefix === 'new') ? '.campaign-ch-check:checked' : '.edit-campaign-ch-check:checked';
    const folderInputId = (prefix === 'new') ? 'campaignLocalFolderInput' : 'editCampaignLocalFolderInput';

    const checkedCount = document.querySelectorAll(chClass).length;
    const folderVal = (document.getElementById(folderInputId)?.value || '').trim();
    const hasChannels = checkedCount > 0;
    const hasFolder = folderVal.length > 0;

    if (hasChannels && hasFolder) {
        badge.className = 'badge badge-success';
        badge.innerHTML = '<i class="fa-solid fa-layer-group"></i> Nguồn: ' + checkedCount + ' Kênh YouTube + Thư Mục';
    } else if (hasChannels) {
        badge.className = 'badge badge-info';
        badge.innerHTML = '<i class="fa-brands fa-youtube"></i> Nguồn: ' + checkedCount + ' Kênh YouTube';
    } else if (hasFolder) {
        badge.className = 'badge badge-warning';
        badge.innerHTML = '<i class="fa-solid fa-folder-open"></i> Nguồn: Thư Mục Cục Bộ';
    } else {
        badge.className = 'badge badge-secondary';
        badge.innerHTML = '<i class="fa-solid fa-question-circle"></i> Chưa chọn nguồn';
    }
}
window.updateSourceModeBadge = updateSourceModeBadge;

async function scanCampaignLocalFolder(prefix) {
    const input = document.getElementById(prefix === 'new' ? 'campaignLocalFolderInput' : `${prefix}CampaignLocalFolderInput`) || document.getElementById(`${prefix}CampaignLocalFolderInput`);
    const statusEl = document.getElementById(prefix === 'new' ? 'campaignLocalFolderStats' : `${prefix}CampaignLocalFolderStats`) || document.getElementById(`${prefix}CampaignLocalScanStatus`);
    const folder = input ? input.value.trim() : '';
    if (!folder) {
        showToast('⚠️ Vui lòng nhập đường dẫn thư mục video trên máy tính!', 'warning');
        return;
    }
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-cyan"></i> Đang quét thư mục video...';
    fetch('/api/v2/pipeline/scan_folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folder })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success' || data.success) {
                const count = data.count || data.files?.length || 0;
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Đã tìm thấy ${count} video hợp lệ (.mp4, .mov, .mkv) trong thư mục!</span>`;
                }
                showToast(`✅ Đã tìm thấy ${count} video sẵn sàng trong thư mục!`, 'success');
            } else {
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-circle-exclamation"></i> Không thể quét thư mục: ${data.message || 'Lỗi không xác định'}</span>`;
                }
                showToast('⚠️ Không thể quét thư mục: ' + (data.message || 'Lỗi'), 'warning');
            }
        })
        .catch(err => {
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi kết nối khi quét thư mục</span>`;
            }
            showToast('Lỗi quét thư mục: ' + err.message, 'error');
        });
}
window.scanCampaignLocalFolder = scanCampaignLocalFolder;

window.syncAllRssSwitches = function (enabled) {
    const swBanner = document.getElementById('bannerRssToggleSwitch');
    const lblBanner = document.getElementById('bannerRssStatusLabel');
    if (swBanner) swBanner.checked = enabled;
    if (lblBanner) {
        lblBanner.textContent = enabled ? 'Đang BẬT' : 'ĐÃ TẮT';
        lblBanner.style.color = enabled ? 'var(--accent-cyan)' : '#f87171';
    }

    const swVm = document.getElementById('toggleRssScanSwitch');
    const lblVm = document.getElementById('lblRssStatus');
    if (swVm) swVm.checked = enabled;
    if (lblVm) {
        lblVm.innerText = enabled ? 'RSS: BẬT' : 'RSS: ĐÃ TẮT';
        lblVm.style.color = enabled ? '#38bdf8' : '#f87171';
    }

    const step1Badge = document.getElementById('step1RssBadge');
    if (step1Badge) {
        if (enabled) {
            step1Badge.className = 'badge badge-success';
            step1Badge.innerHTML = '<i class="fa-solid fa-signal"></i> RSS: BẬT';
        } else {
            step1Badge.className = 'badge badge-warning';
            step1Badge.innerHTML = '<i class="fa-solid fa-ban"></i> RSS: TẮT';
        }
    }
};

window.togglePipelineRss = async function (enabled) {
    try {
        const res = await fetch('/api/v2/pipeline/toggle_rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: Boolean(enabled) })
        });
        const data = await res.json();
        const state = (data.rss_scan_enabled !== undefined) ? data.rss_scan_enabled : enabled;
        syncAllRssSwitches(state);
        showToast(state ? '📡 Đã BẬT tự động quét RSS YouTube!' : '⏸️ Đã TẮT quét RSS YouTube. Hệ thống chỉ xử lý video từ thư mục!', 'info');
    } catch (e) {
        console.error('Lỗi chuyển chế độ RSS:', e);
        showToast('Lỗi cập nhật RSS: ' + e.message, 'error');
    }
};

async function loadInitialRssAndHost() {
    try {
        const resRss = await fetch('/api/v2/pipeline/rss_status');
        const dataRss = await resRss.json();
        if (dataRss && dataRss.rss_scan_enabled !== undefined) {
            syncAllRssSwitches(dataRss.rss_scan_enabled);
        }
    } catch (e) { }

    try {
        const resHost = await fetch('/api/v2/system/info');
        const dataHost = await resHost.json();
        if (dataHost && dataHost.computer_name) {
            const el = document.getElementById('sidebarComputerName');
            if (el) el.textContent = dataHost.computer_name;
        }
    } catch (e) { }
}

window.handleVisualSourceChange = function (el, targetWrapId) {
    if (!el) return;
    const isStock = el.value === 'stock' || el.value === 'mixed';
    const target = document.getElementById(targetWrapId);
    if (target) {
        target.style.display = isStock ? 'block' : 'none';
    }
};

// Module Window Exposures
window.closeAudioPreviewDock = closeAudioPreviewDock;
window.closeAudioSettingsModal = closeAudioSettingsModal;
window.closeCreateAudioCategoryModal = closeCreateAudioCategoryModal;
window.closeDownloadAudioCategoryModal = closeDownloadAudioCategoryModal;
window.closeEditCategoryModal = closeEditCategoryModal;
window.closeVariantsReportModal = closeVariantsReportModal;
window.confirmDownloadAudioTrack = confirmDownloadAudioTrack;
window.deleteAudioTrack = deleteAudioTrack;
window.deleteCategoryPrompt = deleteCategoryPrompt;
window.downloadDirectYtAudio = downloadDirectYtAudio;
window.filterAudioFoldersPopover = filterAudioFoldersPopover;
window.handleAudioFilesSelected = handleAudioFilesSelected;
window.handleAudioFilterDownloadChange = handleAudioFilterDownloadChange;
window.handleAudioFilterDurationChange = handleAudioFilterDurationChange;
window.handleAudioFilterKeywordChange = handleAudioFilterKeywordChange;
window.handleAudioHeaderSort = handleAudioHeaderSort;
window.handleAudioSortChange = handleAudioSortChange;
window.loadAudioCategories = loadAudioCategories;
window.loadAudioTracks = loadAudioTracks;
window.openAudioSettingsModal = openAudioSettingsModal;
window.openCreateAudioCategoryModal = openCreateAudioCategoryModal;
window.openDownloadAudioCategoryModal = openDownloadAudioCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.openVariantsReportModal = openVariantsReportModal;
window.populateAllBgmSelects = populateAllBgmSelects;
window.populateChannelBgmSelect = populateChannelBgmSelect;
window.refreshAudioLibrary = refreshAudioLibrary;
window.saveAudioSettings = saveAudioSettings;
window.saveCategoryRename = saveCategoryRename;
window.scanCampaignLocalFolder = scanCampaignLocalFolder;
window.searchYouTubeAudio = searchYouTubeAudio;
window.selectAudioCategory = selectAudioCategory;
window.submitCreateAudioCategory = submitCreateAudioCategory;
window.switchAudioSubTab = switchAudioSubTab;
window.switchSourceStepTab = switchSourceStepTab;
window.syncCampaignVariantModeUI = syncCampaignVariantModeUI;
window.syncChannelVariantModeUI = syncChannelVariantModeUI;
window.toggleAudioFoldersPopover = toggleAudioFoldersPopover;
window.toggleAudioSortDirection = toggleAudioSortDirection;
window.toggleDockPlayPause = toggleDockPlayPause;
window.togglePlayAudioPreview = togglePlayAudioPreview;
