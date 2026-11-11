// ==========================================
// 10. VIDEO STUDIO & RECIPE LOGIC
// ==========================================
let studioSearchQuery = '';
let studioChannelFilter = '';
let studioDisplayLimit = 30;

async function loadStudioVideos() {
    const listEl = document.getElementById('studioVideoList');
    const badge = document.getElementById('studioVideoCountBadge');
    try {
        const res = await fetch('/api/video/list');
        const videos = await res.json();
        cachedVideos = videos;
        if (badge) badge.textContent = `${videos.length} Video`;

        populateStudioChannelFilter();
        if (!currentStudioFilter) currentStudioFilter = 'all';
        document.getElementById('btnFilterAllVideos')?.classList.toggle('active', currentStudioFilter === 'all');
        document.getElementById('btnFilterUnrenderedVideos')?.classList.toggle('active', currentStudioFilter === 'unrendered');
        document.getElementById('btnFilterRenderedVideos')?.classList.toggle('active', currentStudioFilter === 'rendered');
        renderStudioVideoList();

        // If no active video selected, pick the first video
        if (!activeStudioVideo && videos.length > 0) {
            selectStudioVideo(videos[0].yt_video_id || videos[0].id);
        }
    } catch (err) {
        console.error('Lỗi nạp video studio:', err);
    }
}

async function refreshStudioVideos() {
    const icon = document.getElementById('iconRefreshStudio');
    if (icon) icon.classList.add('fa-spin');
    showToast('Đang quét và đồng bộ thư mục video với hệ thống...');
    try {
        const res = await fetch('/api/video/sync', { method: 'POST' });
        const data = await res.json();
        await loadStudioVideos();
        showToast('✅ ' + (data.message || 'Đã làm mới thư viện video'));
    } catch (err) {
        showToast('Lỗi đồng bộ: ' + err.message, true);
    } finally {
        if (icon) {
            setTimeout(() => icon.classList.remove('fa-spin'), 600);
        }
    }
}

function filterStudioVideos(filter) {
    currentStudioFilter = filter;
    studioDisplayLimit = 30;
    document.getElementById('btnFilterAllVideos')?.classList.toggle('active', filter === 'all');
    document.getElementById('btnFilterUnrenderedVideos')?.classList.toggle('active', filter === 'unrendered');
    document.getElementById('btnFilterRenderedVideos')?.classList.toggle('active', filter === 'rendered');
    renderStudioVideoList();
}

function onStudioSearchInput(val) {
    studioSearchQuery = (val || '').toLowerCase().trim();
    studioDisplayLimit = 30;
    renderStudioVideoList();
}

function onStudioChannelFilterChange(val) {
    studioChannelFilter = val || '';
    studioDisplayLimit = 30;
    renderStudioVideoList();
}

function clearStudioFilters() {
    studioSearchQuery = '';
    studioChannelFilter = '';
    studioDisplayLimit = 30;
    const sInput = document.getElementById('studioSearchInput');
    const chSelect = document.getElementById('studioChannelFilterSelect');
    if (sInput) sInput.value = '';
    if (chSelect) chSelect.value = '';
    renderStudioVideoList();
}

function loadMoreStudioVideos() {
    studioDisplayLimit += 30;
    renderStudioVideoList();
}

function populateStudioChannelFilter() {
    const select = document.getElementById('studioChannelFilterSelect');
    if (!select) return;
    const currentVal = select.value;
    const channels = Array.from(new Set(cachedVideos.map(v => v.channel_name).filter(Boolean))).sort();
    let html = '<option value="">Tất cả kênh nguồn (' + cachedVideos.length + ' video)</option>';
    channels.forEach(ch => {
        const count = cachedVideos.filter(v => v.channel_name === ch).length;
        html += `<option value="${escapeHtml(ch)}">${escapeHtml(ch)} (${count})</option>`;
    });
    select.innerHTML = html;
    if (channels.includes(currentVal)) {
        select.value = currentVal;
    }
}

