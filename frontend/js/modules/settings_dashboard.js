// ============================================================
// SETTINGS TAB – API Key Management
// ============================================================
async function loadApiKeySettings() {
    try {
        const res = await fetch('/api/settings/keys');
        if (!res.ok) return;
        const data = await res.json();

        // YouTube keys – show one per line
        const ytRaw = data.youtube_api_keys || '';
        const ytLines = ytRaw.split(',').map(k => k.trim()).filter(Boolean).join('\n');
        const ytEl = document.getElementById('settingYoutubeKeys');
        if (ytEl) ytEl.value = ytLines;

        const dsEl = document.getElementById('settingDeepSeekKey');
        if (dsEl) dsEl.value = data.deepseek_api_key || '';

        const gemEl = document.getElementById('settingGeminiKey');
        if (gemEl) gemEl.value = data.gemini_api_key || '';

        const oaiEl = document.getElementById('settingOpenAiKey');
        if (oaiEl) oaiEl.value = data.openai_api_key || '';

        const pexEl = document.getElementById('settingPexelsKey');
        if (pexEl) pexEl.value = data.pexels_api_key || '';
        const pixEl = document.getElementById('settingPixabayKey');
        if (pixEl) pixEl.value = data.pixabay_api_key || '';
        const pollEl = document.getElementById('settingPollinationsKey');
        if (pollEl) pollEl.value = data.pollinations_api_key || '';

        const falEl = document.getElementById('settingFalKey');
        if (falEl) falEl.value = data.fal_api_key || '';
        const elKeyEl = document.getElementById('settingElevenLabsKey');
        if (elKeyEl) elKeyEl.value = data.elevenlabs_api_key || '';
        const klingAkEl = document.getElementById('settingKlingAccessKey');
        if (klingAkEl) klingAkEl.value = data.kling_access_key || '';
        const klingSkEl = document.getElementById('settingKlingSecretKey');
        if (klingSkEl) klingSkEl.value = data.kling_secret_key || '';

        const provEl = document.getElementById('settingAiProvider');
        if (provEl && data.ai_provider) provEl.value = data.ai_provider;

        const dsModelEl = document.getElementById('settingDeepSeekModel');
        if (dsModelEl && data.deepseek_model) dsModelEl.value = data.deepseek_model;

        const gemModelEl = document.getElementById('settingGeminiModel');
        if (gemModelEl) {
            if (data.gemini_model) gemModelEl.value = data.gemini_model;
            if (!gemModelEl.value && gemModelEl.options.length > 0) {
                gemModelEl.selectedIndex = 0;
            }
        }

        const gemUrlEl = document.getElementById('settingGeminiBaseUrl');
        if (gemUrlEl) gemUrlEl.value = data.gemini_base_url || '';

        const oaiModelEl = document.getElementById('settingOpenAiModel');
        if (oaiModelEl && data.openai_model) oaiModelEl.value = data.openai_model;

        const whispEl = document.getElementById('settingWhisperModel');
        if (whispEl && data.whisper_model_size) whispEl.value = data.whisper_model_size;

        const subEl = document.getElementById('settingDynamicSubtitles');
        if (subEl && data.enable_dynamic_subtitles !== undefined) subEl.checked = !!data.enable_dynamic_subtitles;

        const subStyleEl = document.getElementById('settingSubtitleStyle');
        if (subStyleEl && data.subtitle_style) subStyleEl.value = data.subtitle_style;

        const subPosEl = document.getElementById('settingSubtitlePosition');
        if (subPosEl && data.subtitle_position) subPosEl.value = data.subtitle_position;

        const subFontEl = document.getElementById('settingSubtitleFontSize');
        if (subFontEl && data.subtitle_font_size) subFontEl.value = String(data.subtitle_font_size);

        const subWrap = document.getElementById('settingSubtitleStyleWrap');
        if (subWrap && subEl) subWrap.style.display = subEl.checked ? 'grid' : 'none';

        const antiEl = document.getElementById('settingAntiDetect');
        if (antiEl && data.enable_anti_detect !== undefined) antiEl.checked = !!data.enable_anti_detect;

        const tgEl = document.getElementById('settingTelegramToken');
        if (tgEl) tgEl.value = data.telegram_bot_token || '';

        const tgChatEl = document.getElementById('settingTelegramChatId');
        if (tgChatEl) tgChatEl.value = data.telegram_chat_id || '';

        const gpmEl = document.getElementById('settingGpmUrl');
        if (gpmEl) gpmEl.value = data.gpm_api_base_url || '';

        const adsEl = document.getElementById('settingAdsPowerUrl');
        if (adsEl) adsEl.value = data.adspower_api_base_url || '';

        const dolEl = document.getElementById('settingDolphinUrl');
        if (dolEl) dolEl.value = data.dolphin_api_base_url || '';

        const genEl = document.getElementById('settingGenLoginUrl');
        if (genEl) genEl.value = data.genlogin_api_base_url || '';

        // Sync language dropdown without overriding the user's active session language
        const activeLang = (window.i18n ? window.i18n.currentLang : localStorage.getItem('app_language')) || data.app_language || 'vi';
        const langEl = document.getElementById('settingAppLanguage');
        if (langEl) langEl.value = activeLang;
        const topLangEl = document.getElementById('selectAppLanguage');
        if (topLangEl) topLangEl.value = activeLang;

        // Sync theme dropdown without overriding the user's active session theme
        const activeTheme = (window.themeManager ? window.themeManager.currentTheme : localStorage.getItem('app_theme')) || data.app_theme || 'dark';
        const themeEl = document.getElementById('settingAppTheme');
        if (themeEl) themeEl.value = activeTheme;

        if (data.follower_threshold_tiktok !== undefined) {
            const el = document.getElementById('settingThresholdTiktok');
            if (el) el.value = data.follower_threshold_tiktok;
            followerThresholds.tiktok = Number(data.follower_threshold_tiktok) || 10000;
        }
        if (data.follower_threshold_youtube !== undefined) {
            const el = document.getElementById('settingThresholdYoutube');
            if (el) el.value = data.follower_threshold_youtube;
            followerThresholds.youtube = Number(data.follower_threshold_youtube) || 1000;
        }
        if (data.follower_threshold_facebook !== undefined) {
            const el = document.getElementById('settingThresholdFacebook');
            if (el) el.value = data.follower_threshold_facebook;
            followerThresholds.facebook = Number(data.follower_threshold_facebook) || 1000;
        }

        // Render key pool status table
        renderKeyPoolTable(data.youtube_key_pool || []);

        // Load Telegram Alert Channels
        loadTelegramChannels();

        // Load cleanup retention settings
        try {
            const cleanRes = await fetch('/api/settings/cleanup');
            const cleanData = await cleanRes.json();
            if (cleanData.status === 'success') {
                const mode = cleanData.retention_mode || '7';
                const radios = document.querySelectorAll('input[name="cleanupRetentionMode"]');
                radios.forEach(r => {
                    r.checked = (r.value === mode);
                });
                const customInput = document.getElementById('inputCleanupCustomDays');
                if (customInput && cleanData.custom_days) {
                    customInput.value = cleanData.custom_days;
                }
            }
        } catch (e) {
            console.error('Lỗi nạp cấu hình dọn dẹp:', e);
        }

        // Load System Tray & Auto-Start settings
        loadSystemTraySettings();

        // Load Download Filter settings (min/max duration)
        loadDownloadFilterSettings();

        // Load AI Usage Tracking & Cost stats
        loadAiUsageStats();
    } catch (err) {
        console.error('loadApiKeySettings error:', err);
    }
}

// ============================================================
// SYSTEM TRAY & AUTO-START SETTINGS
// ============================================================
async function loadSystemTraySettings() {
    try {
        const res = await fetch('/api/settings/system-tray');
        if (!res.ok) return;
        const data = await res.json();
        const autoEl = document.getElementById('settingAutostartToggle');
        const minEl = document.getElementById('settingMinimizeToTrayToggle');
        if (autoEl) autoEl.checked = !!data.autostart;
        if (minEl) minEl.checked = !!data.minimize_to_tray;
    } catch (err) {
        console.error('Lỗi nạp cấu hình System Tray:', err);
    }
}

async function toggleAutostartSetting(checked) {
    try {
        const res = await fetch('/api/settings/system-tray', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autostart: checked })
        });
        const data = await res.json();
        if (checked) {
            showToast('🚀 Đã BẬT tự khởi động ngầm cùng Windows khi mở máy.');
        } else {
            showToast('Đã TẮT tự khởi động cùng Windows.');
        }
    } catch (err) {
        showToast('Lỗi cập nhật cấu hình khởi động: ' + err.message, true);
    }
}

async function toggleMinimizeToTraySetting(checked) {
    try {
        const res = await fetch('/api/settings/system-tray', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minimize_to_tray: checked })
        });
        const data = await res.json();
        if (checked) {
            showToast('📌 Đã BẬT thu nhỏ xuống Khay Hệ Thống khi đóng cửa sổ.');
        } else {
            showToast('Đã TẮT thu nhỏ xuống khay (ứng dụng sẽ thoát hẳn khi đóng).');
        }
    } catch (err) {
        showToast('Lỗi cập nhật cấu hình khay hệ thống: ' + err.message, true);
    }
}

// ============================================================
// DOWNLOAD FILTER SETTINGS (GLOBAL DURATION LIMITS)
// ============================================================
function validateMinDurationInput(input) {
    if (!input || input.disabled) return;
    const minVal = parseInt(input.min, 10) || 0;
    if (input.value !== '') {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < minVal) {
            input.value = minVal;
            if (minVal > 0) {
                showToast('⚠️ Thời lượng tối thiểu cho Video Dài không thể nhỏ hơn ' + minVal + ' giây!', true);
            }
        }
    }
}

/**
 * Shared helper: apply min/value/disabled state to a min-duration input
 * based on whether Shorts checkbox is currently checked.
 *   Shorts checked (both or shorts-only) → value=0, min=0, DISABLED
 *   Only Longform checked                → min=180, value≥180, ENABLED
 */
