// Copyright (c) 2024, ZK Integration Contributors
// ERPNext V15 / Frappe V15 Compatible UI

frappe.ui.form.on("ZK Device", {

    onload: function(frm) {
        frm.set_df_property('last_connection_error', 'read_only', 1);
        frm.set_df_property('last_connection_time', 'read_only', 1);
        frm.set_df_property('excecution_time', 'read_only', 1);
    },

    refresh: function(frm) {
        zk_device_render_header(frm);
        zk_device_render_stats(frm);
        zk_device_setup_buttons(frm);
        zk_device_style_error_box(frm);
        zk_device_render_status_badge(frm);
    }
});

/* ---- Header Banner ---- */
function zk_device_render_header(frm) {
    frm.layout.wrapper.find('.zk-device-header').remove();

    const ip = frm.doc.ip || '---';
    const port = frm.doc.port || '4370';
    const deviceName = frm.doc.device_name || frm.doc.name || 'ZK Device';
    const lastConn = frm.doc.last_connection_time
        ? frappe.datetime.str_to_user(frm.doc.last_connection_time)
        : __('Never connected');

    const $header = $(`
        <div class="zk-device-header">
            <div class="zk-icon">🖥️</div>
            <div>
                <div class="zk-title">${frappe.utils.escape_html(deviceName)}</div>
                <div class="zk-subtitle">
                    📡 ${frappe.utils.escape_html(ip)}:${frappe.utils.escape_html(String(port))}
                    &nbsp;|&nbsp; 🕐 ${__('Last sync')}: ${lastConn}
                </div>
            </div>
        </div>
    `);

    frm.layout.wrapper.find('.form-page').prepend($header);
}

/* ---- Stats Cards ---- */
function zk_device_render_stats(frm) {
    frm.layout.wrapper.find('.zk-stats-row').remove();
    if (frm.is_new()) return;

    // Fetch all counts in parallel
    const deviceName = frm.doc.name;
    const today = frappe.datetime.get_today();

    Promise.all([
        new Promise(resolve => frappe.call({
            method: 'frappe.client.get_count',
            args: { doctype: 'Device Log', filters: { device: deviceName } },
            callback: r => resolve(r.message || 0)
        })),
        new Promise(resolve => frappe.call({
            method: 'frappe.client.get_count',
            args: { doctype: 'Device Log', filters: { device: deviceName, date: today } },
            callback: r => resolve(r.message || 0)
        })),
        new Promise(resolve => frappe.call({
            method: 'frappe.client.get_count',
            args: { doctype: 'Device Log', filters: { device: deviceName, employee: ['is', 'not set'] } },
            callback: r => resolve(r.message || 0)
        }))
    ]).then(([total, today_count, unsynced]) => {
        const statusIcon = frm.doc.last_connection_error ? '❌' : '✅';
        const $stats = $(`
            <div class="zk-stats-row">
                <div class="zk-stat-card today">
                    <div class="stat-value">${today_count.toLocaleString()}</div>
                    <div class="stat-label">📅 ${__("Today's Logs")}</div>
                </div>
                <div class="zk-stat-card total">
                    <div class="stat-value">${total.toLocaleString()}</div>
                    <div class="stat-label">📊 ${__('Total Logs')}</div>
                </div>
                <div class="zk-stat-card unsynced">
                    <div class="stat-value">${unsynced.toLocaleString()}</div>
                    <div class="stat-label">⚠️ ${__('Unlinked')}</div>
                </div>
                <div class="zk-stat-card errors">
                    <div class="stat-value">${statusIcon}</div>
                    <div class="stat-label">🔌 ${__('Last Status')}</div>
                </div>
            </div>
        `);
        frm.layout.wrapper.find('.zk-device-header').after($stats);
    });
}

/* ---- Action Buttons ---- */
function zk_device_setup_buttons(frm) {
    frm.clear_custom_buttons();
    if (frm.is_new()) return;

    frm.add_custom_button(__('🔄 Get Logs'), function() {
        zk_do_get_logs(frm);
    }, __('⚡ Actions'));

    frm.add_custom_button(__('👥 Sync Employees'), function() {
        frappe.show_alert({ message: __('Syncing...'), indicator: 'blue' });
        frappe.call({
            method: 'zk_integration.zk.doctype.zk_device.zk_device.sync_employee',
            callback: function() {
                frappe.show_alert({ message: __('✅ Employees synced!'), indicator: 'green' });
                frm.reload_doc();
            }
        });
    }, __('⚡ Actions'));

    frm.add_custom_button(__('✅ Create Checkins'), function() {
        frappe.show_alert({ message: __('Creating checkins...'), indicator: 'blue' });
        frappe.call({
            method: 'zk_integration.zk.doctype.device_log.device_log.create_employee_checkin',
            callback: function() {
                frm.reload_doc();
            }
        });
    }, __('⚡ Actions'));

    frm.add_custom_button(__('📋 View Device Logs'), function() {
        frappe.set_route('List', 'Device Log', { device: frm.doc.name });
    });
}

