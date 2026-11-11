// ==========================================
// 7. SAVED CHANNELS MANAGER & SETTINGS
// ==========================================
let cachedSavedChannels = [];
let activeModalChannel = null;

async function loadSavedChannels(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    }

    try {
        const res = await fetch('/api/youtube/channels');
        const channels = await res.json();
        cachedSavedChannels = (channels || []).map(c => ({ ...c, is_saved: true }));

        const total = cachedSavedChannels.length;
        const activeCount = cachedSavedChannels.filter(c => c.is_active === 1).length;
        const totalDownloaded = cachedSavedChannels.reduce((sum, c) => sum + (c.downloaded_count || 0), 0);
        const totalRendered = cachedSavedChannels.reduce((sum, c) => sum + (c.rendered_count || 0), 0);

        const elTotal = document.getElementById('savedCountTotal');
        if (elTotal) elTotal.textContent = total;
        const elActive = document.getElementById('savedCountActive');
        if (elActive) elActive.textContent = activeCount;
        const elDl = document.getElementById('savedCountDownloaded');
        if (elDl) elDl.textContent = totalDownloaded;
        const elRd = document.getElementById('savedCountRendered');
        if (elRd) elRd.textContent = totalRendered;
        const badgeCount = document.getElementById('badgeSavedCount');
        if (badgeCount) badgeCount.textContent = `${total} Kênh Đang Theo Dõi`;

        renderSavedChannelsTable();
    } catch (err) {
        console.error('Lỗi khi tải kênh đã lưu:', err);
        showToast('Lỗi khi tải danh sách kênh đã lưu: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Saved Channels Sorting & Filtering State
let savedSortField = 'default';
let savedSortDirection = 'asc';
let savedFilterCountry = 'all';
let savedFilterMinViews = 0;
let savedFilterMinSubs = 0;
let savedFilterCadence = 'all';

function handleSavedSortSelectChange(val) {
    savedSortField = val;
    renderSavedChannelsTable();
}

function toggleSavedSortDirection() {
    savedSortDirection = savedSortDirection === 'asc' ? 'desc' : 'asc';
    updateSavedSortDirectionBtn();
    renderSavedChannelsTable();
}

function updateSavedSortDirectionBtn() {
    const icon = document.getElementById('savedSortDirIcon');
    const text = document.getElementById('savedSortDirText');
    if (icon) icon.className = savedSortDirection === 'asc' ? 'fa-solid fa-arrow-down-short-wide' : 'fa-solid fa-arrow-down-wide-short';
    if (text) text.textContent = savedSortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';
}

function handleSavedHeaderSort(field) {
    if (savedSortField === field) {
        toggleSavedSortDirection();
    } else {
        savedSortField = field;
        savedSortDirection = (field === 'title' || field === 'country') ? 'asc' : 'desc';
        const sel = document.getElementById('savedSortSelect');
        if (sel) sel.value = field;
        updateSavedSortDirectionBtn();
        renderSavedChannelsTable();
    }
}

function handleSavedFilterCountryChange(val) {
    savedFilterCountry = val;
    renderSavedChannelsTable();
}

function handleSavedFilterViewsChange(val) {
    savedFilterMinViews = parseInt(val, 10) || 0;
    renderSavedChannelsTable();
}

function handleSavedFilterSubsChange(val) {
    savedFilterMinSubs = parseInt(val, 10) || 0;
    renderSavedChannelsTable();
}

function handleSavedFilterCadenceChange(val) {
    savedFilterCadence = val;
    renderSavedChannelsTable();
}

function resetSavedFilters() {
    savedSortField = 'default';
    savedSortDirection = 'asc';
    savedFilterCountry = 'all';
    savedFilterMinViews = 0;
    savedFilterMinSubs = 0;
    savedFilterCadence = 'all';

    const selSort = document.getElementById('savedSortSelect');
    if (selSort) selSort.value = 'default';
    const selCountry = document.getElementById('savedFilterCountrySelect');
    if (selCountry) selCountry.value = 'all';
    const selViews = document.getElementById('savedFilterViewsSelect');
    if (selViews) selViews.value = '0';
    const selSubs = document.getElementById('savedFilterSubsSelect');
    if (selSubs) selSubs.value = '0';
    const selCadence = document.getElementById('savedFilterCadenceSelect');
    if (selCadence) selCadence.value = 'all';
    const selStatus = document.getElementById('filterSavedStatus');
    if (selStatus) selStatus.value = 'all';
    const inpKw = document.getElementById('searchSavedKeyword');
    if (inpKw) inpKw.value = '';

    updateSavedSortDirectionBtn();
    renderSavedChannelsTable();
}

function getFilteredSavedChannels() {
    const statusFilter = document.getElementById('filterSavedStatus') ? document.getElementById('filterSavedStatus').value : 'all';
    const keyword = (document.getElementById('searchSavedKeyword') ? document.getElementById('searchSavedKeyword').value : '').trim().toLowerCase();

    let list = cachedSavedChannels.slice();

    // 1. Status Filter
    if (statusFilter === 'active') {
        list = list.filter(c => c.is_active === 1);
    } else if (statusFilter === 'inactive') {
        list = list.filter(c => c.is_active === 0);
    }

    // 2. Country Filter
    if (savedFilterCountry !== 'all') {
        list = list.filter(c => (c.country || 'N/A').toUpperCase() === savedFilterCountry.toUpperCase());
    }

    // 3. Min Views Filter
    if (savedFilterMinViews > 0) {
        list = list.filter(c => (c.avg_views || 0) >= savedFilterMinViews);
    }

    // 4. Min Subs Filter
    if (savedFilterMinSubs > 0) {
        list = list.filter(c => (c.subscriber_count || 0) >= savedFilterMinSubs);
    }

    // 5. Cadence Filter
    if (savedFilterCadence === 'daily') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 1.0);
    } else if (savedFilterCadence === 'frequent') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 3.0);
    } else if (savedFilterCadence === 'weekly') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 7.0);
    }

    // 6. Keyword Filter
    if (keyword) {
        list = list.filter(c => {
            const title = (c.title || '').toLowerCase();
            const displayName = (c.display_name || '').toLowerCase();
            const cid = (c.channel_id || '').toLowerCase();
            const handle = (c.handle || '').toLowerCase();
            const country = (c.country || '').toLowerCase();
            return title.includes(keyword) || displayName.includes(keyword) || cid.includes(keyword) || handle.includes(keyword) || country.includes(keyword);
        });
    }

    // 7. Sort
    if (savedSortField !== 'default') {
        list.sort((a, b) => {
            let res = 0;
            if (savedSortField === 'title') {
                const ta = a.display_name || a.title || '';
                const tb = b.display_name || b.title || '';
                res = ta.localeCompare(tb, 'vi', { sensitivity: 'base' });
            } else if (savedSortField === 'country') {
                res = (a.country || '').localeCompare(b.country || '');
            } else if (savedSortField === 'subscriber_count') {
                res = (a.subscriber_count || 0) - (b.subscriber_count || 0);
            } else if (savedSortField === 'video_count') {
                res = (a.video_count || 0) - (b.video_count || 0);
            } else if (savedSortField === 'avg_views') {
                res = (a.avg_views || 0) - (b.avg_views || 0);
            } else if (savedSortField === 'total_view_count') {
                res = (a.total_view_count || 0) - (b.total_view_count || 0);
            } else if (savedSortField === 'views_per_sub_ratio') {
                res = (a.views_per_sub_ratio || 0) - (b.views_per_sub_ratio || 0);
            } else if (savedSortField === 'days_since_last_upload') {
                const da = a.days_since_last_upload !== undefined && a.days_since_last_upload !== null ? a.days_since_last_upload : 9999;
                const db = b.days_since_last_upload !== undefined && b.days_since_last_upload !== null ? b.days_since_last_upload : 9999;
                res = da - db;
            } else if (savedSortField === 'upload_cadence_days') {
                const ca = a.upload_cadence_days > 0 ? a.upload_cadence_days : 9999;
                const cb = b.upload_cadence_days > 0 ? b.upload_cadence_days : 9999;
                res = ca - cb;
            } else if (savedSortField === 'is_active') {
                res = (a.is_active || 0) - (b.is_active || 0);
            }
            return savedSortDirection === 'asc' ? res : -res;
        });
    }

    return list;
}

