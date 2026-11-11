// ==========================================
// Cross-Browser Linked Account Helpers
// ==========================================
function getCanonicalAccountKey(profile, channel = null) {
    if (!profile) return '';
    const plat = (profile.platform || 'tiktok').toLowerCase();
    if (plat === 'youtube') {
        if (channel && channel.channel_id) return 'yt:' + String(channel.channel_id).trim();
        if (channel && channel.channel_url) {
            const u = String(channel.channel_url).trim().toLowerCase().replace(/^@/, '');
            if (u) return 'yt:' + u;
        }
        if (profile.channel_handle) return 'yt:' + String(profile.channel_handle).trim().toLowerCase().replace(/^@/, '');
        if (profile.tiktok_username) return 'yt:' + String(profile.tiktok_username).trim().toLowerCase().replace(/^@/, '');
        if (profile.tiktok_uid) return 'yt:' + String(profile.tiktok_uid).trim();
        return 'yt:' + String(profile.name || profile.gpm_id).trim().toLowerCase();
    } else if (plat === 'facebook') {
        if (channel && channel.channel_id) return 'fb:' + String(channel.channel_id).trim();
        if (profile.fb_page_id) return 'fb:' + String(profile.fb_page_id).trim();
        if (profile.tiktok_username) return 'fb:' + String(profile.tiktok_username).trim();
        return 'fb:' + String(profile.name || profile.gpm_id).trim().toLowerCase();
    } else {
        if (profile.tiktok_uid) return 'tt:' + String(profile.tiktok_uid).trim();
        if (profile.tiktok_username) return 'tt:' + String(profile.tiktok_username).trim().toLowerCase().replace(/^@/, '');
        return 'tt:' + String(profile.name || profile.gpm_id).trim().toLowerCase();
    }
}

function findLinkedCrossBrowserProfile(targetProfile, allProfiles) {
    if (!targetProfile || !allProfiles) return null;
    const tKey = getCanonicalAccountKey(targetProfile);
    const tBType = (targetProfile.browser_type || 'gpm').toLowerCase();
    const tPlat = (targetProfile.platform || 'tiktok').toLowerCase();

    for (const o of allProfiles) {
        if (o.id === targetProfile.id) continue;
        const oPlat = (o.platform || 'tiktok').toLowerCase();
        if (oPlat !== tPlat) continue;

        const oKey = getCanonicalAccountKey(o);
        if (tKey && oKey && tKey === oKey) {
            return o;
        }

        // Check channel intersections
        if (Array.isArray(targetProfile.channels) && Array.isArray(o.channels)) {
            for (const tc of targetProfile.channels) {
                const tcKey = getCanonicalAccountKey(targetProfile, tc);
                for (const oc of o.channels) {
                    const ocKey = getCanonicalAccountKey(o, oc);
                    if (tcKey && ocKey && tcKey === ocKey) {
                        return o;
                    }
                }
            }
        } else if (Array.isArray(o.channels)) {
            for (const oc of o.channels) {
                const ocKey = getCanonicalAccountKey(o, oc);
                if (tKey && ocKey && tKey === ocKey) {
                    return o;
                }
            }
        } else if (Array.isArray(targetProfile.channels)) {
            for (const tc of targetProfile.channels) {
                const tcKey = getCanonicalAccountKey(targetProfile, tc);
                if (tcKey && oKey && tcKey === oKey) {
                    return o;
                }
            }
        }
    }
    return null;
}

// State
let currentTab = 'tab-auto-pipeline';
let cachedGpmProfiles = [];
let cachedVideos = [];
let cachedCampaigns = [];
let activeStudioVideo = null;
let currentStudioFilter = 'all';
let cachedAudioCategories = [];

let followerThresholds = {
    tiktok: 10000,
    youtube: 1000,
    facebook: 1000
};

function getPlatformThreshold(plat) {
    const p = (plat || 'tiktok').toLowerCase();
    return followerThresholds[p] || followerThresholds.tiktok || 10000;
}

function formatThresholdDisplay(num) {
    const n = Number(num) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
    return n.toString();
}

function isProfileEligible(p) {
    if (!p) return false;
    const plat = (p.platform || 'tiktok').toLowerCase();
    const th = getPlatformThreshold(plat);
    const count = p.followers_count || 0;
    if (count >= th) return true;
    if (p.eligible_10k === 1 || p.eligible_10k === true) return true;
    if (Array.isArray(p.channels)) {
        return p.channels.some(ch => (ch.followers_count || 0) >= th);
    }
    return false;
}

function isChannelEligible(ch, plat) {
    if (!ch) return false;
    const th = getPlatformThreshold(plat);
    return (ch.followers_count || 0) >= th;
}

async function loadFollowerThresholds() {
    try {
        const res = await fetch('/api/settings/thresholds');
        const data = await res.json();
        if (data.status === 'success' && data.thresholds) {
            followerThresholds = {
                tiktok: Number(data.thresholds.tiktok) || 10000,
                youtube: Number(data.thresholds.youtube) || 1000,
                facebook: Number(data.thresholds.facebook) || 1000
            };
        }
    } catch (e) {
        console.warn('Lỗi nạp cấu hình followerThresholds:', e);
    }
}

async function ensureAudioCategoriesLoaded() {
    if (!cachedAudioCategories || !cachedAudioCategories.length) {
        try {
            const res = await fetch('/api/audio/categories');
            const data = await res.json();
            if (data.status === 'success') {
                cachedAudioCategories = data.categories || [];
            }
        } catch (e) {
            console.error('Lỗi nạp thư mục BGM:', e);
        }
    }
    if (typeof populateAllBgmSelects === 'function') {
        populateAllBgmSelects(cachedAudioCategories);
    }
    return cachedAudioCategories;
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    loadInitialRssAndHost();
    applyCachedSchedulerState();
    setupNavigation();
    loadDashboardStats();
    loadCampaigns();
    loadPipelineStatus();
    startTopbarClock();
    initLanguageVoiceAutoSync();
    if (typeof loadActiveBrowser === 'function') loadActiveBrowser();
    if (window.themeManager && typeof window.themeManager.init === 'function') window.themeManager.init();
    if (window.i18n && typeof window.i18n.applyTranslations === 'function') window.i18n.applyTranslations();

    // Defer non-critical background data loading so initial UI paints instantly
    const deferLoad = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    deferLoad(() => {
        loadVideos();
        loadSavedChannels();
        loadGpmProfiles();
        loadFollowerThresholds();
        loadFollowerSchedulerBadge();
        loadSystemTraySettings();
        applyColumnVisibility();
        ensureAudioCategoriesLoaded();
        checkScanProgress();
    });
    document.addEventListener('appLanguageChanged', () => {
        if (typeof window.updateActiveTabHeaders === 'function') {
            window.updateActiveTabHeaders();
        }
    });

    // DEBUG CLICK MONITOR (Capture phase to see if click reaches DOM)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#btnFollowerSchedulerModal, #btnThresholdSettingsModal, .btn-inline-edit, .action-dropdown-item');
        if (btn) {
            console.log('[DEBUG CLICK MONITOR] Clicked button in capture phase:', btn.id || btn.className, 'target:', e.target);
        }
    }, true);

    // Close column dropdown & action menus when clicking outside
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.col-picker-container');
        if (container && !container.contains(e.target)) {
            closeColumnDropdown();
        }
        if (!e.target.closest('.action-dropdown-wrap')) {
            closeAllActionMenus();
        }
    });

    // Close detail modal when clicking outside modal-content
    const detailModal = document.getElementById('channelDetailModal');
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                closeChannelDetailModal();
            }
        });
    }

    const campaignModal = document.getElementById('newCampaignModal');
    if (campaignModal) {
        campaignModal.addEventListener('click', (e) => {
            if (e.target === campaignModal) {
                closeNewCampaignModal();
            }
        });
    }

    const editCampModal = document.getElementById('editCampaignModal');
    if (editCampModal) {
        editCampModal.addEventListener('click', (e) => {
            if (e.target === editCampModal) {
                closeEditCampaignModal();
            }
        });
    }

    const campLogsModal = document.getElementById('campaignLogsModal');
    if (campLogsModal) {
        campLogsModal.addEventListener('click', (e) => {
            if (e.target === campLogsModal) {
                closeCampaignLogsModal();
            }
        });
    }

    const schedModal = document.getElementById('schedulerSettingsModal');
    if (schedModal) {
        schedModal.addEventListener('click', (e) => {
            if (e.target === schedModal) {
                closeSchedulerSettingsModal();
            }
        });
    }

    const follSchedModal = document.getElementById('followerSchedulerModal');
    if (follSchedModal) {
        follSchedModal.addEventListener('click', (e) => {
            console.log('[DEBUG MODAL] follSchedModal click event, target:', e.target.id || e.target.className);
            if (e.target === follSchedModal) {
                console.log('[DEBUG MODAL] Clicked directly on follSchedModal backdrop -> closing');
                closeFollowerSchedulerModal();
            }
        });
    }

    const threshModal = document.getElementById('thresholdSettingsModal');
    if (threshModal) {
        threshModal.addEventListener('click', (e) => {
            console.log('[DEBUG MODAL] threshModal click event, target:', e.target.id || e.target.className);
            if (e.target === threshModal) {
                console.log('[DEBUG MODAL] Clicked directly on threshModal backdrop -> closing');
                closeThresholdSettingsModal();
            }
        });
    }

    const editUserModal = document.getElementById('editProfileUsernameModal');
    if (editUserModal) {
        editUserModal.addEventListener('click', (e) => {
            console.log('[DEBUG MODAL] editUserModal click event, target:', e.target.id || e.target.className);
            if (e.target === editUserModal) {
                console.log('[DEBUG MODAL] Clicked directly on editUserModal backdrop -> closing');
                closeEditUsernameModal();
            }
        });
    }

    // Keyboard ESC listener for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllActionMenus();
            closeChannelDetailModal();
            closeNewCampaignModal();
            closeEditCampaignModal();
            closeCampaignLogsModal();
            closeSchedulerSettingsModal();
            closeFollowerSchedulerModal();
            closeThresholdSettingsModal();
            closeEditUsernameModal();
        }
    });

    const btnSaveDetail = document.getElementById('btnToggleSaveFromDetail');
    if (btnSaveDetail) {
        btnSaveDetail.addEventListener('click', toggleSaveFromDetailModal);
    }

    // Auto refresh logs & stats every 8 seconds (paused when tab hidden, resumes on return)
    setInterval(loadDashboardStats, 8000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) loadDashboardStats();
    });
});

// HTML Escaper for safe rendering
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isAbsolutePath(p) {
    if (!p || typeof p !== 'string') return false;
    const clean = p.trim();
    return /^[a-zA-Z]:[\\/]/.test(clean) || clean.startsWith('\\\\') || clean.startsWith('/');
}

// Enhanced Toast notification helper supporting types ('error', 'warning', 'success', 'info') and structured error formatting
let toastDismissTimer = null;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Backward compatibility: boolean isError
    let normalizedType = 'info';
    if (type === true || type === 'error' || type === 'danger') {
        normalizedType = 'error';
    } else if (type === 'warning' || type === 'warn') {
        normalizedType = 'warning';
    } else if (type === false || type === 'success') {
        normalizedType = 'success';
    } else if (typeof type === 'string' && ['info', 'error', 'warning', 'success'].includes(type.toLowerCase())) {
        normalizedType = type.toLowerCase();
    }

    // Format message if it's an object or array (e.g., FastAPI 422 detail)
    let displayMsg = '';
    if (typeof message === 'string') {
        displayMsg = message;
    } else if (Array.isArray(message)) {
        displayMsg = message.map(item => {
            if (typeof item === 'string') return item;
            if (item && item.msg) return item.msg;
            if (item && item.message) return item.message;
            return JSON.stringify(item);
        }).join('\n');
    } else if (message && typeof message === 'object') {
        if (message.detail) {
            displayMsg = typeof message.detail === 'string'
                ? message.detail
                : (Array.isArray(message.detail) ? message.detail.map(d => d.msg || JSON.stringify(d)).join('\n') : JSON.stringify(message.detail));
        } else if (message.message) {
            displayMsg = message.message;
        } else if (message.msg) {
            displayMsg = message.msg;
        } else {
            try {
                displayMsg = JSON.stringify(message);
            } catch (_) {
                displayMsg = String(message);
            }
        }
    } else {
        displayMsg = String(message || '');
    }

    // Auto-translate toast content if active language is not Vietnamese
    if (window.i18n && typeof window.i18n.translateTextString === 'function' && window.i18n.currentLang !== 'vi') {
        let cleanMsg = displayMsg.trim();
        let prefix = '';
        const iconMatch = cleanMsg.match(/^([✅❌⚠️ℹ️🔥⚡💡🛑🎉🚀\s]+)(.*)$/);
        if (iconMatch) {
            prefix = iconMatch[1];
            cleanMsg = iconMatch[2].trim();
        }
        const trans = window.i18n.translateTextString(cleanMsg, window.i18n.currentLang);
        if (trans) {
            displayMsg = prefix + trans;
        }
    }

    // Icons per type
    let iconHtml = '<i class="fa-solid fa-circle-info toast-icon"></i>';
    if (normalizedType === 'error') {
        iconHtml = '<i class="fa-solid fa-circle-exclamation toast-icon"></i>';
    } else if (normalizedType === 'warning') {
        iconHtml = '<i class="fa-solid fa-triangle-exclamation toast-icon"></i>';
    } else if (normalizedType === 'success') {
        iconHtml = '<i class="fa-solid fa-circle-check toast-icon"></i>';
    }

    toast.className = `toast toast-${normalizedType}`;
    toast.innerHTML = `${iconHtml}<div class="toast-content">${escapeHtml(displayMsg).replace(/\n/g, '<br>')}</div>`;
    toast.classList.add('show');

    if (toastDismissTimer) clearTimeout(toastDismissTimer);
    toastDismissTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Input Error Feedback Helpers