function renderStudioVideoList() {
    const listEl = document.getElementById('studioVideoList');
    const badge = document.getElementById('studioVideoCountBadge');
    if (!listEl) return;

    let filtered = cachedVideos;
    // 1. Lọc theo quy trình: Chưa Render vs Đã Render 9:16
    if (currentStudioFilter === 'unrendered') {
        filtered = filtered.filter(v => !v.has_rendered && v.status !== 'rendered' && (!v.rendered_parts || v.rendered_parts.length === 0));
    } else if (currentStudioFilter === 'rendered') {
        filtered = filtered.filter(v => v.has_rendered || v.status === 'rendered' || (v.rendered_parts && v.rendered_parts.length > 0));
    }

    // 2. Lọc theo kênh nguồn
    if (studioChannelFilter) {
        filtered = filtered.filter(v => (v.channel_name || '').toLowerCase() === studioChannelFilter.toLowerCase());
    }

    // 3. Tìm kiếm tức thì theo từ khóa
    if (studioSearchQuery) {
        filtered = filtered.filter(v => {
            const titleMatch = (v.title || '').toLowerCase().includes(studioSearchQuery);
            const idMatch = (v.yt_video_id || '').toLowerCase().includes(studioSearchQuery) || String(v.id).includes(studioSearchQuery);
            const chMatch = (v.channel_name || '').toLowerCase().includes(studioSearchQuery);
            return titleMatch || idMatch || chMatch;
        });
    }

    // Cập nhật số lượng video hiển thị
    if (badge) {
        if (filtered.length !== cachedVideos.length) {
            badge.textContent = `${filtered.length} / ${cachedVideos.length} Video`;
        } else {
            badge.textContent = `${cachedVideos.length} Video`;
        }
    }

    if (!filtered.length) {
        listEl.innerHTML = `<div class="text-center py-4 text-muted" style="font-size:12px;"><i class="fa-solid fa-magnifying-glass"></i> Không có video phù hợp bộ lọc tìm kiếm.</div>`;
        return;
    }

    const visibleItems = filtered.slice(0, studioDisplayLimit);
    let html = visibleItems.map(v => {
        const isSelected = activeStudioVideo && (activeStudioVideo.id === v.id || activeStudioVideo.yt_video_id === v.yt_video_id);
        const isRendered = v.status === 'rendered' || (v.rendered_parts && v.rendered_parts.length > 0);

        // Hiển thị danh sách các part đã cắt từ video này
        let partsPills = '';
        if (v.rendered_parts && v.rendered_parts.length > 0) {
            partsPills = `
                <div class="svc-parts-container" onclick="event.stopPropagation();">
                    <span style="font-size:11px; color:var(--text-muted); align-self:center; flex-shrink:0;">Parts:</span>
                    ${v.rendered_parts.map(p => `
                        <span class="badge ${activeStudioVideo && activeStudioVideo.id === v.id && activePlaybackType === 'rendered' && activePlaybackPart === p.part ? 'badge-cyan' : 'badge-secondary'}" 
                            style="cursor:pointer; font-size:10.5px; padding:2px 8px; border-radius:4px; flex-shrink:0;" 
                            onclick="selectStudioVideo('${v.yt_video_id || v.id}', 'rendered', ${p.part})"
                            title="Bấm để phát nhanh ${p.tag || ('Part ' + p.part)}">
                            ${p.tag || ('Part ' + p.part)}
                        </span>
                    `).join('')}
                </div>
            `;
        }

        const vKey = String(v.yt_video_id || v.id);
        return `
            <div class="studio-video-card ${isSelected ? 'selected' : ''}" onclick="selectStudioVideo('${vKey}')">
                <div class="svc-header">
                    <div class="svc-title" title="${escapeHtml(v.title || '')}">${escapeHtml(v.title || 'Video #' + v.id)}</div>
                    <div class="svc-actions">
                        <button type="button" class="btn-svc-more" onclick="toggleStudioVideoPopover(event, '${vKey}')" title="Tùy chọn video">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div class="svc-popover" id="svcPopover_${vKey}" onclick="event.stopPropagation()">
                            <button type="button" class="svc-popover-item" onclick="openEditStudioVideoModal('${vKey}')">
                                <i class="fa-solid fa-pen-to-square text-cyan"></i> Chỉnh Sửa Video
                            </button>
                            <button type="button" class="svc-popover-item" onclick="selectStudioVideo('${vKey}')">
                                <i class="fa-solid fa-wand-magic-sparkles text-purple"></i> Mở Biên Tập
                            </button>
                            <button type="button" class="svc-popover-item text-danger" onclick="confirmDeleteStudioVideo('${vKey}')">
                                <i class="fa-solid fa-trash-can"></i> Xóa Video
                            </button>
                        </div>
                    </div>
                </div>
                <div class="svc-meta" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <span style="font-size:11.5px; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${v.duration || 65}s</span>
                    <span class="badge badge-info" style="font-size:10.5px; padding:3px 8px; max-width:135px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(v.channel_name || 'Dán trực tiếp')}">
                        <i class="fa-brands fa-youtube" style="color:#fe2c55; font-size:11px;"></i> ${escapeHtml(v.channel_name || 'Dán trực tiếp')}
                    </span>
                    ${isRendered
                ? `<span class="badge badge-success" style="font-size:10.5px; padding:3px 8px;"><i class="fa-solid fa-check"></i> ${v.rendered_parts && v.rendered_parts.length > 1 ? v.rendered_parts.length + ' Parts' : '9:16'}</span>`
                : '<span class="badge badge-warning" style="font-size:10.5px; padding:3px 8px;">Gốc</span>'}
                </div>
                ${partsPills}
            </div>
        `;
    }).join('');

    // Nút xem thêm nếu danh sách còn video phía sau
    if (filtered.length > studioDisplayLimit) {
        const remaining = filtered.length - studioDisplayLimit;
        html += `
            <button type="button" class="btn btn-secondary btn-sm" onclick="loadMoreStudioVideos()" style="width:100%; margin-top:6px; font-size:11.5px; padding:7px;">
                <i class="fa-solid fa-angles-down"></i> Xem thêm 30 video (còn ${remaining} video)
            </button>
        `;
    }

    listEl.innerHTML = html;
}

function toggleStudioVideoPopover(e, videoKey) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const currentActive = document.querySelector('.svc-popover.active');
    const targetPopover = document.getElementById(`svcPopover_${videoKey}`);
    if (currentActive && currentActive !== targetPopover) {
        currentActive.classList.remove('active');
    }
    if (targetPopover) {
        targetPopover.classList.toggle('active');
    }
}

// Global click dismiss for video card popovers
document.addEventListener('click', (e) => {
    if (!e.target.closest('.svc-actions')) {
        document.querySelectorAll('.svc-popover.active').forEach(p => p.classList.remove('active'));
    }
});