async function exportSavedChannelsCsv() {
    if (!cachedSavedChannels || !cachedSavedChannels.length) {
        try {
            const res = await fetch('/api/youtube/channels');
            const data = await res.json();
            if (Array.isArray(data)) cachedSavedChannels = data;
        } catch (e) {
            console.warn('Lỗi tải kênh trước khi xuất CSV:', e);
        }
    }
    let list = getFilteredSavedChannels();
    if (!list || !list.length) {
        list = cachedSavedChannels || [];
    }
    if (!list.length) {
        showToast('Không có kênh nào đang giám sát để xuất CSV!', true);
        return;
    }

    const headers = [
        'Channel ID',
        'Tên Hiển Thị (Display Name)',
        'Tên Gốc Kênh',
        'Handle',
        'URL Kênh YouTube',
        'Quốc Gia',
        'Subscribers',
        'Tổng Số Video',
        'Lượt Xem TB',
        'Tổng Lượt Xem Kênh',
        'Viral Ratio',
        'Video Mới Nhất',
        'Số Ngày Kể Từ Video Cuối',
        'Tần Suất Đăng (Ngày/Vid)',
        'Video Đã Tải',
        'Video Đã Render 9:16',
        'Trạng Thái',
        'Tự Động Tải MP4',
        'Tự Động Render AI',
        'Proxy Riêng',
        'Thư Mục Tải',
        'Thư Mục Render'
    ];

    const rows = [headers];
    list.forEach(c => {
        rows.push([
            c.channel_id || '',
            c.display_name || c.title || '',
            c.title || '',
            c.handle || '',
            c.url || (c.channel_id ? `https://www.youtube.com/channel/${c.channel_id}` : ''),
            c.country || 'N/A',
            c.subscriber_count !== undefined && c.subscriber_count !== null ? c.subscriber_count : '',
            c.video_count !== undefined && c.video_count !== null ? c.video_count : '',
            c.avg_views !== undefined && c.avg_views !== null ? c.avg_views : '',
            c.total_view_count !== undefined && c.total_view_count !== null ? c.total_view_count : '',
            c.views_per_sub_ratio !== undefined && c.views_per_sub_ratio !== null ? Number(c.views_per_sub_ratio).toFixed(2) : '',
            c.last_upload_date || '',
            c.days_since_last_upload !== undefined && c.days_since_last_upload !== null ? c.days_since_last_upload : '',
            c.upload_cadence_days || '',
            c.downloaded_count || 0,
            c.rendered_count || 0,
            c.is_active === 1 ? 'Hoạt động' : 'Tạm ngưng',
            c.auto_download === 1 ? 'Bật' : 'Tắt',
            c.auto_render === 1 ? 'Bật' : 'Tắt',
            c.custom_proxy || '',
            c.download_dir || '',
            c.render_dir || ''
        ]);
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`kenh_youtube_giam_sat_${dateStr}.csv`, rows);
}

function renderSavedChannelsTable() {
    const tbody = document.getElementById('savedChannelsBody');
    if (!tbody) return;

    const list = getFilteredSavedChannels();

    const badgeCount = document.getElementById('badgeSavedCount');
    if (badgeCount) badgeCount.textContent = `${list.length}/${cachedSavedChannels.length} Kênh`;

    // Update Header Sort Icons
    ['title', 'country', 'subscriber_count', 'video_count', 'avg_views', 'views_per_sub_ratio', 'days_since_last_upload', 'upload_cadence_days', 'is_active'].forEach(f => {
        const thMap = {
            'title': 'th-saved-title',
            'country': 'th-saved-country',
            'subscriber_count': 'th-saved-subs',
            'video_count': 'th-saved-videos',
            'avg_views': 'th-saved-avg-views',
            'views_per_sub_ratio': 'th-saved-ratio',
            'days_since_last_upload': 'th-saved-last-upload',
            'upload_cadence_days': 'th-saved-cadence',
            'is_active': 'th-saved-active'
        };
        const th = document.getElementById(thMap[f]);
        if (!th) return;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (savedSortField === f) {
            th.classList.add('sorted');
            icon.className = savedSortDirection === 'asc' ? 'fa-solid fa-sort-up sort-icon active' : 'fa-solid fa-sort-down sort-icon active';
        } else {
            th.classList.remove('sorted');
            icon.className = 'fa-solid fa-sort sort-icon';
        }
    });

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted"><i class="fa-solid fa-folder-open" style="font-size: 24px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>Không tìm thấy kênh nào phù hợp.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => {
        const cid = c.channel_id || '';
        const hasDisplayName = c.display_name && c.display_name.trim();
        const displayTitle = hasDisplayName ? escapeHtml(c.display_name) : escapeHtml(c.title || cid);
        const origTitle = hasDisplayName ? `<span class="channel-title-main table-text-truncate" style="opacity:0.75; font-size:11px; max-width:200px;" title="Gốc: ${escapeHtml(c.title)}">Gốc: ${escapeHtml(c.title)}</span>` : '';
        const aliasTag = hasDisplayName ? `<span class="channel-alias-tag"><i class="fa-solid fa-tag"></i> Tên riêng</span>` : '';

        const handleText = c.handle ? `<span class="table-text-truncate" style="max-width:180px; font-size:11px; color:var(--accent-cyan); font-weight:500;" title="@${escapeHtml(c.handle.replace('@', ''))}">@${escapeHtml(c.handle.replace('@', ''))}</span>` : '';
        const chUrl = c.url || (cid ? `https://www.youtube.com/channel/${cid}` : '#');

        const thumbImg = c.thumbnail_url
            ? `<img src="${c.thumbnail_url}" alt="" class="channel-avatar-clickable" onclick="openChannelDetailModal('${escapeHtml(cid)}')" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;" title="Bấm xem chi tiết kênh">`
            : `<div class="channel-avatar-clickable" onclick="openChannelDetailModal('${escapeHtml(cid)}')" style="width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; color:var(--text-muted); flex-shrink:0;" title="Bấm xem chi tiết kênh"><i class="fa-brands fa-youtube"></i></div>`;

        const subsFormatted = c.subscriber_count ? formatNumber(c.subscriber_count) : '<span class="text-muted">Ẩn</span>';
        const lastUploadText = c.last_upload_date ? `${c.last_upload_date} (${c.days_since_last_upload || 0} ngày trước)` : 'Chưa có';
        const cadenceDesc = c.upload_cadence_days > 0 ? `${c.upload_cadence_days} ngày/vid` : 'Chưa xác định';

        const dlCount = c.downloaded_count || 0;
        const rdCount = c.rendered_count || 0;

        const isActive = c.is_active === 1;
        const statusBadge = isActive
            ? `<span class="badge badge-success"><i class="fa-solid fa-circle-dot"></i> Hoạt động</span>`
            : `<span class="badge badge-secondary"><i class="fa-solid fa-pause"></i> Tạm ngưng</span>`;

        const ratio = c.views_per_sub_ratio || 0;
        let ratioBadge = '';
        if (ratio > 0) {
            const ratioClass = ratio >= 2.0 ? 'high' : (ratio >= 0.5 ? 'good' : '');
            const fire = ratio >= 1.0 ? '🔥 ' : '';
            ratioBadge = `<div class="badge-ratio ${ratioClass}" title="Tỷ lệ lượt xem trên số người theo dõi">${fire}Ratio: ${ratio.toFixed(2)}x</div>`;
        }

        return `
            <tr data-channel-id="${escapeHtml(cid)}">
                <!-- Col 1: Kênh YouTube (Avatar + Title + Handle + Link) matching Scanner Tab -->
                <td>
                    <div style="display:flex; align-items:flex-start; gap:10px;">
                        ${thumbImg}
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            ${aliasTag}
                            <strong class="channel-title-link" onclick="openChannelDetailModal('${escapeHtml(cid)}')" title="Bấm xem chi tiết kênh: ${displayTitle}">${displayTitle}</strong>
                            ${origTitle}
                            ${handleText}
                            <div style="margin-top:3px;">
                                <a href="${escapeHtml(chUrl)}" target="_blank" rel="noopener" class="channel-link-tag" title="Mở trang YouTube của kênh này">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Mở kênh
                                </a>
                            </div>
                        </div>
                    </div>
                </td>

                <!-- Col 2: Mã Channel ID matching Scanner Tab -->
                <td>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="channel-id-tag" title="${escapeHtml(cid)}">${escapeHtml(cid)}</span>
                        <button type="button" class="btn-copy-id" onclick="copyTextToClipboard('${escapeHtml(cid)}', 'Đã sao chép Channel ID!')" title="Sao chép Channel ID">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </td>

                <!-- Col 3: Quốc Gia -->
                <td>${getCountryBadge(c.country)}</td>

                <!-- Col 4: Subscribers -->
                <td>
                    <div style="font-weight:700; color:var(--text-primary); font-size:13px;">${subsFormatted}</div>
                </td>

                <!-- Col 5: Tổng Video -->
                <td>
                    <div style="font-size:12.5px; color:var(--text-secondary);">${c.video_count ? c.video_count.toLocaleString() : 'N/A'}</div>
                </td>

                <!-- Col 6: Lượt Xem TB -->
                <td>
                    <div style="font-weight:700; color:var(--text-primary); font-size:13px;">${c.avg_views ? formatNumber(c.avg_views) : '<span class="text-muted">N/A</span>'}</div>
                </td>

                <!-- Col 7: Tỷ Lệ View/Sub (Separate Column) -->
                <td>
                    ${ratioBadge || '<span class="text-muted" style="font-size:11px;">—</span>'}
                </td>

                <!-- Col 8: Video Mới Nhất -->
                <td><span style="font-size:12px; color:var(--text-secondary);">${lastUploadText}</span></td>

                <!-- Col 9: Tần Suất Đăng -->
                <td><span class="badge badge-purple">${cadenceDesc}</span></td>

                <!-- Col 10: Video (Tải / Render) -->
                <td>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        <span class="badge badge-blue" title="Video đã tải"><i class="fa-solid fa-download"></i> ${dlCount}</span>
                        <span class="badge badge-gold" title="Video đã render AI"><i class="fa-solid fa-wand-magic-sparkles"></i> ${rdCount}</span>
                    </div>
                </td>

                <!-- Col 11: Trạng Thái Toggle -->
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label class="switch has-tooltip tooltip-top" data-tooltip="${isActive ? 'Bấm để Tạm ngưng (Dừng tải và render)' : 'Bấm để Bật Hoạt động (Tự động tải và render)'}">
                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleChannelStatusInline('${escapeHtml(cid)}', this)">
                            <span class="slider round"></span>
                        </label>
                        ${statusBadge}
                    </div>
                </td>

                <!-- Col 12: Thao Tác -->
                <td style="text-align: center;">
                    <div class="action-dropdown-wrap">
                        <button type="button" class="btn-more-actions" id="btn-more-saved-${escapeHtml(cid)}" 
                            onclick="toggleActionMenu(event, 'saved-${escapeHtml(cid)}')" 
                            title="Tùy chọn thao tác">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                        <div class="action-dropdown-menu" id="action-menu-saved-${escapeHtml(cid)}">
                            <button type="button" class="action-dropdown-item" onclick="openChannelDetailModal('${escapeHtml(cid)}')">
                                <i class="fa-solid fa-circle-info" style="color:var(--accent-cyan);"></i> Xem chi tiết
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="openChannelVideosModal('${escapeHtml(cid)}', '${escapeHtml(displayTitle || c.title || '')}')">
                                <i class="fa-solid fa-film" style="color:#00f2fe;"></i> Chi Tiết Video
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="refreshChannelStatsFromMenu('${escapeHtml(cid)}', this)">
                                <i class="fa-solid fa-arrows-rotate" style="color:#10b981;"></i> Cập nhật chỉ số kênh
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="scanSingleChannel('${escapeHtml(cid)}', this)">
                                <i class="fa-solid fa-bolt" style="color:#fe2c55;"></i> Quét video mới ngay
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="openChannelSettingsModal('${escapeHtml(cid)}')">
                                <i class="fa-solid fa-gear" style="color:#a855f7;"></i> Cài đặt kênh
                            </button>
                            <div class="dropdown-divider"></div>
                            <a href="${escapeHtml(chUrl)}" target="_blank" rel="noopener" class="action-dropdown-item" onclick="closeAllActionMenus()">
                                <i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Mở YouTube
                            </a>
                            <button type="button" class="action-dropdown-item" onclick="copyChannelUrl('${escapeHtml(chUrl)}')">
                                <i class="fa-solid fa-link" style="color:#38bdf8;"></i> Sao chép URL
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="copyTextToClipboard('${escapeHtml(cid)}', 'Đã sao chép Channel ID!')">
                                <i class="fa-solid fa-copy" style="color:#94a3b8;"></i> Sao chép ID
                            </button>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="action-dropdown-item" onclick="clearChannelVideoHistory('${escapeHtml(cid)}', 'downloaded')">
                                <i class="fa-solid fa-file-arrow-down" style="color:#38bdf8;"></i> Xóa lịch sử video đã tải
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="clearChannelVideoHistory('${escapeHtml(cid)}', 'rendered')">
                                <i class="fa-solid fa-film" style="color:#ec4899;"></i> Xóa lịch sử video đã render
                            </button>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="action-dropdown-item text-danger" onclick="unsaveChannelFromList('${escapeHtml(cid)}', this)">
                                <i class="fa-solid fa-trash text-danger"></i> Bỏ lưu / Xóa kênh
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleChannelStatusInline(channelId, checkbox) {
    const newStatus = checkbox.checked ? 1 : 0;
    try {
        const res = await fetch('/api/youtube/channels/toggle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId, is_active: newStatus })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.state_label);
            const ch = cachedSavedChannels.find(c => c.channel_id === channelId);
            if (ch) {
                ch.is_active = data.is_active;
                ch.auto_download = data.is_active;
            }
            renderSavedChannelsTable();
            const activeCount = cachedSavedChannels.filter(c => c.is_active === 1).length;
            const elActive = document.getElementById('savedCountActive');
            if (elActive) elActive.textContent = activeCount;
        } else {
            checkbox.checked = !checkbox.checked;
            showToast('Lỗi: ' + (data.message || 'Không thể đổi trạng thái'), true);
        }
    } catch (err) {
        checkbox.checked = !checkbox.checked;
        showToast('Lỗi kết nối: ' + err.message, true);
    }
}

async function refreshChannelStatsFromMenu(channelId, btn) {
    closeAllActionMenus();
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-emerald"></i> Đang cập nhật...';
    }
    showToast(`Đang cập nhật chỉ số kênh ${channelId} từ YouTube...`);

    try {
        const res = await fetch('/api/youtube/channels/refresh-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(data.message || 'Đã cập nhật chỉ số kênh thành công!');
            if (data.channel) {
                const idx = (cachedSavedChannels || []).findIndex(c => c.channel_id === channelId);
                if (idx !== -1) {
                    cachedSavedChannels[idx] = { ...cachedSavedChannels[idx], ...data.channel };
                }
                if (activeDetailChannel && activeDetailChannel.channel_id === channelId) {
                    activeDetailChannel = { ...activeDetailChannel, ...data.channel };
                    openChannelDetailModal(activeDetailChannel);
                }
            }
            renderSavedChannelsTable();
        } else {
            showToast('Lỗi cập nhật: ' + (data.detail || data.message || 'Không thể làm mới chỉ số'), true);
        }
    } catch (err) {
        showToast('Lỗi khi cập nhật kênh: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function refreshActiveChannelStats(btn) {
    if (!activeDetailChannel || !activeDetailChannel.channel_id) {
        showToast('Không tìm thấy thông tin kênh đang xem!', true);
        return;
    }
    const channelId = activeDetailChannel.channel_id;
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-cyan"></i> Đang cập nhật...';
    }
    showToast(`Đang cập nhật chỉ số mới nhất từ YouTube...`);

    try {
        const res = await fetch('/api/youtube/channels/refresh-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(data.message || 'Đã cập nhật chỉ số kênh thành công!');
            if (data.channel) {
                activeDetailChannel = { ...activeDetailChannel, ...data.channel };
                const idx = (cachedSavedChannels || []).findIndex(c => c.channel_id === channelId);
                if (idx !== -1) {
                    cachedSavedChannels[idx] = { ...cachedSavedChannels[idx], ...data.channel };
                }
                openChannelDetailModal(activeDetailChannel);
                renderSavedChannelsTable();
            }
        } else {
            showToast('Lỗi cập nhật: ' + (data.detail || data.message || 'Không thể làm mới chỉ số'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối khi cập nhật kênh: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

let _singleChannelAbortController = null;

async function stopSingleChannelScan(btn) {
    if (_singleChannelAbortController) {
        _singleChannelAbortController.abort();
        _singleChannelAbortController = null;
    }
    try {
        await fetch('/api/youtube/channels/scan-stop', { method: 'POST' });
        showToast('🛑 Đã dừng quét kênh!', 'warning');
    } catch (_) {}
    if (btn) {
        btn.removeAttribute('data-running');
        btn.className = 'btn btn-sm btn-primary';
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Quét Kênh Này Ngay';
    }
}

async function scanSingleChannel(channelId, btn, maxVideos = null) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Quét Kênh YouTube')) {
        return;
    }
    closeAllActionMenus();

    // Nếu đang chạy mà người dùng bấm lại nút -> Dừng ngay lập tức!
    if (btn && btn.getAttribute('data-running') === 'true') {
        await stopSingleChannelScan(btn);
        return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    const origClass = btn ? btn.className : '';

    if (btn) {
        btn.setAttribute('data-running', 'true');
        btn.className = 'btn btn-sm btn-danger';
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng Quét';
    }

    _singleChannelAbortController = new AbortController();
    showToast(`Đang quét RSS kênh ${channelId}... (Bấm 'Dừng Quét' để dừng bất kỳ lúc nào)`);

    try {
        const payload = { channel_id: channelId };
        if (maxVideos && maxVideos > 0) {
            payload.max_videos = maxVideos;
        }
        const res = await fetch('/api/youtube/channels/scan-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: _singleChannelAbortController.signal
        });
        const data = await res.json();
        if (data.status === 'success') {
            const limitNote = data.max_limit ? ` (giới hạn ${data.max_limit} video)` : '';
            if (data.new_videos > 0) {
                showToast(`Đã tìm thấy & tải về ${data.new_videos} video mới từ kênh ${data.title}!${limitNote}`);
            } else {
                showToast(`Kênh ${data.title}: Chưa có video mới nào (đã kiểm tra ${data.total_rss || 0} mục RSS).`);
            }
            loadSavedChannels();
            loadVideos();
        } else {
            showToast('Lỗi: ' + (data.message || 'Không thể quét kênh'), true);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            showToast('🛑 Đã dừng quét kênh YouTube!', 'warning');
        } else {
            showToast('Lỗi quét kênh: ' + err.message, true);
        }
    } finally {
        _singleChannelAbortController = null;
        if (btn) {
            btn.removeAttribute('data-running');
            btn.className = origClass || 'btn btn-sm btn-primary';
            btn.innerHTML = origHtml || '<i class="fa-solid fa-bolt"></i> Quét Kênh Này Ngay';
        }
    }
}

let _isScanningAllChannels = false;
let _abortScanAllChannels = false;

async function scanAllSavedChannels(btn) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Quét Toàn Bộ Kênh')) {
        return;
    }

    if (_isScanningAllChannels) {
        _abortScanAllChannels = true;
        showToast('🛑 Đang yêu cầu dừng quét...', 'warning');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang dừng...';
        return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    const activeList = cachedSavedChannels.filter(c => c.is_active === 1);
    if (!activeList.length) {
        showToast('Không có kênh nào đang ở trạng thái Hoạt động!', true);
        return;
    }

    _isScanningAllChannels = true;
    _abortScanAllChannels = false;

    if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');
        btn.innerHTML = `<i class="fa-solid fa-hand"></i> Dừng Quét (0/${activeList.length})`;
    }
    showToast('Bắt đầu quét RSS toàn bộ kênh đang theo dõi... (Bấm nút đỏ để Dừng bất kỳ lúc nào)');

    let totalNew = 0;
    try {
        for (let i = 0; i < activeList.length; i++) {
            if (_abortScanAllChannels) {
                showToast('🛑 Đã dừng tiến trình quét các kênh còn lại!', 'warning');
                break;
            }
            const c = activeList[i];
            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-hand"></i> Dừng [${i + 1}/${activeList.length}]`;
            }
            try {
                const res = await fetch('/api/youtube/channels/scan-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channel_id: c.channel_id })
                });
                const data = await res.json();
                if (data.status === 'success' && data.new_videos > 0) {
                    totalNew += data.new_videos;
                }
            } catch (e) {
                console.warn('Lỗi quét kênh:', c.channel_id, e);
            }
        }
    } finally {
        _isScanningAllChannels = false;
        _abortScanAllChannels = false;
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
            btn.innerHTML = origHtml || '<i class="fa-solid fa-bolt"></i> Quét Toàn Bộ Ngay';
        }
        showToast(`Quét hoàn tất: Phát hiện & tải về ${totalNew} video mới!`, 'info');
        loadSavedChannels();
        loadVideos();
    }
}