function markInputError(elOrId, message = '', type = 'error') {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) {
        if (message) showToast(message, type);
        return;
    }

    el.classList.add('input-invalid');
    el.classList.remove('input-shake');
    // Force DOM reflow to re-trigger CSS shake animation
    void el.offsetWidth;
    el.classList.add('input-shake');

    setTimeout(() => {
        el.classList.remove('input-shake');
    }, 400);

    try {
        if (typeof el.focus === 'function') el.focus();
    } catch (_) { }

    // Add inline error feedback under input if message is supplied
    if (message && el.parentElement) {
        let errorMsgEl = el.parentElement.querySelector(`.input-error-msg[data-for="${el.id || ''}"]`);
        if (!errorMsgEl) {
            errorMsgEl = document.createElement('div');
            errorMsgEl.className = 'input-error-msg';
            if (el.id) errorMsgEl.setAttribute('data-for', el.id);
            if (el.nextSibling) {
                el.parentElement.insertBefore(errorMsgEl, el.nextSibling);
            } else {
                el.parentElement.appendChild(errorMsgEl);
            }
        }
        errorMsgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${escapeHtml(message)}</span>`;
    }

    // Auto-remove error state when user changes or types in the field (clean up previous listener to prevent leaks)
    if (el._clearErrorHandler) {
        el.removeEventListener('input', el._clearErrorHandler);
        el.removeEventListener('change', el._clearErrorHandler);
    }
    const clearHandler = () => {
        clearInputError(el);
        el.removeEventListener('input', clearHandler);
        el.removeEventListener('change', clearHandler);
        el._clearErrorHandler = null;
    };
    el._clearErrorHandler = clearHandler;
    el.addEventListener('input', clearHandler);
    el.addEventListener('change', clearHandler);

    if (message) {
        showToast(message, type);
    }
}

function clearInputError(elOrId) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;

    el.classList.remove('input-invalid');
    el.classList.remove('input-shake');

    if (el.parentElement) {
        const errorMsgEl = el.parentElement.querySelector(`.input-error-msg[data-for="${el.id || ''}"]`);
        if (errorMsgEl) errorMsgEl.remove();
    }
}

function clearAllInputErrors(containerOrSelector) {
    const root = typeof containerOrSelector === 'string'
        ? document.querySelector(containerOrSelector)
        : (containerOrSelector || document);
    if (!root) return;
    root.querySelectorAll('.input-invalid').forEach(el => clearInputError(el));
    root.querySelectorAll('.input-error-msg').forEach(el => el.remove());
}

// Input Format Validators
function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.trim();
    if (!clean) return false;
    // Check 11-char raw ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return true;
    // Check standard or shorts URL
    const ytRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return ytRegex.test(clean);
}

function isValidTimeHHMM(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return false;
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr.trim());
}

function isValidFolderName(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (!clean) return false;
    // Check forbidden Windows file/folder characters: \ / : * ? " < > |
    return !/[\\/:*?"<>|]/.test(clean);
}

function isValidProxyFormat(proxyStr) {
    if (!proxyStr || typeof proxyStr !== 'string') return true; // Optional proxy can be empty
    const clean = proxyStr.trim();
    if (!clean) return true;
    // Format: host:port, host:port:user:pass, user:pass@host:port (with optional scheme)
    return /^(https?:\/\/|socks5:\/\/)?([a-zA-Z0-9.-]+):(\d{2,5})(:[^:]+:[^:]+)?$/.test(clean) ||
        /^(https?:\/\/|socks5:\/\/)?([^:]+:[^@]+@)?([a-zA-Z0-9.-]+):(\d{2,5})$/.test(clean);
}


// Global Custom Confirmation Modal Dialog (replaces window.confirm to avoid "127.0.0.1:8088 says" address)
function showConfirmDialog({
    title = 'Xác Nhận Hành Động',
    message = 'Bạn có chắc chắn muốn thực hiện thao tác này?',
    details = '',
    confirmText = 'Xác Nhận',
    cancelText = 'Hủy Bỏ',
    confirmClass = 'btn-danger',
    icon = 'fa-solid fa-triangle-exclamation text-danger'
} = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalGlobalConfirm');
        if (!modal) {
            resolve(window.confirm(message));
            return;
        }

        const titleEl = document.getElementById('globalConfirmTitle');
        const msgEl = document.getElementById('globalConfirmMessage');
        const detEl = document.getElementById('globalConfirmDetails');
        const iconEl = document.getElementById('globalConfirmIcon');
        const btnOk = document.getElementById('btnGlobalConfirmOk');
        const btnCancel = document.getElementById('btnGlobalConfirmCancel');
        const btnClose = document.getElementById('btnGlobalConfirmClose');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.style.wordBreak = 'break-word';
            msgEl.style.overflowWrap = 'anywhere';
        }
        if (detEl) {
            detEl.textContent = details || '';
            detEl.style.display = details ? 'block' : 'none';
            detEl.style.wordBreak = 'break-word';
            detEl.style.overflowWrap = 'anywhere';
        }
        if (iconEl) iconEl.className = icon;
        if (btnOk) {
            btnOk.className = `btn ${confirmClass}`;
            btnOk.innerHTML = `<i class="fa-solid fa-check"></i> ${confirmText}`;
        }
        if (btnCancel) btnCancel.textContent = cancelText;

        let resolved = false;
        const cleanup = (result) => {
            if (resolved) return;
            resolved = true;
            modal.classList.remove('active');
            btnOk?.removeEventListener('click', onOk);
            btnCancel?.removeEventListener('click', onCancel);
            btnClose?.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeyDown);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
        const onKeyDown = (e) => { if (e.key === 'Escape') cleanup(false); };

        btnOk?.addEventListener('click', onOk);
        btnCancel?.addEventListener('click', onCancel);
        btnClose?.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeyDown);

        modal.classList.add('active');
    });
}

// Sidebar Toggle
function toggleSidebar() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    const btn = document.getElementById('sidebarToggleBtn');
    if (btn) {
        btn.setAttribute('data-tooltip', collapsed ? 'Mở rộng' : 'Thu gọn');
    }
}

// Multi-Voice Catalog filtered by Language
const VOICE_OPTIONS_BY_LANG = {
    'vi': [
        { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh (Nam - Phóng sự đại án, tài liệu giật gân)' },
        { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My (Nữ - Truyền cảm, tâm lý, tin tức)' }
    ],
    'en': [
        { id: 'en-US-ChristopherNeural', name: '🔥 Christopher (Viral TikTok deep storytelling)' },
        { id: 'en-US-GuyNeural', name: 'Guy (Nam - Tự nhiên, vlog đời thường)' },
        { id: 'en-US-BrianNeural', name: 'Brian (Nam - Năng động, hài hước, hiện đại)' },
        { id: 'en-US-AndrewNeural', name: 'Andrew (Nam - Trầm, ấm áp, tin cậy)' },
        { id: 'en-US-EricNeural', name: 'Eric (Nam - Trẻ trung, đĩnh đạc)' },
        { id: 'en-US-AvaNeural', name: 'Ava (Nữ - Trendy TikTok aesthetic, trẻ trung)' },
        { id: 'en-US-JennyNeural', name: 'Jenny (Nữ - Kể chuyện cuốn hút, tự nhiên)' },
        { id: 'en-US-EmmaNeural', name: 'Emma (Nữ - Nhẹ nhàng, tâm sự, sâu lắng)' },
        { id: 'en-US-AriaNeural', name: 'Aria (Nữ - Chuyên nghiệp, thời sự, tin tức)' },
        { id: 'en-US-AnaNeural', name: 'Ana (Nữ - Hoạt hình, nhí nhảnh, vui tươi)' }
    ],
    'ja': [
        { id: 'ja-JP-KeitaNeural', name: 'Keita (Nam - Thần thoại, anime, giật gân)' },
        { id: 'ja-JP-NanamiNeural', name: 'Nanami (Nữ - Dịu dàng, chuẩn giọng Tokyo)' }
    ],
    'ko': [
        { id: 'ko-KR-InJoonNeural', name: 'InJoon (Nam - Phim truyền hình K-Drama, kịch tính)' },
        { id: 'ko-KR-HyunsuMultilingualNeural', name: 'Hyunsu (Nam - Điện ảnh, trầm ấm hiện đại)' },
        { id: 'ko-KR-SunHiNeural', name: 'SunHi (Nữ - Năng động, thời trang, sành điệu)' }
    ],
    'de': [
        { id: 'de-DE-ConradNeural', name: 'Conrad (Nam - Khoa học, lịch sử, đĩnh đạc)' },
        { id: 'de-DE-KillianNeural', name: 'Killian (Nam - Đài phát thanh, năng lượng)' },
        { id: 'de-DE-FlorianMultilingualNeural', name: 'Florian (Nam - Trẻ trung, đa ngôn ngữ)' },
        { id: 'de-DE-KatjaNeural', name: 'Katja (Nữ - Thời sự, tin tức rõ ràng)' },
        { id: 'de-DE-AmalaNeural', name: 'Amala (Nữ - Nhẹ nhàng, ấm áp)' },
        { id: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina (Nữ - Tự nhiên, đa ngôn ngữ)' }
    ],
    'es': [
        { id: 'es-ES-AlvaroNeural', name: 'Alvaro (Nam - Tây Ban Nha, truyền cảm)' },
        { id: 'es-MX-JorgeNeural', name: 'Jorge (Nam - Mexico, tự nhiên)' },
        { id: 'es-ES-ElviraNeural', name: 'Elvira (Nữ - Tây Ban Nha, rõ ràng)' },
        { id: 'es-MX-DaliaNeural', name: 'Dalia (Nữ - Mexico, trẻ trung)' }
    ],
    'fr': [
        { id: 'fr-FR-HenriNeural', name: 'Henri (Nam - Truyền cảm, lịch lãm)' },
        { id: 'fr-FR-DeniseNeural', name: 'Denise (Nữ - Rõ ràng, tin tức)' },
        { id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne (Nữ - Tự nhiên, đa ngôn ngữ)' }
    ]
};

function updateVoiceDropdownOptions(voiceSelectId, langCode, currentVal = null, allowInherit = false) {
    const voiceSelect = document.getElementById(voiceSelectId);
    if (!voiceSelect) return;

    const valToKeep = currentVal !== null ? currentVal : voiceSelect.value;
    let html = '';

    if (allowInherit) {
        html += '<option value="inherit">Theo Chiến dịch (Mặc định)</option>';
    }

    html += '<optgroup label="⚡ Chế độ Tự Động">';
    html += '<option value="male">👦 Giọng Nam Chuẩn (Auto)</option>';
    html += '<option value="female">👧 Giọng Nữ Chuẩn (Auto)</option>';
    html += '</optgroup>';

    const langNames = {
        'vi': '🇻🇳 Tiếng Việt',
        'en': '🇺🇸 English (US)',
        'ja': '🇯🇵 日本語',
        'ko': '🇰🇷 한국어',
        'de': '🇩🇪 Deutsch',
        'es': '🇪🇸 Español',
        'fr': '🇫🇷 Français'
    };

    if (VOICE_OPTIONS_BY_LANG[langCode]) {
        html += `<optgroup label="${langNames[langCode] || langCode}">`;
        VOICE_OPTIONS_BY_LANG[langCode].forEach(v => {
            html += `<option value="${v.id}">${v.name}</option>`;
        });
        html += '</optgroup>';
    } else {
        // When language is "original" or "inherit", list available languages
        Object.keys(VOICE_OPTIONS_BY_LANG).forEach(k => {
            html += `<optgroup label="${langNames[k]}">`;
            VOICE_OPTIONS_BY_LANG[k].forEach(v => {
                html += `<option value="${v.id}">${v.name}</option>`;
            });
            html += '</optgroup>';
        });
    }

    voiceSelect.innerHTML = html;

    // Restore or select best voice
    if (valToKeep && voiceSelect.querySelector(`option[value="${valToKeep}"]`)) {
        voiceSelect.value = valToKeep;
    } else if (allowInherit && (langCode === 'inherit' || valToKeep === 'inherit')) {
        voiceSelect.value = 'inherit';
    } else if (VOICE_OPTIONS_BY_LANG[langCode] && VOICE_OPTIONS_BY_LANG[langCode].length > 0) {
        voiceSelect.value = VOICE_OPTIONS_BY_LANG[langCode][0].id;
    } else {
        voiceSelect.value = 'male';
    }
}

let voiceNarratorPreviewAudio = null;
let voiceNarratorPreviewBtn = null;

function resetPreviewBtnState(btnEl) {
    if (!btnEl) return;
    btnEl.className = 'btn-voice-preview';
    btnEl.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    btnEl.title = 'Nghe thử giọng đọc';
}

function setPreviewBtnLoading(btnEl) {
    if (!btnEl) return;
    btnEl.className = 'btn-voice-preview loading';
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnEl.title = 'Đang tải bản nghe thử...';
}

function setPreviewBtnPlaying(btnEl) {
    if (!btnEl) return;
    btnEl.className = 'btn-voice-preview playing';
    btnEl.innerHTML = '<i class="fa-solid fa-stop"></i>';
    btnEl.title = 'Bấm để dừng nghe thử';
}

function playVoicePreview(voiceSelectId, langSelectId, btnEl) {
    const voiceSelect = document.getElementById(voiceSelectId);
    const langSelect = document.getElementById(langSelectId);

    let voiceId = voiceSelect ? voiceSelect.value : 'en-US-ChristopherNeural';
    let lang = langSelect ? langSelect.value : 'original';

    if (voiceId === 'inherit') {
        voiceId = (lang && lang !== 'inherit' && lang !== 'original') ? lang : 'en-US-ChristopherNeural';
    }

    // Toggle stop if already playing
    if (voiceNarratorPreviewAudio) {
        try {
            voiceNarratorPreviewAudio.pause();
            voiceNarratorPreviewAudio.src = '';
            voiceNarratorPreviewAudio.load();
        } catch (_) { }
        if (voiceNarratorPreviewBtn) {
            resetPreviewBtnState(voiceNarratorPreviewBtn);
        }
        if (voiceNarratorPreviewBtn === btnEl) {
            voiceNarratorPreviewAudio = null;
            voiceNarratorPreviewBtn = null;
            return;
        }
    }

    voiceNarratorPreviewBtn = btnEl;
    setPreviewBtnLoading(btnEl);

    const url = `/api/voices/preview?voice_id=${encodeURIComponent(voiceId)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(url);
    voiceNarratorPreviewAudio = audio;

    audio.addEventListener('playing', () => {
        if (voiceNarratorPreviewBtn === btnEl) {
            setPreviewBtnPlaying(btnEl);
        }
    });

    audio.addEventListener('ended', () => {
        if (voiceNarratorPreviewBtn === btnEl) {
            resetPreviewBtnState(btnEl);
            try { audio.src = ''; audio.load(); } catch (_) { }
            voiceNarratorPreviewAudio = null;
            voiceNarratorPreviewBtn = null;
        }
    });

    audio.addEventListener('error', (err) => {
        console.error('Lỗi phát giọng đọc preview:', err);
        if (voiceNarratorPreviewBtn === btnEl) {
            btnEl.className = 'btn-voice-preview';
            btnEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff4d4d;"></i>';
            btnEl.title = 'Không thể tải âm thanh nghe thử';
            setTimeout(() => {
                resetPreviewBtnState(btnEl);
                try { audio.src = ''; audio.load(); } catch (_) { }
                voiceNarratorPreviewAudio = null;
                voiceNarratorPreviewBtn = null;
            }, 2000);
        }
    });

    audio.play().catch(err => {
        console.warn('Playback error / autoplay blocked:', err);
        if (voiceNarratorPreviewBtn === btnEl) {
            resetPreviewBtnState(btnEl);
            voiceNarratorPreviewAudio = null;
            voiceNarratorPreviewBtn = null;
        }
    });
}

function initLanguageVoiceAutoSync() {
    const pairs = [
        { langId: 'settingChannelNarrationLanguage', voiceId: 'settingChannelVoiceGender', allowInherit: true },
        { langId: 'campaignNarrationLanguage', voiceId: 'campaignVoiceGender', allowInherit: false },
        { langId: 'editCampaignNarrationLanguage', voiceId: 'editCampaignVoiceGender', allowInherit: false }
    ];

    pairs.forEach(({ langId, voiceId, allowInherit }) => {
        const langEl = document.getElementById(langId);
        const voiceEl = document.getElementById(voiceId);
        if (!langEl || !voiceEl) return;

        // Initial sync on load
        updateVoiceDropdownOptions(voiceId, langEl.value, voiceEl.value, allowInherit);

        langEl.addEventListener('change', () => {
            const lang = langEl.value;
            updateVoiceDropdownOptions(voiceId, lang, null, allowInherit);
        });
    });
}

// Navigation Tabs
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    // Đồng bộ ngay tiêu đề topbar và nội dung tab đang mở
    switchTab(currentTab);
}

