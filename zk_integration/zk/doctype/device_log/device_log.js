// Copyright (c) 2024, ZK Integration
// ERPNext V15 Compatible

frappe.ui.form.on('Device Log', {

    refresh: function(frm) {
        device_log_render_header(frm);
        device_log_setup_buttons(frm);
    }
});

/* ---- Colored Header ---- */
function device_log_render_header(frm) {
    frm.layout.wrapper.find('.device-log-header').remove();

    const type = (frm.doc.type || 'IN').toUpperCase();
    const typeClass = type === 'IN' ? 'type-in' : 'type-out';
    const typeEmoji = type === 'IN' ? '🟢' : '🔴';
    const typeLabel = type === 'IN' ? __('Check IN') : __('Check OUT');
    const employee = frm.doc.employee || __('Unknown Employee');
    const time = frm.doc.time ? frappe.datetime.str_to_user(frm.doc.time) : '—';
    const device = frm.doc.device || '—';

    const $header = $(`
        <div class="device-log-header ${typeClass}">
            <div class="log-type-badge">${typeEmoji}</div>
            <div class="log-info">
                <div class="log-employee">
                    ${frappe.utils.escape_html(employee)}
                    — <strong>${typeLabel}</strong>
                </div>
                <div class="log-time">
                    🕐 ${time} &nbsp;|&nbsp; 📟 ${frappe.utils.escape_html(device)}
                </div>
            </div>
        </div>
    `);

    frm.layout.wrapper.find('.form-page').prepend($header);
}

/* ---- Form Buttons ---- */
function device_log_setup_buttons(frm) {
    frm.clear_custom_buttons();
    if (frm.is_new()) return;

    // Check if already has employee checkin
    frappe.call({
        method: 'frappe.client.get_count',
        args: { doctype: 'Employee Checkin', filters: { device_log: frm.doc.name } },
        callback: function(r) {
            const count = r.message || 0;
            if (count === 0) {
                frm.add_custom_button(__('✅ Create Employee Checkin'), function() {
                    frappe.call({
                        method: 'zk_integration.zk.doctype.device_log.device_log.create_employee_checkin',
                        callback: function() {
                            frm.reload_doc();
                            frappe.show_alert({ message: __('✅ Checkin created!'), indicator: 'green' });
                        }
                    });
                });
            } else {
                frm.add_custom_button(__('👁 View Employee Checkin'), function() {
                    frappe.set_route('List', 'Employee Checkin', { device_log: frm.doc.name });
                });
            }
        }
    });

    if (frm.doc.employee) {
        frm.add_custom_button(__('👤 View Employee'), function() {
            frappe.set_route('Form', 'Employee', frm.doc.employee);
        });
    }
}