function toggleCampaignAutoUpload(mode, isChecked) {
    const isNew = mode === 'new';
    const actionsWrap = document.getElementById(isNew ? 'campaignAccountActionsWrap' : 'editCampaignAccountActionsWrap');
    const notice = document.getElementById(isNew ? 'campaignNoUploadNotice' : 'editCampaignNoUploadNotice');
    const selectionWrap = document.getElementById(isNew ? 'campaignAccountSelectionWrap' : 'editCampaignAccountSelectionWrap');

    if (actionsWrap) {
        actionsWrap.style.display = isChecked ? 'flex' : 'none';
    }
    if (notice) {
        notice.style.display = isChecked ? 'none' : 'block';
    }
    if (selectionWrap) {
        selectionWrap.style.display = isChecked ? 'block' : 'none';
    }
}

function toggleAiStoryCard(prefix, isChecked) {
    let wrapId = prefix === 'campaign' ? 'campaignImageStyleWrap' : (prefix === 'editCampaign' ? 'editCampaignImageStyleWrap' : (prefix === 'studio' ? 'studioAiStoryWrap' : 'settingChannelImageStyleWrap'));
    const wrap = document.getElementById(wrapId);
    if (wrap) wrap.style.display = isChecked ? (prefix === 'studio' ? 'flex' : 'block') : 'none';

    // Ẩn các tùy chọn Shorts (Tắt phụ đề cho Shorts & Tắt lồng tiếng / Giữ âm thanh gốc cho Shorts) khi bật AI Story; hiện lại khi tắt
    let subShortsWrapId = prefix === 'campaign' ? 'campaignDisableSubtitleWrap' : (prefix === 'editCampaign' ? 'editCampaignDisableSubtitleWrap' : (prefix === 'studio' ? 'studioDisableSubtitleWrap' : 'settingChannelDisableSubtitleWrap'));
    let narrShortsWrapId = prefix === 'campaign' ? 'campaignDisableNarrationWrap' : (prefix === 'editCampaign' ? 'editCampaignDisableNarrationWrap' : (prefix === 'studio' ? 'studioDisableNarrationWrap' : 'settingChannelDisableNarrationWrap'));

    const subShortsWrap = document.getElementById(subShortsWrapId);
    const narrShortsWrap = document.getElementById(narrShortsWrapId);
    if (subShortsWrap) subShortsWrap.style.display = isChecked ? 'none' : 'block';
    if (narrShortsWrap) narrShortsWrap.style.display = isChecked ? 'none' : 'grid';

    // Khi bật AI Story, tự động kích hoạt & mở panel Lồng Tiếng AI nếu đang tắt để người dùng thấy rõ giọng đọc
    if (isChecked) {
        let narrSwitchId = prefix === 'campaign' ? 'campaignNarrationSwitch' : (prefix === 'editCampaign' ? 'editCampaignNarrationSwitch' : (prefix === 'studio' ? 'studioNarrationSwitch' : 'settingChannelNarrationSwitch'));
        let narrWrapId = prefix === 'campaign' ? 'campaignNarrationWrap' : (prefix === 'editCampaign' ? 'editCampaignNarrationWrap' : (prefix === 'studio' ? 'studioNarrationWrap' : 'settingChannelNarrationWrap'));
        const narrSwitch = document.getElementById(narrSwitchId);
        const narrWrap = document.getElementById(narrWrapId);
        if (narrSwitch && !narrSwitch.checked) {
            narrSwitch.checked = true;
            if (narrWrap) narrWrap.style.display = (prefix === 'studio' ? 'flex' : 'block');
        }
    }
}

function toggleCampaignEngagementOptions(prefix, isChecked) {
    const wrap = document.getElementById(`campaignEngagementOptions_${prefix}`);
    if (wrap) {
        wrap.style.display = isChecked ? 'flex' : 'none';
    }
}

function applyMinDurationState(shortsCb, longformCb, minInput, savedValue) {
    if (!minInput) return;
    const onlyLongform = (longformCb ? longformCb.checked : true) && !(shortsCb ? shortsCb.checked : true);
    if (onlyLongform) {
        minInput.disabled = false;
        minInput.style.opacity = '';
        minInput.style.cursor = '';
        minInput.min = '180';
        const mVal = (savedValue != null && savedValue >= 180) ? savedValue : 180;
        minInput.value = mVal;
    } else {
        // Shorts is checked → lock to 0
        minInput.disabled = true;
        minInput.style.opacity = '0.45';
        minInput.style.cursor = 'not-allowed';
        minInput.min = '0';
        minInput.value = 0;
    }
}

/**
 * Called when either Shorts or Longform checkbox changes.
 * Rules:
 *   - Both checked OR only Shorts checked → min duration = 0, input DISABLED
 *   - Only Longform checked              → min duration = 180, input ENABLED
 *   - Cannot uncheck both (re-checks the triggering checkbox)
 */
function onToggleFormatCheckbox(changedCb, shortsId, longformId, minInputId) {
    if (!changedCb) return;
    const shortsCb = document.getElementById(shortsId);
    const longformCb = document.getElementById(longformId);
    const minInput = document.getElementById(minInputId);
    if (!shortsCb || !longformCb) return;

    // Prevent unchecking both
    if (!shortsCb.checked && !longformCb.checked) {
        changedCb.checked = true;
        showToast('⚠️ Phải chọn ít nhất một định dạng (Shorts hoặc Video Dài)!', true);
        return;
    }

    // Preserve current value for longform-only case
    const curVal = minInput ? parseInt(minInput.value, 10) : null;
    applyMinDurationState(shortsCb, longformCb, minInput, isNaN(curVal) ? null : curVal);
}

// Legacy shim kept for any remaining HTML references
function onToggleIncludeLongform(cb, inputId) {
    const shortsId = inputId
        .replace('settingMinVideoDuration', 'settingFilterIncludeShorts')
        .replace('settingChannelMinDuration', 'settingChannelIncludeShorts')
        .replace('campaignMinDurationInput', 'campaignIncludeShorts')
        .replace('editCampaignMinDurationInput', 'editCampaignIncludeShorts');
    const longformId = cb ? cb.id : '';
    onToggleFormatCheckbox(cb, shortsId, longformId, inputId);
}

async function loadDownloadFilterSettings() {
    try {
        const res = await fetch('/api/settings/download-filter');
        if (!res.ok) return;
        const data = await res.json();
        const minEl = document.getElementById('settingMinVideoDuration');
        const maxEl = document.getElementById('settingMaxVideoDuration');
        const shortsEl = document.getElementById('settingFilterIncludeShorts');
        const longformEl = document.getElementById('settingFilterIncludeLongform');

        if (shortsEl && data.include_shorts != null) shortsEl.checked = !!data.include_shorts;
        if (longformEl && data.include_longform != null) longformEl.checked = !!data.include_longform;

        applyMinDurationState(shortsEl, longformEl, minEl, data.min_video_duration ?? null);
        if (maxEl && data.max_video_duration != null) maxEl.value = data.max_video_duration;
    } catch (err) {
        console.error('Lỗi nạp cấu hình bộ lọc video:', err);
    }
}

async function saveDownloadFilterSettings(silent = false) {
    const minVal = parseInt(document.getElementById('settingMinVideoDuration')?.value || '0', 10);
    const maxVal = parseInt(document.getElementById('settingMaxVideoDuration')?.value || '3600', 10);
    const includeShorts = document.getElementById('settingFilterIncludeShorts')?.checked ?? true;
    const includeLongform = document.getElementById('settingFilterIncludeLongform')?.checked ?? true;

    if (!includeShorts && !includeLongform) {
        showToast('⚠️ Vui lòng chọn ít nhất một loại video: Shorts hoặc Video Dài!', true);
        return false;
    }

    if (isNaN(minVal) || minVal < 0) {
        showToast('⚠️ Thời lượng tối thiểu không hợp lệ!', true);
        return false;
    }
    if (isNaN(maxVal) || maxVal <= 0) {
        showToast('⚠️ Thời lượng tối đa không hợp lệ!', true);
        return false;
    }
    if (minVal >= maxVal) {
        showToast('⚠️ Thời lượng tối thiểu phải nhỏ hơn thời lượng tối đa!', true);
        return false;
    }

    try {
        const res = await fetch('/api/settings/download-filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                min_video_duration: minVal,
                max_video_duration: maxVal,
                include_shorts: includeShorts,
                include_longform: includeLongform
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (!silent) {
                const types = [];
                if (includeShorts) types.push('Shorts (≤ 3p)');
                if (includeLongform) types.push(`Video Dài (${minVal}s - ${maxVal}s)`);
                showToast(`✅ Đã lưu bộ lọc video: ${types.join(' + ')}`);
            }
            return true;
        } else {
            showToast('Lỗi lưu bộ lọc: ' + (data.detail || 'Không thể lưu'), true);
            return false;
        }
    } catch (err) {
        showToast('Lỗi kết nối khi lưu bộ lọc: ' + err.message, true);
        return false;
    }
}

