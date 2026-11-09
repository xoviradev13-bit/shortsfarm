// ==========================================
// 4. GPMLOGIN PROFILES & TIKTOK TRACKER
// ==========================================
// ==========================================
// 4. GPMLOGIN PROFILES & TIKTOK TRACKER
// ==========================================
let gpmSortField = 'followers_count';
let gpmSortDirection = 'desc';

async function loadGpmProfiles() {
    try {
        const res = await fetch('/api/gpm/profiles');
        const profiles = await res.json();
        cachedGpmProfiles = profiles;
        renderGpmProfilesTable();
    } catch (err) {
        console.error('Lỗi nạp profiles:', err);
    }
}

function handleGpmSortChange(val) {
    gpmSortField = val;
    renderGpmProfilesTable();
}

function toggleGpmSortDirection() {
    gpmSortDirection = gpmSortDirection === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('gpmSortDirIcon');
    const text = document.getElementById('gpmSortDirText');
    if (icon) icon.className = gpmSortDirection === 'asc' ? 'fa-solid fa-arrow-up-wide-short' : 'fa-solid fa-arrow-down-wide-short';
    if (text) text.textContent = gpmSortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';
    renderGpmProfilesTable();
}

function handleGpmHeaderSort(field) {
    if (gpmSortField === field) {
        gpmSortDirection = gpmSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        gpmSortField = field;
        gpmSortDirection = (field === 'followers_count' || field === 'eligible_10k') ? 'desc' : 'asc';
    }
    const select = document.getElementById('sortGpmField');
    if (select) select.value = gpmSortField;
    const icon = document.getElementById('gpmSortDirIcon');
    const text = document.getElementById('gpmSortDirText');
    if (icon) icon.className = gpmSortDirection === 'asc' ? 'fa-solid fa-arrow-up-wide-short' : 'fa-solid fa-arrow-down-wide-short';
    if (text) text.textContent = gpmSortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';
    renderGpmProfilesTable();
}

function resetGpmFilters() {
    gpmSortField = 'followers_count';
    gpmSortDirection = 'desc';
    const sortSel = document.getElementById('sortGpmField');
    if (sortSel) sortSel.value = 'followers_count';
    const filter10k = document.getElementById('filterGpm10k');
    if (filter10k) filter10k.value = 'all';
    const filterNotify = document.getElementById('filterGpmNotify');
    if (filterNotify) filterNotify.value = 'all';
    const filterNick = document.getElementById('filterGpmNick');
    if (filterNick) filterNick.value = 'all';
    const searchKw = document.getElementById('searchGpmKeyword');
    if (searchKw) searchKw.value = '';
    const icon = document.getElementById('gpmSortDirIcon');
    const text = document.getElementById('gpmSortDirText');
    if (icon) icon.className = 'fa-solid fa-arrow-down-wide-short';
    if (text) text.textContent = 'Giảm dần';
    renderGpmProfilesTable();
}

async function exportGpmProfilesCsv() {
    if (!cachedGpmProfiles || !cachedGpmProfiles.length) {
        try {
            const res = await fetch('/api/gpm/profiles');
            const data = await res.json();
            if (Array.isArray(data)) cachedGpmProfiles = data;
        } catch (e) {
            console.warn('Lỗi tải profiles trước khi xuất CSV:', e);
        }
    }
    const filter10k = document.getElementById('filterGpm10k')?.value || 'all';
    const filterNotify = document.getElementById('filterGpmNotify')?.value || 'all';
    const filterNick = document.getElementById('filterGpmNick')?.value || 'all';
    const keyword = (document.getElementById('searchGpmKeyword')?.value || '').trim().toLowerCase();

    let list = (cachedGpmProfiles || []).slice();

    if (filter10k === '10k') {
        list = list.filter(p => isProfileEligible(p));
    } else if (filter10k === 'growing') {
        list = list.filter(p => !isProfileEligible(p));
    }

    if (filterNotify === 'tracking') {
        list = list.filter(p => (p.notify_status || 'tracking').toLowerCase() === 'tracking');
    } else if (filterNotify === 'sent') {
        list = list.filter(p => (p.notify_status || '').toLowerCase() === 'sent');
    } else if (filterNotify === 'muted') {
        list = list.filter(p => (p.notify_status || '').toLowerCase() === 'muted');
    }

    if (filterNick === 'attached') {
        list = list.filter(p => Boolean(p.tiktok_username && p.tiktok_username.trim()));
    } else if (filterNick === 'unattached') {
        list = list.filter(p => !Boolean(p.tiktok_username && p.tiktok_username.trim()));
    }

    if (keyword) {
        list = list.filter(p => {
            const name = (p.name || '').toLowerCase();
            const u = (p.tiktok_username || '').toLowerCase();
            const nick = (p.tiktok_nickname || '').toLowerCase();
            const uid = (p.tiktok_uid || '').toLowerCase();
            const proxy = (p.raw_proxy || '').toLowerCase();
            const gid = (p.gpm_id || '').toLowerCase();
            const nstat = (p.notify_status || 'tracking').toLowerCase();
            return name.includes(keyword) || u.includes(keyword) || nick.includes(keyword) || uid.includes(keyword) || proxy.includes(keyword) || gid.includes(keyword) || nstat.includes(keyword);
        });
    }

    list.sort((a, b) => {
        let res = 0;
        if (gpmSortField === 'followers_count') {
            res = (a.followers_count || 0) - (b.followers_count || 0);
        } else if (gpmSortField === 'name') {
            res = (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' });
        } else if (gpmSortField === 'tiktok_username') {
            res = (a.tiktok_username || '').localeCompare(b.tiktok_username || '', 'vi', { sensitivity: 'base' });
        } else if (gpmSortField === 'eligible_10k') {
            const ea = isProfileEligible(a) ? 1 : 0;
            const eb = isProfileEligible(b) ? 1 : 0;
            res = ea - eb;
        } else if (gpmSortField === 'notify_status') {
            res = (a.notify_status || 'tracking').localeCompare(b.notify_status || 'tracking');
        } else if (gpmSortField === 'last_checked') {
            res = (a.last_checked || '').localeCompare(b.last_checked || '');
        }
        return gpmSortDirection === 'asc' ? res : -res;
    });

    const header = ['Tên Profile', 'GPM ID', 'Nền Tảng', 'Account Username', 'Proxy', 'Số Follower / Subs', 'Đạt Chỉ Tiêu / Beta', 'Trạng Thái Theo Dõi', 'Lần Quét Cuối'];
    const rows = [header, ...list.map(p => {
        const ns = (p.notify_status || 'tracking').toLowerCase();
        const nsLabel = ns === 'sent' ? 'Đã gửi' : (ns === 'muted' ? 'Bỏ theo dõi' : 'Đang theo dõi');
        return [
            p.name || '',
            p.gpm_id || '',
            (p.platform || 'tiktok').toUpperCase(),
            p.tiktok_username || '',
            p.raw_proxy || '',
            p.followers_count || 0,
            isProfileEligible(p) ? 'Đạt' : 'Chưa Đạt',
            nsLabel,
            p.last_checked || ''
        ];
    })];

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`dan_tai_khoan_gpm_${dateStr}.csv`, rows);
}