function switchTab(tabId) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    // Pause any playing studio video when navigating away to free hardware decoders & CPU
    if (tabId !== 'tab-video-studio') {
        const studioVideo = document.getElementById('studioVideoPlayer');
        if (studioVideo && !studioVideo.paused) {
            try { studioVideo.pause(); } catch (_) { }
        }
    }
    // Aliases support
    if (tabId === 'tab-youtube') {
        tabId = 'tab-sources';
        switchSourceSubTab('search');
    } else if (tabId === 'tab-saved-channels') {
        tabId = 'tab-sources';
        switchSourceSubTab('saved');
    } else if (tabId === 'tab-sources') {
        const btnSaved = document.getElementById('btnSubnavSaved');
        if (btnSaved && btnSaved.classList.contains('active')) {
            switchSourceSubTab('saved');
        } else {
            switchSourceSubTab('search');
        }
    } else if (tabId === 'tab-pipeline') {
        tabId = 'tab-auto-pipeline';
    } else if (tabId === 'tab-ai-editor') {
        tabId = 'tab-video-studio';
    }

    currentTab = tabId;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update active tab pane
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    const activePane = document.getElementById(tabId);
    if (activePane) activePane.classList.add('active');

    // Update Stepper Banner Highlight
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));
    if (tabId === 'tab-sources') {
        document.getElementById('step1Indicator')?.classList.add('active');
    } else if (tabId === 'tab-video-studio') {
        document.getElementById('step2Indicator')?.classList.add('active');
    } else if (tabId === 'tab-auto-pipeline') {
        document.getElementById('step3Indicator')?.classList.add('active');
    } else if (tabId === 'tab-gpm-farm' || tabId === 'tab-tracker') {
        document.getElementById('step4Indicator')?.classList.add('active');
    }

    // Update Topbar Title & Subtitle for every sidebar item
    function updateActiveTabHeaders() {
        if (window.i18n && typeof window.i18n.getTabMeta === 'function') {
            const meta = window.i18n.getTabMeta(currentTab);
            const titleEl = document.getElementById('pageTitle');
            const subEl = document.getElementById('pageSubtitle');
            if (titleEl) titleEl.textContent = meta.title;
            if (subEl) subEl.textContent = meta.sub;
            return;
        }

        const tabMeta = {
            'tab-auto-pipeline': {
                title: 'Chiến Dịch Tự Động Hóa',
                sub: 'Quy trình khép kín: Quét RSS Kênh → Tải MP4 → AI Render 9:16 → Tự Đăng Tài Khoản'
            },
            'tab-video-studio': {
                title: 'Studio Biên Tập Video 9:16',
                sub: 'Tùy chỉnh mẫu cắt >60s chuẩn Quỹ Beta & xem trước trực tiếp trên điện thoại mô phỏng'
            },
            'tab-video-manager': {
                title: 'Quản Lý Video & Tải Đa Nền Tảng',
                sub: 'Tải video sạch không watermark từ 7 nền tảng, nạp kho video cục bộ & quản lý thư viện video'
            },
            'tab-elevenlabs': {
                title: 'Phòng Thu Giọng Đọc ElevenLabs AI',
                sub: 'Tạo giọng đọc siêu thực đa cảm xúc, thử nghiệm âm thanh và kết nối với từng Kênh/Chiến dịch TikTok'
            },
            'tab-sources': {
                title: 'Quản Lý Kênh YouTube Nguồn',
                sub: 'Theo dõi nguồn RSS chất lượng cao và quét từ khóa tự động tìm kênh mới'
            },
            'tab-gpm-farm': {
                title: 'Dàn Tài Khoản Đa Nền Tảng',
                sub: 'Quản lý profile, theo dõi tăng trưởng follower và cấu hình thông báo Telegram'
            },
            'tab-overview': {
                title: 'Bảng Điều Khiển Tổng Quan',
                sub: 'Số liệu tổng quan hệ thống, tài nguyên và tiến độ tăng trưởng'
            },
            'tab-pipeline-queue': {
                title: 'Hàng Đợi & Lịch Đăng',
                sub: 'Theo dõi 4 giai đoạn: Mới tải về → Đã render 9:16 → Chờ lịch đăng → Đã đăng'
            },
            'tab-logs': {
                title: 'Nhật Ký Hệ Thống',
                sub: 'Theo dõi toàn bộ sự kiện, tiến trình chạy nền và cảnh báo lỗi thời gian thực'
            },
            'tab-ai-usage': {
                title: 'Quản Lý Mức Sử Dụng & Chi Phí AI',
                sub: 'Theo dõi lượng token, số lượt gọi API và ngân sách hệ thống theo thời gian thực.'
            },
            'tab-audio-studio': {
                title: 'Kho Âm Thanh & Nhạc Nền',
                sub: 'Tìm kiếm nhạc YouTube No-Copyright, tải lên MP3 và quản lý playlist chủ đề theo kênh'
            },
            'tab-settings': {
                title: 'Cài Đặt API & Cấu Hình Hệ Thống',
                sub: 'Thiết lập YouTube Data API, OpenAI, Gemini và Telegram Alert Bot'
            }
        };
        const meta = tabMeta[currentTab] || { title: 'TikTok Beta Farm', sub: 'Hệ thống tự động hóa khai thác YouTube sang TikTok Beta' };
        const titleEl = document.getElementById('pageTitle');
        const subEl = document.getElementById('pageSubtitle');
        if (titleEl) titleEl.textContent = meta.title;
        if (subEl) subEl.textContent = meta.sub;
    }
    window.updateActiveTabHeaders = updateActiveTabHeaders;
    updateActiveTabHeaders();

    if (tabId === 'tab-auto-pipeline') {
        loadCampaigns();
        loadPipelineStatus();
    } else if (tabId === 'tab-video-studio') {
        loadStudioVideos();
        ensureAudioCategoriesLoaded();
    } else if (tabId === 'tab-sources') {
        loadSavedChannels();
    } else if (tabId === 'tab-audio-studio') {
        loadAudioCategories();
    } else if (tabId === 'tab-gpm-farm' || tabId === 'tab-tracker') {
        loadGpmProfiles();
        checkScanProgress();
    } else if (tabId === 'tab-pipeline-queue') {
        loadPipelineStatus();
    } else if (tabId === 'tab-ai-usage') {
        loadAiUsageStats();
    } else if (tabId === 'tab-settings') {
        loadApiKeySettings();
        loadSchedulerSettings();
    } else if (tabId === 'tab-logs') {
        loadFileLogs();
    } else if (tabId === 'tab-video-manager') {
        if (typeof loadRssScanMode === 'function') loadRssScanMode();
        if (typeof loadVideoLibraryTable === 'function') loadVideoLibraryTable();
    } else if (tabId === 'tab-elevenlabs') {
        if (typeof loadElevenLabsStudio === 'function') loadElevenLabsStudio();
    }

    // Auto-translate newly revealed tab pane if not in base Vietnamese
    if (window.i18n && typeof window.i18n.translateDOM === 'function' && window.i18n.currentLang !== 'vi') {
        setTimeout(() => {
            const pane = document.getElementById(tabId);
            if (pane) window.i18n.translateDOM(pane);
        }, 60);
    }
}

// Subnav switcher for Sources
function switchSourceSubTab(sub) {
    const btnSaved = document.getElementById('btnSubnavSaved');
    const btnSearch = document.getElementById('btnSubnavSearch');
    const viewSaved = document.getElementById('sourceSubViewSaved');
    const viewSearch = document.getElementById('sourceSubViewSearch');

    if (sub === 'saved') {
        btnSaved?.classList.add('active');
        btnSearch?.classList.remove('active');
        if (viewSaved) viewSaved.style.display = 'block';
        if (viewSearch) viewSearch.style.display = 'none';
        loadSavedChannels();
    } else {
        btnSearch?.classList.add('active');
        btnSaved?.classList.remove('active');
        if (viewSaved) viewSaved.style.display = 'none';
        if (viewSearch) viewSearch.style.display = 'block';
    }
}

// Live ticking clock in sticky topbar (pauses in background to save battery & CPU)
function startTopbarClock() {
    function update() {
        if (document.hidden) return;
        const el = document.getElementById('topbarClock');
        if (!el) return;
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
        el.textContent = timeStr;
    }
    update();
    setInterval(update, 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) update();
    });
}

