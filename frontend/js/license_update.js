/**
 * ShortsStack - License & Auto-Update Client Controller
 * Quản lý kích hoạt bản quyền HWID, gói máy tính (1/3/5 PCs) và kiểm tra cập nhật phiên bản.
 */

window.LicenseManager = {
    currentInfo: null,
    updateInfo: null,

    init: function () {
        this.fetchStatus();
        this.checkForUpdates(false); // Check ngầm khi mở app

        // Lắng nghe phím ESC để đóng mọi modal mở
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    },

    fetchStatus: async function () {
        try {
            const res = await fetch('/api/license/status');
            if (!res.ok) return;
            const data = await res.json();
            this.currentInfo = data;
            this.renderUI(data);
            return data;
        } catch (e) {
            console.warn('[LICENSE] Không thể lấy trạng thái bản quyền:', e);
            return null;
        }
    },

    syncLicense: async function (btnElement) {
        const origHtml = btnElement ? btnElement.innerHTML : '';
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...';
        }

        try {
            const res = await fetch('/api/license/verify', { method: 'POST' });
            const data = await res.json();
            const refreshed = await this.fetchStatus();

            if (data.valid) {
                const planName = (refreshed && refreshed.plan_display) ? refreshed.plan_display : 'Bản Quyền Hợp Lệ';
                const expiry = (refreshed && refreshed.expires_display) ? refreshed.expires_display : '';
                const msg = `Đã đồng bộ trạng thái bản quyền! Gói: ${planName}${expiry ? ' | Hạn: ' + expiry : ''}`;
                if (typeof showToast === 'function') {
                    showToast(msg, 'success');
                }
            } else {
                const msg = data.message || 'Mã bản quyền không hợp lệ hoặc đã hết hạn.';
                if (typeof showToast === 'function') {
                    showToast(msg, 'warning');
                }
            }
        } catch (e) {
            console.error('Lỗi đồng bộ:', e);
            if (typeof showToast === 'function') {
                showToast('Không thể kết nối máy chủ đồng bộ: ' + e.message, 'error');
            }
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = origHtml;
            }
        }
    },

    renderUI: function (info) {
        if (!info) return;

        // 1. Cập nhật Badge trên thanh Topbar
        const topbarBadge = document.getElementById('btnTopbarLicense');
        const topbarIcon = document.getElementById('topbarLicenseIcon');
        const topbarText = document.getElementById('topbarLicenseText');

        if (topbarBadge && topbarText) {
            if (info.is_active) {
                topbarBadge.className = 'btn btn-sm btn-success has-tooltip tooltip-left';
                if (topbarIcon) {
                    topbarIcon.className = 'fa-solid fa-circle-check';
                    topbarIcon.style.color = '#ffffff';
                }
                topbarText.textContent = (info.plan === 'agency_5pc' || info.plan === 'lifetime')
                    ? 'Agency (5 PCs)'
                    : ((info.plan === 'studio_3pc' || info.plan === 'yearly')
                        ? 'Studio (3 PCs)'
                        : 'Pro (1 PC)');
                topbarBadge.setAttribute('data-tooltip', `Bản quyền trọn đời | Hạn: ${info.expires_display} | Tối đa: ${info.max_devices} PC`);
            } else {
                topbarBadge.className = 'btn btn-sm btn-warning has-tooltip tooltip-left';
                if (topbarIcon) {
                    topbarIcon.className = 'fa-solid fa-triangle-exclamation';
                    topbarIcon.style.color = '#ffffff';
                }
                topbarText.textContent = 'Chưa Kích Hoạt';
                topbarBadge.setAttribute('data-tooltip', 'Nhấp để nhập License Key mở khóa toàn bộ tính năng');
            }
        }

        // 2. Cập nhật Tab Cài Đặt (Settings)
        const hwidEl = document.getElementById('settingLicenseHwid');
        const statusBadgeEl = document.getElementById('settingLicenseStatusBadge');
        const planNameEl = document.getElementById('settingLicensePlan');
        const expiresEl = document.getElementById('settingLicenseExpires');
        const maxDevicesEl = document.getElementById('settingLicenseDevices');
        const activeCardEl = document.getElementById('settingLicenseActiveCard');
        const unactiveCardEl = document.getElementById('settingLicenseUnactiveCard');
        const currentKeyDisplayEl = document.getElementById('settingLicenseCurrentKey');

        if (hwidEl) hwidEl.textContent = info.hwid || 'Đang quét HWID...';

        if (info.is_active) {
            if (statusBadgeEl) {
                statusBadgeEl.innerHTML = '<span class="badge badge-success"><i class="fa-solid fa-circle-check" style="color: #ffffff; margin-right: 4px;"></i> Đang Hoạt Động</span>';
            }
            if (planNameEl) planNameEl.textContent = info.plan_display || 'Bản Quyền Đã Kích Hoạt';
            if (expiresEl) expiresEl.textContent = info.expires_display || '—';
            if (maxDevicesEl) maxDevicesEl.textContent = `${info.max_devices} máy tính`;
            if (currentKeyDisplayEl) currentKeyDisplayEl.textContent = info.license_key;

            if (activeCardEl) activeCardEl.style.display = 'block';
            if (unactiveCardEl) unactiveCardEl.style.display = 'none';
        } else {
            if (statusBadgeEl) {
                const isExpired = info.status === 'expired';
                const isSuspended = info.status === 'suspended';
                if (isExpired) {
                    statusBadgeEl.innerHTML = '<span class="badge badge-danger"><i class="fa-solid fa-clock-rotate-left"></i> Đã Hết Hạn</span>';
                } else if (isSuspended) {
                    statusBadgeEl.innerHTML = '<span class="badge badge-danger"><i class="fa-solid fa-lock"></i> Đã Bị Khóa</span>';
                } else {
                    statusBadgeEl.innerHTML = '<span class="badge badge-warning"><i class="fa-solid fa-shield-halved"></i> Chưa Kích Hoạt</span>';
                }
            }
            if (planNameEl) planNameEl.textContent = 'Chưa Kích Hoạt Bản Quyền';
            if (expiresEl) expiresEl.textContent = '—';
            if (maxDevicesEl) maxDevicesEl.textContent = '—';

            if (activeCardEl) activeCardEl.style.display = 'none';
            if (unactiveCardEl) unactiveCardEl.style.display = 'block';
        }

        // 3. Modal Kích Hoạt nếu có
        const modalHwid = document.getElementById('modalHwidText');
        if (modalHwid) modalHwid.textContent = info.hwid || '';
    },

    copyHwid: function () {
        if (!this.currentInfo || !this.currentInfo.hwid) return;
        navigator.clipboard.writeText(this.currentInfo.hwid).then(() => {
            if (typeof showToast === 'function') {
                showToast('Đã sao chép mã máy (HWID) vào Clipboard!', 'success');
            } else {
                alert('Đã sao chép HWID: ' + this.currentInfo.hwid);
            }
        });
    },

    activate: async function (btnElement, inputId) {
        const input = document.getElementById(inputId || 'settingLicenseKeyInput');
        if (!input || !input.value.trim()) {
            if (typeof showToast === 'function') showToast('Vui lòng nhập mã bản quyền (License Key)', 'warning');
            return;
        }

        const key = input.value.trim().toUpperCase();
        const origBtnText = btnElement ? btnElement.innerHTML : '';
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xác thực máy chủ...';
        }

        try {
            const res = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: key })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (typeof showToast === 'function') {
                    showToast('🎉 ' + (data.message || 'Kích hoạt bản quyền thành công!'), 'success');
                }
                this.closeLicenseModal();
                input.value = '';
                await this.fetchStatus();
            } else {
                const msg = data.detail || data.message || 'Mã bản quyền không hợp lệ hoặc không thể kích hoạt.';
                if (typeof showToast === 'function') {
                    showToast(msg, 'error');
                } else {
                    alert('Lỗi kích hoạt: ' + msg);
                }
            }
        } catch (e) {
            if (typeof showToast === 'function') {
                showToast('Không thể kết nối đến máy chủ kích hoạt: ' + e.message, 'error');
            }
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = origBtnText;
            }
        }
    },

    openConfirmDeactivateModal: function () {
        const modal = document.getElementById('confirmDeactivateModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    },

    closeConfirmDeactivateModal: function () {
        const modal = document.getElementById('confirmDeactivateModal');
        if (modal) {
            modal.classList.remove('active', 'show');
            modal.style.display = 'none';
        }
    },

    confirmDeactivateNow: async function () {
        this.closeConfirmDeactivateModal();
        try {
            const res = await fetch('/api/license/deactivate', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                if (typeof showToast === 'function') {
                    showToast('Đã hủy liên kết bản quyền thành công. Bạn có thể kích hoạt key mới.', 'info');
                }
                await this.fetchStatus();
            } else {
                if (typeof showToast === 'function') {
                    showToast(data.message || 'Không thể hủy liên kết bản quyền.', 'error');
                }
            }
        } catch (e) {
            console.error('Lỗi hủy kích hoạt:', e);
            if (typeof showToast === 'function') {
                showToast('Lỗi kết nối khi hủy kích hoạt: ' + e.message, 'error');
            }
        }
    },

    checkForUpdates: async function (isManual) {
        const btnCheck = document.getElementById('btnCheckAppUpdate');
        const updateCard = document.getElementById('appUpdateAvailableCard');
        const updateText = document.getElementById('appUpdateInfoText');
        const btnDownloadUpdate = document.getElementById('btnDownloadNewRelease');

        const topbarUpdateBtn = document.getElementById('btnUpdateAvailable');
        const topbarUpdateText = document.getElementById('updateBadgeText');

        if (isManual && btnCheck) {
            btnCheck.disabled = true;
            btnCheck.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra...';
        }

        try {
            const res = await fetch('/api/version/check');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            this.updateInfo = data;

            if (data.update_available) {
                // Hiện thông báo ở Topbar
                if (topbarUpdateBtn && topbarUpdateText) {
                    topbarUpdateBtn.style.display = 'inline-flex';
                    topbarUpdateText.textContent = `v${data.latest_version} Mới`;
                }

                // Hiện thẻ cập nhật trong Tab Settings
                if (updateCard) updateCard.style.display = 'block';
                if (updateText) {
                    updateText.innerHTML = `<strong>Phiên bản mới: v${data.latest_version}</strong> (Hiện tại: v${data.current_version}). Dung lượng: ~${data.file_size_mb || 143}MB. ${data.release_notes ? '<br><small>' + data.release_notes + '</small>' : ''}`;
                }
                if (btnDownloadUpdate && data.download_url) {
                    btnDownloadUpdate.onclick = () => window.open(data.download_url, '_blank');
                }

                if (isManual) {
                    this.openUpdateModal();
                }
            } else {
                if (topbarUpdateBtn) topbarUpdateBtn.style.display = 'none';
                if (updateCard) updateCard.style.display = 'none';
                if (isManual && typeof showToast === 'function') {
                    showToast(`Bạn đang sử dụng phiên bản mới nhất (v${data.current_version})!`, 'success');
                }
            }
        } catch (e) {
            if (isManual && typeof showToast === 'function') {
                showToast('Không thể kiểm tra bản cập nhật lúc này: ' + e.message, 'warning');
            }
        } finally {
            if (isManual && btnCheck) {
                btnCheck.disabled = false;
                btnCheck.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Kiểm Tra Bản Cập Nhật';
            }
        }
    },

    openLicenseModal: function () {
        const modal = document.getElementById('licenseActivationModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            const modalHwid = document.getElementById('modalHwidText');
            if (modalHwid && this.currentInfo) {
                modalHwid.textContent = this.currentInfo.hwid || '';
            }
            const modalInput = document.getElementById('modalLicenseKeyInput');
            if (modalInput) {
                setTimeout(() => modalInput.focus(), 100);
            }
        }
    },

    closeLicenseModal: function () {
        const modal = document.getElementById('licenseActivationModal');
        if (modal) {
            modal.classList.remove('active', 'show');
            modal.style.display = 'none';
        }
    },

    openUpdateModal: function () {
        if (!this.updateInfo || !this.updateInfo.update_available) {
            if (typeof showToast === 'function') showToast('Bạn đang dùng bản mới nhất!', 'info');
            return;
        }
        const modal = document.getElementById('appUpdateModal');
        const verEl = document.getElementById('updateModalVersionText');
        const notesEl = document.getElementById('updateModalNotesText');
        const btnDl = document.getElementById('updateModalDownloadBtn');

        if (verEl) verEl.textContent = `ShortsStack v${this.updateInfo.latest_version}`;
        if (notesEl) notesEl.textContent = this.updateInfo.release_notes || 'Bản phát hành cập nhật tối ưu hiệu năng và sửa lỗi ổn định.';
        if (btnDl && this.updateInfo.download_url) {
            btnDl.onclick = () => {
                window.open(this.updateInfo.download_url, '_blank');
            };
        }
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    },

    closeUpdateModal: function () {
        const modal = document.getElementById('appUpdateModal');
        if (modal) {
            modal.classList.remove('active', 'show');
            modal.style.display = 'none';
        }
    },

    closeAllModals: function () {
        this.closeLicenseModal();
        this.closeConfirmDeactivateModal();
        this.closeUpdateModal();
    }
};

// Khởi chạy khi tài liệu tải xong
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => window.LicenseManager.init());
} else {
    window.LicenseManager.init();
}