function renderGpmProfilesTable() {
    const tbody = document.getElementById('gpmTableBody');
    const eligibleGrid = document.getElementById('eligibleCardsGrid');
    if (!tbody) return;

    const filter10k = document.getElementById('filterGpm10k') ? document.getElementById('filterGpm10k').value : 'all';
    const filterNotify = document.getElementById('filterGpmNotify') ? document.getElementById('filterGpmNotify').value : 'all';
    const filterNick = document.getElementById('filterGpmNick') ? document.getElementById('filterGpmNick').value : 'all';
    const filterPlatform = document.getElementById('filterAccountPlatform') ? document.getElementById('filterAccountPlatform').value : 'all';
    const filterBrowser = document.getElementById('filterAccountBrowser') ? document.getElementById('filterAccountBrowser').value : 'all';
    const keyword = (document.getElementById('searchGpmKeyword') ? document.getElementById('searchGpmKeyword').value : '').trim().toLowerCase();

    let list = (cachedGpmProfiles || []).slice();

    // 1. Lọc theo chuẩn 10K
    if (filter10k === '10k') {
        list = list.filter(p => isProfileEligible(p));
    } else if (filter10k === 'growing') {
        list = list.filter(p => !isProfileEligible(p));
    }

    // 2. Lọc theo trạng thái theo dõi 10K
    if (filterNotify === 'tracking') {
        list = list.filter(p => (p.notify_status || 'tracking').toLowerCase() === 'tracking');
    } else if (filterNotify === 'sent') {
        list = list.filter(p => (p.notify_status || '').toLowerCase() === 'sent');
    } else if (filterNotify === 'muted') {
        list = list.filter(p => (p.notify_status || '').toLowerCase() === 'muted');
    }

    // 3. Lọc theo trạng thái gán nick
    if (filterNick === 'attached') {
        list = list.filter(p => Boolean(p.tiktok_username && p.tiktok_username.trim()));
    } else if (filterNick === 'unattached') {
        list = list.filter(p => !Boolean(p.tiktok_username && p.tiktok_username.trim()));
    }

    // Lọc theo Nền tảng & Trình duyệt
    if (filterPlatform && filterPlatform !== 'all') {
        list = list.filter(p => (p.platform || 'tiktok').toLowerCase() === filterPlatform.toLowerCase());
    }
    if (filterBrowser && filterBrowser !== 'all') {
        list = list.filter(p => (p.browser_type || 'gpm').toLowerCase() === filterBrowser.toLowerCase());
    }

    // 4. Lọc từ khóa
    if (keyword) {
        list = list.filter(p => {
            const name = (p.name || '').toLowerCase();
            const u = (p.tiktok_username || '').toLowerCase();
            const proxy = (p.raw_proxy || '').toLowerCase();
            const gid = (p.gpm_id || '').toLowerCase();
            const nstat = (p.notify_status || 'tracking').toLowerCase();
            return name.includes(keyword) || u.includes(keyword) || proxy.includes(keyword) || gid.includes(keyword) || nstat.includes(keyword);
        });
    }

    // 5. Sắp xếp
    list.sort((a, b) => {
        let res = 0;
        if (gpmSortField === 'followers_count') {
            res = (a.followers_count || 0) - (b.followers_count || 0);
        } else if (gpmSortField === 'name') {
            res = (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' });
        } else if (gpmSortField === 'tiktok_username') {
            res = (a.tiktok_username || '').localeCompare(b.tiktok_username || '', 'vi', { sensitivity: 'base' });
        } else if (gpmSortField === 'eligible_10k') {
            const ea = isProfileEligible(a) ? 1 : 0;
            const eb = isProfileEligible(b) ? 1 : 0;
            res = ea - eb;
        } else if (gpmSortField === 'notify_status') {
            res = (a.notify_status || 'tracking').localeCompare(b.notify_status || 'tracking');
        } else if (gpmSortField === 'last_checked') {
            res = (a.last_checked || '').localeCompare(b.last_checked || '');
        }
        return gpmSortDirection === 'asc' ? res : -res;
    });

    // Cập nhật badge số lượng
    const badgeCount = document.getElementById('badgeGpmCount');
    if (badgeCount) {
        badgeCount.textContent = `${list.length}/${cachedGpmProfiles.length} Profile`;
    }

    // Cập nhật icon sort trên header
    ['name', 'tiktok_username', 'followers_count', 'eligible_10k', 'notify_status'].forEach(f => {
        const th = document.getElementById(`th-gpm-${f}`);
        if (!th) return;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (gpmSortField === f) {
            th.classList.add('sorted');
            icon.className = gpmSortDirection === 'asc' ? 'fa-solid fa-sort-up sort-icon active' : 'fa-solid fa-sort-down sort-icon active';
        } else {
            th.classList.remove('sorted');
            icon.className = 'fa-solid fa-sort sort-icon';
        }
    });

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="fa-solid fa-folder-open" style="font-size: 24px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>Không tìm thấy profile nào phù hợp với bộ lọc.</td></tr>`;
    } else {
        tbody.innerHTML = list.map(p => {
            const plat = (p.platform || 'tiktok').toLowerCase();
            const channelsList = p.channels && p.channels.length > 0 ? p.channels : null;
            const hasMultiChannels = Boolean(channelsList && channelsList.length > 1);
            const isExpanded = window.expandedProfileIds && window.expandedProfileIds.has(p.gpm_id);

            // Kênh mặc định / kênh chính
            const defCh = channelsList ? (channelsList.find(c => c.is_default) || channelsList[0]) : null;

            const linkedOther = findLinkedCrossBrowserProfile(p, cachedGpmProfiles);
            let crossBrowserBadge = '';
            if (linkedOther) {
                const otherBType = (linkedOther.browser_type || 'gpm').toLowerCase();
                const otherBName = otherBType === 'genlogin' ? 'GEN' : (otherBType === 'adspower' ? 'AdsPower' : (otherBType === 'dolphin' ? 'Dolphin' : 'GPM'));
                const otherIdOrName = linkedOther.name ? linkedOther.name : (linkedOther.gpm_id ? `#${linkedOther.gpm_id}` : '');
                crossBrowserBadge = `
                    <div style="margin-top:2px;">
                        <span class="badge" style="background:rgba(234,179,8,0.14); color:#fbbf24; border:1px solid rgba(234,179,8,0.35); font-size:9px; padding:1px 5px; font-weight:600; display:inline-flex; align-items:center; gap:3px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Trùng tài khoản với ${otherBName} (${escapeHtml(otherIdOrName)})">
                            <i class="fa-solid fa-link" style="font-size:8.5px;"></i> Trùng với ${escapeHtml(otherIdOrName)}
                        </span>
                    </div>`;
            }

            let usernameDisplay = '';

            if (plat === 'youtube') {
                if (channelsList) {
                    const chToShow = defCh || channelsList[0];
                    const rawUrl = (chToShow.channel_url || '').trim();
                    let ytLink = '';
                    let ytHandle = '';

                    if (rawUrl.startsWith('http')) {
                        ytLink = rawUrl;
                        ytHandle = rawUrl.split('/').pop();
                    } else if (rawUrl.startsWith('@') && !rawUrl.includes(' ')) {
                        ytLink = `https://www.youtube.com/${rawUrl}`;
                        ytHandle = rawUrl;
                    } else if (chToShow.channel_id) {
                        ytLink = `https://www.youtube.com/channel/${chToShow.channel_id}`;
                        ytHandle = chToShow.channel_id.startsWith('UC') ? `ID: ${chToShow.channel_id}` : (rawUrl ? (rawUrl.startsWith('@') ? rawUrl : `@${rawUrl}`) : `@${chToShow.channel_name}`);
                    } else {
                        const cleanHandle = rawUrl.startsWith('@') ? rawUrl : `@${rawUrl || chToShow.channel_name}`;
                        ytLink = `https://www.youtube.com/${encodeURIComponent(cleanHandle)}`;
                        ytHandle = cleanHandle;
                    }

                    usernameDisplay = `
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <a href="${escapeHtml(ytLink)}" target="_blank" class="table-text-truncate" style="max-width:130px; color:#ef4444; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(chToShow.channel_name)} (${escapeHtml(chToShow.channel_id)})">
                                    <i class="fa-brands fa-youtube" style="color:#ef4444; flex-shrink:0;"></i>
                                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(chToShow.channel_name)}</span>
                                </a>
                                <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(chToShow.channel_url || chToShow.channel_name || '')}', ${chToShow.followers_count || p.followers_count || 0}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', 'youtube', '${escapeHtml(chToShow.channel_id || '')}')" data-tooltip="Sửa nick &amp; chỉ số">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            <div class="table-text-truncate text-muted" style="max-width:135px; font-size:11px; font-weight:500;" title="ID: ${escapeHtml(chToShow.channel_id)}">
                                <i class="fa-solid fa-id-badge" style="font-size:10px; opacity:0.7;"></i> ${escapeHtml(ytHandle)}
                            </div>
                            ${crossBrowserBadge}
                        </div>`;
                } else {
                    const rawHandle = (p.channel_handle || p.tiktok_username || '').trim();
                    let ytLink = '';
                    let cleanHandle = '';

                    if (rawHandle.startsWith('http')) {
                        ytLink = rawHandle;
                        cleanHandle = rawHandle.split('/').pop();
                    } else if (rawHandle.startsWith('@') && !rawHandle.includes(' ')) {
                        ytLink = `https://www.youtube.com/${rawHandle}`;
                        cleanHandle = rawHandle;
                    } else if (rawHandle.startsWith('UC')) {
                        ytLink = `https://www.youtube.com/channel/${rawHandle}`;
                        cleanHandle = `ID: ${rawHandle}`;
                    } else if (rawHandle) {
                        cleanHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
                        ytLink = `https://www.youtube.com/${encodeURIComponent(cleanHandle)}`;
                    }

                    usernameDisplay = cleanHandle ? `
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <a href="${escapeHtml(ytLink)}" target="_blank" class="table-text-truncate" style="max-width:150px; color:#ef4444; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(cleanHandle)}">
                                    <i class="fa-brands fa-youtube" style="color:#ef4444; flex-shrink:0;"></i> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(cleanHandle)}</span>
                                </a>
                                <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(cleanHandle)}', ${p.followers_count || 0}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', 'youtube')" data-tooltip="Sửa nick &amp; chỉ số">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            ${p.tiktok_nickname ? `<div class="table-text-truncate text-muted" style="max-width:165px; font-size:11.5px; font-weight:500;" title="${escapeHtml(p.tiktok_nickname)}"><i class="fa-solid fa-id-badge" style="font-size:10px; opacity:0.7;"></i> ${escapeHtml(p.tiktok_nickname)}</div>` : ''}
                            ${crossBrowserBadge}
                        </div>` : `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="text-muted" style="font-size:12px;"><i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Chưa gắn</span>
                            <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '', ${p.followers_count || 0}, '', '${escapeHtml(p.browser_type || 'gpm')}', 'youtube')" data-tooltip="Gán Kênh YouTube Cho Profile" style="width:auto; padding:0 8px; font-size:10.5px; gap:4px;">
                                <i class="fa-solid fa-plus"></i> Gán
                            </button>
                        </div>`;
                }
            } else if (plat === 'facebook') {
                if (channelsList) {
                    const pgToShow = defCh || channelsList[0];
                    const isPersonal = pgToShow.channel_id === p.tiktok_username || (pgToShow.channel_url && pgToShow.channel_url.startsWith('/profile/'));
                    const isPage = !isPersonal;
                    const fbLink = pgToShow.channel_url && pgToShow.channel_url.startsWith('http') ? pgToShow.channel_url : `https://www.facebook.com/${escapeHtml(pgToShow.channel_id)}`;
                    usernameDisplay = `
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <a href="${escapeHtml(fbLink)}" target="_blank" class="table-text-truncate" style="max-width:130px; color:#60a5fa; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(pgToShow.channel_name)} (UID: ${escapeHtml(pgToShow.channel_id)})">
                                    <i class="fa-brands fa-facebook" style="color:#1877f2; flex-shrink:0;"></i>
                                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(pgToShow.channel_name)}</span>
                                </a>
                                <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(pgToShow.channel_id || p.fb_page_id || '')}', ${pgToShow.followers_count || p.followers_count || 0}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', 'facebook', '${escapeHtml(pgToShow.channel_id || '')}')" data-tooltip="Sửa nick &amp; chỉ số">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; font-size:11px;">
                                <span class="badge" style="background:${isPage ? 'rgba(168,85,247,0.15)' : 'rgba(148,163,184,0.15)'}; color:${isPage ? '#c084fc' : '#94a3b8'}; font-size:9px; padding:0 4px;">
                                    <i class="${isPage ? 'fa-solid fa-flag' : 'fa-solid fa-user'}"></i> ${isPage ? 'Fanpage' : 'Cá nhân'}
                                </span>
                                <span class="table-text-truncate text-muted" style="max-width:95px; font-weight:500;" title="UID: ${escapeHtml(pgToShow.channel_id)}">
                                    UID: ${escapeHtml(pgToShow.channel_id)}
                                </span>
                            </div>
                            ${crossBrowserBadge}
                        </div>`;
                } else {
                    const fbId = p.fb_page_id || p.tiktok_username || '';
                    const fbDisplay = p.tiktok_nickname || (fbId ? `FB: ${fbId}` : '');
                    usernameDisplay = fbId ? `
                        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <a href="https://www.facebook.com/${escapeHtml(fbId)}" target="_blank" class="table-text-truncate" style="max-width:150px; color:#60a5fa; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="FB: ${escapeHtml(fbId)}">
                                    <i class="fa-brands fa-facebook" style="color:#1877f2; flex-shrink:0;"></i> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(fbDisplay)}</span>
                                </a>
                                <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(fbId)}', ${p.followers_count || 0}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', 'facebook')" data-tooltip="Sửa nick &amp; chỉ số">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                            </div>
                            ${p.tiktok_nickname && fbId !== p.tiktok_nickname ? `<div class="table-text-truncate text-muted" style="max-width:165px; font-size:11.5px; font-weight:500;" title="UID: ${escapeHtml(fbId)}"><i class="fa-solid fa-id-badge" style="font-size:10px; opacity:0.7;"></i> UID: ${escapeHtml(fbId)}</div>` : ''}
                            ${crossBrowserBadge}
                        </div>` : `
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="text-muted" style="font-size:12px;"><i class="fa-brands fa-facebook" style="color:#1877f2;"></i> Chưa gắn</span>
                            <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '', ${p.followers_count || 0}, '', '${escapeHtml(p.browser_type || 'gpm')}', 'facebook')" data-tooltip="Gán Page/Nick Facebook Cho Profile" style="width:auto; padding:0 8px; font-size:10.5px; gap:4px;">
                                <i class="fa-solid fa-plus"></i> Gán
                            </button>
                        </div>`;
                }
            } else {
                const hasUsername = Boolean(p.tiktok_username && p.tiktok_username.trim());
                const hasNickname = Boolean(p.tiktok_nickname && p.tiktok_nickname.trim());
                usernameDisplay = hasUsername
                    ? `<div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                        <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                            <a href="https://www.tiktok.com/@${escapeHtml(p.tiktok_username)}" target="_blank" class="table-text-truncate" style="max-width:150px; color:var(--accent-cyan); font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="@${escapeHtml(p.tiktok_username)}${p.tiktok_uid ? ' (UID: ' + escapeHtml(p.tiktok_uid) + ')' : ''}">
                                <i class="fa-brands fa-tiktok" style="flex-shrink:0;"></i> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">@${escapeHtml(p.tiktok_username)}</span>
                            </a>
                            <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(p.tiktok_username || '')}', ${p.followers_count || 0}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', 'tiktok')" data-tooltip="Sửa nick &amp; chỉ số">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                        ${hasNickname ? `<div class="table-text-truncate text-muted" style="max-width:165px; font-size:11.5px; font-weight:500;" title="${escapeHtml(p.tiktok_nickname)}"><i class="fa-solid fa-id-badge" style="font-size:10px; opacity:0.7;"></i> ${escapeHtml(p.tiktok_nickname)}</div>` : ''}
                       </div>`
                    : `<div style="display:flex; align-items:center; gap:6px;">
                        <span class="text-muted" style="font-size:12px;"><i class="fa-brands fa-tiktok"></i> Chưa gắn</span>
                        <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '', ${p.followers_count || 0}, '', '${escapeHtml(p.browser_type || 'gpm')}', 'tiktok')" data-tooltip="Gán Nick TikTok Cho Profile" style="width:auto; padding:0 8px; font-size:10.5px; gap:4px;">
                            <i class="fa-solid fa-plus"></i> Gán
                        </button>
                       </div>`;
            }

            let followersCount = p.followers_count || 0;
            if (defCh) {
                followersCount = defCh.followers_count || 0;
            } else if (!followersCount && channelsList) {
                followersCount = channelsList.reduce((sum, ch) => sum + (ch.followers_count || 0), 0);
            }
            const isEligible = isProfileEligible(p);
            const targetTh = getPlatformThreshold(plat);
            const subLabel = plat === 'youtube' ? 'subs' : 'followers';
            const followersDisplay = `
                <div>
                    <strong style="font-size:14.5px; color:${isEligible ? 'var(--accent-gold)' : 'var(--accent-cyan)'};">
                        ${followersCount.toLocaleString()}
                    </strong>
                    <span style="font-size:11px; color:var(--text-muted); margin-left:2px;">${subLabel}</span>
                    ${p.last_checked ? `<div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;"><i class="fa-regular fa-clock"></i> ${escapeHtml(p.last_checked.slice(5, 16))}</div>` : ''}
                </div>
            `;

            const thSummary = `TikTok ${formatThresholdDisplay(followerThresholds.tiktok)}, YT ${formatThresholdDisplay(followerThresholds.youtube)}, FB ${formatThresholdDisplay(followerThresholds.facebook)}`;
            const nStatus = (p.notify_status || 'tracking').toLowerCase();
            let notifyBadge = '';
            if (nStatus === 'sent') {
                notifyBadge = `<span class="badge badge-sent badge-interactive has-tooltip tooltip-top" onclick="cycleProfileNotifyStatus('${escapeHtml(p.gpm_id)}', '${nStatus}')" data-tooltip="Đã gửi Telegram khi đạt chỉ tiêu (Bấm để đổi trạng thái)"><i class="fa-solid fa-circle-check"></i> Đã gửi</span>`;
            } else if (nStatus === 'muted') {
                notifyBadge = `<span class="badge badge-muted badge-interactive has-tooltip tooltip-top" onclick="cycleProfileNotifyStatus('${escapeHtml(p.gpm_id)}', '${nStatus}')" data-tooltip="Bỏ theo dõi (không gửi Telegram). Bấm để theo dõi"><i class="fa-solid fa-bell-slash"></i> Bỏ theo dõi</span>`;
            } else {
                notifyBadge = `<span class="badge badge-tracking badge-interactive has-tooltip tooltip-top" onclick="cycleProfileNotifyStatus('${escapeHtml(p.gpm_id)}', '${nStatus}')" data-tooltip="Đang theo dõi (gửi Telegram khi đạt chỉ tiêu: ${thSummary}). Bấm để bỏ theo dõi"><i class="fa-solid fa-bell"></i> Đang theo dõi</span>`;
            }

            const mainRowHtml = `
            <tr>
                <td>
                    <div class="table-text-truncate" style="max-width: 220px; display:flex; align-items:center; gap:6px;" title="${escapeHtml(p.name)}">
                        ${hasMultiChannels ? `
                        <button type="button" class="btn-subchannel-toggle ${isExpanded ? 'expanded' : ''}" id="btn-toggle-${escapeHtml(p.gpm_id)}" data-gpm-id="${escapeHtml(p.gpm_id)}" onclick="toggleSubChannels('${escapeHtml(p.gpm_id)}', event)" title="Bấm để ẩn/hiện ${channelsList.length} kênh/trang con">
                            <i class="fa-solid fa-chevron-right" id="chevron-${escapeHtml(p.gpm_id)}"></i>
                        </button>` : `<span style="display:inline-block; width:20px;"></span>`}
                        ${(() => {
                    const b = (p.browser_type || 'gpm').toLowerCase();
                    if (b === 'adspower') return '<span class="badge" style="background:rgba(249,115,22,0.15); color:#fb923c; font-size:10px;"><i class="fa-solid fa-bolt"></i> AdsPower</span>';
                    if (b === 'dolphin') return '<span class="badge" style="background:rgba(6,182,212,0.15); color:#22d3ee; font-size:10px;"><i class="fa-solid fa-water"></i> Dolphin</span>';
                    if (b === 'genlogin') return '<span class="badge" style="background:rgba(34,197,94,0.15); color:#4ade80; font-size:10px;"><i class="fa-solid fa-shield"></i> GEN</span>';
                    return '<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:10px;"><i class="fa-solid fa-cube"></i> GPM</span>';
                })()}
                        <strong ${hasMultiChannels ? `style="cursor:pointer;" onclick="toggleSubChannels('${escapeHtml(p.gpm_id)}', event)"` : ''}>${escapeHtml(p.name)}</strong>
                        ${hasMultiChannels ? `
                        <span class="badge" style="background:rgba(99,102,241,0.18); color:#a5b4fc; font-size:9.5px; padding:1px 6px; font-weight:600; cursor:pointer;" onclick="toggleSubChannels('${escapeHtml(p.gpm_id)}', event)" title="Có ${channelsList.length} kênh/trang con (Bấm để xem)">
                            <i class="fa-solid fa-layer-group"></i> ${channelsList.length}
                        </span>` : ''}
                    </div>
                </td>
                <td>
                    ${(() => {
                    const plat = (p.platform || 'tiktok').toLowerCase();
                    if (plat === 'youtube') return '<span class="badge" style="background:rgba(255,0,0,0.12); color:#ff4d4d; font-size:10px;"><i class="fa-brands fa-youtube"></i> YouTube</span>';
                    if (plat === 'facebook') return '<span class="badge" style="background:rgba(24,119,242,0.12); color:#60a5fa; font-size:10px;"><i class="fa-brands fa-facebook"></i> Facebook</span>';
                    return '<span class="badge" style="background:rgba(255,0,80,0.12); color:#ff0050; font-size:10px;"><i class="fa-brands fa-tiktok"></i> TikTok</span>';
                })()}
                </td>
                <td>${usernameDisplay}</td>
                <td>${followersDisplay}</td>
                <td>
                    ${(() => {
                    const pStatus = (p.status || 'active').toLowerCase();
                    const pReason = p.status_reason ? escapeHtml(p.status_reason) : '';
                    if (pStatus === 'banned') {
                        return `<span class="badge badge-banned has-tooltip tooltip-top" data-tooltip="${pReason || 'Tài khoản bị cấm vĩnh viễn'}"><i class="fa-solid fa-ban"></i> BANNED</span>`;
                    } else if (pStatus === 'restricted') {
                        return `<span class="badge badge-restricted has-tooltip tooltip-top" data-tooltip="${pReason || 'Tài khoản bị hạn chế đăng bài'}"><i class="fa-solid fa-triangle-exclamation"></i> HẠN CHẾ</span>`;
                    } else if (pStatus === 'checkpoint') {
                        return `<span class="badge badge-checkpoint has-tooltip tooltip-top" data-tooltip="${pReason || 'Yêu cầu giải Captcha'}"><i class="fa-solid fa-puzzle-piece"></i> CAPTCHA</span>`;
                    } else if (pStatus === 'unlogged') {
                        return `<span class="badge badge-unlogged has-tooltip tooltip-top" data-tooltip="${pReason || 'Chưa đăng nhập / hết phiên'}"><i class="fa-solid fa-right-to-bracket"></i> HẾT PHIÊN</span>`;
                    } else if (pStatus === 'proxy_dead') {
                        return `<span class="badge badge-proxy-dead has-tooltip tooltip-top" data-tooltip="${pReason || 'Proxy chết / lỗi kết nối'}"><i class="fa-solid fa-network-wired"></i> PROXY LỖI</span>`;
                    } else if (isEligible) {
                        if (plat === 'youtube') {
                            return `<span class="badge badge-success" style="background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.3);"><i class="fa-solid fa-trophy"></i> ĐỦ ${formatThresholdDisplay(targetTh)} SUBS!</span>`;
                        } else if (plat === 'facebook') {
                            return `<span class="badge badge-success" style="background:rgba(24,119,242,0.18); color:#60a5fa; border:1px solid rgba(24,119,242,0.3);"><i class="fa-solid fa-trophy"></i> ĐỦ ${formatThresholdDisplay(targetTh)} FLW!</span>`;
                        } else {
                            return `<span class="badge badge-success"><i class="fa-solid fa-trophy"></i> ĐỦ ${formatThresholdDisplay(targetTh)} BETA!</span>`;
                        }
                    } else {
                        return '<span class="badge badge-info"><i class="fa-solid fa-seedling"></i> Đang Nuôi</span>';
                    }
                })()}
                </td>
                <td>${notifyBadge}</td>
                <td style="text-align: center;">
                    <div class="action-dropdown-wrap">
                        <button type="button" class="btn-more-actions" id="btn-more-gpm-${escapeHtml(p.gpm_id)}" 
                            onclick="toggleActionMenu(event, 'gpm-${escapeHtml(p.gpm_id)}')" 
                            title="Tùy chọn thao tác">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                        <div class="action-dropdown-menu" id="action-menu-gpm-${escapeHtml(p.gpm_id)}">
                            <button type="button" class="action-dropdown-item" onclick="scanSingleProfileFollowers('${escapeHtml(p.gpm_id)}', this); closeAllActionMenus();">
                                <i class="fa-solid fa-magnifying-glass-chart" style="color:var(--accent-pink);"></i> Quét Follower ngay
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(p.tiktok_username || '')}', ${followersCount}, '${escapeHtml(p.tiktok_nickname || '')}', '${escapeHtml(p.browser_type || 'gpm')}', '${escapeHtml(plat)}'); closeAllActionMenus();">
                                <i class="fa-solid fa-pen-to-square" style="color:var(--accent-cyan);"></i> Sửa Nick & Chỉ số
                            </button>
                            ${nStatus === 'tracking' ? `
                            <button type="button" class="action-dropdown-item" onclick="setProfileNotifyStatus('${escapeHtml(p.gpm_id)}', 'muted'); closeAllActionMenus();">
                                <i class="fa-solid fa-bell-slash" style="color:#94a3b8;"></i> Bỏ theo dõi (Mute 10K)
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="setProfileNotifyStatus('${escapeHtml(p.gpm_id)}', 'sent'); closeAllActionMenus();">
                                <i class="fa-solid fa-circle-check" style="color:#60a5fa;"></i> Đánh dấu đã gửi
                            </button>` : nStatus === 'sent' ? `
                            <button type="button" class="action-dropdown-item" onclick="setProfileNotifyStatus('${escapeHtml(p.gpm_id)}', 'tracking'); closeAllActionMenus();">
                                <i class="fa-solid fa-rotate-right" style="color:#fbbf24;"></i> Theo dõi lại (tiếp tục theo dõi)
                            </button>
                            <button type="button" class="action-dropdown-item" onclick="setProfileNotifyStatus('${escapeHtml(p.gpm_id)}', 'muted'); closeAllActionMenus();">
                                <i class="fa-solid fa-bell-slash" style="color:#94a3b8;"></i> Bỏ theo dõi (Mute 10K)
                            </button>` : `
                            <button type="button" class="action-dropdown-item" onclick="setProfileNotifyStatus('${escapeHtml(p.gpm_id)}', 'tracking'); closeAllActionMenus();">
                                <i class="fa-solid fa-bell" style="color:#34d399;"></i> Theo dõi (gửi khi đủ 10K)
                            </button>`}
                            ${plat === 'youtube' ? (() => {
                    const ytTarget = defCh || p;
                    const rawYt = (ytTarget.channel_url || p.channel_handle || '').trim();
                    let mainYtLink = 'https://www.youtube.com';
                    if (rawYt.startsWith('http')) mainYtLink = rawYt;
                    else if (rawYt.startsWith('@') && !rawYt.includes(' ')) mainYtLink = `https://www.youtube.com/${rawYt}`;
                    else if (ytTarget.channel_id) mainYtLink = `https://www.youtube.com/channel/${ytTarget.channel_id}`;
                    else if (p.tiktok_username && p.tiktok_username.startsWith('UC')) mainYtLink = `https://www.youtube.com/channel/${p.tiktok_username}`;
                    return `
                                <a href="${escapeHtml(mainYtLink)}" target="_blank" rel="noopener" class="action-dropdown-item" onclick="closeAllActionMenus()">
                                    <i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Mở kênh chính YouTube
                                </a>`;
                })() : plat === 'facebook' ? `
                            <a href="https://www.facebook.com/${escapeHtml(p.fb_page_id || (defCh && defCh.channel_id) || p.tiktok_username || '')}" target="_blank" rel="noopener" class="action-dropdown-item" onclick="closeAllActionMenus()">
                                <i class="fa-brands fa-facebook" style="color:#1877f2;"></i> Mở trang Facebook
                            </a>` : (p.tiktok_username ? `
                            <a href="https://www.tiktok.com/@${escapeHtml(p.tiktok_username)}" target="_blank" rel="noopener" class="action-dropdown-item" onclick="closeAllActionMenus()">
                                <i class="fa-brands fa-tiktok" style="color:#00f2fe;"></i> Mở kênh TikTok
                            </a>` : '')}
                            ${plat === 'youtube' || plat === 'facebook' ? `
                            <button type="button" class="action-dropdown-item" onclick="syncProfileChannels('${escapeHtml(p.gpm_id)}'); closeAllActionMenus();">
                                <i class="fa-solid fa-layer-group" style="color:#a78bfa;"></i> Quét Kênh / Trang Con
                            </button>` : ''}
                            <button type="button" class="action-dropdown-item" onclick="copyTextToClipboard('${escapeHtml(p.tiktok_username || p.gpm_id)}', 'Đã sao chép!'); closeAllActionMenus();">
                                <i class="fa-solid fa-copy" style="color:#94a3b8;"></i> Sao chép ${p.tiktok_username ? 'Username' : 'GPM ID'}
                            </button>
                            <div class="dropdown-divider"></div>
                            <button type="button" class="action-dropdown-item text-danger" onclick="deleteGpmProfileFromList('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}'); closeAllActionMenus();">
                                <i class="fa-solid fa-trash text-danger"></i> Xóa Profile
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
            `;

            let subRowsHtml = '';
            if (hasMultiChannels) {
                subRowsHtml = channelsList.map(ch => {
                    const chEligible = isChannelEligible(ch, plat);
                    const chTh = getPlatformThreshold(plat);
                    let chNameHtml = '';
                    let chTypeBadge = '';
                    let chLink = '';

                    if (plat === 'youtube') {
                        const rawChUrl = (ch.channel_url || '').trim();
                        let subChLink = '';
                        let subChHandle = '';
                        if (rawChUrl.startsWith('http')) {
                            subChLink = rawChUrl;
                            subChHandle = rawChUrl.split('/').pop();
                        } else if (rawChUrl.startsWith('@') && !rawChUrl.includes(' ')) {
                            subChLink = `https://www.youtube.com/${rawChUrl}`;
                            subChHandle = rawChUrl;
                        } else if (ch.channel_id) {
                            subChLink = `https://www.youtube.com/channel/${ch.channel_id}`;
                            subChHandle = ch.channel_id.startsWith('UC') ? `ID: ${ch.channel_id}` : (rawChUrl ? (rawChUrl.startsWith('@') ? rawChUrl : `@${rawChUrl}`) : `@${ch.channel_name}`);
                        } else {
                            const cleanHandle = rawChUrl.startsWith('@') ? rawChUrl : `@${rawChUrl || ch.channel_name}`;
                            subChLink = `https://www.youtube.com/${encodeURIComponent(cleanHandle)}`;
                            subChHandle = cleanHandle;
                        }
                        chLink = subChLink;
                        chTypeBadge = `<span class="badge" style="background:rgba(239,68,68,0.1); color:#f87171; font-size:9.5px; padding:2px 6px;"><i class="fa-brands fa-youtube"></i> Channel</span>`;
                        chNameHtml = `
                            <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                                <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                    <a href="${escapeHtml(chLink)}" target="_blank" class="table-text-truncate" style="max-width:130px; color:#ef4444; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(ch.channel_name)} (${escapeHtml(ch.channel_id)})">
                                        <i class="fa-brands fa-youtube" style="color:#ef4444; flex-shrink:0;"></i>
                                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(ch.channel_name)}</span>
                                    </a>
                                    <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(ch.channel_url || ch.channel_name || '')}', ${ch.followers_count || 0}, '', '${escapeHtml(p.browser_type || 'gpm')}', 'youtube', '${escapeHtml(ch.channel_id)}')" data-tooltip="Sửa nick &amp; chỉ số">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                </div>
                                <span class="table-text-truncate text-muted" style="max-width:135px; font-size:10.5px;" title="ID: ${escapeHtml(ch.channel_id)}">
                                    <i class="fa-solid fa-id-badge" style="font-size:9.5px; opacity:0.7;"></i> ${escapeHtml(subChHandle)}
                                </span>
                                ${(() => {
                                const subKey = getCanonicalAccountKey(p, ch);
                                const subOther = cachedGpmProfiles.find(o => o.id !== p.id && (o.platform || 'tiktok').toLowerCase() === plat && getCanonicalAccountKey(o, ch) === subKey);
                                if (!subOther) return '';
                                return `<span class="badge" style="background:rgba(234,179,8,0.14); color:#fbbf24; border:1px solid rgba(234,179,8,0.35); font-size:8.5px; padding:1px 5px; font-weight:600; margin-top:2px; display:inline-flex; align-items:center; gap:3px; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Trùng với ${escapeHtml(subOther.name || subOther.gpm_id)}"><i class="fa-solid fa-link" style="font-size:8px;"></i> Trùng với ${escapeHtml(subOther.name || subOther.gpm_id)}</span>`;
                            })()}
                            </div>
                        `;
                    } else {
                        const isPersonal = ch.channel_id === p.tiktok_username || (ch.channel_url && ch.channel_url.startsWith('/profile/'));
                        const isPage = !isPersonal;
                        chLink = ch.channel_url && ch.channel_url.startsWith('http') ? ch.channel_url : `https://www.facebook.com/${escapeHtml(ch.channel_id)}`;
                        chTypeBadge = `<span class="badge" style="background:${isPage ? 'rgba(168,85,247,0.15)' : 'rgba(148,163,184,0.15)'}; color:${isPage ? '#c084fc' : '#94a3b8'}; font-size:9.5px; padding:2px 6px;"><i class="${isPage ? 'fa-solid fa-flag' : 'fa-solid fa-user'}"></i> ${isPage ? 'Fanpage' : 'Cá nhân'}</span>`;
                        chNameHtml = `
                            <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                                <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                    <a href="${chLink}" target="_blank" class="table-text-truncate" style="max-width:130px; color:#60a5fa; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="${escapeHtml(ch.channel_name)} (UID: ${escapeHtml(ch.channel_id)})">
                                        <i class="fa-brands fa-facebook" style="color:#1877f2; flex-shrink:0;"></i>
                                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(ch.channel_name)}</span>
                                    </a>
                                    <button type="button" class="btn-inline-edit has-tooltip tooltip-top" onclick="openEditUsernameModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(ch.channel_id || '')}', ${ch.followers_count || 0}, '', '${escapeHtml(p.browser_type || 'gpm')}', 'facebook', '${escapeHtml(ch.channel_id)}')" data-tooltip="Sửa nick &amp; chỉ số">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                </div>
                                <span class="table-text-truncate text-muted" style="max-width:135px; font-size:10.5px;" title="UID: ${escapeHtml(ch.channel_id)}">
                                    UID: ${escapeHtml(ch.channel_id)}
                                </span>
                                ${(() => {
                                const subKey = getCanonicalAccountKey(p, ch);
                                const subOther = cachedGpmProfiles.find(o => o.id !== p.id && (o.platform || 'tiktok').toLowerCase() === plat && getCanonicalAccountKey(o, ch) === subKey);
                                if (!subOther) return '';
                                return `<span class="badge" style="background:rgba(234,179,8,0.14); color:#fbbf24; border:1px solid rgba(234,179,8,0.35); font-size:8.5px; padding:1px 5px; font-weight:600; margin-top:2px; display:inline-flex; align-items:center; gap:3px; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="Trùng với ${escapeHtml(subOther.name || subOther.gpm_id)}"><i class="fa-solid fa-link" style="font-size:8px;"></i> Trùng với ${escapeHtml(subOther.name || subOther.gpm_id)}</span>`;
                            })()}
                            </div>
                        `;
                    }

                    const chNotifyStatus = (ch.notify_status || (ch.is_default ? p.notify_status : 'tracking') || 'tracking').toLowerCase();
                    let chNotifyBadge = '';
                    if (chNotifyStatus === 'sent') {
                        chNotifyBadge = `<span class="badge badge-success has-tooltip tooltip-top" onclick="cycleChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', '${chNotifyStatus}')" data-tooltip="Đã gửi thông báo đạt mốc. Bấm để theo dõi lại." style="cursor:pointer;"><i class="fa-solid fa-circle-check"></i> Đã gửi 10K</span>`;
                    } else if (chNotifyStatus === 'muted') {
                        chNotifyBadge = `<span class="badge badge-secondary has-tooltip tooltip-top" onclick="cycleChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', '${chNotifyStatus}')" data-tooltip="Đang tắt thông báo. Bấm để bật theo dõi." style="cursor:pointer; opacity:0.6;"><i class="fa-solid fa-bell-slash"></i> Đã tắt</span>`;
                    } else {
                        chNotifyBadge = `<span class="badge badge-warning has-tooltip tooltip-top" onclick="cycleChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', '${chNotifyStatus}')" data-tooltip="Đang theo dõi tăng trưởng. Bấm để tắt." style="cursor:pointer;"><i class="fa-solid fa-bell"></i> Đang theo dõi</span>`;
                    }

                    const safeChId = escapeHtml(ch.channel_id).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const chMenuKey = `ch-${escapeHtml(p.gpm_id)}-${safeChId}`;

                    return `
                    <tr class="sub-channel-row sub-row-${escapeHtml(p.gpm_id)} ${plat === 'youtube' ? 'youtube-channel' : 'facebook-page'}" style="${isExpanded ? '' : 'display:none;'}">
                        <td style="padding-left: 26px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-turn-up fa-rotate-90" style="color:var(--text-muted); opacity:0.6; font-size:11px;"></i>
                                <span style="font-size:11.5px; font-weight:600; color:${ch.is_default ? 'var(--accent-gold)' : 'var(--text-secondary)'};">
                                    ${ch.is_default ? '<i class="fa-solid fa-star" style="font-size:10px; margin-right:3px;"></i> Kênh chính' : '<i class="fa-solid fa-code-branch" style="font-size:10px; margin-right:3px; opacity:0.7;"></i> Kênh con'}
                                </span>
                            </div>
                        </td>
                        <td>${chTypeBadge}</td>
                        <td>${chNameHtml}</td>
                        <td>
                            <div>
                                <strong style="font-size:13.5px; color:${chEligible ? 'var(--accent-gold)' : 'var(--accent-cyan)'};">
                                    ${(ch.followers_count || 0).toLocaleString()}
                                </strong>
                                <span style="font-size:10.5px; color:var(--text-muted); margin-left:2px;">${subLabel}</span>
                            </div>
                        </td>
                        <td>
                            ${chEligible ? (
                            plat === 'youtube'
                                ? `<span class="badge badge-success" style="font-size:10px; background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.3);"><i class="fa-solid fa-trophy"></i> ĐỦ ${formatThresholdDisplay(chTh)} SUBS!</span>`
                                : `<span class="badge badge-success" style="font-size:10px; background:rgba(24,119,242,0.18); color:#60a5fa; border:1px solid rgba(24,119,242,0.3);"><i class="fa-solid fa-trophy"></i> ĐỦ ${formatThresholdDisplay(chTh)} FLW!</span>`
                        ) : '<span class="badge badge-info" style="font-size:10px;"><i class="fa-solid fa-seedling"></i> Đang Nuôi</span>'}
                        </td>
                        <td>${chNotifyBadge}</td>
                        <td style="text-align: center;">
                            <div class="action-dropdown-wrap">
                                <button type="button" class="btn-more-actions" id="btn-more-${chMenuKey}" 
                                    onclick="toggleActionMenu(event, '${chMenuKey}')" 
                                    title="Tùy chọn thao tác">
                                    <i class="fa-solid fa-ellipsis"></i>
                                </button>
                                <div class="action-dropdown-menu" id="action-menu-${chMenuKey}">
                                    ${!ch.is_default ? `
                                    <button type="button" class="action-dropdown-item" onclick="setDefaultChannel('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}'); closeAllActionMenus();">
                                        <i class="fa-solid fa-star" style="color:var(--accent-gold);"></i> ${plat === 'youtube' ? 'Đặt làm Kênh YouTube chính' : 'Đặt làm Fanpage chính'}
                                    </button>` : `
                                    <button type="button" class="action-dropdown-item" style="opacity:0.65; cursor:default;" disabled>
                                        <i class="fa-solid fa-star" style="color:var(--accent-gold);"></i> ${plat === 'youtube' ? 'Kênh chính (Mặc định)' : 'Trang chính (Mặc định)'}
                                    </button>`}
                                    <button type="button" class="action-dropdown-item" onclick="scanSingleChannelFollowers('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', '${plat}', this); closeAllActionMenus();">
                                        <i class="fa-solid fa-magnifying-glass-chart" style="color:var(--accent-pink);"></i> ${plat === 'youtube' ? 'Quét Subscribers ngay' : 'Quét Followers ngay'}
                                    </button>
                                    <button type="button" class="action-dropdown-item" onclick="openEditChannelModal('${escapeHtml(p.gpm_id)}', '${escapeHtml(p.name)}', '${escapeHtml(ch.channel_id)}', '${escapeHtml(ch.channel_name || '')}', ${ch.followers_count || 0}, '${escapeHtml(ch.channel_url || ch.channel_id)}', '${plat}'); closeAllActionMenus();">
                                        <i class="fa-solid fa-pen-to-square" style="color:var(--accent-cyan);"></i> ${plat === 'youtube' ? 'Sửa Kênh & Subscribers' : 'Sửa Trang & Followers'}
                                    </button>
                                    ${chNotifyStatus === 'tracking' ? `
                                    <button type="button" class="action-dropdown-item" onclick="setChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', 'muted'); closeAllActionMenus();">
                                        <i class="fa-solid fa-bell-slash" style="color:#94a3b8;"></i> Bỏ theo dõi (Tắt thông báo)
                                    </button>
                                    <button type="button" class="action-dropdown-item" onclick="setChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', 'sent'); closeAllActionMenus();">
                                        <i class="fa-solid fa-circle-check" style="color:#60a5fa;"></i> Đánh dấu đã gửi
                                    </button>` : chNotifyStatus === 'sent' ? `
                                    <button type="button" class="action-dropdown-item" onclick="setChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', 'tracking'); closeAllActionMenus();">
                                        <i class="fa-solid fa-rotate-right" style="color:#fbbf24;"></i> Theo dõi lại (tiếp tục theo dõi)
                                    </button>
                                    <button type="button" class="action-dropdown-item" onclick="setChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', 'muted'); closeAllActionMenus();">
                                        <i class="fa-solid fa-bell-slash" style="color:#94a3b8;"></i> Bỏ theo dõi (Tắt thông báo)
                                    </button>` : `
                                    <button type="button" class="action-dropdown-item" onclick="setChannelNotifyStatus('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', 'tracking'); closeAllActionMenus();">
                                        <i class="fa-solid fa-bell" style="color:#34d399;"></i> Theo dõi (gửi khi đạt mốc)
                                    </button>`}
                                    <a href="${chLink}" target="_blank" rel="noopener" class="action-dropdown-item" onclick="closeAllActionMenus()">
                                        <i class="${plat === 'youtube' ? 'fa-brands fa-youtube' : 'fa-brands fa-facebook'}" style="color:${plat === 'youtube' ? '#ef4444' : '#1877f2'};"></i> ${plat === 'youtube' ? 'Mở kênh YouTube' : 'Mở trang Facebook'}
                                    </a>
                                    <button type="button" class="action-dropdown-item" onclick="copyTextToClipboard('${escapeHtml(ch.channel_id)}', 'Đã sao chép ID!'); closeAllActionMenus();">
                                        <i class="fa-solid fa-copy" style="color:#94a3b8;"></i> Sao chép ${plat === 'youtube' ? 'Channel ID' : 'Page UID'}
                                    </button>
                                    <button type="button" class="action-dropdown-item" onclick="copyTextToClipboard('${escapeHtml(chLink)}', 'Đã sao chép liên kết!'); closeAllActionMenus();">
                                        <i class="fa-solid fa-link" style="color:#94a3b8;"></i> Sao chép liên kết
                                    </button>
                                    ${!ch.is_default ? `
                                    <div class="dropdown-divider"></div>
                                    <button type="button" class="action-dropdown-item text-danger" onclick="deleteChannelFromList('${escapeHtml(p.gpm_id)}', '${escapeHtml(ch.channel_id)}', '${escapeHtml(ch.channel_name || ch.channel_id)}'); closeAllActionMenus();">
                                        <i class="fa-solid fa-trash text-danger"></i> Xóa khỏi danh sách
                                    </button>` : ''}
                                </div>
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('');
            }

            return mainRowHtml + subRowsHtml;
        }).join('');
    }

    // Cập nhật tab Nick Đạt Chỉ Tiêu
    if (eligibleGrid) {
        const eligibleList = (cachedGpmProfiles || []).filter(p => isProfileEligible(p));
        if (eligibleList.length > 0) {
            eligibleGrid.innerHTML = eligibleList.map(e => {
                const plat = (e.platform || 'tiktok').toLowerCase();
                const th = getPlatformThreshold(plat);
                const subLabel = plat === 'youtube' ? 'subs' : 'followers';
                const platName = plat === 'youtube' ? 'YouTube' : (plat === 'facebook' ? 'Facebook' : 'TikTok');
                const platIcon = plat === 'youtube' ? '<i class="fa-brands fa-youtube" style="color:#ef4444;"></i>' : (plat === 'facebook' ? '<i class="fa-brands fa-facebook" style="color:#1877f2;"></i>' : '<i class="fa-brands fa-tiktok" style="color:#ff0050;"></i>');
                return `
                <div class="glass-panel" style="border-color: rgba(245, 158, 11, 0.4); background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(20, 26, 40, 0.9));">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 style="color:var(--accent-gold); font-size:16px; margin:0; display:flex; align-items:center; gap:6px;">
                            ${platIcon} @${escapeHtml(e.tiktok_username || e.name)}
                        </h4>
                        <span class="badge badge-success">Đạt Mốc ${formatThresholdDisplay(th)}</span>
                    </div>
                    <div style="margin-top:12px; font-size:13px; color:var(--text-secondary);">
                        <p style="margin:4px 0;"><strong>${plat === 'youtube' ? 'Subscribers:' : 'Followers:'}</strong> <span style="color:white; font-size:16px; font-weight:700;">${(e.followers_count || 0).toLocaleString()}</span> <span style="font-size:11px; color:var(--text-muted);">${subLabel}</span></p>
                        <p style="margin:4px 0;"><strong>Nền tảng:</strong> ${platName} | <strong>Profile:</strong> ${escapeHtml(e.name)}</p>
                        <p style="margin:4px 0;"><strong>Proxy:</strong> ${escapeHtml(e.raw_proxy || 'Direct')}</p>
                        ${e.last_checked ? `<p style="margin:4px 0;"><strong>Lần quét gần nhất:</strong> ${escapeHtml(e.last_checked)}</p>` : ''}
                    </div>
                </div>
                `;
            }).join('');
        } else {
            eligibleGrid.innerHTML = `
                <div class="card-empty-state">
                    <i class="fa-solid fa-chart-line"></i>
                    <p>Hệ thống đang theo dõi tăng trưởng các tài khoản. Khi có tài khoản/kênh đạt ngưỡng chỉ tiêu đã đặt (TikTok, YouTube, Facebook), thông tin sẽ hiển thị tại đây và hệ thống sẽ tự động gửi thông báo qua Telegram.</p>
                </div>
            `;
        }
    }
}