function openEditStudioVideoModal(videoKey) {
    document.querySelectorAll('.svc-popover.active').forEach(p => p.classList.remove('active'));
    const v = cachedVideos.find(item => item.id == videoKey || item.yt_video_id === videoKey);
    if (!v) return;
    const modal = document.getElementById('modalEditStudioVideo');
    const idInput = document.getElementById('editStudioVideoId');
    const titleInput = document.getElementById('editStudioVideoTitle');
    if (idInput) idInput.value = v.yt_video_id || v.id;
    if (titleInput) titleInput.value = v.title || '';
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        setTimeout(() => titleInput?.focus(), 100);
    }
}

function closeEditStudioVideoModal() {
    const modal = document.getElementById('modalEditStudioVideo');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

async function saveStudioVideoEdit(btn) {
    const idInput = document.getElementById('editStudioVideoId');
    const titleInput = document.getElementById('editStudioVideoTitle');
    const videoKey = idInput?.value;
    const newTitle = titleInput?.value.trim();
    if (!videoKey) return;
    if (!newTitle) {
        markInputError(titleInput, 'Vui lòng nhập tiêu đề cho video!');
        return;
    }

    const orig = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    try {
        const res = await fetch(`/api/video/${videoKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('✅ Đã cập nhật tiêu đề video thành công!', 'success');
            closeEditStudioVideoModal();
            // Update in cachedVideos
            const item = cachedVideos.find(v => v.id == videoKey || v.yt_video_id === videoKey);
            if (item) item.title = newTitle;
            if (activeStudioVideo && (activeStudioVideo.id == videoKey || activeStudioVideo.yt_video_id === videoKey)) {
                activeStudioVideo.title = newTitle;
                const titleEl = document.getElementById('studioActiveVideoTitle');
                if (titleEl) titleEl.textContent = newTitle;
            }
            renderStudioVideoList();
        } else {
            showToast('Lỗi cập nhật: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }
}

async function confirmDeleteStudioVideo(videoKey) {
    document.querySelectorAll('.svc-popover.active').forEach(p => p.classList.remove('active'));
    const v = cachedVideos.find(item => item.id == videoKey || item.yt_video_id === videoKey);
    const videoTitle = v ? (v.title || `Video #${v.id}`) : 'video này';

    const confirmed = await showConfirmDialog({
        title: 'Xác Nhận Xóa Video',
        message: `Bạn có chắc muốn xóa video "${videoTitle}"?`,
        details: 'File video gốc và toàn bộ các Part 9:16 đã render trên ổ đĩa sẽ bị xóa vĩnh viễn.',
        confirmText: 'Xác Nhận Xóa',
        confirmClass: 'btn-danger'
    });
    if (!confirmed) return;

    showToast('Đang xóa video và dọn dẹp file...');
    try {
        const res = await fetch(`/api/video/${videoKey}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã xóa video thành công!'}`, 'success');
            // Remove from cachedVideos
            cachedVideos = cachedVideos.filter(item => item.id != videoKey && item.yt_video_id !== videoKey);
            if (activeStudioVideo && (activeStudioVideo.id == videoKey || activeStudioVideo.yt_video_id === videoKey)) {
                activeStudioVideo = cachedVideos.length > 0 ? cachedVideos[0] : null;
            }
            populateStudioChannelFilter();
            renderStudioVideoList();
            if (activeStudioVideo) {
                selectStudioVideo(activeStudioVideo.yt_video_id || activeStudioVideo.id);
            }
            // Also refresh other tables if needed
            loadVideos();
            loadDashboardStats();
        } else {
            showToast('Lỗi khi xóa video: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối khi xóa video: ' + err.message, 'error');
    }
}

let activePlaybackType = 'auto'; // 'original' hoặc 'rendered'
let activePlaybackPart = 1;

function updateStudioShortFormVisibility(isShort) {
    const clipsGroup = document.getElementById('studioClipsPerVideoGroup');
    const partWrap = document.getElementById('studioAddPartLabelWrap');
    const shortNotice = document.getElementById('studioShortNotice');
    const isVariants = document.getElementById('studioGenerateVariants')?.checked ?? false;

    if (isShort) {
        if (clipsGroup) clipsGroup.style.display = 'none';
        if (partWrap) partWrap.style.display = 'none';
        if (shortNotice) shortNotice.style.display = 'block';
    } else {
        if (shortNotice) shortNotice.style.display = 'none';
        if (isVariants) {
            if (clipsGroup) clipsGroup.style.display = 'none';
            if (partWrap) partWrap.style.display = 'none';
        } else {
            if (clipsGroup) clipsGroup.style.display = 'block';
            if (partWrap) partWrap.style.display = 'flex';
        }
    }
}

function syncStudioVariantModeUI(mode) {
    const isVariants = (mode === 'variants');
    const durVal = parseFloat(activeStudioVideo?.duration) || 0;
    const isShort = activeStudioVideo && ((durVal > 0 && durVal <= 180) || activeStudioVideo.is_short === true || activeStudioVideo.is_short === 1);

    const hookAngleWrap = document.getElementById('studioHookAngleWrap');
    const noticeWrap = document.getElementById('studioVariantsNoticeWrap');
    const clipsGroup = document.getElementById('studioClipsPerVideoGroup');
    const partWrap = document.getElementById('studioAddPartLabelWrap');
    const genVariantsCheck = document.getElementById('studioGenerateVariants');

    if (genVariantsCheck) {
        genVariantsCheck.checked = isVariants;
    }

    if (isVariants) {
        // Khi chọn 3 Biến Thể A/B/C: Tự động ẩn góc Hook, ẩn Số clip cắt và ẩn Đóng dấu PART X
        if (hookAngleWrap) hookAngleWrap.style.display = 'none';
        if (noticeWrap) noticeWrap.style.display = 'block';
        if (clipsGroup) clipsGroup.style.display = 'none';
        if (partWrap) partWrap.style.display = 'none';
    } else {
        // Khi chọn 1 Clip Tốt Nhất: Hiện góc Hook, và nếu là video dài thì hiện lại Số clip cắt & Đóng dấu PART
        if (hookAngleWrap) hookAngleWrap.style.display = 'block';
        if (noticeWrap) noticeWrap.style.display = 'none';
        if (!isShort) {
            if (clipsGroup) clipsGroup.style.display = 'block';
            if (partWrap) partWrap.style.display = 'flex';
        }
    }
}

function selectStudioVideo(videoId, playType = null, partNum = 1) {
    const v = cachedVideos.find(item => item.id == videoId || item.yt_video_id === videoId);
    if (!v) return;
    activeStudioVideo = v;

    if (playType) {
        activePlaybackType = playType;
        activePlaybackPart = partNum;
    } else {
        if (currentStudioFilter === 'unrendered') {
            activePlaybackType = 'original';
            activePlaybackPart = 1;
        } else if (currentStudioFilter === 'rendered') {
            activePlaybackType = 'rendered';
            activePlaybackPart = 1;
        } else {
            activePlaybackType = (v.has_rendered || (v.rendered_parts && v.rendered_parts.length > 0)) ? 'rendered' : 'original';
            activePlaybackPart = 1;
        }
    }

    renderStudioVideoList();
    ensureAudioCategoriesLoaded();

    // Ẩn/hiện "Số clip cắt" và "Đóng dấu PART X" nếu là video short-form (<= 180s / 3 phút)
    const durVal = parseFloat(v.duration) || 0;
    const isShortForm = (durVal > 0 && durVal <= 180) || v.is_short === true || v.is_short === 1;
    updateStudioShortFormVisibility(isShortForm);

    // Update active video info bar
    const titleEl = document.getElementById('studioActiveVideoTitle');
    const statusEl = document.getElementById('studioMetaStatus');
    const durEl = document.getElementById('studioMetaDuration');
    const chEl = document.getElementById('studioMetaChannel');
    const hiddenId = document.getElementById('studioActiveYtVideoId');

    if (titleEl) titleEl.textContent = v.title || `Video #${v.id}`;
    if (durEl) durEl.textContent = `${v.duration || 65}s`;
    if (chEl) chEl.textContent = v.channel_name || 'Dán trực tiếp';
    if (statusEl) {
        const isRen = v.status === 'rendered' || (v.rendered_parts && v.rendered_parts.length > 0);
        statusEl.textContent = isRen ? 'Đã Render 9:16' : 'Chưa Render';
        statusEl.className = `badge ${isRen ? 'badge-success' : 'badge-warning'}`;
    }
    if (hiddenId) hiddenId.value = v.yt_video_id || v.id;

    // Render Version Switcher Bar (Chỉ hiển thị khi có các Part đã cắt)
    renderStudioVersionsBar(v);

    // Update Phone Mockup Overlay
    const captionEl = document.getElementById('ttOverlayCaption');
    const partBadge = document.getElementById('ttOverlayPartBadge');
    if (captionEl) {
        captionEl.textContent = (v.ai_title || v.title || 'Video ngắn viral TikTok Beta') + ' ' + (v.ai_tags || '#fyp #xuhuong');
    }
    const shortsTitle = document.getElementById('shortsOverlayTitle');
    const shortsChannel = document.getElementById('shortsOverlayChannel');
    const reelsCaption = document.getElementById('reelsOverlayCaption');
    const reelsPage = document.getElementById('reelsOverlayPage');
    if (shortsTitle) shortsTitle.textContent = (v.ai_title || v.title || 'Video ngắn viral') + ' #shorts';
    if (shortsChannel) shortsChannel.textContent = v.channel_title ? `@${v.channel_title.replace(/\s+/g, '').toLowerCase()}` : '@creator';
    if (reelsCaption) reelsCaption.textContent = (v.ai_title || v.title || 'Video ngắn viral') + ' #reels';
    if (reelsPage) reelsPage.textContent = v.channel_title || 'Fanpage Official';
    if (partBadge) {
        if (activePlaybackType === 'original') {
            partBadge.textContent = 'VIDEO GỐC';
            partBadge.style.background = 'rgba(234, 179, 8, 0.85)';
        } else {
            const curRp = v.rendered_parts ? v.rendered_parts.find(p => p.part === activePlaybackPart) : null;
            const tagLabel = curRp && curRp.tag ? curRp.tag : `PART ${activePlaybackPart}`;
            partBadge.textContent = `${tagLabel} (9:16)`;
            partBadge.style.background = 'rgba(0, 242, 254, 0.85)';
        }
    }

    // Update Video Player Source
    const player = document.getElementById('studioVideoPlayer');
    const source = document.getElementById('studioVideoSource');
    if (player && source) {
        let playUrl = '';
        if (activePlaybackType === 'original' && v.raw_url) {
            playUrl = v.raw_url;
        } else if (activePlaybackType === 'rendered' && v.rendered_parts && v.rendered_parts.length > 0) {
            const targetPart = v.rendered_parts.find(p => p.part === activePlaybackPart) || v.rendered_parts[0];
            playUrl = targetPart.url;
        } else {
            playUrl = v.media_url || '';
        }

        if (playUrl) {
            source.src = playUrl;
            player.onloadedmetadata = () => {
                if (player.duration && isFinite(player.duration)) {
                    if (activePlaybackType === 'original' && (!v.duration || v.duration === 0)) {
                        v.duration = Math.round(player.duration);
                    }
                    // Kiểm tra Short-form LUÔN dựa trên thời lượng video gốc (v.duration), tuyệt đối KHÔNG dùng thời lượng của Part đã render (player.duration)!
                    const origDur = parseFloat(v.duration) || 0;
                    const isShort = (origDur > 0 && origDur <= 180) || v.is_short === true || v.is_short === 1;
                    updateStudioShortFormVisibility(isShort);
                }
            };
            player.load();
        } else {
            source.src = '';
        }
    }
}

function renderStudioVersionsBar(v) {
    const bar = document.getElementById('studioVideoVersionsBar');
    if (bar) bar.innerHTML = '';
}

function applyStudioPreset(preset) {
    const ratio = document.getElementById('studioAspectRatio');
    const durationRange = document.getElementById('studioDurationRange');
    const durationVal = document.getElementById('studioDurationVal');
    const flip = document.getElementById('studioFlipHorizontal');
    const speed = document.getElementById('studioSpeedFactor');
    const part = document.getElementById('studioAddPartLabel');
    const hook = document.getElementById('studioGenerateAiHook');

    if (preset === 'beta-standard') {
        if (ratio) ratio.value = '9:16_blur';
        if (durationRange) durationRange.value = 65;
        if (durationVal) durationVal.textContent = '65s';
        if (flip) flip.checked = true;
        if (speed) speed.checked = true;
        if (part) part.checked = true;
        if (hook) hook.checked = true;
    } else if (preset === 'shorts-fast') {
        if (ratio) ratio.value = '9:16_crop';
        if (durationRange) durationRange.value = 45;
        if (durationVal) durationVal.textContent = '45s';
        if (flip) flip.checked = true;
        if (speed) speed.checked = true;
        if (part) part.checked = false;
        if (hook) hook.checked = true;
    }
}

function toggleStudioPlayback() {
    const player = document.getElementById('studioVideoPlayer');
    const btn = document.getElementById('btnStudioPlayToggle');
    if (!player) return;
    if (player.paused) {
        player.play().catch(e => console.warn('Autoplay prevented:', e));
        if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> Dừng Video';
    } else {
        player.pause();
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Phát Video';
    }
}

function handleCampaignClipsInputChange(mode, val) {
    let num = parseInt(val, 10);
    const input = mode === 'new'
        ? document.getElementById('campaignClipsPerVideoInput')
        : document.getElementById('editCampaignClipsPerVideoInput');
    if (input && val !== '' && (isNaN(num) || num < 1)) {
        num = 1;
        input.value = 1;
    }
    if (isNaN(num)) num = 1;

    const switchEl = mode === 'new'
        ? document.getElementById('campaignAddPartLabelSwitch')
        : document.getElementById('editCampaignAddPartLabelSwitch');
    const textEl = mode === 'new'
        ? document.getElementById('campaignAddPartLabelText')
        : document.getElementById('editCampaignAddPartLabelText');
    const wrapEl = mode === 'new'
        ? document.getElementById('campaignAddPartLabelWrap')
        : document.getElementById('editCampaignAddPartLabelWrap');

    const partTooltipHtml = ' <span class="has-tooltip tooltip-multiline" data-tooltip="Lưu ý: Chỉ áp dụng cắt Part và gắn chữ PART cho Video Dài (> 3 phút). YouTube Shorts (≤ 3 phút) sẽ luôn được render nguyên bản 1 video trọn vẹn và không chèn chữ PART." title="Lưu ý: Chỉ áp dụng cắt Part và gắn chữ PART cho Video Dài (> 3 phút). YouTube Shorts (≤ 3 phút) sẽ luôn được render nguyên bản 1 video trọn vẹn và không chèn chữ PART." style="cursor:help; display:inline-flex; align-items:center; margin-left:4px;"><i class="fa-solid fa-circle-info text-cyan" style="font-size:14px; opacity:0.95;"></i></span>';

    if (switchEl) {
        if (num <= 1) {
            switchEl.checked = false;
            switchEl.disabled = true;
            if (wrapEl) {
                wrapEl.style.opacity = '0.5';
                wrapEl.style.cursor = 'not-allowed';
            }
            if (textEl) {
                textEl.innerHTML = 'Đóng dấu chữ PART X (Tắt vì chỉ 1 clip)' + partTooltipHtml;
            }
        } else {
            switchEl.disabled = false;
            switchEl.checked = true;
            if (wrapEl) {
                wrapEl.style.opacity = '1';
                wrapEl.style.cursor = 'pointer';
            }
            if (textEl) {
                textEl.innerHTML = 'Đóng dấu chữ PART X trên video' + partTooltipHtml;
            }
        }
    }
}

function handleStudioClipsPerVideoChange(val) {
    const switchEl = document.getElementById('studioAddPartLabel');
    const textEl = document.getElementById('studioAddPartLabelText');
    const wrapEl = document.getElementById('studioAddPartLabelWrap');
    if (!switchEl) return;
    if (val === '1') {
        switchEl.checked = false;
        switchEl.disabled = true;
        if (wrapEl) {
            wrapEl.style.opacity = '0.5';
            wrapEl.style.cursor = 'not-allowed';
        }
        if (textEl) textEl.textContent = 'Đóng dấu PART X (Tắt vì chỉ 1 clip)';
    } else {
        switchEl.disabled = false;
        switchEl.checked = true;
        if (wrapEl) {
            wrapEl.style.opacity = '1';
            wrapEl.style.cursor = 'pointer';
        }
        if (textEl) textEl.textContent = 'Đóng dấu PART X & Tiến trình';
    }
}

async function renderStudioActiveVideo(btn) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('AI Render Video Studio')) {
        return;
    }
    if (!activeStudioVideo) {
        showToast('Vui lòng chọn 1 video từ danh sách bên trái trước!', 'warning');
        return;
    }

    const durVal = parseFloat(activeStudioVideo?.duration) || 0;
    const isShort = activeStudioVideo && ((durVal > 0 && durVal <= 180) || activeStudioVideo.is_short === true || activeStudioVideo.is_short === 1);
    const duration = parseInt(document.getElementById('studioDurationRange')?.value) || 65;
    const clipsCount = isShort ? 1 : (parseInt(document.getElementById('studioClipsPerVideo')?.value) || 1);
    const flip = document.getElementById('studioFlipHorizontal')?.checked ?? true;
    const speed = document.getElementById('studioSpeedFactor')?.checked ? 1.03 : 1.0;
    const generateVariants = isShort ? false : (document.getElementById('studioGenerateVariants')?.checked ?? false);
    const addPart = (generateVariants || isShort || clipsCount <= 1) ? false : (document.getElementById('studioAddPartLabel')?.checked ?? true);
    const genHook = document.getElementById('studioGenerateAiHook')?.checked ?? true;
    const selectedModel = document.getElementById('studioAiModelSelect')?.value || 'default';
    const enableSub = document.getElementById('studioEnableSubtitles')?.checked ?? true;
    const subStyle = document.getElementById('studioSubtitleStyle')?.value || 'karaoke_yellow';
    const subPos = document.getElementById('studioSubtitlePosition')?.value || 'center';
    const isSmartCurate = document.getElementById('studioSmartCurate')?.checked ?? true;
    const hookAngle = document.getElementById('studioHookAngle')?.value || 'auto';
    const isEnableBgm = document.getElementById('studioEnableBgm')?.checked ?? false;
    const bgmFolder = isEnableBgm ? (document.getElementById('studioBgmFolder')?.value || null) : null;
    const bgmVolume = parseFloat(document.getElementById('studioBgmVolume')?.value || 0.15);
    const useAiImages = document.getElementById('studioUseAiImages')?.checked ?? false;
    const imageStyle = document.getElementById('studioImageStyle')?.value || 'cinematic';
    const visualSource = document.getElementById('studioVisualSource')?.value || 'ai';
    const aiImageModel = document.getElementById('studioAiImageModel')?.value || 'flux';
    const aiVideoModel = document.getElementById('studioAiVideoModel')?.value || 'fal_ltx';
    const stockProvider = document.getElementById('studioStockProvider')?.value || 'all';
    const mpNarrLang = document.getElementById('studioMpNarrationLanguage')?.value || 'vi';
    const mpVoice = document.getElementById('studioMpVoiceGender')?.value || 'male';
    const mpNarrStyle = document.getElementById('studioMpNarrationStyle')?.value || 'giat_gan';
    const studioTtsEngine = document.querySelector('input[name="studioTtsEngineRadio"]:checked')?.value || 'edge-tts';
    const studioElevenLabsVoiceId = document.getElementById('studioElevenLabsVoiceId')?.value || '';
    const studioElevenLabsModel = document.getElementById('studioElevenLabsModel')?.value || 'eleven_multilingual_v2';
    const studioKenBurns = document.getElementById('studioKenBurnsSwitch')?.checked ?? true;
    const studioEndcard = document.getElementById('studioEndcardSwitch')?.checked ?? true;
    const studioKeepOrig = document.getElementById('studioKeepOriginalScriptForShorts')?.checked ?? true;
    const studioDisableNarrShorts = document.getElementById('studioDisableNarrationForShorts')?.checked ?? true;

    if (duration < 10 || duration > 3600) {
        markInputError('studioDurationRange', 'Thời lượng render mỗi clip phải từ 10 đến 3600 giây!');
        return;
    }
    if (clipsCount < 1 || clipsCount > 20) {
        markInputError('studioClipsPerVideo', 'Số phần cắt mỗi video phải từ 1 đến 20!');
        return;
    }
    if (isNaN(bgmVolume) || bgmVolume < 0 || bgmVolume > 1) {
        markInputError('studioBgmVolume', 'Âm lượng nhạc nền BGM phải từ 0.0 đến 1.0 (0% - 100%)!');
        return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    const stopBtn = document.getElementById('btnStudioRenderStop');
    if (stopBtn) stopBtn.style.display = 'inline-flex';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = useAiImages ? '<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> Đang Tạo Video AI Story...' : '<i class="fa-solid fa-spinner fa-spin"></i> Đang Render AI 9:16...';
    }

    if (useAiImages) {
        showToast(`Bắt đầu tạo video AI Story: 100% Ảnh AI (${imageStyle}) & Lồng tiếng mới (${mpNarrLang})...`);
    } else {
        showToast(`Bắt đầu render AI (Model: ${selectedModel}, Cắt: ${clipsCount} clip, Thời lượng: ${duration}s, Subtitles: ${enableSub ? 'Bật' : 'Tắt'}, BGM: ${bgmFolder || 'Không'})...`);
    }

    _studioRenderAbortController = new AbortController();

    try {
        const endpoint = isSmartCurate ? '/api/video/render-smart-ai' : '/api/video/render';
        const payload = isSmartCurate ? {
            video_id: activeStudioVideo.yt_video_id,
            target_duration: duration,
            flip_horizontal: flip,
            speed_factor: speed,
            add_part_label: addPart,
            generate_hook: genHook,
            ai_model: selectedModel !== 'default' ? selectedModel : null,
            enable_subtitles: enableSub,
            subtitle_style: subStyle,
            subtitle_position: subPos,
            clips_count: clipsCount,
            bgm_folder: bgmFolder,
            bgm_volume: bgmVolume,
            generate_variants: generateVariants,
            hook_angle: hookAngle,
            use_ai_images: useAiImages,
            image_style: imageStyle,
            visual_source: visualSource,
            ai_image_model: aiImageModel,
            ai_video_model: aiVideoModel,
            stock_provider: stockProvider,
            narration_language: mpNarrLang,
            voice_gender: mpVoice,
            narration_style: mpNarrStyle,
            tts_engine: studioTtsEngine,
            elevenlabs_voice_id: studioElevenLabsVoiceId,
            elevenlabs_model: studioElevenLabsModel,
            ken_burns_enabled: studioKenBurns,
            endcard_enabled: studioEndcard,
            keep_original_script_for_shorts: studioKeepOrig,
            disable_narration_for_shorts: studioDisableNarrShorts
        } : {
            video_id: activeStudioVideo.yt_video_id,
            duration: duration,
            flip_horizontal: flip,
            speed_factor: speed,
            add_part_label: addPart,
            enable_subtitles: enableSub,
            subtitle_style: subStyle,
            subtitle_position: subPos,
            ai_model: selectedModel !== 'default' ? selectedModel : null,
            clips_count: clipsCount,
            bgm_folder: bgmFolder,
            bgm_volume: bgmVolume,
            use_ai_images: useAiImages,
            image_style: imageStyle,
            visual_source: visualSource,
            ai_image_model: aiImageModel,
            ai_video_model: aiVideoModel,
            stock_provider: stockProvider,
            narration_language: mpNarrLang,
            voice_gender: mpVoice,
            narration_style: mpNarrStyle,
            tts_engine: studioTtsEngine,
            elevenlabs_voice_id: studioElevenLabsVoiceId,
            elevenlabs_model: studioElevenLabsModel,
            ken_burns_enabled: studioKenBurns,
            endcard_enabled: studioEndcard,
            keep_original_script_for_shorts: studioKeepOrig,
            disable_narration_for_shorts: studioDisableNarrShorts
        };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: _studioRenderAbortController ? _studioRenderAbortController.signal : undefined
        });
        const data = await res.json();
        if (res.ok && (data.status === 'success' || data.rendered_file)) {
            showToast('Render AI 9:16 thành công! Bạn có thể xem thử trên mô phỏng điện thoại.', 'success');
            const currYtId = activeStudioVideo ? activeStudioVideo.yt_video_id : null;
            await loadStudioVideos();
            filterStudioVideos('rendered');
            if (currYtId) {
                selectStudioVideo(currYtId, 'rendered', 1);
            }
            loadDashboardStats();
            loadPipelineStatus();
            if (typeof loadAiUsageStats === 'function') {
                loadAiUsageStats();
            }
        } else {
            showToast('Lỗi render: ' + (data.detail || data.message || 'Không thể render video'), 'error');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            showToast('🛑 Đã dừng tiến trình Render video!', 'warning');
        } else {
            showToast('Lỗi render: ' + err.message, 'error');
        }
    } finally {
        if (stopBtn) stopBtn.style.display = 'none';
        _studioRenderAbortController = null;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml || '<i class="fa-solid fa-wand-magic-sparkles"></i> Render Video';
        }
    }
}

