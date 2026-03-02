frappe.listview_settings['ZK Device'] = {

    add_fields: ['device_name', 'ip', 'port', 'auto_attendance',
                 'last_connection_time', 'last_connection_error', 'excecution_time'],

    get_indicator: function(doc) {
        if (doc.last_connection_error) {
            return [__('Error'), 'red', 'last_connection_error,is,set'];
        }
        if (doc.last_connection_time) {
            const minsAgo = Math.abs(frappe.datetime.get_minute_diff(
                frappe.datetime.now_datetime(), doc.last_connection_time
            ));
            if (minsAgo < 30) return [__('Active'), 'green', 'auto_attendance,=,1'];
            return [__('Idle'), 'orange', 'auto_attendance,=,1'];
        }
        return [__('Not Connected'), 'grey', 'last_connection_time,is,not set'];
    },

    formatters: {
        device_name: function(value) {
            return `<strong style="color:#0f3460">🖥️ ${frappe.utils.escape_html(value || '')}</strong>`;
        },
        ip: function(value) {
            return `<span class="zk-code-chip">📡 ${frappe.utils.escape_html(value || '')}</span>`;
        },
        auto_attendance: function(value) {
            return value
                ? '<span style="color:#155724;font-weight:600">✅ Auto</span>'
                : '<span style="color:#6c757d">Manual</span>';
        },
        last_connection_time: function(value) {
            if (!value) return '<span style="color:#aaa">—</span>';
            return `<span style="font-size:0.85rem;color:#495057">🕐 ${frappe.datetime.str_to_user(value)}</span>`;
        }
    },

    refresh: function(listview) {
        // Get logs for selected devices
        listview.page.add_menu_item(__('🔄 Get Logs for Selected'), function() {
            const sel = listview.get_checked_items();
            if (!sel.length) {
                frappe.show_alert({ message: __('Select at least one device'), indicator: 'orange' });
                return;
            }
            const names = sel.map(d => d.name);
            frappe.show_alert({ message: __('Fetching logs for ') + names.length + __(' device(s)...'), indicator: 'blue' });
            frappe.call({
                method: 'zk_integration.zk.doctype.zk_device.zk_device.get_active_device_logs',
                args: { names: JSON.stringify(names) },
                callback: function() {
                    listview.refresh();
                    frappe.show_alert({ message: __('✅ Done!'), indicator: 'green' });
                }
            });
        });

        // Get ALL device logs
        listview.page.add_menu_item(__('🔄 Get Logs for ALL Devices'), function() {
            frappe.confirm(__('Fetch logs from ALL active auto-attendance devices?'), function() {
                frappe.show_alert({ message: __('Fetching all logs...'), indicator: 'blue' });
                frappe.call({
                    method: 'zk_integration.zk.doctype.zk_device.zk_device.get_active_device_logs',
                    callback: function() {
                        listview.refresh();
                        frappe.show_alert({ message: __('✅ All logs fetched!'), indicator: 'green' });
                    }
                });
            });
        });

        // Sync employees
        listview.page.add_menu_item(__('👥 Sync All Employees'), function() {
            frappe.call({
                method: 'zk_integration.zk.doctype.zk_device.zk_device.sync_employee',
                callback: function() {
                    listview.refresh();
                    frappe.show_alert({ message: __('✅ Employees synced!'), indicator: 'green' });
                }
            });
        });

        // Create checkins
        listview.page.add_menu_item(__('✅ Create Employee Checkins'), function() {
            frappe.call({
                method: 'zk_integration.zk.doctype.device_log.device_log.create_employee_checkin',
                callback: function() {
                    listview.refresh();
                }
            });
        });
    }
};