// 1. Dashboard Stats (skips polling when window/tab is in background)
async function loadDashboardStats() {
    if (document.hidden) return;
    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();

        document.getElementById('statChannels').textContent = data.total_channels;
        document.getElementById('statVideos').textContent = data.total_videos;
        document.getElementById('statProfiles').textContent = data.total_profiles;
        document.getElementById('stat10k').textContent = data.eligible_10k_count;

        // Stepper stats sync
        const sSource = document.getElementById('stepperSourceStats');
        if (sSource) sSource.textContent = `${data.total_channels} kênh theo dõi`;

        const sGpm = document.getElementById('stepperGpmStats');
        if (sGpm) sGpm.textContent = `${data.total_profiles} nick kết nối`;

        const sSourceBadge = document.getElementById('sourceSavedCountBadge');
        if (sSourceBadge) sSourceBadge.textContent = data.total_channels;

        // Update GPM status
        const gpmStatusText = document.getElementById('gpmStatusText');
        const sidebarComputerName = document.getElementById('sidebarComputerName');
        if (sidebarComputerName && data.computer_name) {
            sidebarComputerName.textContent = data.computer_name;
        }
        const chkGpm = document.getElementById('chkGpm');
        if (data.gpm_health && data.gpm_health.running) {
            if (gpmStatusText) { gpmStatusText.textContent = ''; }
            gpmStatusText.style.color = '#10b981';
            if (chkGpm) {
                chkGpm.className = 'badge badge-success';
                chkGpm.textContent = 'Kết Nối Tốt';
            }
        } else {
            if (gpmStatusText) { gpmStatusText.textContent = ''; }
            gpmStatusText.style.color = '#ef4444';
            if (chkGpm) {
                chkGpm.className = 'badge badge-danger';
                chkGpm.textContent = 'Chưa Mở GPM';
            }
        }

        // Update logs only when content has changed to avoid DOM churn & layout thrashing
        const logTerminal = document.getElementById('logTerminal');
        if (logTerminal && data.recent_logs && data.recent_logs.length > 0) {
            const logsSig = data.recent_logs.map(l => `${l.created_at || ''}:${l.level}:${l.message}`).join('|');
            if (logTerminal._lastLogsSig !== logsSig) {
                logTerminal._lastLogsSig = logsSig;
                logTerminal.innerHTML = data.recent_logs.map(log => {
                    const cls = log.level === 'ERROR' ? 'error' : (log.level === 'WARNING' ? 'warning' : 'info');
                    return `<div class="log-line ${cls}">[${log.created_at || 'LOG'}] [${log.level}] ${escapeHtml(log.message)}</div>`;
                }).join('');
            }
        }

        // Update Active Issues button in Topbar
        const btnIssues = document.getElementById('btnSystemIssues');
        const badgeText = document.getElementById('issueBadgeText');
        if (btnIssues && badgeText) {
            const count = data.active_issues_count || 0;
            if (count > 0) {
                btnIssues.style.display = 'inline-flex';
                badgeText.textContent = `${count} Cảnh Báo`;
                if (data.has_critical_issues) {
                    btnIssues.className = 'btn btn-danger btn-sm has-tooltip tooltip-left';
                } else {
                    btnIssues.className = 'btn btn-warning btn-sm has-tooltip tooltip-left';
                }
            } else {
                btnIssues.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error fetching stats:', err);
    }
}

// 2. YouTube Search & Table State
let rawYtChannels = [];
let currentSortField = 'default';
let currentSortDirection = 'asc';
let filterActiveOnly = false;
let filterSaved = 'all'; // 'all', 'saved', 'unsaved'
let filterCountry = 'all';
let filterMinViews = 0;
let filterMinSubs = 0;
let filterCadence = 'all'; // 'all', 'daily', 'frequent', 'weekly', 'custom'
let filterKeyword = '';
let filterCustomViews = null;
let filterCustomSubs = null;
let filterCustomCadence = null;

// ======================== Column Picker Management ========================
function toggleColumnDropdown(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('colPickerDropdown');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function closeColumnDropdown() {
    const dropdown = document.getElementById('colPickerDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

function getHiddenColumns() {
    try {
        const saved = localStorage.getItem('yt_hidden_cols');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function setHiddenColumns(cols) {
    try {
        localStorage.setItem('yt_hidden_cols', JSON.stringify(cols));
    } catch (e) { }
}

function toggleColVisibility(colKey, isVisible) {
    let hiddenCols = getHiddenColumns();
    if (!isVisible) {
        if (!hiddenCols.includes(colKey)) hiddenCols.push(colKey);
    } else {
        hiddenCols = hiddenCols.filter(k => k !== colKey);
    }
    setHiddenColumns(hiddenCols);
    applyColumnVisibility();
}

function applyColumnVisibility() {
    const hiddenCols = getHiddenColumns();
    document.querySelectorAll('[data-col]').forEach(el => {
        const colKey = el.getAttribute('data-col');
        if (hiddenCols.includes(colKey)) {
            el.classList.add('col-hidden');
        } else {
            el.classList.remove('col-hidden');
        }
    });

    document.querySelectorAll('#colPickerDropdown input[data-col-target]').forEach(chk => {
        const colKey = chk.getAttribute('data-col-target');
        chk.checked = !hiddenCols.includes(colKey);
    });
}

function getCountryBadge(code) {
    if (!code || code === 'N/A' || code === 'ZZ' || code === 'None') {
        return '<span class="badge-country text-muted"><i class="fa-solid fa-globe"></i> N/A</span>';
    }
    const c = code.trim().toUpperCase();
    const flags = {
        'US': '🇺🇸 US', 'VN': '🇻🇳 VN', 'GB': '🇬🇧 GB', 'UK': '🇬🇧 UK',
        'CA': '🇨🇦 CA', 'AU': '🇦🇺 AU', 'DE': '🇩🇪 DE', 'FR': '🇫🇷 FR',
        'JP': '🇯🇵 JP', 'KR': '🇰🇷 KR', 'IN': '🇮🇳 IN', 'BR': '🇧🇷 BR',
        'RU': '🇷🇺 RU', 'ES': '🇪🇸 ES', 'IT': '🇮🇹 IT', 'ID': '🇮🇩 ID',
        'PH': '🇵🇭 PH', 'TH': '🇹🇭 TH', 'SG': '🇸🇬 SG', 'MX': '🇲🇽 MX',
        'NL': '🇳🇱 NL', 'SE': '🇸🇪 SE', 'NO': '🇳🇴 NO', 'CH': '🇨🇭 CH',
    };
    const label = flags[c] || `🌐 ${c}`;
    return `<span class="badge-country" title="Quốc gia: ${escapeHtml(c)}">${label}</span>`;
}

function copyTextToClipboard(text, msg = 'Đã sao chép vào bộ nhớ tạm!') {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(msg);
        }).catch(() => {
            _fallbackCopy(text, msg);
        });
    } else {
        _fallbackCopy(text, msg);
    }
}

function _fallbackCopy(text, msg) {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
        document.execCommand('copy');
        showToast(msg);
    } catch (e) {
        showToast('Không thể sao chép: ' + e.message, true);
    }
    document.body.removeChild(input);
}

// ==================== CSV Export Helper ====================
async function downloadCsv(filename, rows) {
    if (!rows || !rows.length) {
        showToast('Không có dữ liệu để xuất file CSV!', true);
        return;
    }
    const csvContent = '\uFEFF' + rows.map(row =>
        row.map(cell => {
            if (cell === null || cell === undefined) return '""';
            let str = String(cell).replace(/"/g, '""');
            return `"${str}"`;
        }).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // 1. Thử mở cửa sổ "Save As" (Chọn thư mục lưu) của hệ thống nếu trình duyệt hỗ trợ
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Tệp CSV (Excel UTF-8)',
                    accept: { 'text/csv': ['.csv'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast(`Đã xuất thành công ${rows.length - 1} dòng ra file "${handle.name || filename}"!`);
            return;
        } catch (err) {
            // Người dùng bấm Hủy (Cancel) trên hộp thoại chọn thư mục
            if (err.name === 'AbortError') {
                return;
            }
            console.warn('showSaveFilePicker không khả dụng, chuyển sang tải tự động:', err);
        }
    }

    // 2. Dự phòng: Tự động tải xuống qua thẻ download mặc định của trình duyệt
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất thành công ${rows.length - 1} dòng ra file "${filename}"!`);
}

function populateCountryFilterOptions(channels) {
    const sel = document.getElementById('ytFilterCountrySelect');
    if (!sel) return;
    const currentVal = filterCountry;

    const counts = {};
    channels.forEach(c => {
        const country = (c.country || 'N/A').toUpperCase();
        counts[country] = (counts[country] || 0) + 1;
    });

    const sortedCountries = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    let options = '<option value="all">Tất cả quốc gia</option>';
    sortedCountries.forEach(code => {
        const flagMap = { 'US': '🇺🇸', 'VN': '🇻🇳', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 'FR': '🇫🇷', 'JP': '🇯🇵', 'KR': '🇰🇷', 'IN': '🇮🇳' };
        const flag = flagMap[code] || '🌐';
        options += `<option value="${code}">${flag} ${code} (${counts[code]} kênh)</option>`;
    });

    sel.innerHTML = options;
    if (counts[currentVal]) {
        sel.value = currentVal;
    } else {
        filterCountry = 'all';
        sel.value = 'all';
    }
}

async function searchYouTubeChannels() {
    const kwEl = document.getElementById('ytSearchKeyword');
    const maxResultsEl = document.getElementById('ytMaxResults');
    const keyword = kwEl ? kwEl.value.trim() : '';
    const maxResults = maxResultsEl ? parseInt(maxResultsEl.value, 10) : 50;
    const tbody = document.getElementById('ytChannelsBody');
    const toolbar = document.getElementById('ytTableToolbar');
    const btn = document.getElementById('btnSearchYt');

    if (!keyword) {
        markInputError('ytSearchKeyword', 'Vui lòng nhập từ khóa ngách YouTube!');
        return;
    }
    if (isNaN(maxResults) || maxResults < 1 || maxResults > 50) {
        markInputError('ytMaxResults', 'Số lượng kênh quét phải từ 1 đến 50!');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Đang Quét...';
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="12" class="text-center py-4">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Đang quét và phân tích tần suất đăng bài của các kênh YouTube...
            </td>
        </tr>
    `;

    try {
        const res = await fetch('/api/youtube/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, max_results: maxResults })
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || data.message || 'Lỗi khi quét kênh YouTube', 'error');
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-danger">${escapeHtml(data.detail || data.message || 'Lỗi quét kênh')}</td></tr>`;
            return;
        }

        if (!data.channels || data.channels.length === 0) {
            rawYtChannels = [];
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">Không tìm thấy kênh nào với từ khóa này.</td></tr>`;
            return;
        }

        rawYtChannels = data.channels.map((ch, idx) => ({
            ...ch,
            originalIndex: idx,
            is_saved: Boolean(ch.is_saved)
        }));

        currentSortField = 'default';
        currentSortDirection = 'asc';
        filterActiveOnly = false;
        filterSaved = 'all';
        filterCountry = 'all';
        filterMinViews = 0;
        filterMinSubs = 0;
        filterCadence = 'all';
        filterKeyword = '';
        filterCustomViews = null;
        filterCustomSubs = null;
        filterCustomCadence = null;

        populateCountryFilterOptions(rawYtChannels);

        const sortSelect = document.getElementById('ytSortSelect');
        if (sortSelect) sortSelect.value = 'default';
        const filterSavedSel = document.getElementById('ytFilterSavedSelect');
        if (filterSavedSel) filterSavedSel.value = 'all';
        const filterCheck = document.getElementById('ytFilterActiveOnly');
        if (filterCheck) filterCheck.checked = false;
        const filterViewsSel = document.getElementById('ytFilterViewsSelect');
        if (filterViewsSel) filterViewsSel.value = '0';
        const filterSubsSel = document.getElementById('ytFilterSubsSelect');
        if (filterSubsSel) filterSubsSel.value = '0';
        const filterCadenceSel = document.getElementById('ytFilterCadenceSelect');
        if (filterCadenceSel) filterCadenceSel.value = 'all';
        const filterKwInput = document.getElementById('ytFilterKeyword');
        if (filterKwInput) filterKwInput.value = '';

        const customViewsInp = document.getElementById('ytCustomViewsInput');
        if (customViewsInp) { customViewsInp.value = ''; customViewsInp.style.display = 'none'; }
        const customSubsInp = document.getElementById('ytCustomSubsInput');
        if (customSubsInp) { customSubsInp.value = ''; customSubsInp.style.display = 'none'; }
        const customCadenceInp = document.getElementById('ytCustomCadenceInput');
        if (customCadenceInp) { customCadenceInp.value = ''; customCadenceInp.style.display = 'none'; }

        updateSortDirectionBtn();
        renderYtChannelsTable();
        showToast(`Đã tìm thấy ${data.channels.length} kênh theo từ khóa!`);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-danger">Lỗi khi quét kênh: ${err.message}</td></tr>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt" style="margin-right: 6px;"></i> Bắt Đầu Quét';
        }
    }
}

function handleFilterCountryChange(val) {
    filterCountry = val;
    renderYtChannelsTable();
}

function handleFilterViewsChange(val) {
    const customInp = document.getElementById('ytCustomViewsInput');
    if (val === 'custom') {
        if (customInp) {
            customInp.style.display = 'inline-block';
            customInp.focus();
            filterCustomViews = customInp.value ? (parseFloat(customInp.value) || 0) : null;
        }
        filterMinViews = filterCustomViews || 0;
    } else {
        if (customInp) customInp.style.display = 'none';
        filterCustomViews = null;
        filterMinViews = parseInt(val, 10) || 0;
    }
    renderYtChannelsTable();
}

function handleCustomViewsInput(val) {
    const num = parseFloat(val);
    filterCustomViews = !isNaN(num) && num > 0 ? num : null;
    filterMinViews = filterCustomViews || 0;
    renderYtChannelsTable();
}

function handleFilterSubsChange(val) {
    const customInp = document.getElementById('ytCustomSubsInput');
    if (val === 'custom') {
        if (customInp) {
            customInp.style.display = 'inline-block';
            customInp.focus();
            filterCustomSubs = customInp.value ? (parseFloat(customInp.value) || 0) : null;
        }
        filterMinSubs = filterCustomSubs || 0;
    } else {
        if (customInp) customInp.style.display = 'none';
        filterCustomSubs = null;
        filterMinSubs = parseInt(val, 10) || 0;
    }
    renderYtChannelsTable();
}

function handleCustomSubsInput(val) {
    const num = parseFloat(val);
    filterCustomSubs = !isNaN(num) && num > 0 ? num : null;
    filterMinSubs = filterCustomSubs || 0;
    renderYtChannelsTable();
}

function handleFilterCadenceChange(val) {
    const customInp = document.getElementById('ytCustomCadenceInput');
    if (val === 'custom') {
        if (customInp) {
            customInp.style.display = 'inline-block';
            customInp.focus();
            filterCustomCadence = customInp.value ? (parseFloat(customInp.value) || null) : null;
        }
        filterCadence = 'custom';
    } else {
        if (customInp) customInp.style.display = 'none';
        filterCustomCadence = null;
        filterCadence = val;
    }
    renderYtChannelsTable();
}

function handleCustomCadenceInput(val) {
    const num = parseFloat(val);
    filterCustomCadence = !isNaN(num) && num > 0 ? num : null;
    renderYtChannelsTable();
}

function resetYtFilters() {
    filterCountry = 'all';
    filterMinViews = 0;
    filterMinSubs = 0;
    filterCadence = 'all';
    filterActiveOnly = false;
    filterSaved = 'all';
    filterKeyword = '';
    filterCustomViews = null;
    filterCustomSubs = null;
    filterCustomCadence = null;
    currentSortField = 'default';
    currentSortDirection = 'asc';

    const elSort = document.getElementById('ytSortSelect');
    if (elSort) elSort.value = 'default';
    const elCountry = document.getElementById('ytFilterCountrySelect');
    if (elCountry) elCountry.value = 'all';
    const elViews = document.getElementById('ytFilterViewsSelect');
    if (elViews) elViews.value = '0';
    const elSubs = document.getElementById('ytFilterSubsSelect');
    if (elSubs) elSubs.value = '0';
    const elCadence = document.getElementById('ytFilterCadenceSelect');
    if (elCadence) elCadence.value = 'all';
    const elSaved = document.getElementById('ytFilterSavedSelect');
    if (elSaved) elSaved.value = 'all';
    const elActive = document.getElementById('ytFilterActiveOnly');
    if (elActive) elActive.checked = false;
    const elKw = document.getElementById('ytFilterKeyword');
    if (elKw) elKw.value = '';

    const customViewsInp = document.getElementById('ytCustomViewsInput');
    if (customViewsInp) { customViewsInp.value = ''; customViewsInp.style.display = 'none'; }
    const customSubsInp = document.getElementById('ytCustomSubsInput');
    if (customSubsInp) { customSubsInp.value = ''; customSubsInp.style.display = 'none'; }
    const customCadenceInp = document.getElementById('ytCustomCadenceInput');
    if (customCadenceInp) { customCadenceInp.value = ''; customCadenceInp.style.display = 'none'; }

    updateSortDirectionBtn();
    renderYtChannelsTable();
    showToast('Đã đặt lại toàn bộ bộ lọc!');
}

function getFilteredYtChannels() {
    let list = [...rawYtChannels];

    // 1. Lọc theo checkbox Đang hoạt động
    if (filterActiveOnly) {
        list = list.filter(c => c.is_active === 1);
    }

    // 2. Lọc theo trạng thái Đã lưu / Chưa lưu
    if (filterSaved === 'saved') {
        list = list.filter(c => c.is_saved);
    } else if (filterSaved === 'unsaved') {
        list = list.filter(c => !c.is_saved);
    }

    // 3. Lọc theo Quốc gia
    if (filterCountry !== 'all') {
        list = list.filter(c => (c.country || 'N/A').toUpperCase() === filterCountry.toUpperCase());
    }

    // 4. Lọc theo Views tối thiểu
    if (filterMinViews > 0) {
        list = list.filter(c => (c.avg_views || 0) >= filterMinViews);
    }

    // 5. Lọc theo Subs tối thiểu
    if (filterMinSubs > 0) {
        list = list.filter(c => (c.subscriber_count || 0) >= filterMinSubs);
    }

    // 6. Lọc theo Tần suất
    if (filterCadence === 'daily') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 1.0);
    } else if (filterCadence === 'frequent') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 3.0);
    } else if (filterCadence === 'weekly') {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= 7.0);
    } else if (filterCadence === 'custom' && filterCustomCadence !== null) {
        list = list.filter(c => c.upload_cadence_days > 0 && c.upload_cadence_days <= filterCustomCadence);
    }

    // 7. Lọc theo từ khóa tên kênh / ID / handle
    if (filterKeyword) {
        const kw = filterKeyword.toLowerCase().trim();
        list = list.filter(c =>
            (c.title || '').toLowerCase().includes(kw) ||
            (c.channel_id || '').toLowerCase().includes(kw) ||
            (c.handle || '').toLowerCase().includes(kw) ||
            (c.country || '').toLowerCase().includes(kw)
        );
    }

    // 8. Sắp xếp
    if (currentSortField !== 'default') {
        list.sort((a, b) => {
            let res = 0;
            if (currentSortField === 'title') {
                res = (a.title || '').localeCompare(b.title || '', 'vi', { sensitivity: 'base' });
            } else if (currentSortField === 'country') {
                res = (a.country || '').localeCompare(b.country || '');
            } else if (currentSortField === 'subscriber_count') {
                res = (a.subscriber_count || 0) - (b.subscriber_count || 0);
            } else if (currentSortField === 'video_count') {
                res = (a.video_count || 0) - (b.video_count || 0);
            } else if (currentSortField === 'avg_views') {
                res = (a.avg_views || 0) - (b.avg_views || 0);
            } else if (currentSortField === 'total_view_count') {
                res = (a.total_view_count || 0) - (b.total_view_count || 0);
            } else if (currentSortField === 'views_per_sub_ratio') {
                res = (a.views_per_sub_ratio || 0) - (b.views_per_sub_ratio || 0);
            } else if (currentSortField === 'days_since_last_upload') {
                const da = a.days_since_last_upload !== undefined && a.days_since_last_upload !== null ? a.days_since_last_upload : 9999;
                const db = b.days_since_last_upload !== undefined && b.days_since_last_upload !== null ? b.days_since_last_upload : 9999;
                res = da - db;
            } else if (currentSortField === 'upload_cadence_days') {
                const ca = a.upload_cadence_days > 0 ? a.upload_cadence_days : 9999;
                const cb = b.upload_cadence_days > 0 ? b.upload_cadence_days : 9999;
                res = ca - cb;
            } else if (currentSortField === 'is_active') {
                res = (a.is_active || 0) - (b.is_active || 0);
            } else if (currentSortField === 'is_saved') {
                res = (a.is_saved ? 1 : 0) - (b.is_saved ? 1 : 0);
            }
            return currentSortDirection === 'asc' ? res : -res;
        });
    }

    return list;
}