async function stopStudioRenderNow(btn) {
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang dừng...';
    }
    if (_studioRenderAbortController) {
        _studioRenderAbortController.abort();
        _studioRenderAbortController = null;
    }
    try {
        await fetch('/api/video/render-stop', { method: 'POST' });
    } catch (_) {}
    showToast('🛑 Đã gửi lệnh dừng Render video!', 'warning');
    const renderBtn = document.getElementById('btnStudioRenderAction');
    if (renderBtn) {
        renderBtn.disabled = false;
        renderBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render Video';
    }
    const stopBtn = document.getElementById('btnStudioRenderStop');
    if (stopBtn) {
        stopBtn.disabled = false;
        stopBtn.style.display = 'none';
        stopBtn.innerHTML = '<i class="fa-solid fa-hand"></i> Dừng';
    }
}

function openUploadModalForActiveStudioVideo() {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Đăng Video Lên Nick')) {
        return;
    }
    if (!activeStudioVideo) {
        showToast('Vui lòng chọn video trước!', true);
        return;
    }
    let targetPath = null;
    if (activeStudioVideo.rendered_parts && activeStudioVideo.rendered_parts.length > 0) {
        const cur = activeStudioVideo.rendered_parts.find(p => p.part === activePlaybackPart) || activeStudioVideo.rendered_parts[0];
        if (cur && cur.path) targetPath = cur.path;
    }
    if (!targetPath && activeStudioVideo.rendered_path) {
        targetPath = activeStudioVideo.rendered_path;
    }
    openUploadModal(activeStudioVideo.id, targetPath);
}