/* ---- Get Logs with animated freeze message ---- */
// function zk_do_get_logs(frm) {
//     frm.save().then(() => {
//         frappe.call({
//             method: 'get_device_log',
//             doc: frm.doc,
//             args: { show_progress: 1 },
//             freeze: true,
//             freeze_message: `
//                 <div style="text-align:center;padding:14px 10px">
//                     <div style="font-size:2.5rem;margin-bottom:8px">🖥️</div>
//                     <div style="font-weight:700;font-size:1rem;margin-bottom:4px">
//                         ${__('Connecting to ZK Device...')}
//                     </div>
//                     <div style="color:#6c757d;font-size:0.85rem;margin-bottom:10px">
//                         ${frappe.utils.escape_html(frm.doc.ip)}:${frappe.utils.escape_html(String(frm.doc.port || 4370))}
//                     </div>
//                     <div class="zk-sync-progress" style="width:220px;margin:auto">
//                         <div class="zk-sync-progress-bar"></div>
//                     </div>
//                 </div>
//             `,
//             callback: function() {
//                 frappe.show_alert({ message: __('✅ Logs fetched successfully!'), indicator: 'green' });
//                 frm.reload_doc();
//             },
//             error: function() {
//                 frappe.show_alert({ message: __('❌ Failed. Check device connection.'), indicator: 'red' });
//                 frm.reload_doc();
//             }
//         });
//     });
// }
/* ---- Get Logs ---- */
function zk_do_get_logs(frm) {
    frappe.call({
        method: 'get_device_log',
        doc: frm.doc,
        args: { show_progress: 1 },
        freeze: true,
        freeze_message: `
            <div style="text-align:center;padding:14px 10px">
                <div style="font-size:2.5rem;margin-bottom:8px">🖥️</div>
                <div style="font-weight:700;font-size:1rem;margin-bottom:4px">
                    ${__('Connecting to ZK Device...')}
                </div>
                <div style="color:#6c757d;font-size:0.85rem;margin-bottom:10px">
                    ${frappe.utils.escape_html(frm.doc.ip)}:${frappe.utils.escape_html(String(frm.doc.port || 4370))}
                </div>
                <div class="zk-sync-progress" style="width:220px;margin:auto">
                    <div class="zk-sync-progress-bar"></div>
                </div>
            </div>
        `,
        callback: function() {
            frappe.show_alert({ message: __('✅ Logs fetched successfully!'), indicator: 'green' });
            frm.reload_doc();
        },
        error: function() {
            frappe.show_alert({ message: __('❌ Failed. Check device connection.'), indicator: 'red' });
            frm.reload_doc();
        }
    });
}

/* ---- Style Error Box ---- */
function zk_device_style_error_box(frm) {
    if (!frm.doc.last_connection_error) return;
    setTimeout(function() {
        const ef = frm.get_field('last_connection_error');
        if (ef) {
            $(ef.wrapper).find('textarea, .control-value').addClass('zk-error-box');
        }
    }, 400);
}

/* ---- Connection Status Badge in page title ---- */
function zk_device_render_status_badge(frm) {
    if (frm.is_new()) return;
    frm.page.wrapper.find('.zk-status-badge').remove();

    const lastTime = frm.doc.last_connection_time;
    const hasError = frm.doc.last_connection_error;
    let cls = 'unknown', txt = __('Not tested');

    if (lastTime) {
        const minsAgo = Math.abs(frappe.datetime.get_minute_diff(
            frappe.datetime.now_datetime(), lastTime
        ));
        if (hasError) {
            cls = 'disconnected'; txt = __('Connection Error');
        } else if (minsAgo < 30) {
            cls = 'connected'; txt = `${__('Active')} (${minsAgo}m ${__('ago')})`;
        } else {
            cls = 'unknown'; txt = __('Idle');
        }
    }

    const $badge = $(`<span class="zk-status-badge ${cls}">● ${txt}</span>`);
    setTimeout(() => {
        frm.page.wrapper.find('.title-text').append($badge);
    }, 250);
}