function renderKeyPoolTable(pool) {
    const wrap = document.getElementById('keyPoolStatus');
    const table = document.getElementById('keyPoolTable');
    if (!wrap || !table) return;
    if (!pool || pool.length === 0) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';
    const rows = pool.map((k, i) => {
        const status = k.is_active
            ? `<span class="key-badge-active"><i class="fa-solid fa-circle-check"></i> Hoạt Động</span>`
            : `<span class="key-badge-cooldown"><i class="fa-solid fa-clock"></i> Cooldown ${Math.ceil(k.cooldown_remaining_sec / 3600)}h</span>`;
        const current = k.is_current ? `<span class="key-badge-current"><i class="fa-solid fa-bolt"></i> Đang Dùng</span>` : '';
        return `<tr>
            <td style="width:32px; color:var(--text-muted);">${i + 1}</td>
            <td class="key-mono">${escapeHtml(k.key_masked)}</td>
            <td>${status}${current}</td>
            <td style="color:var(--text-muted);">${k.is_active ? '—' : `~${Math.ceil(k.cooldown_remaining_sec / 60)} phút`}</td>
        </tr>`;
    }).join('');
    table.innerHTML = `<table class="key-pool-table">
        <thead><tr><th>#</th><th>API Key</th><th>Trạng Thái</th><th>Còn Lại</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

async function saveApiKeySettings(btn) {
    const original = btn ? btn.innerHTML : '';
    const resultEl = document.getElementById('saveKeysResult');
    if (resultEl) resultEl.innerHTML = '';

    const fontSizeInput = document.getElementById('settingSubtitleFontSize');
    const subtitleFontSize = fontSizeInput ? (parseInt(fontSizeInput.value, 10) || 54) : 54;
    if (subtitleFontSize < 12 || subtitleFontSize > 120) {
        markInputError('settingSubtitleFontSize', 'Cỡ chữ phụ đề phải từ 12 đến 120 pt!');
        return;
    }

    const gpmUrlInput = document.getElementById('settingGpmUrl');
    const gpmUrl = gpmUrlInput ? gpmUrlInput.value.trim() : '';
    if (gpmUrl && !/^https?:\/\//i.test(gpmUrl)) {
        markInputError('settingGpmUrl', 'GPM API Base URL phải bắt đầu bằng http:// hoặc https:// (VD: http://127.0.0.1:19995)!');
        return;
    }

    const selRadio = document.querySelector('input[name="cleanupRetentionMode"]:checked');
    const retentionMode = selRadio ? selRadio.value : '7';
    const customDaysInput = document.getElementById('inputCleanupCustomDays');
    const customDays = customDaysInput ? (parseInt(customDaysInput.value, 10) || 7) : 7;
    if (retentionMode === 'custom' && (isNaN(customDays) || customDays < 1 || customDays > 3650)) {
        markInputError('inputCleanupCustomDays', 'Số ngày lưu trữ tùy chỉnh phải từ 1 đến 3650 ngày!');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    const ytRaw = (document.getElementById('settingYoutubeKeys')?.value || '');
    // Normalize: join lines as comma-separated
    const ytKeys = ytRaw.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean).join(',');

    const payload = {
        youtube_api_keys: ytKeys,
        deepseek_api_key: document.getElementById('settingDeepSeekKey')?.value || '',
        gemini_api_key: document.getElementById('settingGeminiKey')?.value || '',
        openai_api_key: document.getElementById('settingOpenAiKey')?.value || '',
        pexels_api_key: document.getElementById('settingPexelsKey')?.value || '',
        pixabay_api_key: document.getElementById('settingPixabayKey')?.value || '',
        pollinations_api_key: document.getElementById('settingPollinationsKey')?.value || '',
        elevenlabs_api_key: document.getElementById('settingElevenLabsKey')?.value || '',
        ai_provider: document.getElementById('settingAiProvider')?.value || 'deepseek',
        deepseek_model: document.getElementById('settingDeepSeekModel')?.value || 'deepseek-chat',
        gemini_model: document.getElementById('settingGeminiModel')?.value || 'gemini-2.0-flash',
        gemini_base_url: document.getElementById('settingGeminiBaseUrl')?.value || '',
        openai_model: document.getElementById('settingOpenAiModel')?.value || 'gpt-4o-mini',
        whisper_model_size: document.getElementById('settingWhisperModel')?.value || 'base',
        enable_dynamic_subtitles: document.getElementById('settingDynamicSubtitles')?.checked ?? true,
        enable_anti_detect: document.getElementById('settingAntiDetect')?.checked ?? true,
        subtitle_style: document.getElementById('settingSubtitleStyle')?.value || 'karaoke_yellow',
        subtitle_position: document.getElementById('settingSubtitlePosition')?.value || 'center',
        subtitle_font_size: subtitleFontSize,
        telegram_bot_token: document.getElementById('settingTelegramToken')?.value || '',
        telegram_chat_id: document.getElementById('settingTelegramChatId')?.value || '',
        gpm_api_base_url: gpmUrl,
        adspower_api_base_url: document.getElementById('settingAdsPowerUrl')?.value.trim() || '',
        dolphin_api_base_url: document.getElementById('settingDolphinUrl')?.value.trim() || '',
        genlogin_api_base_url: document.getElementById('settingGenLoginUrl')?.value.trim() || '',
        app_language: document.getElementById('settingAppLanguage')?.value || 'vi',
        app_theme: document.getElementById('settingAppTheme')?.value || 'dark',
        follower_threshold_tiktok: parseInt(document.getElementById('settingThresholdTiktok')?.value, 10) || followerThresholds.tiktok,
        follower_threshold_youtube: parseInt(document.getElementById('settingThresholdYoutube')?.value, 10) || followerThresholds.youtube,
        follower_threshold_facebook: parseInt(document.getElementById('settingThresholdFacebook')?.value, 10) || followerThresholds.facebook,
    };

    try {
        const res = await fetch('/api/settings/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            await saveSchedulerSettings(null, false);

            followerThresholds.tiktok = payload.follower_threshold_tiktok;
            followerThresholds.youtube = payload.follower_threshold_youtube;
            followerThresholds.facebook = payload.follower_threshold_facebook;
            loadGpmProfiles();

            // Apply selected language and theme immediately and persist to DB
            const savedLang = document.getElementById('settingAppLanguage')?.value;
            const savedTheme = document.getElementById('settingAppTheme')?.value;
            if (savedLang && typeof window.setAppLanguage === 'function') {
                window.setAppLanguage(savedLang, true);
            }
            if (savedTheme && typeof window.setAppTheme === 'function') {
                window.setAppTheme(savedTheme, true);
            }

            // Save cleanup retention policy
            try {
                await fetch('/api/settings/cleanup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ retention_mode: retentionMode, custom_days: customDays })
                });
            } catch (e) {
                console.error('Lỗi lưu cấu hình dọn dẹp:', e);
            }

            if (resultEl) resultEl.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-circle-check"></i> Đã lưu toàn bộ cài đặt & chính sách dọn dẹp! Pool: ${data.pool_size} key</span>`;
            showToast(`✅ Đã lưu cấu hình & cài đặt tự động dọn dẹp thành công!`, 'success');
            await loadApiKeySettings(); // refresh pool status
            loadPipelineStatus();
            loadAiUsageStats();
            if (typeof checkSystemIssuesCount === 'function') checkSystemIssuesCount();
        } else {
            if (resultEl) resultEl.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(data.detail || data.message || 'Lỗi không xác định')}</span>`;
            showToast('Lỗi khi lưu cài đặt: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        if (resultEl) resultEl.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> Lỗi kết nối: ${err.message}</span>`;
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

async function saveThresholdSettingsOnly(btn) {
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }
    const thTiktok = parseInt(document.getElementById('settingThresholdTiktok')?.value, 10) || 10000;
    const thYoutube = parseInt(document.getElementById('settingThresholdYoutube')?.value, 10) || 1000;
    const thFacebook = parseInt(document.getElementById('settingThresholdFacebook')?.value, 10) || 1000;

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
            showToast('✅ Đã lưu cấu hình ngưỡng thông báo thành công!', 'success');
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

// ============================================================
// AI USAGE & COST MANAGEMENT DASHBOARD
// ============================================================
let cachedAiLogs = [];
let aiFilterDate = '7d';
let aiFilterModel = 'all';
let aiSortField = 'created_at';
let aiSortDirection = 'desc';

function isDateInRange(dateStr, rangeKey) {
    if (!dateStr || rangeKey === 'all') return true;
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return true;
    const now = new Date();

    if (rangeKey === 'today') {
        return d.toDateString() === now.toDateString();
    }
    if (rangeKey === '7d') {
        const diffMs = now.getTime() - d.getTime();
        return diffMs >= 0 && diffMs <= 7 * 86400 * 1000;
    }
    if (rangeKey === '14d') {
        const diffMs = now.getTime() - d.getTime();
        return diffMs >= 0 && diffMs <= 14 * 86400 * 1000;
    }
    if (rangeKey === '30d') {
        const diffMs = now.getTime() - d.getTime();
        return diffMs >= 0 && diffMs <= 30 * 86400 * 1000;
    }
    if (rangeKey === 'wtd') {
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diffToMon);
        monday.setHours(0, 0, 0, 0);
        return d >= monday && d <= now;
    }
    if (rangeKey === 'mtd') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        return d >= startOfMonth && d <= now;
    }
    return true;
}

function getFilteredAiLogs() {
    let list = [...cachedAiLogs];

    // 1. Filter Date
    if (aiFilterDate !== 'all') {
        list = list.filter(l => isDateInRange(l.created_at, aiFilterDate));
    }

    // 2. Filter Model
    if (aiFilterModel !== 'all') {
        const target = aiFilterModel.toLowerCase();
        list = list.filter(l => {
            const m = (l.model || '').toLowerCase();
            const p = (l.provider || '').toLowerCase();
            const t = (l.task || '').toLowerCase();
            return m.includes(target) || p.includes(target) || t.includes(target);
        });
    }

    // 3. Sort
    list.sort((a, b) => {
        let res = 0;
        if (aiSortField === 'created_at') {
            res = (a.created_at || '').localeCompare(b.created_at || '');
        } else if (aiSortField === 'total_tokens') {
            res = (a.total_tokens || 0) - (b.total_tokens || 0);
        } else if (aiSortField === 'estimated_cost') {
            res = (a.estimated_cost || 0) - (b.estimated_cost || 0);
        } else if (aiSortField === 'duration_ms') {
            res = (a.duration_ms || 0) - (b.duration_ms || 0);
        } else if (aiSortField === 'model') {
            res = (a.model || '').localeCompare(b.model || '');
        } else if (aiSortField === 'task') {
            res = (a.task || '').localeCompare(b.task || '');
        }
        return aiSortDirection === 'asc' ? res : -res;
    });

    return list;
}