function exportYtSearchCsv() {
    let list = getFilteredYtChannels();
    if (!list || !list.length) {
        list = rawYtChannels || [];
    }
    if (!list.length) {
        showToast('Không có kênh nào trong danh sách quét để xuất CSV!', true);
        return;
    }

    const headers = [
        'Channel ID',
        'Tên Kênh',
        'Handle',
        'URL Kênh',
        'Quốc Gia',
        'Subscribers',
        'Tổng Số Video',
        'Lượt Xem TB',
        'Tổng Lượt Xem Kênh',
        'Viral Ratio',
        'Video Mới Nhất',
        'Số Ngày Kể Từ Video Cuối',
        'Tần Suất Đăng (Ngày/Vid)',
        'Mô Tả Tần Suất',
        'Trạng Thái Hoạt Động',
        'Đã Lưu Vào Hệ Thống'
    ];

    const rows = [headers];
    list.forEach(c => {
        rows.push([
            c.channel_id || '',
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
            c.cadence_description || '',
            c.is_active ? 'Đang hoạt động' : 'Ít đăng',
            c.is_saved ? 'Đã lưu' : 'Chưa lưu'
        ]);
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`kenh_youtube_tim_kiem_${dateStr}.csv`, rows);
}

function renderYtChannelsTable() {
    const tbody = document.getElementById('ytChannelsBody');
    const countBadge = document.getElementById('ytResultCountBadge');

    const list = getFilteredYtChannels();

    // Update result count badge
    if (countBadge) {
        countBadge.textContent = `${list.length}/${rawYtChannels.length} Kênh`;
    }

    // Update table header icons
    updateHeaderSortIcons();

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">Không có kênh nào phù hợp với bộ lọc hiện tại.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((c) => {
        const ratio = c.views_per_sub_ratio || 0;
        let ratioBadge = '';
        if (ratio > 0) {
            const ratioClass = ratio >= 2.0 ? 'high' : (ratio >= 0.5 ? 'good' : '');
            const fire = ratio >= 1.0 ? '🔥 ' : '';
            ratioBadge = `<div class="badge-ratio ${ratioClass}" title="Tỷ lệ lượt xem trên số người theo dõi">${fire}Ratio: ${ratio.toFixed(2)}x</div>`;
        }

        const handleText = c.handle ? `<span class="table-text-truncate" style="max-width:180px; font-size:11px; color:var(--accent-cyan); font-weight:500;" title="${escapeHtml(c.handle)}">${escapeHtml(c.handle)}</span>` : '';
        const cid = c.channel_id || '';
        const channelUrl = c.url || (cid ? `https://www.youtube.com/channel/${cid}` : '#');
        const thumbImg = c.thumbnail_url
            ? `<img src="${c.thumbnail_url}" alt="" class="channel-avatar-clickable" onclick="openChannelDetailModal(${c.originalIndex})" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.1); flex-shrink:0;" title="Bấm xem chi tiết kênh">`
            : `<div class="channel-avatar-clickable" onclick="openChannelDetailModal(${c.originalIndex})" style="width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; color:var(--text-muted); flex-shrink:0;" title="Bấm xem chi tiết kênh"><i class="fa-brands fa-youtube"></i></div>`;

        return `
        <tr id="ch-row-${c.originalIndex}" class="${c.is_saved ? 'row-saved' : ''}">
            <td data-col="col-title">
                <div style="display:flex; align-items:flex-start; gap:10px;">
                    ${thumbImg}
                    <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                        <strong class="channel-title-link" onclick="openChannelDetailModal(${c.originalIndex})" title="Bấm xem chi tiết kênh: ${escapeHtml(c.title)}">${escapeHtml(c.title)}</strong>
                        ${handleText}
                        <div style="margin-top:3px;">
                            <a href="${escapeHtml(channelUrl)}" target="_blank" rel="noopener" class="channel-link-tag" title="Mở trang YouTube của kênh này">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Mở kênh
                            </a>
                        </div>
                    </div>
                </div>
            </td>
            <td data-col="col-id">
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="channel-id-tag" title="${escapeHtml(cid)}">${escapeHtml(cid)}</span>
                    <button type="button" class="btn-copy-id" onclick="copyTextToClipboard('${escapeHtml(cid)}', 'Đã sao chép Channel ID!')" title="Sao chép Channel ID">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            </td>
            <td data-col="col-country">
                ${getCountryBadge(c.country)}
            </td>
            <td data-col="col-subs">
                <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${c.subscriber_count ? formatNumber(c.subscriber_count) : '<span class="text-muted">Ẩn</span>'}</div>
            </td>
            <td data-col="col-videos">
                <div style="font-size:12.5px; color:var(--text-secondary);">${c.video_count ? c.video_count.toLocaleString() : 'N/A'}</div>
            </td>
            <td data-col="col-avg-views">
                <div style="font-size:13px; font-weight:700; color:var(--text-primary);">
                    ${c.avg_views ? formatNumber(c.avg_views) : '<span class="text-muted">N/A</span>'}
                </div>
            </td>
            <td data-col="col-total-views">
                <div style="font-size:12.5px; color:var(--text-secondary);">${c.total_view_count ? formatNumber(c.total_view_count) : 'N/A'}</div>
            </td>
            <td data-col="col-ratio">
                ${ratioBadge || '<span class="text-muted" style="font-size:11px;">—</span>'}
            </td>
            <td data-col="col-last-upload">
                <div style="font-size:12px; font-weight:600; color:var(--text-primary);">${c.last_upload_date || 'N/A'}</div>
                <span class="text-muted" style="font-size:11px;">(${c.days_since_last_upload !== undefined && c.days_since_last_upload !== null ? c.days_since_last_upload : 0} ngày trước)</span>
            </td>
            <td data-col="col-cadence">
                <span class="badge ${c.upload_cadence_days > 0 && c.upload_cadence_days <= 1 ? 'badge-success' : 'badge-info'}" style="font-size:11px;">
                    ${escapeHtml(c.cadence_description || (c.upload_cadence_days > 0 ? c.upload_cadence_days + ' ngày/vid' : 'Chưa rõ'))}
                </span>
            </td>
            <td data-col="col-active">
                ${c.is_active
                ? '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Đang hoạt động</span>'
                : '<span class="badge badge-warning"><i class="fa-solid fa-clock-rotate-left"></i> Ít đăng</span>'}
            </td>
            <td data-col="col-actions">
                <div class="action-dropdown-wrap">
                    <button type="button" class="btn-more-actions" id="btn-more-${c.originalIndex}" 
                        onclick="toggleActionMenu(event, ${c.originalIndex})" 
                        title="Tùy chọn thao tác">
                        <i class="fa-solid fa-ellipsis"></i>
                    </button>
                    <div class="action-dropdown-menu" id="action-menu-${c.originalIndex}">
                        <button type="button" class="action-dropdown-item" onclick="openChannelDetailModal(${c.originalIndex})">
                            <i class="fa-solid fa-circle-info" style="color:var(--accent-cyan);"></i> Xem chi tiết
                        </button>
                        <button type="button" class="action-dropdown-item" onclick="openChannelVideosModal('${escapeHtml(cid)}', '${escapeHtml(c.title || '')}')">
                            <i class="fa-solid fa-film" style="color:#00f2fe;"></i> Chi Tiết Video
                        </button>
                        <button type="button" class="action-dropdown-item" onclick="toggleSaveFromMenu(${c.originalIndex})">
                            <i class="${c.is_saved ? 'fa-solid fa-trash-can text-danger' : 'fa-solid fa-bookmark text-gold'}"></i> 
                            <span>${c.is_saved ? 'Bỏ lưu kênh' : 'Lưu kênh'}</span>
                        </button>
                        <div class="dropdown-divider"></div>
                        <a href="${escapeHtml(channelUrl)}" target="_blank" rel="noopener" class="action-dropdown-item">
                            <i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Mở YouTube
                        </a>
                        <button type="button" class="action-dropdown-item" onclick="copyTextToClipboard('${escapeHtml(cid)}', 'Đã sao chép Channel ID!')">
                            <i class="fa-solid fa-copy" style="color:#94a3b8;"></i> Sao chép ID
                        </button>
                    </div>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    // Apply saved column visibility state
    applyColumnVisibility();
}

function updateHeaderSortIcons() {
    const fields = [
        { id: 'th-title', field: 'title' },
        { id: 'th-country', field: 'country' },
        { id: 'th-subs', field: 'subscriber_count' },
        { id: 'th-videos', field: 'video_count' },
        { id: 'th-avg-views', field: 'avg_views' },
        { id: 'th-total-views', field: 'total_view_count' },
        { id: 'th-ratio', field: 'views_per_sub_ratio' },
        { id: 'th-last_upload', field: 'days_since_last_upload' },
        { id: 'th-cadence', field: 'upload_cadence_days' },
        { id: 'th-active', field: 'is_active' }
    ];

    fields.forEach(item => {
        const th = document.getElementById(item.id);
        if (!th) return;
        const icon = th.querySelector('.sort-icon');
        if (currentSortField === item.field) {
            th.classList.add('sorted-active');
            if (icon) {
                icon.className = currentSortDirection === 'asc'
                    ? 'fa-solid fa-arrow-up-short-wide sort-icon'
                    : 'fa-solid fa-arrow-down-wide-short sort-icon';
            }
        } else {
            th.classList.remove('sorted-active');
            if (icon) icon.className = 'fa-solid fa-sort sort-icon';
        }
    });
}

function updateSortDirectionBtn() {
    const btn = document.getElementById('btnSortDirection');
    const icon = document.getElementById('sortDirIcon');
    const text = document.getElementById('sortDirText');
    if (!btn || !icon || !text) return;

    if (currentSortDirection === 'asc') {
        icon.className = 'fa-solid fa-arrow-up-wide-short';
        text.textContent = 'Tăng dần';
        btn.title = 'Hiện đang Tăng dần. Bấm để chuyển sang Giảm dần';
    } else {
        icon.className = 'fa-solid fa-arrow-down-wide-short';
        text.textContent = 'Giảm dần';
        btn.title = 'Hiện đang Giảm dần. Bấm để chuyển sang Tăng dần';
    }

    if (currentSortField === 'default') {
        btn.style.opacity = '0.45';
        btn.style.pointerEvents = 'none';
    } else {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }
}

function toggleSortDirection() {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    updateSortDirectionBtn();
    renderYtChannelsTable();
}

function handleHeaderSort(field) {
    if (currentSortField === field) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        // Các trường số lượng thường ưu tiên xem từ cao xuống thấp trước
        if (['subscriber_count', 'video_count', 'avg_views', 'total_view_count', 'views_per_sub_ratio', 'is_active'].includes(field)) {
            currentSortDirection = 'desc';
        } else {
            currentSortDirection = 'asc';
        }
    }
    syncSortSelectUI();
    updateSortDirectionBtn();
    renderYtChannelsTable();
}

function handleSortSelectChange(field) {
    currentSortField = field;
    if (field !== 'default') {
        if (['subscriber_count', 'video_count', 'avg_views', 'total_view_count', 'views_per_sub_ratio', 'is_active'].includes(field)) {
            currentSortDirection = 'desc';
        } else {
            currentSortDirection = 'asc';
        }
    } else {
        currentSortDirection = 'asc';
    }
    updateSortDirectionBtn();
    renderYtChannelsTable();
}

function syncSortSelectUI() {
    const sel = document.getElementById('ytSortSelect');
    if (!sel) return;
    sel.value = currentSortField;
}

function handleFilterActiveChange(checked) {
    filterActiveOnly = checked;
    renderYtChannelsTable();
}

function handleFilterKeywordChange(val) {
    filterKeyword = val;
    renderYtChannelsTable();
}

function handleFilterSavedChange(val) {
    filterSaved = val;
    renderYtChannelsTable();
}

function handleSaveBtnHover(btn, isHover) {
    if (btn && btn.dataset.saved === 'true') {
        if (isHover) {
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Bỏ Lưu';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Lưu';
        }
    }
}

async function toggleSaveChannel(origIdx) {
    const ch = rawYtChannels[origIdx];
    if (!ch) return;
    const btn = document.getElementById(`save-btn-${origIdx}`);
    const row = document.getElementById(`ch-row-${origIdx}`);

    if (ch.is_saved) {
        // --- BỎ LƯU (UNSAVE) ---
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Bỏ Lưu...';
        }
        try {
            const res = await fetch('/api/youtube/unsave-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_id: ch.channel_id })
            });
            const data = await res.json();
            if (data.status === 'success') {
                ch.is_saved = false;
                cachedSavedChannels = (cachedSavedChannels || []).filter(c => c.channel_id !== ch.channel_id);
                showToast(`Đã bỏ lưu kênh "${ch.title}"!`);
                loadDashboardStats();
                loadSavedChannels();
                renderYtChannelsTable();
            } else {
                showToast('Lỗi bỏ lưu kênh: ' + (data.message || 'Không rõ'), true);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Lưu';
                }
            }
        } catch (err) {
            showToast('Lỗi bỏ lưu kênh: ' + err.message, true);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Lưu';
            }
        }
    } else {
        // --- LƯU KÊNH (SAVE) ---
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
        }
        try {
            await fetch('/api/youtube/save-channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([ch])
            });
            ch.is_saved = true;
            if (!cachedSavedChannels.some(c => c.channel_id === ch.channel_id)) {
                cachedSavedChannels.unshift({ ...ch, is_saved: true });
            }
            showToast(`Đã lưu kênh "${ch.title}" vào danh sách theo dõi!`);
            loadDashboardStats();
            loadSavedChannels();
            renderYtChannelsTable();
        } catch (err) {
            showToast('Lỗi lưu kênh: ' + err.message, true);
            if (btn) {
                btn.disabled = false;
                btn.className = 'btn btn-sm btn-secondary';
                btn.dataset.saved = 'false';
                btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Lưu Kênh';
            }
        }
    }
}

// Giữ tương thích nếu có code gọi saveSingleChannel
function saveSingleChannel(ch, rowIdx) {
    toggleSaveChannel(rowIdx);
}

// ==========================================================================
// Action Dropdown & Channel Detail Modal Management
// ==========================================================================
let activeDetailChannel = null;

// Tracks original parent so we can return teleported menus
const _menuOriginalParent = new Map();

function closeAllActionMenus() {
    document.querySelectorAll('.action-dropdown-menu.show').forEach(m => {
        m.classList.remove('show');
        m.style.top = '';
        m.style.bottom = '';
        m.style.left = '';
        // Restore to original parent if teleported
        const originalParent = _menuOriginalParent.get(m.id);
        if (originalParent && m.parentElement === document.body) {
            originalParent.appendChild(m);
        }
        _menuOriginalParent.delete(m.id);
    });
    document.querySelectorAll('.btn-more-actions.active').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.action-dropdown-wrap.active').forEach(w => w.classList.remove('active'));
    document.querySelectorAll('tr.row-dropdown-open').forEach(r => r.classList.remove('row-dropdown-open'));
}

function toggleActionMenu(e, id) {
    e.stopPropagation();
    const menu = document.getElementById(`action-menu-${id}`);
    const btn = document.getElementById(`btn-more-${id}`);
    const row = (btn ? btn.closest('tr') : null) || document.getElementById(`ch-row-${id}`);
    if (!menu) return;

    const isOpen = menu.classList.contains('show');
    closeAllActionMenus();

    if (!isOpen && btn) {
        if (btn) btn.classList.add('active');
        const wrap = btn ? btn.closest('.action-dropdown-wrap') : null;
        if (wrap) wrap.classList.add('active');
        if (row) row.classList.add('row-dropdown-open');

        const rect = btn.getBoundingClientRect();
        const menuWidth = 185;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Teleport to body to escape table overflow/transform stacking context
        _menuOriginalParent.set(menu.id, menu.parentElement);
        document.body.appendChild(menu);

        menu.style.position = 'fixed';
        menu.style.minWidth = menuWidth + 'px';
        menu.style.left = Math.max(4, rect.right - menuWidth) + 'px';
        menu.style.top = '';
        menu.style.bottom = '';

        if (spaceBelow < 260 && spaceAbove > spaceBelow) {
            menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
            menu.classList.add('dropup');
        } else {
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.classList.remove('dropup');
        }

        menu.classList.add('show');
        if (window.i18n && typeof window.i18n.translateDOM === 'function' && window.i18n.currentLang !== 'vi') {
            window.i18n.translateDOM(menu);
        }
    }
}

function toggleSaveFromMenu(index) {
    closeAllActionMenus();
    toggleSaveChannel(index);
}

async function openChannelDetailModal(target) {
    closeAllActionMenus();
    let ch = null;
    let targetCid = '';
    if (typeof target === 'number') {
        ch = rawYtChannels[target];
        if (ch) targetCid = ch.channel_id;
    } else if (typeof target === 'string') {
        targetCid = target;
        ch = (cachedSavedChannels || []).find(c => c.channel_id === target || (c.channel_id && c.channel_id.toLowerCase() === target.toLowerCase())) ||
            (rawYtChannels || []).find(c => c.channel_id === target || (c.channel_id && c.channel_id.toLowerCase() === target.toLowerCase()));
    } else if (target && typeof target === 'object') {
        ch = target;
        if (ch) targetCid = ch.channel_id;
    }

    const cid = targetCid || (ch ? ch.channel_id : '');

    // Kiểm tra trạng thái đã lưu:
    // 1. Kiểm tra cờ is_saved hiện tại và cachedSavedChannels trong bộ nhớ
    let isChannelSaved = Boolean(
        (ch && ch.is_saved) ||
        (cachedSavedChannels && cachedSavedChannels.some(sc =>
            sc.channel_id === cid ||
            (sc.channel_id && cid && sc.channel_id.toLowerCase() === cid.toLowerCase())
        ))
    );

    // 2. Nếu chưa chắc chắn hoặc ch chưa có đầy đủ thông tin, truy vấn DB để xác thực chính xác
    if (cid && (!ch || !isChannelSaved)) {
        try {
            const res = await fetch(`/api/youtube/channels/${encodeURIComponent(cid)}`);
            if (res.ok) {
                const dbCh = await res.json();
                if (dbCh && !dbCh.error) {
                    if (dbCh.is_saved) {
                        isChannelSaved = true;
                    }
                    ch = { ...(ch || {}), ...dbCh };
                    if (isChannelSaved && !cachedSavedChannels.some(sc => sc.channel_id === dbCh.channel_id)) {
                        cachedSavedChannels.unshift({ ...dbCh, is_saved: true });
                    }
                }
            }
        } catch (err) {
            console.warn('Cannot fetch channel detail from backend:', err);
        }
    }

    if (!ch) {
        showToast('Không tìm thấy thông tin kênh!', true);
        return;
    }

    ch.is_saved = isChannelSaved;
    activeDetailChannel = ch;

    const modal = document.getElementById('channelDetailModal');
    if (!modal) return;

    // Header & Hero
    const elAvatar = document.getElementById('detailChannelAvatar');
    const elFallback = document.getElementById('detailAvatarFallback');
    if (ch.thumbnail_url) {
        elAvatar.src = ch.thumbnail_url;
        elAvatar.style.display = 'block';
        elFallback.style.display = 'none';
        elAvatar.onerror = () => {
            elAvatar.style.display = 'none';
            elFallback.style.display = 'flex';
        };
    } else {
        elAvatar.style.display = 'none';
        elFallback.style.display = 'flex';
    }

    const elTitle = document.getElementById('detailChannelTitle');
    if (elTitle) {
        elTitle.textContent = ch.title || 'Kênh YouTube';
        elTitle.title = ch.title || '';
    }

    const elActiveBadge = document.getElementById('detailChannelActiveBadge');
    if (elActiveBadge) {
        if (ch.is_active) {
            elActiveBadge.className = 'badge badge-success';
            elActiveBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đang hoạt động';
        } else {
            elActiveBadge.className = 'badge badge-warning';
            elActiveBadge.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Ít đăng bài';
        }
    }

    const elHandle = document.getElementById('detailChannelHandle');
    if (elHandle) {
        const handleStr = ch.handle ? ch.handle : '';
        elHandle.textContent = handleStr;
        elHandle.title = handleStr;
        elHandle.style.display = handleStr ? 'inline-block' : 'none';
    }

    const btnRefModal = document.getElementById('btnRefreshChannelStats');
    if (btnRefModal) {
        btnRefModal.disabled = false;
        btnRefModal.innerHTML = '<i class="fa-solid fa-arrows-rotate text-cyan"></i> Cập nhật kênh';
    }

    const elId = document.getElementById('detailChannelId');
    if (elId) elId.textContent = ch.channel_id || 'N/A';

    const btnCopy = document.getElementById('btnCopyDetailId');
    if (btnCopy) {
        btnCopy.onclick = () => copyTextToClipboard(ch.channel_id || '', 'Đã sao chép Channel ID!');
    }

    const elCountry = document.getElementById('detailChannelCountry');
    if (elCountry) {
        elCountry.innerHTML = getCountryBadge(ch.country);
    }

    const elJoined = document.getElementById('detailChannelJoined');
    if (elJoined) {
        if (ch.created_at) {
            let dStr = ch.created_at;
            try {
                const dt = new Date(ch.created_at);
                if (!isNaN(dt.getTime())) {
                    dStr = dt.toLocaleDateString('vi-VN');
                }
            } catch (e) { }
            elJoined.innerHTML = `<i class="fa-regular fa-calendar"></i> <span data-i18n="Tham gia:">Tham gia:</span> ${dStr}`;
            elJoined.style.display = 'inline-flex';
            if (window.i18n && typeof window.i18n.translateDOM === 'function') {
                window.i18n.translateDOM(elJoined);
            }
        } else {
            elJoined.style.display = 'none';
        }
    }

    const ytLink = document.getElementById('detailChannelYtLink');
    if (ytLink) {
        const url = ch.url || (ch.channel_id ? `https://www.youtube.com/channel/${ch.channel_id}` : '#');
        ytLink.href = url;
    }

    // Update Save button state
    updateDetailModalSaveBtn();

    // 8 KPI Stat Cards
    const elSubs = document.getElementById('detailSubs');
    if (elSubs) elSubs.textContent = ch.subscriber_count ? formatNumber(ch.subscriber_count) : 'Ẩn / Chưa rõ';

    const elVideos = document.getElementById('detailVideos');
    if (elVideos) elVideos.textContent = ch.video_count ? ch.video_count.toLocaleString() : 'N/A';

    const elAvgViews = document.getElementById('detailAvgViews');
    if (elAvgViews) elAvgViews.textContent = ch.avg_views ? formatNumber(ch.avg_views) : 'N/A';

    const elTotalViews = document.getElementById('detailTotalViews');
    if (elTotalViews) elTotalViews.textContent = ch.total_view_count ? formatNumber(ch.total_view_count) : 'N/A';

    const elRatio = document.getElementById('detailRatio');
    if (elRatio) {
        const r = ch.views_per_sub_ratio || 0;
        if (r > 0) {
            const fire = r >= 1.0 ? '🔥 ' : '';
            elRatio.textContent = `${fire}${r.toFixed(2)}x`;
            elRatio.style.color = r >= 2.0 ? '#f87171' : (r >= 1.0 ? '#fbbf24' : '#38bdf8');
        } else {
            elRatio.textContent = '—';
            elRatio.style.color = 'var(--text-muted)';
        }
    }

    const elCadence = document.getElementById('detailCadence');
    if (elCadence) {
        elCadence.textContent = ch.cadence_description || (ch.upload_cadence_days > 0 ? `${ch.upload_cadence_days} ngày/vid` : 'Chưa rõ');
    }

    const elLastUpload = document.getElementById('detailLastUpload');
    if (elLastUpload) {
        const days = ch.days_since_last_upload !== undefined && ch.days_since_last_upload !== null ? `${ch.days_since_last_upload} ngày trước` : '';
        elLastUpload.textContent = ch.last_upload_date ? `${ch.last_upload_date} ${days ? `(${days})` : ''}` : 'N/A';
        if (window.i18n && typeof window.i18n.translateDOM === 'function') {
            window.i18n.translateDOM(elLastUpload);
        }
    }

    const elStatus = document.getElementById('detailStatus');
    if (elStatus) {
        if (ch.is_active) {
            elStatus.className = 'detail-kpi-val is-active';
            elStatus.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size: 13px; margin-right: 5px;"></i><span data-i18n="Hoạt động">Hoạt động</span>';
            elStatus.style.color = '#059669';
        } else {
            elStatus.className = 'detail-kpi-val is-inactive';
            elStatus.innerHTML = '<i class="fa-solid fa-circle-pause" style="font-size: 13px; margin-right: 5px;"></i><span data-i18n="Tạm ngưng">Tạm ngưng</span>';
            elStatus.style.color = '#64748b';
        }
        if (window.i18n && typeof window.i18n.translateDOM === 'function') {
            window.i18n.translateDOM(elStatus);
        }
    }

    // Description
    const elDesc = document.getElementById('detailDescription');
    if (elDesc) {
        const descText = (ch.description || '').trim();
        if (descText) {
            elDesc.textContent = descText;
            elDesc.classList.remove('detail-no-data');
        } else {
            elDesc.textContent = 'Kênh này chưa có mô tả hoặc chưa được cập nhật từ YouTube.';
            elDesc.classList.add('detail-no-data');
        }
    }

    // Keywords / Tags
    const elKwWrap = document.getElementById('detailKeywordsList');
    if (elKwWrap) {
        let kwList = [];
        if (Array.isArray(ch.keywords)) {
            kwList = ch.keywords;
        } else if (typeof ch.keywords === 'string') {
            try {
                const parsed = JSON.parse(ch.keywords);
                if (Array.isArray(parsed)) kwList = parsed;
                else kwList = ch.keywords.split(',').map(s => s.trim()).filter(Boolean);
            } catch (e) {
                kwList = ch.keywords.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        if (kwList && kwList.length > 0) {
            elKwWrap.innerHTML = kwList.map(kw => `<span class="detail-tag-chip"><i class="fa-solid fa-tag"></i> ${escapeHtml(kw)}</span>`).join('');
        } else {
            elKwWrap.innerHTML = '<span class="detail-no-data">Không có thẻ từ khóa nào.</span>';
        }
    }

    // Topics
    const elTopWrap = document.getElementById('detailTopicsList');
    if (elTopWrap) {
        let topList = [];
        if (Array.isArray(ch.topic_categories)) {
            topList = ch.topic_categories;
        } else if (typeof ch.topic_categories === 'string') {
            try {
                const parsed = JSON.parse(ch.topic_categories);
                if (Array.isArray(parsed)) topList = parsed;
            } catch (e) { }
        }
        if (topList && topList.length > 0) {
            elTopWrap.innerHTML = topList.map(t => {
                let clean = t;
                if (typeof t === 'string' && t.includes('/wiki/')) {
                    clean = decodeURIComponent(t.split('/wiki/')[1].replace(/_/g, ' '));
                }
                return `<span class="detail-topic-chip"><i class="fa-solid fa-shapes"></i> ${escapeHtml(clean)}</span>`;
            }).join('');
        } else {
            elTopWrap.innerHTML = '<span class="detail-no-data">Không có danh mục chủ đề cụ thể.</span>';
        }
    }

    // Recent Videos List
    const elRecentSec = document.getElementById('detailRecentVideosSection');
    const elRecentList = document.getElementById('detailRecentVideosList');
    const elRecentBadge = document.getElementById('detailRecentVideosCount');
    let recentVids = [];
    if (Array.isArray(ch.recent_video_titles)) {
        recentVids = ch.recent_video_titles;
    } else if (typeof ch.recent_video_titles === 'string') {
        try {
            const parsed = JSON.parse(ch.recent_video_titles);
            if (Array.isArray(parsed)) recentVids = parsed;
        } catch (e) { }
    }
    if (recentVids && recentVids.length > 0) {
        if (elRecentSec) elRecentSec.style.display = 'block';
        if (elRecentBadge) elRecentBadge.textContent = `${recentVids.length} Video`;
        if (elRecentList) {
            elRecentList.innerHTML = recentVids.map(title => {
                const searchQ = encodeURIComponent(title + ' ' + (ch.title || ''));
                const ytUrl = `https://www.youtube.com/results?search_query=${searchQ}`;
                return `
                <a href="${ytUrl}" target="_blank" rel="noopener" class="detail-video-item" title="Bấm để mở video trên YouTube: ${escapeHtml(title)}">
                    <i class="fa-brands fa-youtube" style="color:#ef4444; font-size:15px;"></i>
                    <span class="detail-video-item-title">${escapeHtml(title)}</span>
                    <i class="fa-solid fa-arrow-up-right-from-square detail-video-link-icon"></i>
                </a>
                `;
            }).join('');
        }
    } else {
        if (elRecentSec) elRecentSec.style.display = 'none';
    }

    // Similar Channels
    renderSimilarChannels(ch);

    // Show modal
    modal.classList.add('active');
    modal.classList.add('show');
}

function closeChannelDetailModal() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const modal = document.getElementById('channelDetailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('show');
    }
    activeDetailChannel = null;
}

let currentModalChannelVideos = [];
let currentModalChannelTitle = '';
let currentModalChannelId = '';

async function openChannelVideosModal(channelId, channelTitle = '') {
    closeAllActionMenus();
    currentModalChannelVideos = [];
    currentModalChannelTitle = channelTitle || channelId;
    currentModalChannelId = channelId;

    const modal = document.getElementById('modalChannelVideos');
    const titleEl = document.getElementById('modalChannelVideosTitle');
    const subEl = document.getElementById('modalChannelVideosSub');
    const bodyEl = document.getElementById('modalChannelVideosBody');
    const statsEl = document.getElementById('modalChannelVideosStats');

    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-film text-cyan"></i> Video Kênh: ${escapeHtml(channelTitle || channelId)}`;
    }
    if (subEl) {
        subEl.textContent = `Danh sách video của kênh ID: ${channelId}`;
    }
    if (bodyEl) {
        bodyEl.innerHTML = '<div class="text-center py-5 text-muted"><i class="fa-solid fa-spinner fa-spin text-cyan" style="font-size:24px;"></i><p class="mt-2" style="font-size:12px;">Đang tải danh sách video của kênh...</p></div>';
    }
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    try {
        const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/videos`);
        const data = await res.json();
        const vids = data.videos || [];
        currentModalChannelVideos = vids;
        if (statsEl) statsEl.textContent = `${vids.length} Video`;

        if (!vids.length) {
            bodyEl.innerHTML = `
                <div style="text-align:center; padding:36px 20px; background:rgba(255,255,255,0.02); border-radius:10px; border:1px dashed rgba(255,255,255,0.1);">
                    <i class="fa-solid fa-video-slash text-cyan" style="font-size:32px; opacity:0.6; margin-bottom:10px; display:block;"></i>
                    <div style="font-size:14px; font-weight:700; color:#fff;">Kênh này chưa có video nào được tải về</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                        Bấm nút "Quét video mới ngay" trong menu thao tác để tải video mới nhất từ RSS YouTube.
                    </div>
                </div>
            `;
            return;
        }

        bodyEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${vids.map(v => {
            const isRendered = v.has_rendered || v.status === 'rendered' || (v.rendered_parts && v.rendered_parts.length > 0);
            const isRendering = v.status === 'rendering';

            let renderBadge = '';
            if (isRendering) {
                renderBadge = '<span class="badge badge-purple" style="font-size:11px;" title="Video đang trong tiến trình xử lý render"><i class="fa-solid fa-spinner fa-spin"></i> Đang render AI...</span>';
            } else if (isRendered) {
                const partsText = (v.rendered_parts && v.rendered_parts.length > 1) ? `${v.rendered_parts.length} Parts (9:16)` : 'Đã Render 9:16';
                renderBadge = `<span class="badge badge-success" style="font-size:11px;" title="Video dọc 9:16 đã render hoàn tất"><i class="fa-solid fa-circle-check"></i> ${partsText}</span>`;
            } else {
                renderBadge = '<span class="badge badge-secondary" style="font-size:11px;" title="Chưa tạo bản cắt 9:16 cho video này"><i class="fa-solid fa-hourglass-half"></i> Chưa render</span>';
            }

            const dlBadge = v.has_raw || v.download_path
                ? `<span class="badge badge-blue" style="font-size:11px;" title="Đã lưu video MP4 gốc trên máy"><i class="fa-solid fa-cloud-arrow-down"></i> Đã tải MP4 gốc</span>`
                : '<span class="badge badge-secondary" style="font-size:11px;" title="Chưa có file MP4 gốc">Chưa có MP4</span>';

            let partsHtml = '';
            if (v.rendered_parts && v.rendered_parts.length > 0) {
                partsHtml = `
                            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;">
                                <span style="font-size:10.5px; color:var(--text-muted); align-self:center;">Parts:</span>
                                ${v.rendered_parts.map(p => `
                                    <span class="badge badge-purple" style="font-size:10px; padding:2px 8px; border-radius:4px;" title="Bản render Part ${p.part} (dọc 9:16)">Part ${p.part}</span>
                                `).join('')}
                            </div>
                        `;
            }

            return `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                            <div style="flex:1; min-width:240px; max-width:440px;">
                                <div style="display:flex; align-items:center; gap:8px; font-size:11px; color:var(--text-muted); margin-bottom:4px;">
                                    <span>ID: <code>${v.yt_video_id || '#' + v.id}</code></span>
                                    <span>•</span>
                                    <span><i class="fa-solid fa-clock"></i> ${v.duration || 65}s</span>
                                    <span>•</span>
                                    <span>${v.created_at ? v.created_at.substring(0, 16) : ''}</span>
                                </div>
                                <h5 style="margin:0; font-size:13px; color:#fff; font-weight:600; line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:440px;" title="${escapeHtml(v.title || '')}">
                                    ${escapeHtml(v.title || 'Video #' + v.id)}
                                </h5>
                                ${partsHtml}
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start; min-width:130px;">
                                ${dlBadge}
                                ${renderBadge}
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('tab-video-studio'); selectStudioVideo('${v.yt_video_id || v.id}'); closeChannelVideosModal();" title="Mở video này trong Studio Biên Tập">
                                    <i class="fa-solid fa-wand-magic-sparkles text-cyan"></i>
                                </button>
                                <button type="button" class="btn btn-danger btn-sm" onclick="deleteChannelVideoModalItem('${v.yt_video_id || v.id}', '${escapeHtml(channelId)}', '${escapeHtml(v.title || '')}')" title="Xóa video này và dọn dẹp file">
                                    <i class="fa-solid fa-trash-can"></i> Xóa
                                </button>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    } catch (err) {
        bodyEl.innerHTML = `<div class="text-center py-4 text-danger"><i class="fa-solid fa-circle-exclamation"></i> Lỗi nạp video: ${escapeHtml(err.message)}</div>`;
    }
}