async function triggerManualPipelineScan(btn) {
    await scanAllSavedChannels(btn);
    loadPipelineStatus();
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function toggleStudioSafeZoneOverlay(btn) {
    const overlay = document.getElementById('studioUniversalSafeZoneOverlay');
    if (!overlay) return;
    const isVisible = overlay.style.display !== 'none';
    overlay.style.display = isVisible ? 'none' : 'block';
    if (btn) {
        btn.classList.toggle('active', !isVisible);
        btn.style.borderColor = !isVisible ? 'var(--accent-cyan)' : '';
        btn.style.color = !isVisible ? 'var(--accent-cyan)' : '';
    }
}

function switchStudioPlatformPreview(platform) {
    const tt = document.getElementById('tiktokOverlayMockup');
    const yt = document.getElementById('youtubeShortsOverlayMockup');
    const fb = document.getElementById('facebookReelsOverlayMockup');
    
    if (tt) tt.style.display = (platform === 'tiktok') ? 'flex' : 'none';
    if (yt) yt.style.display = (platform === 'youtube_shorts') ? 'flex' : 'none';
    if (fb) fb.style.display = (platform === 'facebook_reels') ? 'flex' : 'none';
}

function toggleStudioPlatformDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('studioPlatformMenu');
    if (!menu) return;
    const isShown = menu.style.display !== 'none';
    menu.style.display = isShown ? 'none' : 'block';
}