async function setProfileNotifyStatus(gpmId, newStatus) {
    try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(gpmId)}/notify-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            if (cachedGpmProfiles) {
                const target = cachedGpmProfiles.find(p => p.gpm_id === gpmId);
                if (target) {
                    target.notify_status = newStatus;
                }
            }
            showToast(`✅ Đã chuyển trạng thái theo dõi: ${data.label || newStatus}`);
            renderGpmProfilesTable();
        } else {
            showToast(data.detail || data.message || 'Lỗi cập nhật trạng thái theo dõi', true);
        }
    } catch (err) {
        console.error('Lỗi setProfileNotifyStatus:', err);
        showToast('Lỗi kết nối khi cập nhật trạng thái theo dõi: ' + err.message, true);
    }
}

function cycleProfileNotifyStatus(gpmId, currentStatus) {
    const cur = (currentStatus || 'tracking').toLowerCase();
    let nextStatus = 'tracking';
    if (cur === 'tracking') {
        nextStatus = 'muted';
    } else if (cur === 'muted') {
        nextStatus = 'tracking';
    } else if (cur === 'sent') {
        nextStatus = 'tracking';
    }
    setProfileNotifyStatus(gpmId, nextStatus);
}

async function deleteGpmProfileFromList(gpmId, profileName) {
    closeAllActionMenus();
    const ok = await showConfirmDialog({
        title: 'Xóa Profile',
        message: `Bạn có chắc chắn muốn XÓA profile "${profileName}" khỏi hệ thống Quản lý Farm?`,
        details: 'Hệ thống sẽ ngừng theo dõi và quản lý profile này.',
        confirmText: 'Xóa Profile',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;
    try {
        const res = await fetch(`/api/gpm/profiles/${gpmId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã xóa profile thành công!'}`);
            loadGpmProfiles();
            loadDashboardStats();
        } else {
            showToast(data.message || 'Không thể xóa profile', true);
        }
    } catch (err) {
        showToast('Lỗi khi xóa profile: ' + err.message, true);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUẢN LÝ KÊNH/TRANG CON PROFILE (OPTION A - ACCORDION SUB-ROWS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.expandedProfileIds = window.expandedProfileIds || new Set();

function toggleSubChannels(gpmId, event) {
    if (event) {
        event.stopPropagation();
    }
    const subRows = document.querySelectorAll(`.sub-row-${gpmId}`);
    const toggleBtn = document.getElementById(`btn-toggle-${gpmId}`);
    const isCurrentlyExpanded = window.expandedProfileIds.has(gpmId);

    if (isCurrentlyExpanded) {
        window.expandedProfileIds.delete(gpmId);
        subRows.forEach(row => { row.style.display = 'none'; });
        if (toggleBtn) toggleBtn.classList.remove('expanded');
    } else {
        window.expandedProfileIds.add(gpmId);
        subRows.forEach(row => { row.style.display = ''; });
        if (toggleBtn) toggleBtn.classList.add('expanded');
    }
}
window.toggleSubChannels = toggleSubChannels;

async function setDefaultChannel(gpmId, channelId) {
    showToast('Đang cập nhật kênh mặc định...');
    try {
        const res = await fetch(`/api/gpm/profiles/${gpmId}/channels/${channelId}/set-default`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('✅ Đã đặt làm kênh mặc định!');
            await loadGpmProfiles();
        } else {
            showToast(data.message || 'Lỗi đặt kênh mặc định', true);
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, true);
    }
}
window.setDefaultChannel = setDefaultChannel;

async function deleteSubChannel(gpmId, channelId, channelName) {
    if (!confirm(`Bạn có chắc muốn xóa kênh/trang "${channelName || channelId}" khỏi danh sách?`)) {
        return;
    }
    try {
        const res = await fetch(`/api/gpm/profiles/${gpmId}/channels/${channelId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`✅ Đã xóa kênh/trang "${channelName || channelId}"`);
            await loadGpmProfiles();
        } else {
            showToast(data.message || 'Lỗi khi xóa kênh', true);
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, true);
    }
}
window.deleteSubChannel = deleteSubChannel;

// Quét và đồng bộ tất cả kênh/trang con (YouTube channels, Facebook pages) cho 1 profile
async function syncProfileChannels(gpmId) {
    showToast('Đang quét kênh / trang con...');
    try {
        const res = await fetch(`/api/gpm/profiles/${gpmId}/channels/sync`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            const ytCount = (data.youtube || []).length;
            const fbCount = (data.facebook || []).length;
            showToast(`✅ Đã tìm thấy ${ytCount} kênh YouTube + ${fbCount} trang Facebook!`);
            loadGpmProfiles();
        } else {
            showToast(data.message || 'Lỗi quét kênh', true);
        }
    } catch (err) {
        showToast('Lỗi quét kênh: ' + err.message, true);
    }
}

// Quét follower 1 profile cụ thể
async function scanSingleProfileFollowers(gpmId, btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Quét...';
    }
    showToast('Đang kết nối và trích xuất số follower...');
    try {
        const res = await fetch(`/api/profiles/${gpmId}/scan`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const fStr = (data.followers || 0).toLocaleString();
            showToast(`✅ Quét thành công: @${data.username || 'N/A'} đạt ${fStr} followers!`);
            loadGpmProfiles();
            loadDashboardStats();
            return data;
        } else {
            showToast(data.message || 'Lỗi quét profile', true);
            return data;
        }
    } catch (err) {
        showToast('Không thể quét follower: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Quét follower toàn bộ nick tuần tự với Live Progress & Nút Dừng
let _scanProgressPoller = null;
let _lastScanProgressIndex = 0;

async function checkScanProgress() {
    try {
        const res = await fetch('/api/profiles/scan-progress');
        const data = await res.json();
        const container = document.getElementById('scanProgressBarContainer');
        const titleEl = document.getElementById('scanProgressTitle');
        const subEl = document.getElementById('scanProgressSubtitle');
        const pctEl = document.getElementById('scanProgressPercent');
        const fillEl = document.getElementById('scanProgressBarFill');
        const scanBtn = document.getElementById('btnScanAllFollowersTab');

        if (!container) return;

        if (data.is_scanning) {
            container.style.display = 'block';
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Quét...';
            }

            const total = data.total || 0;
            const current = data.current !== undefined ? data.current : (data.current_index !== undefined ? data.current_index : 0);
            const pct = data.percent !== undefined ? data.percent : (total > 0 ? Math.round((current / total) * 100) : 0);

            if (titleEl) {
                if (data.current_profile_name) {
                    titleEl.innerHTML = `Đang quét: <span style="color:var(--accent-cyan); font-weight:700;">${escapeHtml(data.current_profile_name)}</span> [${current}/${total}]`;
                } else {
                    titleEl.textContent = `Đang quét Follower [${current}/${total}]...`;
                }
            }
            if (subEl) {
                subEl.textContent = data.status_message || data.message || 'Chế độ ZeroRAM siêu nhẹ, tự động giải phóng bộ nhớ sau mỗi nick';
            }
            if (pctEl) pctEl.textContent = `${pct}%`;
            if (fillEl) fillEl.style.width = `${pct}%`;

            // Cập nhật bảng dữ liệu khi nick vừa quét xong
            if (current > _lastScanProgressIndex) {
                _lastScanProgressIndex = current;
                loadGpmProfiles();
                loadDashboardStats();
            }
        } else {
            // Không quét hoặc đã kết thúc
            if (_scanProgressPoller) {
                clearInterval(_scanProgressPoller);
                _scanProgressPoller = null;
            }
            _lastScanProgressIndex = 0;

            if (container.style.display !== 'none') {
                if (fillEl) fillEl.style.width = '100%';
                if (pctEl) pctEl.textContent = '100%';
                if (titleEl) titleEl.textContent = data.status_message || data.message || 'Đã hoàn thành quét Follower!';
                setTimeout(() => {
                    container.style.display = 'none';
                    if (fillEl) fillEl.style.width = '0%';
                }, 2500);
            }

            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Quét Follower';
            }

            loadGpmProfiles();
            loadDashboardStats();
        }
    } catch (err) {
        console.error('Lỗi kiểm tra tiến độ quét:', err);
    }
}

function startScanProgressPolling() {
    if (_scanProgressPoller) clearInterval(_scanProgressPoller);
    _lastScanProgressIndex = 0;
    checkScanProgress();
    _scanProgressPoller = setInterval(checkScanProgress, 800);
}

async function stopAllProfilesScan(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Dừng...';
    }
    showToast('🛑 Đang yêu cầu dừng quét... Nick hiện tại sẽ được đóng ngay lập tức.');
    try {
        const res = await fetch('/api/profiles/scan-stop', { method: 'POST' });
        const data = await res.json();
        showToast(data.message || 'Đã gửi lệnh dừng tiến trình quét thành công!');
        setTimeout(checkScanProgress, 500);
    } catch (err) {
        showToast('Lỗi khi dừng quét: ' + err.message, true);
    } finally {
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
        }, 1500);
    }
}

async function scanAllProfilesFollowers(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Khởi Động...';
    }
    showToast('🚀 Bắt đầu quét Follower cho toàn bộ nick (Chế độ Low-RAM)...');
    try {
        const res = await fetch('/api/profiles/scan-all', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'warning') {
            showToast(data.message, true);
        } else {
            showToast('Tiến trình quét đang chạy ngầm, bạn có thể theo dõi tiến độ hoặc bấm Dừng Quét bất kỳ lúc nào!');
        }
        startScanProgressPolling();
    } catch (err) {
        showToast('Lỗi khi kích hoạt quét tất cả: ' + err.message, true);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}
window.scanAllProfilesFollowers = scanAllProfilesFollowers;

// Quản lý Modal sửa Nick & Followers / Account & Channel Metrics
function updateEditProfileModalLabels(platform, channelId) {
    const plat = (platform || 'tiktok').toLowerCase();
    const isSub = Boolean(channelId);

    const iconEl = document.getElementById('editProfileModalIcon');
    const titleEl = document.getElementById('editProfileModalTitle');
    const subEl = document.getElementById('editProfileModalSub');
    const userIcon = document.getElementById('editProfileUserIcon');
    const userLabel = document.getElementById('editProfileUserLabel');
    const userPrefix = document.getElementById('editProfileUserPrefix');
    const userInput = document.getElementById('editProfileUsername');
    const userHint = document.getElementById('editProfileUserHint');
    const nickIcon = document.getElementById('editProfileNickIcon');
    const nickLabel = document.getElementById('editProfileNickLabel');
    const nickInput = document.getElementById('editProfileNickname');
    const flwIcon = document.getElementById('editProfileFollowersIcon');
    const flwLabel = document.getElementById('editProfileFollowersLabel');

    if (plat === 'youtube') {
        if (iconEl) { iconEl.className = 'fa-brands fa-youtube'; iconEl.style.color = '#ef4444'; }
        if (titleEl) titleEl.textContent = isSub ? 'Sửa Kênh YouTube & Số Subscribers' : 'Sửa Tài Khoản YouTube & Chỉ Số';
        if (subEl) subEl.textContent = isSub ? 'Cập nhật tên kênh, handle và số người đăng ký cho kênh con' : 'Gán thủ công hoặc đồng bộ thông số kênh YouTube cho profile';
        if (userIcon) { userIcon.className = 'fa-brands fa-youtube'; userIcon.style.color = '#ef4444'; }
        if (userLabel) userLabel.textContent = 'YouTube Handle / Channel ID:';
        if (userPrefix) userPrefix.style.display = 'block';
        if (userInput) { userInput.placeholder = 'ten_kenh_youtube'; userInput.style.paddingLeft = '28px'; }
        if (userHint) userHint.innerHTML = 'Handle YouTube (ví dụ: <code>tenkenh</code>) hoặc Channel ID (ví dụ: <code>UC...</code>)';
        if (nickIcon) nickIcon.className = 'fa-solid fa-id-badge';
        if (nickLabel) nickLabel.textContent = 'Tên Kênh YouTube:';
        if (nickInput) nickInput.placeholder = 'Ví dụ: Shorts Stack Channel, Tech Tips...';
        if (flwIcon) flwIcon.className = 'fa-solid fa-users';
        if (flwLabel) flwLabel.textContent = 'Số Người Đăng Ký (Subscribers):';
    } else if (plat === 'facebook') {
        if (iconEl) { iconEl.className = 'fa-brands fa-facebook'; iconEl.style.color = '#1877f2'; }
        if (titleEl) titleEl.textContent = isSub ? 'Sửa Fanpage & Số Followers' : 'Sửa Tài Khoản Facebook & Chỉ Số';
        if (subEl) subEl.textContent = isSub ? 'Cập nhật tên fanpage, UID và số người theo dõi cho trang con' : 'Gán thủ công hoặc đồng bộ thông số Facebook cho profile';
        if (userIcon) { userIcon.className = 'fa-brands fa-facebook'; userIcon.style.color = '#1877f2'; }
        if (userLabel) userLabel.textContent = 'Page UID / Username:';
        if (userPrefix) userPrefix.style.display = 'none';
        if (userInput) { userInput.placeholder = 'Ví dụ: 6159616419 hoặc page_username'; userInput.style.paddingLeft = '12px'; }
        if (userHint) userHint.innerHTML = 'Nhập UID Fanpage hoặc Username / URL trang Facebook';
        if (nickIcon) nickIcon.className = 'fa-solid fa-flag';
        if (nickLabel) nickLabel.textContent = 'Tên Fanpage / Trang Facebook:';
        if (nickInput) nickInput.placeholder = 'Ví dụ: Cộng Đồng MMO, Tin Tức 24h...';
        if (flwIcon) flwIcon.className = 'fa-solid fa-users';
        if (flwLabel) flwLabel.textContent = 'Số Followers / Likes Hiện Tại:';
    } else {
        if (iconEl) { iconEl.className = 'fa-brands fa-tiktok text-accent'; iconEl.style.color = ''; }
        if (titleEl) titleEl.textContent = 'Sửa Tài Khoản & Chỉ Số TikTok';
        if (subEl) subEl.textContent = 'Gán thủ công hoặc đồng bộ thông số cho profile';
        if (userIcon) { userIcon.className = 'fa-brands fa-tiktok'; userIcon.style.color = ''; }
        if (userLabel) userLabel.textContent = 'TikTok Username:';
        if (userPrefix) userPrefix.style.display = 'block';
        if (userInput) { userInput.placeholder = 'username_cua_ban'; userInput.style.paddingLeft = '28px'; }
        if (userHint) userHint.innerHTML = 'Không cần nhập dấu @. Ví dụ: <code>dat.nguyen261096</code>';
        if (nickIcon) nickIcon.className = 'fa-solid fa-id-badge';
        if (nickLabel) nickLabel.textContent = 'Tên Kênh / Hiển Thị TikTok:';
        if (nickInput) nickInput.placeholder = 'Ví dụ: Hoàng Minh, Iamcooked...';
        if (flwIcon) flwIcon.className = 'fa-solid fa-users';
        if (flwLabel) flwLabel.textContent = 'Số Follower Hiện Tại:';
    }
}
window.updateEditProfileModalLabels = updateEditProfileModalLabels;

function onEditProfilePlatformChange(val) {
    const chId = document.getElementById('editProfileChannelId')?.value;
    updateEditProfileModalLabels(val, chId);
}
window.onEditProfilePlatformChange = onEditProfilePlatformChange;

function openEditChannelModal(gpmId, profileName, channelId, channelName, followers, handle, platform) {
    openEditUsernameModal(gpmId, profileName, handle || channelId, followers, channelName, 'gpm', platform, channelId);
}
window.openEditChannelModal = openEditChannelModal;

function openEditUsernameModal(gpmId, profileName, currentUsername, followers, currentNickname, browserType, platform, channelId) {
    console.log('[DEBUG MODAL] openEditUsernameModal CALLED with:', { gpmId, profileName, currentUsername, followers, currentNickname, browserType, platform, channelId });
    const gpmIdEl = document.getElementById('editProfileGpmId');
    if (gpmIdEl) gpmIdEl.value = gpmId;
    const channelIdEl = document.getElementById('editProfileChannelId');
    if (channelIdEl) channelIdEl.value = channelId || '';
    const nameEl = document.getElementById('editProfileName');
    if (nameEl) nameEl.value = profileName || gpmId;
    const userEl = document.getElementById('editProfileUsername');
    if (userEl) userEl.value = (currentUsername || '').replace(/^@/, '');
    const nickInput = document.getElementById('editProfileNickname');
    if (nickInput) nickInput.value = currentNickname || '';
    const flwEl = document.getElementById('editProfileFollowers');
    if (flwEl) flwEl.value = followers || 0;
    const bTypeSelect = document.getElementById('editProfileBrowserType');
    if (bTypeSelect && browserType) bTypeSelect.value = browserType.toLowerCase();
    const platSelect = document.getElementById('editProfilePlatform');
    const effPlat = (platform || 'tiktok').toLowerCase();
    if (platSelect) platSelect.value = effPlat;

    updateEditProfileModalLabels(effPlat, channelId);

    const modal = document.getElementById('editProfileUsernameModal');
    console.log('[DEBUG MODAL] #editProfileUsernameModal element:', modal);
    if (modal) {
        modal.classList.add('active');
        modal.classList.add('show');
        modal.style.display = 'flex';
        const computed = window.getComputedStyle(modal);
        console.log('[DEBUG MODAL] #editProfileUsernameModal after open -> style.display:', modal.style.display, 'computed display:', computed.display, 'z-index:', computed.zIndex, 'visibility:', computed.visibility, 'opacity:', computed.opacity);
    } else {
        console.error('[DEBUG MODAL] #editProfileUsernameModal NOT FOUND in DOM!');
    }
}
window.openEditUsernameModal = openEditUsernameModal;

function closeEditUsernameModal() {
    console.log('[DEBUG MODAL] closeEditUsernameModal CALLED');
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const channelIdEl = document.getElementById('editProfileChannelId');
    if (channelIdEl) channelIdEl.value = '';
    const modal = document.getElementById('editProfileUsernameModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('show');
        modal.style.display = 'none';
        console.log('[DEBUG MODAL] #editProfileUsernameModal closed');
    }
}
window.closeEditUsernameModal = closeEditUsernameModal;

async function saveProfileUsernameFromModal(btn) {
    const gpmId = document.getElementById('editProfileGpmId').value;
    const channelId = document.getElementById('editProfileChannelId')?.value;
    const usernameInput = document.getElementById('editProfileUsername');
    const nicknameInput = document.getElementById('editProfileNickname');
    const followersInput = document.getElementById('editProfileFollowers');
    const platform = (document.getElementById('editProfilePlatform')?.value || 'tiktok').toLowerCase();
    const username = usernameInput ? usernameInput.value.trim().replace(/^@/, '') : '';
    const nickname = nicknameInput ? nicknameInput.value.trim() : '';
    const rawFollowers = followersInput ? followersInput.value.trim() : '0';
    const followers = parseInt(rawFollowers, 10);

    const userLabel = platform === 'youtube' ? 'YouTube Handle / ID' : (platform === 'facebook' ? 'Page UID / Username' : 'TikTok Username');
    if (!username) {
        markInputError('editProfileUsername', `Vui lòng nhập ${userLabel} (không được để trống)!`);
        return;
    }
    if (isNaN(followers) || followers < 0) {
        markInputError('editProfileFollowers', 'Số lượng Followers / Subscribers phải là số nguyên không âm (>= 0)!');
        return;
    }

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    try {
        if (channelId) {
            // Lưu thông tin kênh / trang con
            const resCh = await fetch(`/api/gpm/profiles/${encodeURIComponent(gpmId)}/channels/${encodeURIComponent(channelId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channel_name: nickname,
                    channel_url: platform === 'youtube' ? (username.startsWith('@') ? username : '@' + username) : username,
                    new_channel_id: (platform === 'youtube' && channelId.startsWith('UC') && !username.startsWith('UC')) ? channelId : username,
                    followers_count: followers
                })
            });
            const dataCh = await resCh.json();
            if (!resCh.ok) {
                showToast('Lỗi cập nhật kênh: ' + (dataCh.detail || dataCh.message || 'Thất bại'), 'error');
                return;
            }
            showToast(`✅ Đã lưu thông tin kênh "${nickname || username}" thành công!`, 'success');
            closeEditUsernameModal();
            loadGpmProfiles();
            loadDashboardStats();
            return;
        }

        const resU = await fetch(`/api/profiles/${gpmId}/username`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                nickname: nickname,
                browser_type: document.getElementById('editProfileBrowserType')?.value || 'gpm',
                platform: platform
            })
        });
        const dataU = await resU.json();
        if (!resU.ok) {
            showToast('Lỗi cập nhật username: ' + (dataU.detail || dataU.message || 'Thất bại'), 'error');
            return;
        }

        const resS = await fetch('/api/profiles/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gpm_id: gpmId,
                followers: followers,
                views: 0,
                username: username,
                nickname: nickname
            })
        });
        const dataS = await resS.json();
        if (!resS.ok) {
            showToast('Lỗi cập nhật chỉ số: ' + (dataS.detail || dataS.message || 'Thất bại'), 'error');
            return;
        }

        showToast(`✅ Đã lưu thông tin ${nickname || username} thành công!`, 'success');
        closeEditUsernameModal();
        loadGpmProfiles();
        loadDashboardStats();
    } catch (err) {
        showToast('Lỗi khi lưu thông tin: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function setChannelNotifyStatus(gpmId, channelId, newStatus) {
    try {
        const res = await fetch(`/api/gpm/profiles/${encodeURIComponent(gpmId)}/channels/${encodeURIComponent(channelId)}/notify-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            if (cachedGpmProfiles) {
                const targetP = cachedGpmProfiles.find(p => p.gpm_id === gpmId);
                if (targetP && targetP.channels) {
                    const targetCh = targetP.channels.find(c => c.channel_id === channelId);
                    if (targetCh) targetCh.notify_status = newStatus;
                }
            }
            showToast(`✅ Đã chuyển trạng thái theo dõi kênh: ${data.label || newStatus}`);
            renderGpmProfilesTable();
        } else {
            showToast(data.detail || data.message || 'Lỗi cập nhật trạng thái theo dõi kênh', true);
        }
    } catch (err) {
        console.error('Lỗi setChannelNotifyStatus:', err);
        showToast('Lỗi kết nối khi cập nhật trạng thái theo dõi kênh: ' + err.message, true);
    }
}
window.setChannelNotifyStatus = setChannelNotifyStatus;

function cycleChannelNotifyStatus(gpmId, channelId, currentStatus) {
    const cur = (currentStatus || 'tracking').toLowerCase();
    let nextStatus = 'tracking';
    if (cur === 'tracking') {
        nextStatus = 'muted';
    } else if (cur === 'muted') {
        nextStatus = 'tracking';
    } else if (cur === 'sent') {
        nextStatus = 'tracking';
    }
    setChannelNotifyStatus(gpmId, channelId, nextStatus);
}
window.cycleChannelNotifyStatus = cycleChannelNotifyStatus;

async function scanSingleChannelFollowers(gpmId, channelId, plat, btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Quét...';
    }
    showToast('Đang kết nối và đồng bộ số liệu kênh / trang...');
    try {
        const res = await fetch(`/api/gpm/profiles/${encodeURIComponent(gpmId)}/channels/sync`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`✅ Đã đồng bộ và cập nhật chỉ số kênh thành công!`);
            loadGpmProfiles();
            loadDashboardStats();
        } else {
            showToast(data.message || 'Lỗi khi đồng bộ chỉ số kênh', true);
        }
    } catch (err) {
        showToast('Lỗi khi quét kênh: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}
window.scanSingleChannelFollowers = scanSingleChannelFollowers;

async function deleteChannelFromList(gpmId, channelId, channelName) {
    closeAllActionMenus();
    const ok = await showConfirmDialog({
        title: 'Xóa Kênh / Trang Con',
        message: `Bạn có chắc chắn muốn xóa kênh/trang "${channelName || channelId}" khỏi danh sách theo dõi?`,
        details: 'Kênh này sẽ không còn hiển thị trong danh sách kênh con của profile.',
        confirmText: 'Xóa Kênh',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;
    try {
        const res = await fetch(`/api/gpm/profiles/${encodeURIComponent(gpmId)}/channels/${encodeURIComponent(channelId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã xóa kênh thành công!'}`);
            loadGpmProfiles();
        } else {
            showToast(data.message || 'Không thể xóa kênh', true);
        }
    } catch (err) {
        showToast('Lỗi khi xóa kênh: ' + err.message, true);
    }
}
window.deleteChannelFromList = deleteChannelFromList;

async function scanCurrentEditProfile(btn) {
    const gpmId = document.getElementById('editProfileGpmId').value;
    if (!gpmId) return;
    const res = await scanSingleProfileFollowers(gpmId, btn);
    if (res && res.success) {
        if (res.username) document.getElementById('editProfileUsername').value = res.username;
        if (res.nickname !== undefined) {
            const nickInput = document.getElementById('editProfileNickname');
            if (nickInput) nickInput.value = res.nickname || '';
        }
        if (res.followers !== undefined) document.getElementById('editProfileFollowers').value = res.followers;
    }
}

async function deleteCurrentEditProfile(btn) {
    const gpmId = document.getElementById('editProfileGpmId').value;
    const name = document.getElementById('editProfileName').value;
    if (!gpmId) return;
    closeEditUsernameModal();
    await deleteGpmProfileFromList(gpmId, name || gpmId);
}

// Quản lý Modal Cài Đặt Lịch Quét Follower Tự Động
async function loadFollowerSchedulerBadge() {
    try {
        const res = await fetch('/api/settings/follower-scheduler');
        const data = await res.json();
        const btn = document.getElementById('btnFollowerSchedulerModal');
        const badge = document.getElementById('badgeFollowerSchedulerState');

        // Nếu thẻ badge cũ còn trong DOM thì loại bỏ để nút hiển thị gọn gàng
        if (badge) {
            badge.remove();
        }

        if (btn) {
            if (data.enabled) {
                if (data.mode === 'daily_times') {
                    const timesStr = (data.times || '').trim();
                    btn.title = `Lịch quét tự động: Bật (${timesStr || '08:00, 20:00'}) - Nhấn để cấu hình`;
                } else {
                    btn.title = `Lịch quét tự động: Bật (Mỗi ${data.interval_hours || 6}h) - Nhấn để cấu hình`;
                }
            } else {
                btn.title = 'Lịch quét định kỳ đang tắt - Nhấn để cấu hình';
            }
        }
    } catch (err) {
        console.error('Lỗi nạp follower scheduler info:', err);
    }
}

function toggleFollowerScanModeUI() {
    const isDaily = document.getElementById('scanModeDaily').checked;
    const wrapDaily = document.getElementById('wrapDailyTimes');
    const wrapInterval = document.getElementById('wrapIntervalHours');
    if (wrapDaily) wrapDaily.style.display = isDaily ? 'block' : 'none';
    if (wrapInterval) wrapInterval.style.display = isDaily ? 'none' : 'block';
}

async function openFollowerSchedulerModal() {
    console.log('[DEBUG MODAL] openFollowerSchedulerModal CALLED');
    const modal = document.getElementById('followerSchedulerModal');
    console.log('[DEBUG MODAL] #followerSchedulerModal element:', modal);
    if (modal) {
        modal.classList.add('active');
        modal.classList.add('show');
        modal.style.display = 'flex';
        const computed = window.getComputedStyle(modal);
        console.log('[DEBUG MODAL] #followerSchedulerModal after open -> style.display:', modal.style.display, 'computed display:', computed.display, 'z-index:', computed.zIndex, 'visibility:', computed.visibility, 'opacity:', computed.opacity);
    } else {
        console.error('[DEBUG MODAL] #followerSchedulerModal NOT FOUND in DOM!');
    }

    try {
        console.log('[DEBUG MODAL] Fetching /api/settings/follower-scheduler...');
        const res = await fetch('/api/settings/follower-scheduler');
        const data = await res.json();
        console.log('[DEBUG MODAL] follower-scheduler settings received:', data);
        const chk = document.getElementById('chkFollowerSchedulerEnable');
        if (chk) chk.checked = Boolean(data.enabled);
        if (data.mode === 'interval') {
            const rInt = document.getElementById('scanModeInterval');
            if (rInt) rInt.checked = true;
        } else {
            const rDay = document.getElementById('scanModeDaily');
            if (rDay) rDay.checked = true;
        }
        const tInput = document.getElementById('inputFollowerScanTimes');
        if (tInput && data.times) tInput.value = data.times;
        const iSelect = document.getElementById('selectFollowerIntervalHours');
        if (iSelect && data.interval_hours) iSelect.value = String(data.interval_hours);
        if (data.follower_threshold_tiktok !== undefined) {
            const el = document.getElementById('schedThresholdTiktok');
            if (el) el.value = data.follower_threshold_tiktok;
        }
        if (data.follower_threshold_youtube !== undefined) {
            const el = document.getElementById('schedThresholdYoutube');
            if (el) el.value = data.follower_threshold_youtube;
        }
        if (data.follower_threshold_facebook !== undefined) {
            const el = document.getElementById('schedThresholdFacebook');
            if (el) el.value = data.follower_threshold_facebook;
        }
        if (typeof toggleFollowerScanModeUI === 'function') toggleFollowerScanModeUI();
    } catch (err) {
        console.error('[DEBUG MODAL] Lỗi đọc follower scheduler settings:', err);
    }
}
window.openFollowerSchedulerModal = openFollowerSchedulerModal;

function closeFollowerSchedulerModal() {
    console.log('[DEBUG MODAL] closeFollowerSchedulerModal CALLED');
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const modal = document.getElementById('followerSchedulerModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('show');
        modal.style.display = 'none';
        console.log('[DEBUG MODAL] #followerSchedulerModal closed');
    }
}
window.closeFollowerSchedulerModal = closeFollowerSchedulerModal;

function openThresholdSettingsModal() {
    console.log('[DEBUG MODAL] openThresholdSettingsModal CALLED');
    const inputTiktok = document.getElementById('modalThTiktok');
    const inputYoutube = document.getElementById('modalThYoutube');
    const inputFacebook = document.getElementById('modalThFacebook');

    if (inputTiktok) inputTiktok.value = followerThresholds.tiktok || 10000;
    if (inputYoutube) inputYoutube.value = followerThresholds.youtube || 1000;
    if (inputFacebook) inputFacebook.value = followerThresholds.facebook || 1000;

    const modal = document.getElementById('thresholdSettingsModal');
    console.log('[DEBUG MODAL] #thresholdSettingsModal element:', modal);
    if (modal) {
        modal.classList.add('active');
        modal.classList.add('show');
        modal.style.display = 'flex';
        const computed = window.getComputedStyle(modal);
        console.log('[DEBUG MODAL] #thresholdSettingsModal after open -> style.display:', modal.style.display, 'computed display:', computed.display, 'z-index:', computed.zIndex, 'visibility:', computed.visibility, 'opacity:', computed.opacity);
    } else {
        console.error('[DEBUG MODAL] #thresholdSettingsModal NOT FOUND in DOM!');
    }

    // Nạp lại giá trị mới nhất từ backend
    fetch('/api/settings/thresholds')
        .then(r => r.json())
        .then(data => {
            console.log('[DEBUG MODAL] thresholds settings received:', data);
            if (data.status === 'success' && data.thresholds) {
                followerThresholds.tiktok = Number(data.thresholds.tiktok) || 10000;
                followerThresholds.youtube = Number(data.thresholds.youtube) || 1000;
                followerThresholds.facebook = Number(data.thresholds.facebook) || 1000;
                if (inputTiktok) inputTiktok.value = followerThresholds.tiktok;
                if (inputYoutube) inputYoutube.value = followerThresholds.youtube;
                if (inputFacebook) inputFacebook.value = followerThresholds.facebook;
            }
        })
        .catch(e => console.warn('[DEBUG MODAL] Lỗi đọc thresholds:', e));
}
window.openThresholdSettingsModal = openThresholdSettingsModal;

function closeThresholdSettingsModal() {
    console.log('[DEBUG MODAL] closeThresholdSettingsModal CALLED');
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const modal = document.getElementById('thresholdSettingsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('show');
        modal.style.display = 'none';
        console.log('[DEBUG MODAL] #thresholdSettingsModal closed');
    }
}
window.closeThresholdSettingsModal = closeThresholdSettingsModal;

async function saveThresholdFromDedicatedModal(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    const inputTiktok = document.getElementById('modalThTiktok');
    const inputYoutube = document.getElementById('modalThYoutube');
    const inputFacebook = document.getElementById('modalThFacebook');

    const thTiktok = Math.max(1, parseInt(inputTiktok ? inputTiktok.value : '10000', 10) || 10000);
    const thYoutube = Math.max(1, parseInt(inputYoutube ? inputYoutube.value : '1000', 10) || 1000);
    const thFacebook = Math.max(1, parseInt(inputFacebook ? inputFacebook.value : '1000', 10) || 1000);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    try {
        const res = await fetch('/api/settings/thresholds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                follower_threshold_tiktok: thTiktok,
                follower_threshold_youtube: thYoutube,
                follower_threshold_facebook: thFacebook
            })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            followerThresholds.tiktok = thTiktok;
            followerThresholds.youtube = thYoutube;
            followerThresholds.facebook = thFacebook;

            // Đồng bộ sang các input khác nếu đang hiển thị
            const sT = document.getElementById('settingThresholdTiktok');
            const sY = document.getElementById('settingThresholdYoutube');
            const sF = document.getElementById('settingThresholdFacebook');
            if (sT) sT.value = thTiktok;
            if (sY) sY.value = thYoutube;
            if (sF) sF.value = thFacebook;

            const scT = document.getElementById('schedThresholdTiktok');
            const scY = document.getElementById('schedThresholdYoutube');
            const scF = document.getElementById('schedThresholdFacebook');
            if (scT) scT.value = thTiktok;
            if (scY) scY.value = thYoutube;
            if (scF) scF.value = thFacebook;

            showToast('✅ Đã lưu cấu hình ngưỡng thông báo thành công!', 'success');
            closeThresholdSettingsModal();
            loadGpmProfiles();
        } else {
            showToast('Lỗi lưu ngưỡng: ' + (data.message || 'Thất bại'), 'error');
        }
    } catch (e) {
        showToast('Lỗi kết nối lưu ngưỡng: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}
window.saveThresholdFromDedicatedModal = saveThresholdFromDedicatedModal;

async function saveFollowerSchedulerSettings(btn) {
    const enabled = document.getElementById('chkFollowerSchedulerEnable').checked;
    const isDaily = document.getElementById('scanModeDaily').checked;
    const mode = isDaily ? 'daily_times' : 'interval';
    const timesInput = document.getElementById('inputFollowerScanTimes');
    const intervalSelect = document.getElementById('selectFollowerIntervalHours');
    const times = timesInput ? timesInput.value.trim() : '';
    const interval_hours = intervalSelect ? (parseInt(intervalSelect.value, 10) || 6) : 6;

    if (mode === 'daily_times') {
        if (!times) {
            markInputError('inputFollowerScanTimes', 'Vui lòng nhập khung giờ quét (Ví dụ: 08:00, 20:00)!');
            return;
        }
        const timeSlots = times.split(',').map(s => s.trim()).filter(Boolean);
        const badSlot = timeSlots.find(s => !isValidTimeHHMM(s));
        if (badSlot || timeSlots.length === 0) {
            markInputError('inputFollowerScanTimes', `Khung giờ "${badSlot || 'trống'}" không hợp lệ! Định dạng chuẩn: HH:MM (00:00 - 23:59)`);
            return;
        }
    } else {
        if (isNaN(interval_hours) || interval_hours < 1 || interval_hours > 48) {
            markInputError('selectFollowerIntervalHours', 'Chu kỳ quét lặp lại phải từ 1 đến 48 giờ!');
            return;
        }
    }

    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    const thTiktok = parseInt(document.getElementById('schedThresholdTiktok')?.value, 10) || followerThresholds.tiktok;
    const thYoutube = parseInt(document.getElementById('schedThresholdYoutube')?.value, 10) || followerThresholds.youtube;
    const thFacebook = parseInt(document.getElementById('schedThresholdFacebook')?.value, 10) || followerThresholds.facebook;

    try {
        const res = await fetch('/api/settings/follower-scheduler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: enabled,
                mode: mode,
                times: times,
                interval_hours: interval_hours,
                follower_threshold_tiktok: thTiktok,
                follower_threshold_youtube: thYoutube,
                follower_threshold_facebook: thFacebook
            })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            followerThresholds.tiktok = thTiktok;
            followerThresholds.youtube = thYoutube;
            followerThresholds.facebook = thFacebook;
            showToast('✅ Đã lưu cấu hình lịch quét Follower thành công!', 'success');
            closeFollowerSchedulerModal();
            loadFollowerSchedulerBadge();
            loadGpmProfiles();
        } else {
            showToast('Lỗi lưu cấu hình: ' + (data.detail || data.message || 'Thất bại'), 'error');
        }
    } catch (err) {
        showToast('Lỗi gửi cài đặt: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}
window.saveFollowerSchedulerSettings = saveFollowerSchedulerSettings;

// 5. Upload Modal
function openUploadModal(videoId, specificPath = null) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Đăng Video Lên Nick')) {
        return;
    }
    const video = cachedVideos.find(v => v.id == videoId || v.yt_video_id === videoId);
    if (!video) {
        showToast('Không tìm thấy thông tin video!', 'warning');
        return;
    }

    // Xác định đường dẫn file đã render:
    // 1. Đường dẫn cụ thể truyền vào (ví dụ part đang phát trong Studio)
    // 2. Hoặc từ activeStudioVideo nếu trùng khớp
    // 3. Hoặc video.rendered_path
    // 4. Hoặc part đầu tiên trong video.rendered_parts
    let targetPath = specificPath;
    if (!targetPath && typeof activeStudioVideo !== 'undefined' && activeStudioVideo && (activeStudioVideo.id == video.id || activeStudioVideo.yt_video_id == video.yt_video_id)) {
        if (activeStudioVideo.rendered_parts && activeStudioVideo.rendered_parts.length > 0) {
            const currentPart = activeStudioVideo.rendered_parts.find(p => p.part === activePlaybackPart) || activeStudioVideo.rendered_parts[0];
            if (currentPart && currentPart.path) targetPath = currentPart.path;
        }
    }
    if (!targetPath && video.rendered_path) {
        targetPath = video.rendered_path;
    }
    if (!targetPath && video.rendered_parts && video.rendered_parts.length > 0) {
        targetPath = video.rendered_parts[0].path;
    }

    if (!targetPath) {
        showToast('Video chưa được render AI!', 'warning');
        return;
    }

    const select = document.getElementById('modalProfileSelect');
    if (cachedGpmProfiles.length === 0) {
        showToast('Vui lòng đồng bộ danh sách trước!', 'warning');
        return;
    }

    select.innerHTML = cachedGpmProfiles.map(p => {
        const pName = (p.name || `Profile ${p.gpm_id}`).trim();
        const ttUser = p.tiktok_username ? (p.tiktok_username.startsWith('@') ? p.tiktok_username : '@' + p.tiktok_username) : (p.tiktok_nickname || 'Chưa gắn TikTok');
        const fullLabel = `${pName} - ${ttUser}`;
        const maxLen = 42;
        const displayLabel = fullLabel.length > maxLen ? fullLabel.substring(0, maxLen - 3) + '...' : fullLabel;
        return `<option value="${p.gpm_id}" title="${escapeHtml(fullLabel)}">${escapeHtml(displayLabel)}</option>`;
    }).join('');

    document.getElementById('modalVideoPath').value = targetPath;
    document.getElementById('modalVideoTitle').value = video.ai_title || video.title;
    if (video.ai_tags && document.getElementById('modalVideoTags')) {
        document.getElementById('modalVideoTags').value = video.ai_tags;
    }
    document.getElementById('uploadModal').classList.add('active');
}

let _uploadAbortController = null;

async function stopUploadVideo() {
    if (_uploadAbortController) {
        _uploadAbortController.abort();
        _uploadAbortController = null;
    }
    try {
        await fetch('/api/tiktok/upload-stop', { method: 'POST' });
        showToast('🛑 Đã gửi lệnh dừng tiến trình đăng video và đóng trình duyệt!');
    } catch (e) {
        showToast('Lỗi gửi lệnh dừng: ' + e.message, true);
    }
}

function closeUploadModal() {
    if (_uploadAbortController) {
        stopUploadVideo();
    }
    const modal = document.getElementById('uploadModal');
    if (modal) modal.classList.remove('active');
    const btn = document.getElementById('btnConfirmUpload');
    if (btn) {
        btn.removeAttribute('data-running');
        btn.className = 'btn btn-primary';
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Bắt Đầu Đăng Bài';
    }
}

async function executeUploadVideo() {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Đăng Video Lên TikTok')) {
        return;
    }

    const btn = document.getElementById('btnConfirmUpload');
    if (btn && btn.getAttribute('data-running') === 'true') {
        await stopUploadVideo();
        if (btn) {
            btn.removeAttribute('data-running');
            btn.className = 'btn btn-primary';
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Bắt Đầu Đăng Bài';
        }
        return;
    }

    const profileId = document.getElementById('modalProfileSelect')?.value;
    const videoPath = (document.getElementById('modalVideoPath')?.value || '').trim();
    const title = (document.getElementById('modalVideoTitle')?.value || '').trim();
    const tags = document.getElementById('modalVideoTags')?.value || '';

    if (!profileId) {
        markInputError('modalProfileSelect', 'Vui lòng chọn Profile để đăng video!');
        return;
    }
    if (!videoPath) {
        markInputError('modalVideoPath', 'Đường dẫn video không được để trống!');
        return;
    }
    if (!title) {
        markInputError('modalVideoTitle', 'Vui lòng nhập tiêu đề cho video TikTok!');
        return;
    }

    if (btn) {
        btn.setAttribute('data-running', 'true');
        btn.className = 'btn btn-danger';
        btn.innerHTML = '<i class="fa-solid fa-stop"></i> Dừng Đăng Ngay';
    }

    _uploadAbortController = new AbortController();
    showToast('🚀 Đang mở trình duyệt profile và upload... (Bấm nút Dừng để hủy)');

    try {
        const res = await fetch('/api/tiktok/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gpm_profile_id: profileId,
                video_path: videoPath,
                title: title,
                tags: tags
            }),
            signal: _uploadAbortController.signal
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('✅ Đã thực hiện xong lệnh đăng video lên TikTok!', 'success');
            closeUploadModal();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Không thể đăng video'), 'error');
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            showToast('🛑 Đã hủy tiến trình đăng video!', 'warning');
        } else {
            showToast('Lỗi kết nối upload: ' + err.message, 'error');
        }
    } finally {
        _uploadAbortController = null;
        if (btn) {
            btn.removeAttribute('data-running');
            btn.className = 'btn btn-primary';
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Bắt Đầu Đăng Bài';
        }
    }
}