function updateAiHeaderSortIcons() {
    const fields = [
        { id: 'th-ai-created_at', field: 'created_at' },
        { id: 'th-ai-model', field: 'model' },
        { id: 'th-ai-task', field: 'task' },
        { id: 'th-ai-total_tokens', field: 'total_tokens' },
        { id: 'th-ai-estimated_cost', field: 'estimated_cost' },
        { id: 'th-ai-duration_ms', field: 'duration_ms' }
    ];

    fields.forEach(item => {
        const th = document.getElementById(item.id);
        if (!th) return;
        const icon = th.querySelector('.sort-icon');
        if (aiSortField === item.field) {
            th.classList.add('sorted-active');
            if (icon) {
                icon.className = aiSortDirection === 'asc'
                    ? 'fa-solid fa-arrow-up-short-wide sort-icon'
                    : 'fa-solid fa-arrow-down-wide-short sort-icon';
            }
        } else {
            th.classList.remove('sorted-active');
            if (icon) icon.className = 'fa-solid fa-sort sort-icon';
        }
    });

    const icon = document.getElementById('aiSortDirIcon');
    const text = document.getElementById('aiSortDirText');
    if (icon) icon.className = aiSortDirection === 'asc' ? 'fa-solid fa-arrow-up-wide-short' : 'fa-solid fa-arrow-down-wide-short';
    if (text) text.textContent = aiSortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';
}

function handleAiDateFilterChange(val) {
    aiFilterDate = val;
    renderAiLogsTable();
}

function handleAiModelFilterChange(val) {
    aiFilterModel = val;
    renderAiLogsTable();
}

function handleAiSortChange(val) {
    aiSortField = val;
    if (['total_tokens', 'estimated_cost', 'duration_ms', 'created_at'].includes(val)) {
        aiSortDirection = 'desc';
    } else {
        aiSortDirection = 'asc';
    }
    updateAiHeaderSortIcons();
    renderAiLogsTable();
}

function toggleAiSortDirection() {
    aiSortDirection = aiSortDirection === 'asc' ? 'desc' : 'asc';
    updateAiHeaderSortIcons();
    renderAiLogsTable();
}

function handleAiHeaderSort(field) {
    if (aiSortField === field) {
        aiSortDirection = aiSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        aiSortField = field;
        aiSortDirection = (field === 'model' || field === 'task') ? 'asc' : 'desc';
        const sel = document.getElementById('aiSortSelect');
        if (sel) sel.value = field;
    }
    updateAiHeaderSortIcons();
    renderAiLogsTable();
}

function resetAiFilters() {
    aiFilterDate = '7d';
    aiFilterModel = 'all';
    aiSortField = 'created_at';
    aiSortDirection = 'desc';

    const selDate = document.getElementById('aiFilterDateSelect');
    if (selDate) selDate.value = '7d';
    const selModel = document.getElementById('aiFilterModelSelect');
    if (selModel) selModel.value = 'all';
    const selSort = document.getElementById('aiSortSelect');
    if (selSort) selSort.value = 'created_at';

    updateAiHeaderSortIcons();
    renderAiLogsTable();
    showToast('Đã đặt lại toàn bộ bộ lọc nhật ký AI!');
}