async function unsaveChannelFromList(channelId, btn) {
    closeAllActionMenus();
    const ok = await showConfirmDialog({
        title: 'Bỏ Lưu Kênh YouTube',
        message: 'Bạn có chắc muốn BỎ LƯU và ngừng theo dõi kênh này?',
        details: 'Kênh sẽ không còn trong danh sách quét video tự động.',
        confirmText: 'Bỏ Theo Dõi',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const res = await fetch('/api/youtube/unsave-channel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Đã bỏ lưu kênh thành công!');
            loadSavedChannels();
            loadDashboardStats();
        } else {
            showToast('Lỗi khi bỏ lưu: ' + (data.message || 'Thất bại'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

function openChannelUrl(url) {
    closeAllActionMenus();
    if (url) window.open(url, '_blank');
}

function copyChannelUrl(url) {
    closeAllActionMenus();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Đã sao chép link kênh vào clipboard!');
    }).catch(err => {
        showToast('Không thể sao chép: ' + err.message, true);
    });
}

async function openChannelSettingsModal(channelId) {
    closeAllActionMenus();
    const channel = cachedSavedChannels.find(c => c.channel_id === channelId);
    if (!channel) {
        showToast('Không tìm thấy thông tin kênh!', true);
        return;
    }
    activeModalChannel = channel;

    document.getElementById('settingChannelId').value = channel.channel_id;
    document.getElementById('modalChannelTitleHeader').textContent = channel.display_name || channel.title;
    document.getElementById('modalChannelIdSub').textContent = `ID: ${channel.channel_id} • URL: ${channel.url || 'N/A'}`;
    document.getElementById('settingDisplayName').value = channel.display_name || channel.title || '';
    document.getElementById('settingCustomProxy').value = channel.custom_proxy || '';

    let defaultDl = 'data/downloads';
    let defaultRd = 'data/rendered';
    try {
        const defRes = await fetch('/api/settings/defaults');
        const defData = await defRes.json();
        if (defData.download_dir) defaultDl = defData.download_dir;
        if (defData.render_dir) defaultRd = defData.render_dir;
    } catch (_) { }

    const chDlInput = document.getElementById('settingDownloadDir');
    const chRdInput = document.getElementById('settingRenderDir');
    if (chDlInput) {
        chDlInput.value = (channel.download_dir && isAbsolutePath(channel.download_dir)) ? channel.download_dir : defaultDl;
    }
    if (chRdInput) {
        chRdInput.value = (channel.render_dir && isAbsolutePath(channel.render_dir)) ? channel.render_dir : defaultRd;
    }
    document.getElementById('settingIsActive').checked = channel.is_active === 1;
    document.getElementById('settingAutoDownload').checked = channel.auto_download === 1;
    document.getElementById('settingAutoRender').checked = channel.auto_render === 1;

    // Load cài đặt tải định dạng & thời lượng riêng cho kênh
    const chIncShorts = document.getElementById('settingChannelIncludeShorts');
    if (chIncShorts) chIncShorts.checked = (channel.include_shorts !== 0);
    const chIncLong = document.getElementById('settingChannelIncludeLongform');
    if (chIncLong) chIncLong.checked = (channel.include_longform !== 0);
    const chMinDur = document.getElementById('settingChannelMinDuration');
    applyMinDurationState(chIncShorts, chIncLong, chMinDur, channel.min_video_duration ?? null);
    const chMaxDur = document.getElementById('settingChannelMaxDuration');
    if (chMaxDur) chMaxDur.value = (channel.max_video_duration != null) ? channel.max_video_duration : '';
    // Load cài đặt Phụ đề AI riêng cho kênh
    const isSubEnabled = (channel.subtitle_enabled !== 0);
    const chSubSwitch = document.getElementById('settingChannelSubtitleSwitch');
    if (chSubSwitch) chSubSwitch.checked = isSubEnabled;
    const chSubWrap = document.getElementById('settingChannelSubtitleSettingsWrap');
    if (chSubWrap) chSubWrap.style.display = isSubEnabled ? '' : 'none';
    const chSubStyle = document.getElementById('settingChannelSubtitleStyle');
    if (chSubStyle) chSubStyle.value = channel.subtitle_style || 'inherit';
    const chSubPos = document.getElementById('settingChannelSubtitlePosition');
    if (chSubPos) chSubPos.value = channel.subtitle_position || 'inherit';
    const chNoSubShorts = document.getElementById('settingChannelDisableSubtitleForShorts');
    if (chNoSubShorts) chNoSubShorts.checked = (channel.disable_subtitle_for_shorts !== 0);

    // Load cài đặt Lồng tiếng AI (Zero-Unoriginal Audio) riêng cho kênh
    const chNarrSwitch = document.getElementById('settingChannelNarrationSwitch');
    const chNarrWrap = document.getElementById('settingChannelNarrationWrap');
    const chNarrLang = document.getElementById('settingChannelNarrationLanguage');
    const chNarrGender = document.getElementById('settingChannelVoiceGender');
    const chNarrStyle = document.getElementById('settingChannelNarrationStyle');
    if (chNarrSwitch) {
        chNarrSwitch.checked = (channel.narration_enabled === 1);
        if (chNarrWrap) chNarrWrap.style.display = chNarrSwitch.checked ? 'block' : 'none';
    }
    if (chNarrLang) chNarrLang.value = channel.narration_language || 'inherit';
    updateVoiceDropdownOptions('settingChannelVoiceGender', channel.narration_language || 'inherit', channel.voice_gender || 'inherit', true);
    if (chNarrStyle) chNarrStyle.value = channel.narration_style || 'inherit';
    const chNoNarrShorts = document.getElementById('settingChannelDisableNarrationForShorts');
    if (chNoNarrShorts) chNoNarrShorts.checked = (channel.disable_narration_for_shorts !== 0);
    const chKeepAudio = document.getElementById('settingChannelKeepOriginalScriptForShorts');
    if (chKeepAudio) chKeepAudio.checked = (channel.keep_original_script_for_shorts !== 0);

    const chTtsEngine = channel.tts_engine || 'edge-tts';
    const chTtsRadio = document.querySelector(`input[name="channelTtsEngineRadio"][value="${chTtsEngine}"]`);
    if (chTtsRadio) chTtsRadio.checked = true;
    toggleChannelTtsEngine(chTtsEngine);
    if (chTtsEngine === 'elevenlabs') {
        populateElevenLabsVoicesToSelect('settingChannelElevenLabsVoiceId', channel.elevenlabs_voice_id || '');
    }
    const chElModel = document.getElementById('settingChannelElevenLabsModel');
    if (chElModel && channel.elevenlabs_model) chElModel.value = channel.elevenlabs_model;

    const chMpImgSwitch = document.getElementById('settingChannelUseAiImages');
    const chMpImgWrap = document.getElementById('settingChannelImageStyleWrap');
    const chMpImgStyle = document.getElementById('settingChannelImageStyle');
    if (chMpImgSwitch) {
        chMpImgSwitch.checked = (channel.use_ai_images === 1);
        toggleAiStoryCard('settingChannel', chMpImgSwitch.checked);
    }
    if (chMpImgStyle) chMpImgStyle.value = channel.image_style || 'inherit';
    const chVisualSource = document.getElementById('settingChannelVisualSource');
    if (chVisualSource) chVisualSource.value = channel.visual_source || 'inherit';
    const chAiModel = document.getElementById('settingChannelAiImageModel');
    if (chAiModel) chAiModel.value = channel.ai_image_model || 'inherit';
    const chAiVideoModel = document.getElementById('settingChannelAiVideoModel');
    if (chAiVideoModel) chAiVideoModel.value = channel.ai_video_model || 'inherit';
    const chStockProvider = document.getElementById('settingChannelStockProvider');
    if (chStockProvider) chStockProvider.value = channel.stock_provider || 'inherit';


    const chKbSwitch = document.getElementById('settingChannelKenBurnsSwitch');
    if (chKbSwitch) chKbSwitch.checked = (channel.ken_burns_enabled !== 0);
    const chEcSwitch = document.getElementById('settingChannelEndcardSwitch');
    if (chEcSwitch) chEcSwitch.checked = (channel.endcard_enabled !== 0);

    // Load Chế độ Xuất Biến Thể & Hook Tâm Lý riêng cho kênh
    const chVariantMode = document.getElementById('settingChannelVariantMode');
    const chHookAngle = document.getElementById('settingChannelHookAngle');
    let currentVarMode = 'inherit';
    if (channel.generate_variants === 1) {
        currentVarMode = 'variants';
    } else if (channel.generate_variants === 0) {
        currentVarMode = 'single';
    } else {
        currentVarMode = 'inherit';
    }
    if (chVariantMode) chVariantMode.value = currentVarMode;
    if (chHookAngle) chHookAngle.value = channel.hook_angle || 'inherit';
    syncChannelVariantModeUI(currentVarMode);

    // Load và gán cài đặt BGM cho kênh
    populateChannelBgmSelect(channel.bgm_folder || '', channel.bgm_volume != null ? channel.bgm_volume : 0.15);

    // Load cài đặt giới hạn tải khi quét thủ công (Manual Scan Limit)
    // Mặc định bằng scan_all_monitored_channels cap (max_videos_per_scan từ scheduler settings)
    let defaultMaxManual = 5;
    try {
        const schedRes = await fetch('/api/scheduler/settings');
        const schedData = await schedRes.json();
        if (schedData && schedData.max_videos_per_scan) {
            defaultMaxManual = schedData.max_videos_per_scan;
        }
    } catch (_) { }

    const chMaxManualInput = document.getElementById('settingMaxManualVideos');
    const chMaxManualBadge = document.getElementById('settingMaxManualVideosBadge');
    const effectiveManualVal = (channel.max_manual_videos !== null && channel.max_manual_videos !== undefined && channel.max_manual_videos !== '')
        ? channel.max_manual_videos
        : defaultMaxManual;
    if (chMaxManualInput) {
        chMaxManualInput.value = effectiveManualVal;
        chMaxManualInput.placeholder = defaultMaxManual;
    }
    if (chMaxManualBadge) {
        chMaxManualBadge.textContent = `${effectiveManualVal} video/lần`;
    }

    document.getElementById('channelSettingsModal').classList.add('active');
}

function closeChannelSettingsModal() {
    if (_singleChannelAbortController) {
        stopSingleChannelScan(document.getElementById('btnModalScanNow'));
    }
    const modal = document.getElementById('channelSettingsModal');
    if (modal) modal.classList.remove('active');
    activeModalChannel = null;
    const btn = document.getElementById('btnModalScanNow');
    if (btn) {
        btn.removeAttribute('data-running');
        btn.className = 'btn btn-sm btn-primary';
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Quét Kênh Này Ngay';
    }
}

function openCurrentChannelYouTube() {
    if (activeModalChannel && activeModalChannel.url) {
        window.open(activeModalChannel.url, '_blank');
    } else if (activeModalChannel) {
        window.open('https://www.youtube.com/channel/' + activeModalChannel.channel_id, '_blank');
    }
}

function copyCurrentChannelUrl() {
    if (activeModalChannel) {
        const url = activeModalChannel.url || ('https://www.youtube.com/channel/' + activeModalChannel.channel_id);
        copyChannelUrl(url);
    }
}

function scanCurrentChannelNow(btn) {
    if (activeModalChannel) {
        const inputLimit = document.getElementById('settingMaxManualVideos');
        const limitVal = inputLimit && inputLimit.value ? parseInt(inputLimit.value, 10) : null;
        scanSingleChannel(activeModalChannel.channel_id, btn, limitVal);
    }
}

async function saveChannelSettings(btn) {
    const channelId = document.getElementById('settingChannelId')?.value;
    if (!channelId) return;

    const rawDisplayName = (document.getElementById('settingDisplayName')?.value || '').trim();
    const displayName = rawDisplayName || (activeModalChannel ? (activeModalChannel.title || '') : '').trim();
    const customProxy = (document.getElementById('settingCustomProxy')?.value || '').trim();
    const downloadDir = (document.getElementById('settingDownloadDir')?.value || '').trim();
    const renderDir = (document.getElementById('settingRenderDir')?.value || '').trim();
    const bgmVolumeInput = document.getElementById('settingBgmVolume');
    const rawBgmVolume = bgmVolumeInput ? bgmVolumeInput.value : '0.15';
    const bgmVolume = parseFloat(rawBgmVolume);
    if (customProxy && !isValidProxyFormat(customProxy)) {
        markInputError('settingCustomProxy', 'Định dạng Proxy không hợp lệ! Ví dụ: ip:port hoặc ip:port:user:pass');
        return;
    }
    if (isNaN(bgmVolume) || bgmVolume < 0 || bgmVolume > 1) {
        markInputError('settingBgmVolume', 'Âm lượng nhạc nền BGM phải từ 0.0 đến 1.0 (0% - 100%)!');
        return;
    }

    const incShorts = document.getElementById('settingChannelIncludeShorts')?.checked ? 1 : 0;
    const incLong = document.getElementById('settingChannelIncludeLongform')?.checked ? 1 : 0;
    if (!incShorts && !incLong) {
        showToast('⚠️ Vui lòng chọn ít nhất một định dạng video: Shorts hoặc Video Dài!', true);
        return;
    }

    const minDurRaw = (document.getElementById('settingChannelMinDuration')?.value || '').trim();
    const maxDurRaw = (document.getElementById('settingChannelMaxDuration')?.value || '').trim();
    const minDur = minDurRaw !== '' && !isNaN(parseInt(minDurRaw, 10)) ? parseInt(minDurRaw, 10) : null;
    const maxDur = maxDurRaw !== '' && !isNaN(parseInt(maxDurRaw, 10)) ? parseInt(maxDurRaw, 10) : null;

    if (minDur !== null && maxDur !== null && minDur >= maxDur) {
        markInputError('settingChannelMinDuration', 'Thời lượng tối thiểu phải nhỏ hơn thời lượng tối đa!');
        return;
    }

    const maxManualRaw = (document.getElementById('settingMaxManualVideos')?.value || '').trim();
    const maxManual = maxManualRaw !== '' && !isNaN(parseInt(maxManualRaw, 10)) ? Math.max(1, parseInt(maxManualRaw, 10)) : null;

    const payload = {
        channel_id: channelId,
        display_name: displayName,
        custom_proxy: customProxy,
        download_dir: downloadDir,
        render_dir: renderDir,
        is_active: document.getElementById('settingIsActive')?.checked ? 1 : 0,
        auto_download: document.getElementById('settingAutoDownload')?.checked ? 1 : 0,
        auto_render: document.getElementById('settingAutoRender')?.checked ? 1 : 0,
        bgm_folder: document.getElementById('settingBgmFolder')?.value || '',
        bgm_volume: bgmVolume,
        min_video_duration: minDur,
        max_video_duration: maxDur,
        include_shorts: incShorts,
        include_longform: incLong,
        disable_subtitle_for_shorts: document.getElementById('settingChannelDisableSubtitleForShorts')?.checked ? 1 : 0,
        subtitle_enabled: document.getElementById('settingChannelSubtitleSwitch')?.checked ? 1 : 0,
        subtitle_style: document.getElementById('settingChannelSubtitleStyle')?.value || 'inherit',
        subtitle_position: document.getElementById('settingChannelSubtitlePosition')?.value || 'inherit',
        max_manual_videos: maxManual,
        narration_enabled: document.getElementById('settingChannelNarrationSwitch')?.checked ? 1 : 0,
        narration_language: document.getElementById('settingChannelNarrationLanguage')?.value || 'inherit',
        voice_gender: document.getElementById('settingChannelVoiceGender')?.value || 'inherit',
        narration_style: document.getElementById('settingChannelNarrationStyle')?.value || 'inherit',
        disable_narration_for_shorts: document.getElementById('settingChannelDisableNarrationForShorts')?.checked ? 1 : 0,
        keep_original_script_for_shorts: document.getElementById('settingChannelKeepOriginalScriptForShorts')?.checked ? 1 : 0,
        tts_engine: document.querySelector('input[name="channelTtsEngineRadio"]:checked')?.value || 'edge-tts',
        elevenlabs_voice_id: document.getElementById('settingChannelElevenLabsVoiceId')?.value || '',
        elevenlabs_model: document.getElementById('settingChannelElevenLabsModel')?.value || 'eleven_multilingual_v2',

        ken_burns_enabled: document.getElementById('settingChannelKenBurnsSwitch')?.checked ? 1 : 0,
        endcard_enabled: document.getElementById('settingChannelEndcardSwitch')?.checked ? 1 : 0,
        use_ai_images: document.getElementById('settingChannelUseAiImages')?.checked ? 1 : 0,
        image_style: document.getElementById('settingChannelImageStyle')?.value || 'inherit',
        visual_source: document.getElementById('settingChannelVisualSource')?.value || 'inherit',
        ai_image_model: document.getElementById('settingChannelAiImageModel')?.value || 'inherit',
        ai_video_model: document.getElementById('settingChannelAiVideoModel')?.value || 'inherit',
        stock_provider: document.getElementById('settingChannelStockProvider')?.value || 'inherit',
        hook_angle: document.getElementById('settingChannelHookAngle')?.value || 'inherit',
        generate_variants: (() => {
            const vm = document.getElementById('settingChannelVariantMode')?.value || 'inherit';
            if (vm === 'variants') return 1;
            if (vm === 'single') return 0;
            return -1;
        })()
    };

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    try {
        const res = await fetch('/api/youtube/channels/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = { detail: 'Lỗi máy chủ (' + res.status + '): Phản hồi không hợp lệ' };
        }
        if (res.ok && data.status === 'success') {
            showToast('✅ Đã lưu cấu hình kênh thành công!', 'success');
            // Optimistically update cachedSavedChannels in memory so immediate re-opens show the new data
            const ch = (cachedSavedChannels || []).find(c => c.channel_id === channelId);
            if (ch) {
                ch.display_name = displayName;
                ch.custom_proxy = customProxy;
                ch.download_dir = downloadDir;
                ch.render_dir = renderDir;
                ch.is_active = payload.is_active;
                ch.auto_download = payload.auto_download;
                ch.auto_render = payload.auto_render;
                ch.bgm_folder = payload.bgm_folder;
                ch.bgm_volume = payload.bgm_volume;
                ch.min_video_duration = minDur;
                ch.max_video_duration = maxDur;
                ch.include_shorts = incShorts;
                ch.include_longform = incLong;
                ch.disable_subtitle_for_shorts = payload.disable_subtitle_for_shorts;
                ch.subtitle_enabled = payload.subtitle_enabled;
                ch.subtitle_style = payload.subtitle_style;
                ch.subtitle_position = payload.subtitle_position;
                ch.max_manual_videos = maxManual;
            }
            closeChannelSettingsModal();
            await loadSavedChannels();
        } else {
            showToast('Lỗi khi lưu: ' + (data.detail || data.message || 'Thất bại'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function clearChannelVideoHistory(channelId, target = 'downloaded') {
    closeAllActionMenus();
    const ch = (cachedSavedChannels || []).find(c => c.channel_id === channelId);
    const channelName = ch ? (ch.display_name || ch.title || channelId) : channelId;
    const isDownloaded = target === 'downloaded';
    const actionLabel = isDownloaded ? 'video đã tải' : 'video đã render';

    const ok = await showConfirmDialog({
        title: `Xóa Lịch Sử ${actionLabel.toUpperCase()}`,
        message: `Bạn có chắc muốn XÓA LỊCH SỬ ${actionLabel} của kênh "${channelName}"?`,
        details: 'Thao tác này cũng sẽ xóa các file trên máy tính để giải phóng dung lượng!',
        confirmText: 'Xác Nhận Xóa',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    try {
        const res = await fetch('/api/youtube/channels/clear-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channelId, delete_files: true, target: target })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Đã xóa ${data.deleted_videos} ${actionLabel} (${data.files_deleted} files) của kênh "${channelName}"!`);
            if (typeof loadSavedChannels === 'function') loadSavedChannels();
            if (typeof loadVideos === 'function') loadVideos();
            if (typeof loadPipelineStatus === 'function') loadPipelineStatus();
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
        } else {
            showToast('Lỗi khi xóa lịch sử: ' + (data.message || 'Thất bại'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    }
}

async function clearChannelHistoryFromModal(btn) {
    if (!activeModalChannel) return;
    const cid = activeModalChannel.channel_id;
    const name = activeModalChannel.display_name || activeModalChannel.title;

    const ok = await showConfirmDialog({
        title: 'Đặt Lại Lịch Sử Kênh (Reset)',
        message: `Bạn có chắc muốn ĐẶT LẠI LỊCH SỬ video của kênh "${name}"?`,
        details: 'Hệ thống sẽ xóa bộ nhớ chống trùng lặp và các file video cũ của kênh này, cho phép bạn quét và tải lại các video từ đầu.',
        confirmText: 'Xác Nhận Đặt Lại',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
        const res = await fetch('/api/youtube/channels/clear-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: cid, delete_files: true })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Đã xóa ${data.deleted_videos} video (${data.files_deleted} files) của kênh này!`);
            loadSavedChannels();
            loadVideos();
            loadPipelineStatus();
        } else {
            showToast('Lỗi khi xóa lịch sử: ' + (data.message || 'Thất bại'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function deleteChannelFromModal(btn) {
    if (!activeModalChannel) return;
    const cid = activeModalChannel.channel_id;
    const name = activeModalChannel.display_name || activeModalChannel.title;

    const ok = await showConfirmDialog({
        title: 'Bỏ Lưu Kênh',
        message: `Bạn có chắc chắn muốn bỏ theo dõi kênh "${name}"?`,
        details: 'Kênh sẽ bị xóa khỏi danh sách giám sát và dừng tự động tải/render video mới.',
        confirmText: 'Bỏ Lưu',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Bỏ Lưu...';
    }

    try {
        const res = await fetch(`/api/youtube/channels/${encodeURIComponent(cid)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Đã bỏ lưu kênh "${name}" thành công!`);
            closeChannelSettingsModal();
            cachedSavedChannels = (cachedSavedChannels || []).filter(c => c.channel_id !== cid);
            const raw = (rawYtChannels || []).find(c => c.channel_id === cid);
            if (raw) raw.is_saved = false;
            if (activeDetailChannel && activeDetailChannel.channel_id === cid) {
                activeDetailChannel.is_saved = false;
                updateDetailModalSaveBtn();
            }
            loadSavedChannels();
            renderYtChannelsTable();
            loadDashboardStats();
        } else {
            showToast('Lỗi khi bỏ lưu kênh: ' + (data.message || 'Thất bại'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Module Window Exposures
window.clearChannelHistoryFromModal = clearChannelHistoryFromModal;
window.clearChannelVideoHistory = clearChannelVideoHistory;
window.closeChannelSettingsModal = closeChannelSettingsModal;
window.copyChannelUrl = copyChannelUrl;
window.copyCurrentChannelUrl = copyCurrentChannelUrl;
window.deleteChannelFromModal = deleteChannelFromModal;
window.exportSavedChannelsCsv = exportSavedChannelsCsv;
window.getFilteredSavedChannels = getFilteredSavedChannels;
window.handleSavedFilterCadenceChange = handleSavedFilterCadenceChange;
window.handleSavedFilterCountryChange = handleSavedFilterCountryChange;
window.handleSavedFilterSubsChange = handleSavedFilterSubsChange;
window.handleSavedFilterViewsChange = handleSavedFilterViewsChange;
window.handleSavedHeaderSort = handleSavedHeaderSort;
window.handleSavedSortSelectChange = handleSavedSortSelectChange;
window.loadSavedChannels = loadSavedChannels;
window.openChannelUrl = openChannelUrl;
window.openCurrentChannelYouTube = openCurrentChannelYouTube;
window.refreshActiveChannelStats = refreshActiveChannelStats;
window.refreshChannelStatsFromMenu = refreshChannelStatsFromMenu;
window.renderSavedChannelsTable = renderSavedChannelsTable;
window.resetSavedFilters = resetSavedFilters;
window.saveChannelSettings = saveChannelSettings;
window.scanAllSavedChannels = scanAllSavedChannels;
window.scanCurrentChannelNow = scanCurrentChannelNow;
window.toggleChannelStatusInline = toggleChannelStatusInline;
window.toggleSavedSortDirection = toggleSavedSortDirection;
window.unsaveChannelFromList = unsaveChannelFromList;
window.openChannelSettingsModal = openChannelSettingsModal;
window.scanSingleChannel = scanSingleChannel;
window.stopSingleChannelScan = stopSingleChannelScan;