// 6. Test Telegram Alert (Gửi cảnh báo đạt ngưỡng tới tất cả các kênh đang Bật)
async function testTelegramAlert(btn, platform) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Gửi...';
    }
    const targetPlat = platform || 'tiktok';
    showToast(`Đang gửi tin nhắn cảnh báo thử nghiệm [${targetPlat.toUpperCase()}] tới các kênh Telegram...`);
    try {
        const res = await fetch('/api/telegram/test-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: targetPlat,
                threshold: getPlatformThreshold(targetPlat)
            })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã gửi test alert thành công!'} (${data.sent_count || 0} kênh)`, 'success');
        } else {
            showToast('⚠️ ' + (data.message || 'Lỗi gửi test alert'), true);
        }
    } catch (err) {
        showToast('Lỗi gửi Telegram: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Gửi Báo Cáo Hoạt Động Hàng Ngày Ngay Lập Tức
async function testDailyReportNow(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Gửi...';
    }
    showToast('Đang tạo và gửi Báo cáo hoạt động ngày tới các kênh Telegram...');
    try {
        const res = await fetch('/api/telegram/send-daily-report', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã gửi Báo cáo hoạt động ngày thành công!'}`, 'success');
        } else {
            showToast('⚠️ ' + (data.message || 'Lỗi gửi báo cáo ngày'), true);
        }
    } catch (err) {
        showToast('Lỗi gửi Telegram: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Gửi Cảnh Báo Sự Cố Thử Nghiệm Kèm Hướng Dẫn Khắc Phục
async function testIssueAlertNow(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Gửi...';
    }
    showToast('Đang gửi cảnh báo lỗi kèm cách khắc phục thử nghiệm...');
    try {
        const res = await fetch('/api/telegram/test-issue-alert', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã gửi cảnh báo lỗi thành công!'}`, 'success');
        } else {
            showToast('⚠️ ' + (data.message || 'Lỗi gửi cảnh báo lỗi'), true);
        }
    } catch (err) {
        showToast('Lỗi gửi Telegram: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Bắn cảnh báo sự cố từ System Diagnostics qua Telegram
async function sendDiagnosticsIssueAlertToTelegram(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
    }
    try {
        const res = await fetch('/api/system/diagnostics');
        const diag = await res.json();
        const actionItems = diag.action_items || [];
        if (actionItems.length === 0) {
            showToast('🎉 Hệ thống hoạt động hoàn hảo! Không có sự cố nào để cảnh báo.', 'success');
            return;
        }

        const firstErr = actionItems.find(i => i.type === 'error') || actionItems[0];
        const payload = {
            title: `Sự cố phát hiện từ Chẩn Đoán Hệ Thống: ${firstErr.title || firstErr.category}`,
            message: firstErr.message || 'Phát hiện sự cố phần mềm phụ thuộc hoặc cấu hình môi trường.',
            solution: firstErr.message || 'Xem chi tiết hướng dẫn sửa trong tab Chẩn Đoán Hệ Thống.',
            severity: firstErr.type === 'error' ? 'HIGH' : 'WARNING',
            details: `Danh mục: ${firstErr.category || 'Môi trường'} | Tổng số lưu ý: ${actionItems.length}`
        };

        const postRes = await fetch('/api/telegram/send-issue-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const postData = await postRes.json();
        if (postRes.ok && postData.status === 'success') {
            showToast('✅ Đã bắn cảnh báo lỗi chẩn đoán qua Telegram thành công!', 'success');
        } else {
            showToast('⚠️ ' + (postData.message || 'Không thể gửi cảnh báo Telegram'), true);
        }
    } catch (err) {
        showToast('Lỗi gửi Telegram: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// Utility
function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}





// Tự động vô hiệu hóa (disable) và làm mờ các nick trùng lặp trên các trình duyệt khác nhau khi 1 nick đã được chọn
function syncCampaignDuplicateCheckboxes(mode = 'new') {
    const isNew = mode === 'new';
    const listId = isNew ? 'campaignGpmList' : 'editCampaignGpmList';
    const checkClass = isNew ? '.campaign-gpm-check' : '.edit-campaign-gpm-check';
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    const allBoxes = Array.from(listEl.querySelectorAll(checkClass));
    const checkedMap = new Map();

    allBoxes.forEach(b => {
        if (b.checked && !b.disabled) {
            const k = b.dataset.accountKey;
            if (k && !checkedMap.has(k)) {
                checkedMap.set(k, {
                    browserLabel: b.dataset.browserLabel || 'GPMLogin',
                    profileName: b.dataset.profileName || '',
                    channelName: b.dataset.channelName || '',
                    box: b
                });
            }
        }
    });

    allBoxes.forEach(b => {
        const k = b.dataset.accountKey;
        const label = b.closest('label');
        if (!label) return;

        let noteBadge = label.querySelector('.dup-disabled-note');

        if (k && checkedMap.has(k)) {
            const source = checkedMap.get(k);
            if (source.box !== b) {
                b.checked = false;
                b.disabled = true;
                label.style.opacity = '0.45';
                label.style.cursor = 'not-allowed';
                label.setAttribute('data-duplicate-disabled', 'true');
                const noteText = `Tài khoản này đã được chọn qua ${source.browserLabel} (${source.profileName})`;
                if (!noteBadge) {
                    noteBadge = document.createElement('span');
                    noteBadge.className = 'badge dup-disabled-note';
                    noteBadge.style.cssText = 'background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); font-size:9.5px; padding:1px 6px; font-weight:600; white-space:nowrap; margin-left:4px; flex-shrink:0;';
                    const targetContainer = label.querySelector('div') || label;
                    targetContainer.appendChild(noteBadge);
                }
                noteBadge.innerHTML = `<i class="fa-solid fa-lock"></i> Đã chọn qua ${escapeHtml(source.browserLabel)} (${escapeHtml(source.profileName)})`;
                noteBadge.style.display = 'inline-flex';
                label.title = noteText;
            } else {
                b.disabled = false;
                label.style.opacity = '1';
                label.style.cursor = 'pointer';
                label.removeAttribute('data-duplicate-disabled');
                label.removeAttribute('title');
                if (noteBadge) noteBadge.style.display = 'none';
            }
        } else {
            b.disabled = false;
            label.style.opacity = '1';
            label.style.cursor = 'pointer';
            label.removeAttribute('data-duplicate-disabled');
            label.removeAttribute('title');
            if (noteBadge) noteBadge.style.display = 'none';
        }
    });

    if (isNew) updateSelectedGpmCount();
    else updateEditSelectedGpmCount();
}
window.syncCampaignDuplicateCheckboxes = syncCampaignDuplicateCheckboxes;

// Module Window Exposures
window.closeUploadModal = closeUploadModal;
window.openUploadModal = openUploadModal;
window.executeUploadVideo = executeUploadVideo;
window.stopUploadVideo = stopUploadVideo;
window.saveProfileUsernameFromModal = saveProfileUsernameFromModal;
window.sendDiagnosticsIssueAlertToTelegram = sendDiagnosticsIssueAlertToTelegram;
window.testDailyReportNow = testDailyReportNow;
window.testIssueAlertNow = testIssueAlertNow;
window.testTelegramAlert = testTelegramAlert;
window.toggleFollowerScanModeUI = toggleFollowerScanModeUI;
window.syncCampaignDuplicateCheckboxes = syncCampaignDuplicateCheckboxes;
window.scanSingleChannelFollowers = scanSingleChannelFollowers;
window.scanSingleProfileFollowers = scanSingleProfileFollowers;
window.scanAllProfilesFollowers = scanAllProfilesFollowers;
window.stopAllProfilesScan = stopAllProfilesScan;
window.checkScanProgress = checkScanProgress;
window.loadGpmProfiles = loadGpmProfiles;
window.renderGpmProfilesTable = renderGpmProfilesTable;
window.openEditUsernameModal = openEditUsernameModal;
window.closeEditUsernameModal = closeEditUsernameModal;
window.openEditChannelModal = openEditChannelModal;
window.openThresholdSettingsModal = openThresholdSettingsModal;
window.closeThresholdSettingsModal = closeThresholdSettingsModal;
window.saveThresholdFromDedicatedModal = saveThresholdFromDedicatedModal;
window.openFollowerSchedulerModal = openFollowerSchedulerModal;
window.closeFollowerSchedulerModal = closeFollowerSchedulerModal;
window.saveFollowerSchedulerSettings = saveFollowerSchedulerSettings;
window.loadFollowerSchedulerBadge = loadFollowerSchedulerBadge;
window.setProfileNotifyStatus = setProfileNotifyStatus;
window.cycleProfileNotifyStatus = cycleProfileNotifyStatus;
window.setChannelNotifyStatus = setChannelNotifyStatus;
window.cycleChannelNotifyStatus = cycleChannelNotifyStatus;
window.deleteGpmProfileFromList = deleteGpmProfileFromList;
window.deleteChannelFromList = deleteChannelFromList;
window.deleteSubChannel = deleteSubChannel;
window.setDefaultChannel = setDefaultChannel;
window.toggleSubChannels = toggleSubChannels;
window.syncProfileChannels = syncProfileChannels;
window.scanCurrentEditProfile = scanCurrentEditProfile;
window.deleteCurrentEditProfile = deleteCurrentEditProfile;
window.exportGpmProfilesCsv = exportGpmProfilesCsv;
window.resetGpmFilters = resetGpmFilters;
window.handleGpmSortChange = handleGpmSortChange;
window.toggleGpmSortDirection = toggleGpmSortDirection;
window.handleGpmHeaderSort = handleGpmHeaderSort;
window.updateEditProfileModalLabels = updateEditProfileModalLabels;
window.onEditProfilePlatformChange = onEditProfilePlatformChange;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.executeUploadVideo = executeUploadVideo;
window.stopUploadVideo = stopUploadVideo;