function closeChannelVideosModal() {
    const modal = document.getElementById('modalChannelVideos');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function exportCurrentChannelVideosCsv() {
    if (!currentModalChannelVideos || !currentModalChannelVideos.length) {
        showToast('Kênh này chưa có video nào được tải về để xuất CSV!', true);
        return;
    }
    const headers = [
        'ID Video (DB)',
        'YouTube Video ID',
        'Tiêu Đề Video',
        'Kênh Nguồn',
        'Channel ID',
        'Thời Lượng (giây)',
        'Trạng Thái',
        'Đường Dẫn File Gốc',
        'Đường Dẫn Render 9:16',
        'Thời Gian Tải'
    ];
    const rows = [headers];
    currentModalChannelVideos.forEach(v => {
        rows.push([
            v.id || '',
            v.yt_video_id || '',
            v.title || '',
            v.channel_name || currentModalChannelTitle || '',
            v.channel_id || currentModalChannelId || '',
            v.duration ? Math.round(v.duration) : '',
            v.status || '',
            v.file_path || '',
            v.rendered_path || '',
            v.created_at || ''
        ]);
    });
    const safeTitle = (currentModalChannelTitle || currentModalChannelId || 'kenh').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`video_${safeTitle}_${dateStr}.csv`, rows);
}