async function exportAiUsageLogsCsv() {
    if (!cachedAiLogs || !cachedAiLogs.length) {
        try {
            await loadAiUsageDashboard();
        } catch (e) {
            console.warn('Lỗi tải nhật ký AI trước khi xuất CSV:', e);
        }
    }
    const list = getFilteredAiLogs();
    if (!list || !list.length) {
        showToast('Không có dữ liệu nhật ký AI để xuất CSV!', true);
        return;
    }

    const headers = [
        'ID Nhật Ký',
        'Thời Gian',
        'Nhà Cung Cấp (Provider)',
        'Mô Hình AI (Model)',
        'Tác Vụ (Task)',
        'Mã Video (Video ID)',
        'Tổng Tokens Tiêu Thụ',
        'Prompt Tokens',
        'Completion Tokens',
        'Chi Phí Ước Tính (USD)',
        'Chi Phí Quy Đổi VNĐ (25,400đ)',
        'Thời Gian Xử Lý (ms)',
        'Trạng Thái',
        'Thông Báo Lỗi'
    ];

    const rows = [headers];
    list.forEach(l => {
        const costUsd = Number(l.estimated_cost || 0);
        const costVnd = Math.round(costUsd * 25400);
        rows.push([
            l.id || '',
            l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : '',
            l.provider || '',
            l.model || '',
            l.task || 'general',
            l.video_id || '',
            l.total_tokens || 0,
            l.prompt_tokens || 0,
            l.completion_tokens || 0,
            costUsd.toFixed(6),
            costVnd,
            l.duration_ms || 0,
            l.status === 'success' ? 'Thành công' : 'Lỗi',
            l.error_message || ''
        ]);
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(`nhat_ky_chi_phi_ai_${dateStr}.csv`, rows);
}

function renderAiLogsTable() {
    const list = getFilteredAiLogs();
    const logsCount = document.getElementById('aiLogsCountBadge');
    if (logsCount) {
        if (aiFilterDate !== 'all' || aiFilterModel !== 'all') {
            logsCount.textContent = `${list.length}/${cachedAiLogs.length} sự kiện`;
        } else {
            logsCount.textContent = `${list.length} sự kiện`;
        }
    }

    // Update Header Sort Icons
    updateAiHeaderSortIcons();

    const logsBody = document.getElementById('aiUsageLogsTableBody');
    if (!logsBody) return;

    if (!list.length) {
        const msg = cachedAiLogs.length === 0
            ? 'Chưa có lịch sử gọi AI. Hãy thử render video AI để bắt đầu theo dõi.'
            : 'Không tìm thấy nhật ký AI nào phù hợp với bộ lọc ngày/mô hình đã chọn.';
        logsBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:rgba(255,255,255,0.4);">${msg}</td></tr>`;
        return;
    }

    logsBody.innerHTML = list.map(l => {
        const isSuccess = l.status === 'success';
        const statusBadge = isSuccess
            ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); font-size:11px;">Thành công</span>`
            : `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:11px;" title="${escapeHtml(l.error_message || '')}">Lỗi</span>`;

        const timeStr = l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : '—';
        const pLower = (l.provider || '').toLowerCase();
        const mLower = (l.model || '').toLowerCase();
        const pColor = pLower.includes('deepseek') ? '#0070f3' :
            pLower.includes('gemini') ? '#10b981' :
                pLower.includes('openai') || mLower.includes('dall-e') ? '#10a37f' :
                    pLower.includes('fal') || mLower.includes('ltx') || mLower.includes('wan') ? '#f97316' :
                        pLower.includes('kling') ? '#ec4899' :
                            pLower.includes('flux') || pLower.includes('pollinations') ? '#06b6d4' :
                                pLower.includes('banana') ? '#eab308' :
                                    pLower.includes('imagen') ? '#4285f4' :
                                        pLower.includes('whisper') ? '#a855f7' : '#8b5cf6';

        const provBadge = `<div class="table-text-truncate" style="max-width:180px;" title="${escapeHtml(l.provider)} (${escapeHtml(l.model)})"><span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${pColor}; margin-right:5px;"></span><span style="font-weight:600; color:#fff;">${escapeHtml(l.provider)}</span> <span style="color:var(--text-muted); font-size:11px;">${escapeHtml(l.model)}</span></div>`;

        const taskRaw = l.task || 'general';
        let taskBadge = `<span class="badge badge-secondary" style="font-size:10.5px;">${escapeHtml(taskRaw)}</span>`;
        if (taskRaw === 'video_generation') {
            taskBadge = `<span class="badge" style="background:rgba(249,115,22,0.15); color:#f97316; border:1px solid rgba(249,115,22,0.3); font-size:10.5px;"><i class="fa-solid fa-film"></i> Video AI</span>`;
        } else if (taskRaw === 'image_generation') {
            taskBadge = `<span class="badge" style="background:rgba(6,182,212,0.15); color:#06b6d4; border:1px solid rgba(6,182,212,0.3); font-size:10.5px;"><i class="fa-solid fa-image"></i> Ảnh AI</span>`;
        } else if (taskRaw === 'speech_to_text') {
            taskBadge = `<span class="badge" style="background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid rgba(168,85,247,0.3); font-size:10.5px;"><i class="fa-solid fa-microphone-lines"></i> Whisper</span>`;
        } else if (taskRaw === 'aistory_scenes') {
            taskBadge = `<span class="badge" style="background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); font-size:10.5px;"><i class="fa-solid fa-book-open"></i> Phân Cảnh AI</span>`;
        } else if (taskRaw === 'seed_debate_comment') {
            taskBadge = `<span class="badge" style="background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.3); font-size:10.5px;"><i class="fa-solid fa-comment-dots"></i> Seeding</span>`;
        }

        return `<tr>
            <td style="white-space:nowrap; color:var(--text-muted); font-size:11.5px;">${escapeHtml(timeStr)}</td>
            <td>${provBadge}</td>
            <td>${taskBadge}</td>
            <td><div class="table-text-truncate" style="max-width:120px; font-family:monospace; font-size:11px; color:#38bdf8;" title="${escapeHtml(l.video_id || '')}">${escapeHtml(l.video_id || '—')}</div></td>
            <td style="text-align:right; font-weight:600; color:#c084fc;">${(l.total_tokens || 0).toLocaleString()}</td>
            <td style="text-align:right; font-weight:700; color:#22c55e;">$${(l.estimated_cost || 0).toFixed(4)}</td>
            <td style="text-align:right; color:var(--text-muted); font-size:11px;">${l.duration_ms ? l.duration_ms + 'ms' : '—'}</td>
            <td style="text-align:center;">${statusBadge}</td>
        </tr>`;
    }).join('');
}

async function loadAiUsageStats() {
    try {
        const res = await fetch('/api/ai/usage');
        if (!res.ok) return;
        const data = await res.json();
        const stats = data.stats || {};
        const breakdown = data.model_breakdown || [];
        cachedAiLogs = data.recent_logs || [];

        // 4 Thẻ Summary
        const elTotalCalls = document.getElementById('aiStatTotalCalls');
        if (elTotalCalls) elTotalCalls.textContent = (stats.total_calls || 0).toLocaleString();

        const elTodayCalls = document.getElementById('aiStatTodayCalls');
        if (elTodayCalls) elTodayCalls.textContent = `Hôm nay: ${(stats.today_calls || 0).toLocaleString()} lượt gọi`;

        const elTotalTokens = document.getElementById('aiStatTotalTokens');
        if (elTotalTokens) elTotalTokens.textContent = (stats.total_tokens || 0).toLocaleString();

        const elTodayTokens = document.getElementById('aiStatTodayTokens');
        if (elTodayTokens) elTodayTokens.textContent = `Hôm nay: ${(stats.today_tokens || 0).toLocaleString()} tokens`;

        const elCostUsd = document.getElementById('aiStatTotalCostUsd');
        if (elCostUsd) elCostUsd.textContent = `$${(stats.total_cost_usd || 0).toFixed(4)}`;

        const elCostVnd = document.getElementById('aiStatTotalCostVnd');
        if (elCostVnd) elCostVnd.textContent = `~ ${(stats.total_cost_vnd || 0).toLocaleString()} VNĐ`;

        const elActiveModel = document.getElementById('aiStatActiveModel');
        if (elActiveModel) {
            const prov = (stats.active_provider || 'deepseek').toUpperCase();
            const mod = stats.active_model || 'deepseek-chat';
            elActiveModel.textContent = `${prov} (${mod})`;
        }

        // Bảng Phân Bổ Theo Từng Mô Hình
        const bdBody = document.getElementById('aiModelBreakdownTableBody');
        if (bdBody) {
            if (!breakdown.length) {
                bdBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:18px; color:var(--text-muted);">Chưa có dữ liệu phân bổ. Khi render video AI, hệ thống sẽ tự động tổng hợp.</td></tr>`;
            } else {
                bdBody.innerHTML = breakdown.map(item => {
                    const pLower = (item.provider || '').toLowerCase();
                    const mLower = (item.model || '').toLowerCase();
                    const provColor = pLower.includes('deepseek') ? '#0070f3' :
                        pLower.includes('gemini') ? '#10b981' :
                            pLower.includes('openai') || mLower.includes('dall-e') ? '#10a37f' :
                                pLower.includes('fal') || mLower.includes('ltx') || mLower.includes('wan') ? '#f97316' :
                                    pLower.includes('kling') ? '#ec4899' :
                                        pLower.includes('flux') || pLower.includes('pollinations') ? '#06b6d4' :
                                            pLower.includes('banana') ? '#eab308' :
                                                pLower.includes('imagen') ? '#4285f4' :
                                                    pLower.includes('whisper') ? '#a855f7' : '#8b5cf6';

                    let taskDesc = "Xử lý AI";
                    if (pLower.includes('fal') || pLower.includes('kling') || mLower.includes('ltx') || mLower.includes('wan') || (item.task || '').includes('video')) {
                        taskDesc = "Sinh Video Động Chuyển Cảnh (Video AI)";
                    } else if (pLower.includes('flux') || pLower.includes('banana') || pLower.includes('imagen') || mLower.includes('dall-e') || (item.task || '').includes('image')) {
                        taskDesc = "Sinh Ảnh AI Phân Cảnh (Image AI)";
                    } else if (pLower.includes('whisper') || mLower.includes('whisper') || (item.task || '').includes('speech')) {
                        taskDesc = "Nhận Dạng Âm Thanh & Phụ Đề (STT)";
                    } else {
                        taskDesc = "Phân Tích Hook & Kịch Bản AI Story / Curation";
                    }

                    return `<tr>
                        <td style="font-weight:600;">
                            <div class="table-text-truncate" style="max-width:200px;" title="${escapeHtml(item.provider)} (${escapeHtml(item.model)})">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${provColor}; margin-right:6px;"></span>
                                ${escapeHtml(item.provider)} <span style="color:var(--text-muted); font-size:11px;">(${escapeHtml(item.model)})</span>
                            </div>
                        </td>
                        <td style="color:var(--text-secondary); font-size:11.5px;">${escapeHtml(taskDesc)}</td>
                        <td style="text-align:right; font-weight:700;">${(item.calls || 0).toLocaleString()}</td>
                        <td style="text-align:right; color:#a855f7;">${(item.total_tokens || 0).toLocaleString()}</td>
                        <td style="text-align:right; color:var(--text-muted);">${item.avg_duration_ms ? (item.avg_duration_ms / 1000).toFixed(2) + 's' : '—'}</td>
                        <td style="text-align:right; font-weight:700; color:#22c55e;">$${(item.cost_usd || 0).toFixed(4)}</td>
                        <td style="text-align:right; color:#22c55e;">~ ${(item.cost_vnd || 0).toLocaleString()}đ</td>
                    </tr>`;
                }).join('');
            }
        }

        // Bảng Nhật Ký Lượt Gọi Gần Nhất (áp dụng filter và sort)
        renderAiLogsTable();
    } catch (e) {
        console.error('Lỗi nạp thống kê AI usage:', e);
    }
}

async function clearAiUsageStats() {
    const ok = await showConfirmDialog({
        title: 'Làm Sạch Lịch Sử AI',
        message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử và nhật ký gọi AI?',
        details: 'Số liệu thống kê token và chi phí sẽ được đặt lại về 0.',
        confirmText: 'Xóa Lịch Sử',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;
    try {
        const res = await fetch('/api/ai/usage/clear', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            showToast('✅ Đã xóa sạch lịch sử và đặt lại thống kê AI!');
            await loadAiUsageStats();
        } else {
            showToast('Lỗi xóa lịch sử AI: ' + (data.message || 'Không xác định'), true);
        }
    } catch (e) {
        showToast('Lỗi kết nối khi xóa: ' + e.message, true);
    }
}

async function triggerManualCleanup(btn) {
    const original = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Dọn Dẹp...';
    }
    const statusEl = document.getElementById('manualCleanupStatus');
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra file đã đăng...';

    try {
        const selRadio = document.querySelector('input[name="cleanupRetentionMode"]:checked');
        const retentionMode = selRadio ? selRadio.value : null;
        const customDays = parseInt(document.getElementById('inputCleanupCustomDays')?.value) || null;

        const res = await fetch('/api/pipeline/cleanup-uploaded', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: retentionMode, custom_days: customDays })
        });
        const data = await res.json();

        if (data.status === 'success') {
            const msg = data.files_deleted > 0
                ? `Đã giải phóng ${data.mb_freed} MB (${data.files_deleted} file mp4) từ ${data.cleaned_videos} video đã đăng!`
                : `Không có file video nào cần dọn dẹp (tất cả video đã đăng đều nằm trong thời hạn lưu trữ hoặc đã được dọn).`;

            if (statusEl) {
                statusEl.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(msg)}</span>`;
            }
            showToast(data.files_deleted > 0 ? `🧹 ${msg}` : msg, data.files_deleted > 0 ? 'success' : 'info');
            loadPipelineStatus();
        } else {
            if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(data.message || 'Lỗi dọn dẹp')}</span>`;
            showToast('Lỗi dọn dẹp: ' + (data.message || 'Thất bại'), 'error');
        }
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444;">Lỗi kết nối: ${err.message}</span>`;
        showToast('Lỗi kết nối dọn dẹp: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

async function testYoutubeKey(btn) {
    const rawKeys = document.getElementById('settingYoutubeKeys')?.value || '';
    const firstKey = rawKeys.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean)[0];
    if (!firstKey) {
        showToast('⚠️ Chưa nhập API Key nào để test.', 'warning');
        return;
    }
    const resultEl = document.getElementById('testKeyResult');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Test...';
    if (resultEl) resultEl.innerHTML = '';

    try {
        const res = await fetch('/api/settings/test-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: firstKey }),
        });
        const data = await res.json();
        if (data.valid) {
            if (resultEl) resultEl.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(data.message)}</span>`;
        } else {
            if (resultEl) resultEl.innerHTML = `<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(data.message)}</span>`;
        }
    } catch (err) {
        if (resultEl) resultEl.innerHTML = `<span style="color:#f87171;">Lỗi: ${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}



// ============================================================
// ADVANCED SCHEDULER & AUTO-SCAN SETTINGS
// ============================================================
function openSchedulerSettingsModal() {
    loadSchedulerSettings();
    loadDownloadFilterSettings();
    const modal = document.getElementById('schedulerSettingsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeSchedulerSettingsModal() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const modal = document.getElementById('schedulerSettingsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// Backdrop click close for schedulerSettingsModal
document.addEventListener('DOMContentLoaded', () => {
    const schedModal = document.getElementById('schedulerSettingsModal');
    if (schedModal) {
        schedModal.addEventListener('click', (e) => {
            if (e.target === schedModal) {
                closeSchedulerSettingsModal();
            }
        });
    }
});

function updateModalIntervalBadge(val) {
    const badge = document.getElementById('modalIntervalBadge');
    if (badge) {
        const num = parseInt(val) || 15;
        badge.textContent = `${num} phút/lần`;
    }
}

function setSchedulerPreset(minutes, isModal) {
    if (isModal) {
        const inp = document.getElementById('modalSchedulerInterval');
        if (inp) {
            inp.value = minutes;
            updateModalIntervalBadge(minutes);
        }
    } else {
        const inp = document.getElementById('settingSchedulerInterval');
        if (inp) inp.value = minutes;
    }
}

function updateModalParallelUploadsBadge(val) {
    const badge = document.getElementById('modalParallelUploadsBadge');
    if (!badge) return;
    const num = parseInt(val, 10) || 1;
    let text = '';
    if (num === 1) text = '1 Luồng (8GB RAM)';
    else if (num === 2) text = '2 Luồng (16GB RAM)';
    else if (num === 3) text = '3 Luồng (32GB RAM)';
    else text = `${num} Luồng (Farm Pro)`;
    badge.textContent = text;
    if (window.i18n && typeof window.i18n.translateElement === 'function') {
        window.i18n.translateElement(badge);
    }
}

function setParallelUploadsPreset(count) {
    const num = Math.max(1, Math.min(6, parseInt(count, 10) || 1));
    const inp = document.getElementById('modalMaxParallelUploads');
    if (inp) {
        inp.value = num;
    }
    updateModalParallelUploadsBadge(num);
    [1, 2, 3, 4].forEach(n => {
        const btn = document.getElementById(`btnParallelPreset${n}`);
        if (btn) {
            const isActive = (n === num) || (n === 4 && num >= 4);
            btn.classList.toggle('btn-primary', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        }
    });
}

async function loadSchedulerSettings() {
    try {
        const res = await fetch('/api/settings/scheduler');
        if (!res.ok) return;
        const data = await res.json();
        const interval = data.interval_minutes || 15;
        const uploadSec = data.upload_interval_seconds || 60;
        const maxVids = data.max_videos_per_scan || 5;
        const delaySec = data.channel_delay_seconds !== undefined ? data.channel_delay_seconds : 2;
        const autoDl = data.auto_download !== undefined ? data.auto_download : true;
        const autoRd = data.auto_render !== undefined ? data.auto_render : true;
        const saveByFolder = data.save_by_channel_folder !== undefined ? data.save_by_channel_folder : false;
        const autoRetry = data.auto_retry_enabled !== undefined ? data.auto_retry_enabled : true;
        const maxRetries = data.max_retries || 2;
        const retryDelay = data.retry_delay_minutes || 15;
        const watchdog = data.watchdog_enabled !== undefined ? data.watchdog_enabled : true;
        const stuckTimeout = data.stuck_timeout_minutes || 15;
        const minCooldown = data.min_account_cooldown_minutes || 60;

        // Populate Modal Fields
        const mInterval = document.getElementById('modalSchedulerInterval');
        if (mInterval) {
            mInterval.value = interval;
            updateModalIntervalBadge(interval);
        }
        const mUpload = document.getElementById('modalUploadInterval');
        if (mUpload) mUpload.value = uploadSec;
        const mMax = document.getElementById('modalMaxVideosPerScan');
        if (mMax) mMax.value = maxVids;
        const mDelay = document.getElementById('modalChannelDelay');
        if (mDelay) mDelay.value = delaySec;
        const mMinCooldown = document.getElementById('modalMinAccountCooldown');
        if (mMinCooldown) mMinCooldown.value = minCooldown;
        const mAutoDl = document.getElementById('modalAutoDownloadToggle');
        if (mAutoDl) mAutoDl.checked = autoDl;
        const mAutoRd = document.getElementById('modalAutoRenderToggle');
        if (mAutoRd) mAutoRd.checked = autoRd;
        const mSaveByFolder = document.getElementById('modalSaveByChannelFolderToggle');
        if (mSaveByFolder) mSaveByFolder.checked = saveByFolder;
        const mAutoRetry = document.getElementById('modalAutoRetryToggle');
        if (mAutoRetry) mAutoRetry.checked = autoRetry;
        const mMaxRetries = document.getElementById('modalMaxRetries');
        if (mMaxRetries) mMaxRetries.value = maxRetries;
        const mRetryDelay = document.getElementById('modalRetryDelay');
        if (mRetryDelay) mRetryDelay.value = retryDelay;
        const mWatchdog = document.getElementById('modalWatchdogToggle');
        if (mWatchdog) mWatchdog.checked = watchdog;
        const mStuckTimeout = document.getElementById('modalStuckTimeout');
        if (mStuckTimeout) mStuckTimeout.value = stuckTimeout;

        // Concurrent Upload Workers
        const maxParallel = data.max_parallel_uploads !== undefined ? data.max_parallel_uploads : 1;
        setParallelUploadsPreset(maxParallel);

        // Populate Settings Tab Fields
        const sInterval = document.getElementById('settingSchedulerInterval');
        if (sInterval) sInterval.value = interval;
        const sUpload = document.getElementById('settingUploadInterval');
        if (sUpload) sUpload.value = uploadSec;
        const sMax = document.getElementById('settingMaxVideosPerScan');
        if (sMax) sMax.value = maxVids;
        const sDelay = document.getElementById('settingChannelDelay');
        if (sDelay) sDelay.value = delaySec;
        const sMinCooldown = document.getElementById('settingMinAccountCooldown');
        if (sMinCooldown) sMinCooldown.value = minCooldown;
        const sAutoDl = document.getElementById('settingAutoDownloadToggle');
        if (sAutoDl) sAutoDl.checked = autoDl;
        const sAutoRd = document.getElementById('settingAutoRenderToggle');
        if (sAutoRd) sAutoRd.checked = autoRd;
        const sSaveByFolder = document.getElementById('settingSaveByChannelFolderToggle');
        if (sSaveByFolder) sSaveByFolder.checked = saveByFolder;
    } catch (err) {
        console.error('loadSchedulerSettings error:', err);
    }
}

async function saveSchedulerSettings(btn, fromModal = true) {
    const original = btn ? btn.innerHTML : '';

    let intervalInput, uploadInput, maxVidsInput, delayInput, autoDl, autoRd, saveByFolder;
    let autoRetry = true, maxRetries = 2, retryDelay = 15, watchdog = true, stuckTimeout = 15, minAccountCooldown = 60, maxParallelUploads = 1;

    if (fromModal) {
        intervalInput = document.getElementById('modalSchedulerInterval');
        uploadInput = document.getElementById('modalUploadInterval');
        maxVidsInput = document.getElementById('modalMaxVideosPerScan');
        delayInput = document.getElementById('modalChannelDelay');
        autoDl = document.getElementById('modalAutoDownloadToggle')?.checked ?? true;
        autoRd = document.getElementById('modalAutoRenderToggle')?.checked ?? true;
        saveByFolder = document.getElementById('modalSaveByChannelFolderToggle')?.checked ?? false;
        autoRetry = document.getElementById('modalAutoRetryToggle')?.checked ?? true;
        maxRetries = parseInt(document.getElementById('modalMaxRetries')?.value, 10) || 2;
        retryDelay = parseInt(document.getElementById('modalRetryDelay')?.value, 10) || 15;
        watchdog = document.getElementById('modalWatchdogToggle')?.checked ?? true;
        stuckTimeout = parseInt(document.getElementById('modalStuckTimeout')?.value, 10) || 15;
        minAccountCooldown = parseInt(document.getElementById('modalMinAccountCooldown')?.value, 10) || 60;
        maxParallelUploads = Math.max(1, Math.min(6, parseInt(document.getElementById('modalMaxParallelUploads')?.value || 1, 10)));
    } else {
        intervalInput = document.getElementById('settingSchedulerInterval');
        uploadInput = document.getElementById('settingUploadInterval');
        maxVidsInput = document.getElementById('settingMaxVideosPerScan');
        delayInput = document.getElementById('settingChannelDelay');
        autoDl = document.getElementById('settingAutoDownloadToggle')?.checked ?? true;
        autoRd = document.getElementById('settingAutoRenderToggle')?.checked ?? true;
        saveByFolder = document.getElementById('settingSaveByChannelFolderToggle')?.checked ?? false;
        autoRetry = document.getElementById('modalAutoRetryToggle')?.checked ?? true;
        maxRetries = parseInt(document.getElementById('modalMaxRetries')?.value, 10) || 2;
        retryDelay = parseInt(document.getElementById('modalRetryDelay')?.value, 10) || 15;
        watchdog = document.getElementById('modalWatchdogToggle')?.checked ?? true;
        stuckTimeout = parseInt(document.getElementById('modalStuckTimeout')?.value, 10) || 15;
        minAccountCooldown = parseInt(document.getElementById('settingMinAccountCooldown')?.value, 10) || 60;
    }

    const interval = parseInt(intervalInput?.value, 10);
    const uploadSec = parseInt(uploadInput?.value, 10);
    const maxVids = parseInt(maxVidsInput?.value, 10);
    const delaySec = parseInt(delayInput?.value, 10);

    if (isNaN(interval) || interval < 1 || interval > 1440) {
        markInputError(intervalInput, 'Chu kỳ quét ngầm phải từ 1 đến 1440 phút (tối đa 24 giờ)!');
        return;
    }
    if (isNaN(uploadSec) || uploadSec < 10 || uploadSec > 86400) {
        markInputError(uploadInput, 'Khoảng cách giữa các lần đăng phải từ 10 đến 86400 giây!');
        return;
    }
    if (isNaN(maxVids) || maxVids < 1 || maxVids > 50) {
        markInputError(maxVidsInput, 'Số video quét tối đa mỗi lần phải từ 1 đến 50!');
        return;
    }
    if (isNaN(delaySec) || delaySec < 0 || delaySec > 3600) {
        markInputError(delayInput, 'Độ trễ giữa các kênh phải từ 0 đến 3600 giây!');
        return;
    }
    if (isNaN(minAccountCooldown) || minAccountCooldown < 15 || minAccountCooldown > 1440) {
        showToast('Giãn cách an toàn giữa 2 lần đăng cùng nick phải từ 15 đến 1440 phút!', 'error');
        return;
    }

    if (fromModal) {
        const filterSaved = await saveDownloadFilterSettings(true);
        if (!filterSaved) {
            return;
        }
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...';
    }

    const payload = {
        interval_minutes: interval,
        upload_interval_seconds: uploadSec,
        max_videos_per_scan: maxVids,
        channel_delay_seconds: delaySec,
        auto_download: autoDl,
        auto_render: autoRd,
        save_by_channel_folder: saveByFolder,
        auto_retry_enabled: autoRetry,
        max_retries: maxRetries,
        retry_delay_minutes: retryDelay,
        watchdog_enabled: watchdog,
        stuck_timeout_minutes: stuckTimeout,
        min_account_cooldown_minutes: minAccountCooldown,
        max_parallel_uploads: maxParallelUploads
    };

    try {
        const res = await fetch('/api/settings/scheduler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã lưu cấu hình tự động quét thành công!'}`, 'success');
            if (fromModal) {
                closeSchedulerSettingsModal();
            }
            // Sync values to both modal and tab
            await loadSchedulerSettings();
            // Refresh pipeline banner status immediately
            loadPipelineStatus();
        } else {
            showToast('Lỗi khi lưu cấu hình scheduler: ' + (data.detail || data.message || 'Không xác định'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }
}

// ============================================================
// TELEGRAM ALERT CHANNELS MANAGEMENT
// ============================================================

async function loadTelegramChannels() {
    const listEl = document.getElementById('telegramChannelsList');
    const badgeEl = document.getElementById('teleActiveBadge');
    const countTextEl = document.getElementById('teleActiveCountText');
    const totalCountEl = document.getElementById('teleChannelsTotalCount');

    try {
        const res = await fetch('/api/telegram/channels');
        if (!res.ok) throw new Error('Không thể tải danh sách kênh');
        const data = await res.json();
        const channels = data.channels || [];
        const activeCount = channels.filter(c => c.is_active).length;

        if (totalCountEl) totalCountEl.textContent = channels.length;
        if (countTextEl) countTextEl.textContent = `${activeCount} Kênh Đang Bật`;
        if (badgeEl) {
            if (activeCount > 0) {
                badgeEl.style.background = 'rgba(16,185,129,0.15)';
                badgeEl.style.color = '#10b981';
                badgeEl.style.borderColor = 'rgba(16,185,129,0.3)';
            } else {
                badgeEl.style.background = 'rgba(239,68,68,0.15)';
                badgeEl.style.color = '#ef4444';
                badgeEl.style.borderColor = 'rgba(239,68,68,0.3)';
            }
        }

        if (!listEl) return;

        if (channels.length === 0) {
            listEl.innerHTML = `
                <div style="background:rgba(255,255,255,0.02); border:1px dashed var(--border-color); border-radius:var(--radius-md); padding:28px 20px; text-align:center;">
                    <div style="font-size:32px; color:#2AABEE; margin-bottom:8px;"><i class="fa-brands fa-telegram"></i></div>
                    <div style="font-weight:700; font-size:14px; margin-bottom:4px; color:var(--text-primary);">Chưa có kênh Telegram nào</div>
                    <div style="font-size:12px; color:var(--text-muted); max-width:440px; margin:0 auto 16px auto;">
                        Thêm ít nhất một kênh hoặc nhóm Telegram để hệ thống tự động gửi thông báo khi tài khoản TikTok đạt mốc 10.000 Follower.
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" onclick="openAddTelegramChannelModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Kênh Đầu Tiên
                    </button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = channels.map(ch => {
            const isActive = !!ch.is_active;
            const statusLabel = isActive ? 'Đang Bật' : 'Đã Tắt';
            const statusColor = isActive ? '#10b981' : 'var(--text-muted)';
            const escapedName = escapeHtml(ch.name);
            const escapedChatId = escapeHtml(ch.chat_id);
            const chJsonStr = JSON.stringify(ch).replace(/"/g, '&quot;');

            let typeBadges = [];
            if (ch.notify_10k !== 0) {
                typeBadges.push(`<span class="tele-type-badge tele-type-10k" title="Nhận cảnh báo khi nick đạt 10.000 Follower"><i class="fa-solid fa-star"></i> 10K Follower</span>`);
            }
            if (ch.notify_issues !== 0) {
                typeBadges.push(`<span class="tele-type-badge tele-type-issues" title="Nhận cảnh báo lỗi nghiêm trọng & cách khắc phục"><i class="fa-solid fa-triangle-exclamation"></i> Báo Lỗi</span>`);
            }
            if (ch.notify_daily_report !== 0) {
                const rTime = ch.daily_report_time || '21:00';
                typeBadges.push(`<span class="tele-type-badge tele-type-report" title="Nhận báo cáo hoạt động tổng kết hàng ngày lúc ${rTime}"><i class="fa-solid fa-chart-pie"></i> Báo Cáo (${rTime})</span>`);
            }
            if (typeBadges.length === 0) {
                typeBadges.push(`<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); font-size:10px;">Chưa chọn loại tin</span>`);
            }

            return `
                <div class="tele-channel-card ${isActive ? '' : 'inactive'}" id="teleChannelRow_${ch.id}">
                    <div class="tele-channel-info">
                        <label class="tele-toggle-switch" title="${isActive ? 'Nhấn để Tắt kênh này' : 'Nhấn để Bật kênh này'}">
                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleTelegramChannel(${ch.id}, this)">
                            <span class="tele-toggle-slider"></span>
                        </label>
                        <div class="tele-channel-icon">
                            <i class="fa-solid fa-tower-broadcast"></i>
                        </div>
                        <div class="tele-channel-details">
                            <div class="tele-channel-title">
                                <span>${escapedName}</span>
                                <span style="font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:12px; background:${isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}; color:${statusColor};">
                                    ${statusLabel}
                                </span>
                            </div>
                            <div class="tele-channel-meta">
                                <span><i class="fa-solid fa-id-badge" style="color:var(--text-muted);"></i> Chat ID: <code class="tele-chat-id-badge">${escapedChatId}</code></span>
                                <div style="display:inline-flex; gap:5px; flex-wrap:wrap; margin-left:4px;">
                                    ${typeBadges.join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tele-channel-actions">
                        <div class="tele-dropdown-wrap dropdown" style="display:inline-flex; align-items:center; position:relative;">
                            <button type="button" class="btn btn-secondary btn-xs" id="btnTestTele_${ch.id}" onclick="toggleChannelTestMenu(${ch.id}, event)" title="Menu kiểm tra gửi tin tới kênh này">
                                <i class="fa-solid fa-paper-plane"></i> Test <i class="fa-solid fa-caret-down" style="font-size:9px;"></i>
                            </button>
                            <div id="teleTestMenu_${ch.id}" class="tele-test-dropdown" onclick="event.stopPropagation()">
                                <button type="button" class="tele-test-dropdown-item" onclick="testTelegramChannelMode(${ch.id}, 'connection', event)">
                                    <i class="fa-solid fa-plug text-cyan"></i> <span>Test Kết Nối</span>
                                </button>
                                <button type="button" class="tele-test-dropdown-item" onclick="testTelegramChannelMode(${ch.id}, '10k', event)">
                                    <i class="fa-solid fa-star" style="color:#2AABEE;"></i> <span>Test Cảnh Báo 10K</span>
                                </button>
                                <button type="button" class="tele-test-dropdown-item" onclick="testTelegramChannelMode(${ch.id}, 'issue', event)">
                                    <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> <span>Test Báo Lỗi + Fix</span>
                                </button>
                                <button type="button" class="tele-test-dropdown-item" onclick="testTelegramChannelMode(${ch.id}, 'daily_report', event)">
                                    <i class="fa-solid fa-chart-pie" style="color:#10b981;"></i> <span>Test Báo Cáo Ngày</span>
                                </button>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-xs has-tooltip tooltip-left"
                            onclick="openEditTelegramChannelModal(${chJsonStr})"
                            data-tooltip="Chỉnh sửa thông tin và loại tin nhận">
                            <i class="fa-solid fa-pen"></i> Sửa
                        </button>
                        <button type="button" class="btn btn-danger btn-xs has-tooltip tooltip-left"
                            onclick="deleteTelegramChannel(${ch.id}, '${escapedName}')"
                            data-tooltip="Xóa kênh này khỏi danh sách">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('loadTelegramChannels error:', err);
        if (listEl) {
            listEl.innerHTML = `<div style="color:#ef4444; font-size:12px; padding:12px;"><i class="fa-solid fa-circle-exclamation"></i> Lỗi nạp danh sách kênh Telegram: ${err.message}</div>`;
        }
    }
}

function toggleDailyTimeRow(checked) {
    const row = document.getElementById('teleDailyTimeRow');
    if (row) {
        row.style.display = checked ? 'flex' : 'none';
    }
}

function toggleChannelTestMenu(channelId, e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const currentMenu = document.getElementById(`teleTestMenu_${channelId}`);
    const isShown = currentMenu && currentMenu.classList.contains('show');

    // Đóng tất cả menu test khác
    document.querySelectorAll('.tele-test-dropdown').forEach(el => {
        el.classList.remove('show');
    });

    if (currentMenu && !isShown) {
        currentMenu.classList.add('show');
    }
}

// Lắng nghe click bên ngoài để đóng test menu
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.tele-test-dropdown').forEach(el => {
            el.classList.remove('show');
        });
    }
});

async function toggleTelegramChannel(channelId, checkboxEl) {
    try {
        const res = await fetch(`/api/telegram/channels/${channelId}/toggle`, { method: 'PATCH' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(data.message || 'Đã cập nhật trạng thái kênh', 'success');
            await loadTelegramChannels();
        } else {
            showToast('Lỗi cập nhật: ' + (data.detail || data.message || 'Thất bại'), true);
            if (checkboxEl) checkboxEl.checked = !checkboxEl.checked;
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
        if (checkboxEl) checkboxEl.checked = !checkboxEl.checked;
    }
}

function openAddTelegramChannelModal() {
    const idEl = document.getElementById('teleModalChannelId');
    const nameEl = document.getElementById('teleModalName');
    const chatEl = document.getElementById('teleModalChatId');
    const activeEl = document.getElementById('teleModalActive');
    const titleEl = document.getElementById('teleModalTitle');

    const n10k = document.getElementById('teleModalNotify10k');
    const nIssues = document.getElementById('teleModalNotifyIssues');
    const nDaily = document.getElementById('teleModalNotifyDailyReport');
    const rTime = document.getElementById('teleModalReportTime');

    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (chatEl) chatEl.value = '';
    if (activeEl) activeEl.checked = true;
    const iconEl = document.getElementById('teleModalIcon');
    if (iconEl) iconEl.innerHTML = '<i class="fa-brands fa-telegram"></i>';
    if (titleEl) titleEl.textContent = 'Thêm Kênh Telegram Mới';

    if (n10k) n10k.checked = true;
    if (nIssues) nIssues.checked = true;
    if (nDaily) nDaily.checked = true;
    if (rTime) rTime.value = '21:00';
    toggleDailyTimeRow(true);

    const modal = document.getElementById('telegramChannelModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        if (nameEl) setTimeout(() => nameEl.focus(), 50);
    }
}

function openEditTelegramChannelModal(channel) {
    if (!channel) return;
    const idEl = document.getElementById('teleModalChannelId');
    const nameEl = document.getElementById('teleModalName');
    const chatEl = document.getElementById('teleModalChatId');
    const activeEl = document.getElementById('teleModalActive');
    const titleEl = document.getElementById('teleModalTitle');

    const n10k = document.getElementById('teleModalNotify10k');
    const nIssues = document.getElementById('teleModalNotifyIssues');
    const nDaily = document.getElementById('teleModalNotifyDailyReport');
    const rTime = document.getElementById('teleModalReportTime');

    if (idEl) idEl.value = channel.id || '';
    if (nameEl) nameEl.value = channel.name || '';
    if (chatEl) chatEl.value = channel.chat_id || '';
    if (activeEl) activeEl.checked = (channel.is_active !== 0 && channel.is_active !== false);
    const iconEl = document.getElementById('teleModalIcon');
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    if (titleEl) titleEl.textContent = 'Chỉnh Sửa Kênh Telegram';

    if (n10k) n10k.checked = channel.notify_10k !== 0;
    if (nIssues) nIssues.checked = channel.notify_issues !== 0;
    if (nDaily) nDaily.checked = channel.notify_daily_report !== 0;
    if (rTime) rTime.value = channel.daily_report_time || '21:00';
    toggleDailyTimeRow(channel.notify_daily_report !== 0);

    const modal = document.getElementById('telegramChannelModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        if (nameEl) setTimeout(() => nameEl.focus(), 50);
    }
}

function closeTelegramChannelModal() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    const modal = document.getElementById('telegramChannelModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

async function saveTelegramChannelModal(btn) {
    const id = document.getElementById('teleModalChannelId')?.value;
    const name = (document.getElementById('teleModalName')?.value || '').trim();
    const chatId = (document.getElementById('teleModalChatId')?.value || '').trim();
    const isActive = !!document.getElementById('teleModalActive')?.checked;

    const notify10k = !!document.getElementById('teleModalNotify10k')?.checked;
    const notifyIssues = !!document.getElementById('teleModalNotifyIssues')?.checked;
    const notifyDaily = !!document.getElementById('teleModalNotifyDailyReport')?.checked;
    const reportTime = (document.getElementById('teleModalReportTime')?.value || '21:00').trim();

    if (!name) {
        markInputError('teleModalName', 'Vui lòng nhập tên gợi nhớ cho kênh Telegram!');
        return;
    }
    if (!chatId) {
        markInputError('teleModalChatId', 'Vui lòng nhập Chat ID hoặc Channel ID Telegram (Ví dụ: -100xxxxxxxxxx)!');
        return;
    }
    if (notifyDaily && reportTime && !isValidTimeHHMM(reportTime)) {
        markInputError('teleModalReportTime', `Khung giờ báo cáo "${reportTime}" không hợp lệ! Định dạng chuẩn: HH:MM (00:00 - 23:59)`);
        return;
    }

    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    }

    const payload = {
        name: name,
        chat_id: chatId,
        is_active: isActive,
        notify_10k: notify10k,
        notify_issues: notifyIssues,
        notify_daily_report: notifyDaily,
        daily_report_time: reportTime
    };

    try {
        let res;
        if (id) {
            res = await fetch(`/api/telegram/channels/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch('/api/telegram/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Lưu kênh Telegram thành công!'}`, 'success');
            closeTelegramChannelModal();
            await loadTelegramChannels();
        } else {
            showToast('Lỗi lưu kênh: ' + (data.detail || data.message || 'Thất bại'), 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function deleteTelegramChannel(channelId, channelName) {
    const ok = await showConfirmDialog({
        title: 'Xóa Kênh Telegram',
        message: `Bạn có chắc chắn muốn xóa kênh Telegram "${channelName}" khỏi danh sách nhận thông báo?`,
        confirmText: 'Xóa Kênh',
        confirmClass: 'btn-danger'
    });
    if (!ok) return;

    try {
        const res = await fetch(`/api/telegram/channels/${channelId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message || 'Đã xóa kênh Telegram!'}`, 'success');
            await loadTelegramChannels();
        } else {
            showToast('Lỗi khi xóa: ' + (data.detail || data.message || 'Thất bại'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    }
}

async function testTelegramChannelMode(channelId, mode, e) {
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    // Đóng dropdown menu
    const menu = document.getElementById(`teleTestMenu_${channelId}`);
    if (menu) menu.classList.remove('show');

    const parentBtn = document.getElementById(`btnTestTele_${channelId}`);
    const originalHtml = parentBtn ? parentBtn.innerHTML : '';
    if (parentBtn) {
        parentBtn.disabled = true;
        parentBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    const modeLabels = {
        'connection': 'kết nối',
        '10k': 'cảnh báo 10K',
        'issue': 'báo lỗi & cách sửa',
        'daily_report': 'báo cáo ngày'
    };
    showToast(`Đang gửi tin nhắn thử nghiệm (${modeLabels[mode] || mode}) tới kênh...`);

    try {
        const res = await fetch(`/api/telegram/channels/${channelId}/test?mode=${mode}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            showToast(`✅ ${data.message}`, 'success');
        } else {
            showToast('❌ ' + (data.detail || data.message || 'Lỗi gửi tin nhắn test'), true);
        }
    } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, true);
    } finally {
        if (parentBtn) {
            parentBtn.disabled = false;
            parentBtn.innerHTML = originalHtml;
        }
    }
}

async function testTelegramChannel(channelId, btn) {
    return testTelegramChannelMode(channelId, 'connection', btn);
}

function togglePasswordVisibility(inputId, triggerEl, label = 'Token') {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (triggerEl) triggerEl.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Ẩn ${label}`;
    } else {
        input.type = 'password';
        if (triggerEl) triggerEl.innerHTML = `<i class="fa-solid fa-eye"></i> Hiện ${label}`;
    }
}

// Backdrop click close for modals
document.addEventListener('DOMContentLoaded', () => {
    const teleModal = document.getElementById('telegramChannelModal');
    if (teleModal) {
        teleModal.addEventListener('click', (e) => {
            if (e.target === teleModal) {
                closeTelegramChannelModal();
            }
        });
    }

    const issuesModal = document.getElementById('modalSystemIssues');
    if (issuesModal) {
        issuesModal.addEventListener('click', (e) => {
            if (e.target === issuesModal) {
                closeSystemIssuesModal();
            }
        });
    }

    const diagModal = document.getElementById('modalDiagnostics');
    if (diagModal) {
        diagModal.addEventListener('click', (e) => {
            if (e.target === diagModal) {
                closeDiagnosticsModal();
            }
        });
    }
});


// Module Window Exposures
window.clearAiUsageStats = clearAiUsageStats;
window.closeSchedulerSettingsModal = closeSchedulerSettingsModal;
window.closeTelegramChannelModal = closeTelegramChannelModal;
window.deleteTelegramChannel = deleteTelegramChannel;
window.exportAiUsageLogsCsv = exportAiUsageLogsCsv;
window.handleAiDateFilterChange = handleAiDateFilterChange;
window.handleAiHeaderSort = handleAiHeaderSort;
window.handleAiModelFilterChange = handleAiModelFilterChange;
window.handleAiSortChange = handleAiSortChange;
window.loadAiUsageStats = loadAiUsageStats;
window.loadApiKeySettings = loadApiKeySettings;
window.loadDownloadFilterSettings = loadDownloadFilterSettings;
window.loadTelegramChannels = loadTelegramChannels;
window.onToggleFormatCheckbox = onToggleFormatCheckbox;
window.onToggleIncludeLongform = onToggleIncludeLongform;
window.openAddTelegramChannelModal = openAddTelegramChannelModal;
window.openEditTelegramChannelModal = openEditTelegramChannelModal;
window.openSchedulerSettingsModal = openSchedulerSettingsModal;
window.renderKeyPoolTable = renderKeyPoolTable;
window.resetAiFilters = resetAiFilters;
window.saveApiKeySettings = saveApiKeySettings;
window.saveDownloadFilterSettings = saveDownloadFilterSettings;
window.saveSchedulerSettings = saveSchedulerSettings;
window.saveTelegramChannelModal = saveTelegramChannelModal;
window.saveThresholdSettingsOnly = saveThresholdSettingsOnly;
window.setParallelUploadsPreset = setParallelUploadsPreset;
window.setSchedulerPreset = setSchedulerPreset;
window.testTelegramChannel = testTelegramChannel;
window.testTelegramChannelMode = testTelegramChannelMode;
window.testYoutubeKey = testYoutubeKey;
window.toggleAiSortDirection = toggleAiSortDirection;
window.toggleAiStoryCard = toggleAiStoryCard;
window.toggleAutostartSetting = toggleAutostartSetting;
window.toggleCampaignAutoUpload = toggleCampaignAutoUpload;
window.toggleChannelTestMenu = toggleChannelTestMenu;
window.toggleDailyTimeRow = toggleDailyTimeRow;
window.toggleMinimizeToTraySetting = toggleMinimizeToTraySetting;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleTelegramChannel = toggleTelegramChannel;
window.triggerManualCleanup = triggerManualCleanup;
window.updateModalIntervalBadge = updateModalIntervalBadge;
window.updateModalParallelUploadsBadge = updateModalParallelUploadsBadge;
window.validateMinDurationInput = validateMinDurationInput;