function selectStudioPlatform(platform) {
    const label = document.getElementById('studioPlatformSelectedLabel');
    if (label) {
        if (platform === 'tiktok') {
            label.innerHTML = '<i class="fa-brands fa-tiktok" style="color:#ff0050;"></i> <span>TikTok</span>';
        } else if (platform === 'youtube_shorts') {
            label.innerHTML = '<i class="fa-brands fa-youtube" style="color:#ff0000;"></i> <span>Shorts</span>';
        } else if (platform === 'facebook_reels') {
            label.innerHTML = '<i class="fa-brands fa-facebook" style="color:#1877f2;"></i> <span>Reels</span>';
        } else {
            label.innerHTML = '<i class="fa-solid fa-eye-slash" style="color:var(--text-muted);"></i> <span>Ẩn UI</span>';
        }
    }
    const menu = document.getElementById('studioPlatformMenu');
    if (menu) menu.style.display = 'none';

    switchStudioPlatformPreview(platform);
}

// Close platform dropdown on outer click
document.addEventListener('click', function (e) {
    const wrap = document.getElementById('studioPlatformDropdownWrap');
    const menu = document.getElementById('studioPlatformMenu');
    if (menu && menu.style.display !== 'none' && wrap && !wrap.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// Module Window Exposures
window.toggleStudioSafeZoneOverlay = toggleStudioSafeZoneOverlay;
window.switchStudioPlatformPreview = switchStudioPlatformPreview;
window.toggleStudioPlatformDropdown = toggleStudioPlatformDropdown;
window.selectStudioPlatform = selectStudioPlatform;
window.applyStudioPreset = applyStudioPreset;
window.clearStudioFilters = clearStudioFilters;
window.closeEditStudioVideoModal = closeEditStudioVideoModal;
window.confirmDeleteStudioVideo = confirmDeleteStudioVideo;
window.filterStudioVideos = filterStudioVideos;
window.handleCampaignClipsInputChange = handleCampaignClipsInputChange;
window.handleStudioClipsPerVideoChange = handleStudioClipsPerVideoChange;
window.loadMoreStudioVideos = loadMoreStudioVideos;
window.loadStudioVideos = loadStudioVideos;
window.onStudioChannelFilterChange = onStudioChannelFilterChange;
window.onStudioSearchInput = onStudioSearchInput;
window.openEditStudioVideoModal = openEditStudioVideoModal;
window.openUploadModalForActiveStudioVideo = openUploadModalForActiveStudioVideo;
window.refreshStudioVideos = refreshStudioVideos;
window.renderStudioActiveVideo = renderStudioActiveVideo;
window.saveStudioVideoEdit = saveStudioVideoEdit;
window.selectStudioVideo = selectStudioVideo;
window.stopStudioRenderNow = stopStudioRenderNow;
window.syncStudioVariantModeUI = syncStudioVariantModeUI;
window.toggleStudioPlayback = toggleStudioPlayback;
window.toggleStudioVideoPopover = toggleStudioVideoPopover;
window.triggerManualPipelineScan = triggerManualPipelineScan;