async function deleteChannelVideoModalItem(videoId, channelId, videoTitle) {
    const confirmed = await showConfirmDialog({
        title: 'Xác Nhận Xóa Video',
        message: `Bạn có chắc muốn xóa video "${videoTitle || videoId}"?`,
        details: 'File video gốc và toàn bộ các Part 9:16 đã render trên ổ đĩa sẽ bị xóa vĩnh viễn.',
        confirmText: 'Xác Nhận Xóa',
        confirmClass: 'btn-danger'
    });
    if (!confirmed) return;

    showToast('Đang xóa video và file đĩa...');
    try {
        const res = await fetch(`/api/video/${videoId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('✅ ' + (data.message || 'Đã xóa video thành công!'), 'success');
            // Reload modal videos
            openChannelVideosModal(channelId, '');
            // Reload channels table to update badge counts
            loadSavedChannels();
            loadVideos();
            loadStudioVideos();
        } else {
            showToast('Lỗi khi xóa video: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối khi xóa: ' + err.message, 'error');
    }
}

function updateDetailModalSaveBtn() {
    const btn = document.getElementById('btnToggleSaveFromDetail');
    if (!btn || !activeDetailChannel) return;

    const cid = activeDetailChannel.channel_id;
    const isSaved = Boolean(
        activeDetailChannel.is_saved ||
        (cachedSavedChannels && cachedSavedChannels.some(sc =>
            sc.channel_id === cid ||
            (sc.channel_id && cid && sc.channel_id.toLowerCase() === cid.toLowerCase())
        ))
    );
    activeDetailChannel.is_saved = isSaved;

    if (isSaved) {
        btn.className = 'btn btn-danger btn-sm has-tooltip tooltip-left';
        btn.setAttribute('data-tooltip', 'Bỏ lưu kênh khỏi danh sách theo dõi');
        btn.title = 'Bỏ lưu kênh khỏi danh sách theo dõi';
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span id="detailSaveBtnText">Bỏ lưu</span>';
    } else {
        btn.className = 'btn btn-primary btn-sm has-tooltip tooltip-left';
        btn.setAttribute('data-tooltip', 'Lưu kênh vào danh sách theo dõi');
        btn.title = 'Lưu kênh vào danh sách theo dõi';
        btn.innerHTML = '<i class="fa-solid fa-bookmark"></i> <span id="detailSaveBtnText">Lưu Kênh</span>';
    }
}

async function toggleSaveFromDetailModal() {
    if (!activeDetailChannel) return;
    const ch = activeDetailChannel;
    const cid = ch.channel_id;

    if (ch.is_saved) {
        const confirmed = await showConfirmDialog({
            title: 'Bỏ Lưu Kênh',
            message: `Bạn có chắc chắn muốn bỏ theo dõi kênh "${ch.title || cid}"?`,
            details: 'Kênh sẽ bị xóa khỏi danh sách giám sát và dừng tự động tải/render video mới.',
            confirmText: 'Bỏ Lưu',
            confirmClass: 'btn-danger'
        });
        if (!confirmed) return;

        try {
            const res = await fetch('/api/youtube/unsave-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_id: cid })
            });
            const data = await res.json();
            if (data.status === 'success') {
                ch.is_saved = false;
                cachedSavedChannels = (cachedSavedChannels || []).filter(c => c.channel_id !== cid);
                const raw = (rawYtChannels || []).find(c => c.channel_id === cid);
                if (raw) raw.is_saved = false;
                showToast(`Đã bỏ lưu kênh "${ch.title || cid}"!`);
                updateDetailModalSaveBtn();
                renderSavedChannelsTable();
                renderYtChannelsTable();
                loadDashboardStats();
                renderSimilarChannels(ch);
            } else {
                showToast('Lỗi khi bỏ lưu: ' + (data.message || 'Thất bại'), true);
            }
        } catch (err) {
            showToast('Lỗi kết nối: ' + err.message, true);
        }
    } else {
        try {
            await fetch('/api/youtube/save-channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([ch])
            });
            ch.is_saved = true;
            if (!cachedSavedChannels.some(c => c.channel_id === cid)) {
                cachedSavedChannels.unshift({ ...ch, is_saved: true });
            }
            const raw = (rawYtChannels || []).find(c => c.channel_id === cid);
            if (raw) raw.is_saved = true;
            showToast(`Đã lưu kênh "${ch.title || cid}"!`);
            updateDetailModalSaveBtn();
            renderSavedChannelsTable();
            renderYtChannelsTable();
            loadDashboardStats();
            renderSimilarChannels(ch);
        } catch (err) {
            showToast('Lỗi khi lưu kênh: ' + err.message, true);
        }
    }
}

function renderSimilarChannels(target) {
    const grid = document.getElementById('similarChannelsGrid');
    const badge = document.getElementById('similarChannelsBadge');
    if (!grid) return;

    const pool = [...rawYtChannels];
    cachedSavedChannels.forEach(sc => {
        if (!pool.some(p => p.channel_id === sc.channel_id)) {
            pool.push(sc);
        }
    });

    const others = pool.filter(c => c.channel_id !== target.channel_id);
    if (!others.length) {
        grid.innerHTML = '<div class="card-empty-state" style="grid-column: 1/-1;"><p>Chưa có kênh tương đồng nào trong dữ liệu quét hiện tại.</p></div>';
        if (badge) badge.textContent = '0 Kênh';
        return;
    }

    const targetCountry = (target.country || '').toUpperCase();
    const targetSubs = target.subscriber_count || 0;
    const targetWords = (target.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

    let targetKw = [];
    if (Array.isArray(target.keywords)) targetKw = target.keywords;
    else if (typeof target.keywords === 'string') {
        try { targetKw = JSON.parse(target.keywords); } catch (e) { targetKw = target.keywords.split(','); }
    }
    targetKw = targetKw.map(k => String(k).toLowerCase().trim()).filter(Boolean);

    const scored = others.map(other => {
        let score = 0;
        // Country match
        if (targetCountry && (other.country || '').toUpperCase() === targetCountry) {
            score += 4;
        }
        // Keywords match
        let otherKw = [];
        if (Array.isArray(other.keywords)) otherKw = other.keywords;
        else if (typeof other.keywords === 'string') {
            try { otherKw = JSON.parse(other.keywords); } catch (e) { otherKw = other.keywords.split(','); }
        }
        otherKw = otherKw.map(k => String(k).toLowerCase().trim()).filter(Boolean);
        for (const k of targetKw) {
            if (otherKw.includes(k)) score += 3;
        }
        // Title words match
        const otherTitleLower = (other.title || '').toLowerCase();
        for (const w of targetWords) {
            if (otherTitleLower.includes(w)) score += 2;
        }
        // Viral Ratio similarity
        if (target.views_per_sub_ratio && other.views_per_sub_ratio) {
            const diff = Math.abs(target.views_per_sub_ratio - other.views_per_sub_ratio);
            if (diff <= 0.5) score += 3;
        }
        // Subs range
        if (targetSubs > 0 && other.subscriber_count > 0) {
            const ratio = other.subscriber_count / targetSubs;
            if (ratio >= 0.4 && ratio <= 2.5) score += 2;
        }
        if (other.is_active) score += 1;

        return { channel: other, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topSimilar = scored.slice(0, 9).map(s => s.channel);

    if (badge) badge.textContent = `${topSimilar.length} Kênh gợi ý`;

    grid.innerHTML = topSimilar.map(c => {
        const thumb = c.thumbnail_url
            ? `<img src="${c.thumbnail_url}" alt="" class="similar-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="similar-avatar-fallback" style="display:none;"><i class="fa-brands fa-youtube"></i></div>`
            : `<div class="similar-avatar-fallback"><i class="fa-brands fa-youtube"></i></div>`;
        const r = c.views_per_sub_ratio || 0;
        const fire = r >= 1.0 ? '🔥 ' : '';
        const ratioText = r > 0 ? `${fire}${r.toFixed(2)}x` : '—';

        return `
            <div class="similar-channel-card">
                <div class="similar-card-top">
                    ${thumb}
                    <div class="similar-meta">
                        <div class="similar-title" onclick="openChannelDetailModal('${escapeHtml(c.channel_id)}')" title="${escapeHtml(c.title)}">
                            ${escapeHtml(c.title)}
                        </div>
                        <div class="similar-handle">
                            ${c.handle ? escapeHtml(c.handle) : escapeHtml(c.channel_id)}
                        </div>
                    </div>
                    ${getCountryBadge(c.country)}
                </div>

                <div class="similar-metrics-row">
                    <div class="similar-metric-item">
                        <span class="similar-metric-label">Subscribers</span>
                        <span class="similar-metric-val">${c.subscriber_count ? formatNumber(c.subscriber_count) : 'Ẩn'}</span>
                    </div>
                    <div class="similar-metric-item">
                        <span class="similar-metric-label">Lượt Xem TB</span>
                        <span class="similar-metric-val">${c.avg_views ? formatNumber(c.avg_views) : 'N/A'}</span>
                    </div>
                    <div class="similar-metric-item">
                        <span class="similar-metric-label">Viral Ratio</span>
                        <span class="similar-metric-val" style="color:${r >= 2.0 ? '#f87171' : (r >= 1.0 ? '#fbbf24' : '#38bdf8')};">${ratioText}</span>
                    </div>
                </div>

                <div class="similar-card-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openChannelDetailModal('${escapeHtml(c.channel_id)}')">
                        <i class="fa-solid fa-circle-info text-cyan"></i> Chi tiết
                    </button>
                    <button type="button" class="btn btn-sm ${c.is_saved ? 'btn-saved' : 'btn-primary'}" onclick="toggleSaveChannelById('${escapeHtml(c.channel_id)}')">
                        ${c.is_saved ? '<i class="fa-solid fa-check"></i> Đã Lưu' : '<i class="fa-solid fa-bookmark"></i> Lưu Kênh'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleSaveChannelById(channelId) {
    const rawIdx = rawYtChannels.findIndex(c => c.channel_id === channelId);
    if (rawIdx !== -1) {
        await toggleSaveChannel(rawIdx);
        if (activeDetailChannel) {
            updateDetailModalSaveBtn();
            renderSimilarChannels(activeDetailChannel);
        }
        return;
    }
    const saved = cachedSavedChannels.find(c => c.channel_id === channelId);
    if (saved) {
        try {
            const res = await fetch('/api/youtube/unsave-channel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_id: channelId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast(`Đã bỏ lưu kênh!`);
                await loadSavedChannels();
                loadDashboardStats();
                if (activeDetailChannel) {
                    if (activeDetailChannel.channel_id === channelId) {
                        activeDetailChannel.is_saved = false;
                        updateDetailModalSaveBtn();
                    }
                    renderSimilarChannels(activeDetailChannel);
                }
            }
        } catch (e) {
            showToast('Lỗi: ' + e.message, true);
        }
    }
}

// 3. AI Video Editor
async function downloadSingleVideo() {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('Tải Video Đơn')) {
        return;
    }
    const inputEl = document.getElementById('directDownloadUrl');
    const url = inputEl ? inputEl.value.trim() : '';
    const btn = document.getElementById('btnDownloadVideo');
    if (!url) {
        markInputError('directDownloadUrl', 'Vui lòng nhập liên kết video từ YouTube, Douyin, Xiaohongshu, Facebook, Instagram...');
        return;
    }
    // Hỗ trợ cả 7 nền tảng: YouTube, Douyin, Xiaohongshu, Facebook, Instagram, Bilibili, Weibo
    const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');
    if (!isHttpUrl && !isValidYouTubeUrl(url)) {
        markInputError('directDownloadUrl', 'Định dạng link không hợp lệ! Vui lòng dán link video (http/https) hoặc YouTube ID 11 ký tự.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Tải...';
    }
    showToast('Đang tải video gốc trong nền...');
    try {
        const res = await fetch('/api/video/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, is_studio: true })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast('Tải video thành công!', 'success');
            if (inputEl) inputEl.value = '';
            loadVideos();
            loadStudioVideos();
            loadDashboardStats();
            if (typeof loadVideoLibraryTable === 'function') loadVideoLibraryTable();
        } else {
            showToast('Lỗi: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        showToast('Lỗi tải video: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Tải';
        }
    }
}

async function loadVideos() {
    const tbody = document.getElementById('videosTableBody');
    try {
        const res = await fetch('/api/video/list');
        const videos = await res.json();
        cachedVideos = videos;

        if (videos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Chưa có video nào được tải về. Dán link phía trên để tải thử!</td></tr>`;
            return;
        }

        tbody.innerHTML = videos.map(v => `
            <tr>
                <td><code>#${v.id}</code></td>
                <td>
                    <div class="table-text-truncate" style="max-width: 250px;" title="${escapeHtml(v.title)}">
                        <strong>${escapeHtml(v.title)}</strong>
                    </div>
                    <span class="text-muted" style="font-size:11px;">ID: ${v.yt_video_id}</span>
                </td>
                <td>${v.duration}s</td>
                <td>
                    ${v.status === 'rendered'
                ? '<span class="badge badge-success"><i class="fa-solid fa-check-double"></i> Đã Render AI 9:16</span>'
                : '<span class="badge badge-warning">Video Gốc</span>'}
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-sm btn-primary" onclick="renderVideoAI('${v.yt_video_id}', this)">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Render AI 9:16
                        </button>
                        ${v.rendered_path ? `
                        <button class="btn btn-sm btn-secondary" onclick="openUploadModal('${v.id}')">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Đăng
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Lỗi nạp video:', err);
    }
}

async function renderVideoAI(ytVideoId, btn) {
    if (window.LicenseManager && !window.LicenseManager.requireLicense('AI Render Video')) {
        return;
    }
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Render...';
    }
    showToast('Đang tiến hành AI Render (Format 9:16, lật hình, đổi speed & cắt part)...');
    try {
        const res = await fetch('/api/video/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_id: ytVideoId,
                duration: 65,
                flip_horizontal: true,
                speed_factor: 1.03
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Render AI thành công! Video đã sẵn sàng đăng.');
            loadVideos();
            loadDashboardStats();
        } else {
            showToast('Lỗi render: ' + (data.detail || 'Không xác định'), true);
        }
    } catch (err) {
        showToast('Lỗi render: ' + err.message, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Render AI 9:16';
        }
    }
}

// 4. GPMLogin Profiles
let _gpmSyncAbortController = null;

async function syncGPMProfiles(btn) {
    const topBtn = document.getElementById('btnSyncGpmTopbar');
    const tabBtn = document.getElementById('btnSyncGpmTab');
    const syncButtons = [btn, topBtn, tabBtn].filter(Boolean);

    // If already running and user clicks again, abort!
    if (_gpmSyncAbortController) {
        _gpmSyncAbortController.abort();
        _gpmSyncAbortController = null;
        showToast('🛑 Đã hủy yêu cầu đồng bộ trình duyệt!', 'warning');
        syncButtons.forEach(b => {
            b.disabled = false;
            b.innerHTML = b.id === 'btnSyncGpmTopbar'
                ? '<i class="fa-solid fa-rotate"></i> <span data-i18n="topbar_sync">Đồng Bộ</span>'
                : '<i class="fa-solid fa-arrows-rotate"></i> Đồng Bộ';
        });
        return;
    }

    syncButtons.forEach(b => {
        b.disabled = true;
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Đồng Bộ...';
    });

    const sel = document.getElementById('selectActiveBrowser');
    const browserName = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.replace(/^[^a-zA-Z0-9]+/, '').split(' ')[0] : 'Trình Duyệt';
    showToast(`Đang đồng bộ profiles từ ${browserName}...`);

    _gpmSyncAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
        if (_gpmSyncAbortController) {
            _gpmSyncAbortController.abort();
            _gpmSyncAbortController = null;
        }
    }, 15000);

    try {
        const res = await fetch('/api/gpm/sync', { 
            method: 'POST',
            signal: _gpmSyncAbortController.signal 
        });
        clearTimeout(timeoutId);
        _gpmSyncAbortController = null;

        let data;
        try {
            data = await res.json();
        } catch (_) {
            throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${res.status})`);
        }
        if (data.status === 'success') {
            showToast(data.message || `Đồng bộ thành công ${data.synced} profiles!`, 'success');
            if (typeof loadGpmProfiles === 'function') loadGpmProfiles();
            if (typeof loadDashboardStats === 'function') loadDashboardStats();
        } else {
            showToast(data.message || 'Không thể đồng bộ profiles', true);
        }
    } catch (err) {
        clearTimeout(timeoutId);
        _gpmSyncAbortController = null;
        if (err.name === 'AbortError') {
            showToast('Hết thời gian chờ kết nối trình duyệt (Timeout 15s). Vui lòng kiểm tra ứng dụng antidetect đã mở chưa.', true);
        } else {
            showToast('Không kết nối được trình duyệt: ' + err.message, true);
        }
    } finally {
        syncButtons.forEach(b => {
            b.disabled = false;
            b.innerHTML = b.id === 'btnSyncGpmTopbar'
                ? '<i class="fa-solid fa-rotate"></i> <span data-i18n="topbar_sync">Đồng Bộ</span>'
                : '<i class="fa-solid fa-arrows-rotate"></i> Đồng Bộ';
        });
    }
}
window.syncGPMProfiles = syncGPMProfiles;
window.toggleGpmSortDirection = toggleGpmSortDirection;
window.handleGpmSortChange = handleGpmSortChange;
window.handleGpmHeaderSort = handleGpmHeaderSort;
window.renderGpmProfilesTable = renderGpmProfilesTable;
window.resetGpmFilters = resetGpmFilters;
window.exportGpmProfilesCsv = exportGpmProfilesCsv;
window.stopAllProfilesScan = stopAllProfilesScan;
window.openEditUsernameModal = openEditUsernameModal;
window.openEditChannelModal = openEditChannelModal;
window.closeEditUsernameModal = closeEditUsernameModal;
window.setCachedGpmProfiles = function(p) { cachedGpmProfiles = p; };
window.cycleProfileNotifyStatus = cycleProfileNotifyStatus;
window.setChannelNotifyStatus = setChannelNotifyStatus;
window.cycleChannelNotifyStatus = cycleChannelNotifyStatus;
window.scanSingleChannelFollowers = scanSingleChannelFollowers;
window.deleteChannelFromList = deleteChannelFromList;
window.updateEditProfileModalLabels = updateEditProfileModalLabels;
window.onEditProfilePlatformChange = onEditProfilePlatformChange;
window.scanSingleProfileFollowers = scanSingleProfileFollowers;
window.loadGpmProfiles = loadGpmProfiles;
window.updateSelectedGpmCount = updateSelectedGpmCount;
window.updateEditSelectedGpmCount = updateEditSelectedGpmCount;
window.selectAllEditCampaignGpm = selectAllEditCampaignGpm;

// Module Window Exposures
window.closeChannelDetailModal = closeChannelDetailModal;
window.closeChannelVideosModal = closeChannelVideosModal;
window.closeColumnDropdown = closeColumnDropdown;
window.downloadSingleVideo = downloadSingleVideo;
window.exportCurrentChannelVideosCsv = exportCurrentChannelVideosCsv;
window.exportYtSearchCsv = exportYtSearchCsv;
window.handleCustomCadenceInput = handleCustomCadenceInput;
window.handleCustomSubsInput = handleCustomSubsInput;
window.handleCustomViewsInput = handleCustomViewsInput;
window.handleFilterActiveChange = handleFilterActiveChange;
window.handleFilterCadenceChange = handleFilterCadenceChange;
window.handleFilterCountryChange = handleFilterCountryChange;
window.handleFilterKeywordChange = handleFilterKeywordChange;
window.handleFilterSavedChange = handleFilterSavedChange;
window.handleFilterSubsChange = handleFilterSubsChange;
window.handleFilterViewsChange = handleFilterViewsChange;
window.handleHeaderSort = handleHeaderSort;
window.handleSortSelectChange = handleSortSelectChange;
window.loadDashboardStats = loadDashboardStats;
window.playVoicePreview = playVoicePreview;
window.resetYtFilters = resetYtFilters;
window.searchYouTubeChannels = searchYouTubeChannels;
window.switchSourceSubTab = switchSourceSubTab;
window.switchTab = switchTab;
window.toggleColVisibility = toggleColVisibility;
window.toggleColumnDropdown = toggleColumnDropdown;
window.toggleSidebar = toggleSidebar;
window.toggleSortDirection = toggleSortDirection;
window.updateVoiceDropdownOptions = updateVoiceDropdownOptions;
window.openChannelDetailModal = openChannelDetailModal;
window.openChannelVideosModal = openChannelVideosModal;
window.ensureAudioCategoriesLoaded = ensureAudioCategoriesLoaded;

function loadActiveBrowser() {
    try {
        const saved = localStorage.getItem('active_browser');
        const sel = document.getElementById('selectActiveBrowser');
        if (saved && sel) {
            sel.value = saved;
        }
    } catch (_) {}
}

function changeActiveBrowser(val) {
    try {
        localStorage.setItem('active_browser', val);
    } catch (_) {}
    const selName = val === 'genlogin' ? 'GenLogin' : (val === 'adspower' ? 'AdsPower' : (val === 'dolphin' ? 'Dolphin Anty' : 'GPMLogin'));
    showToast(`Đã chuyển trình duyệt hoạt động sang ${selName}`, 'info');
    if (typeof loadGpmProfiles === 'function') {
        loadGpmProfiles();
    }
}
window.loadActiveBrowser = loadActiveBrowser;
window.changeActiveBrowser = changeActiveBrowser;

// License Manager Aliases
window.openLicenseModal = () => window.LicenseManager?.openLicenseModal?.();
window.closeLicenseModal = () => window.LicenseManager?.closeLicenseModal?.();
window.checkForUpdates = () => window.LicenseManager?.checkForUpdates?.();
window.copyHwid = () => window.LicenseManager?.copyHwid?.();
window.syncLicense = () => window.LicenseManager?.syncLicense?.();
window.openConfirmDeactivateModal = () => window.LicenseManager?.openConfirmDeactivateModal?.();
window.closeConfirmDeactivateModal = () => window.LicenseManager?.closeConfirmDeactivateModal?.();
window.confirmDeactivateNow = () => window.LicenseManager?.confirmDeactivateNow?.();
window.openUpdateModal = () => window.LicenseManager?.openUpdateModal?.();
window.closeUpdateModal = () => window.LicenseManager?.closeUpdateModal?.();

// Additional Core UI Exposures
window.renderVideoAI = renderVideoAI;
window.loadVideos = loadVideos;
window.toggleSaveChannel = toggleSaveChannel;
window.saveSingleChannel = saveSingleChannel;
window.toggleSaveFromMenu = toggleSaveFromMenu;
window.toggleSaveFromDetailModal = toggleSaveFromDetailModal;
window.toggleSaveChannelById = toggleSaveChannelById;
window.deleteChannelVideoModalItem = deleteChannelVideoModalItem;
window.toggleActionMenu = toggleActionMenu;
window.closeAllActionMenus = closeAllActionMenus;
window.showConfirmDialog = showConfirmDialog;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.copyTextToClipboard = copyTextToClipboard;
