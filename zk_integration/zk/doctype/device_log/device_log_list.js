frappe.listview_settings['Device Log'] = {

    add_fields: ['employee', 'type', 'time', 'date', 'device', 'enroll_no'],

    get_indicator: function(doc) {
        const type = (doc.type || 'IN').toUpperCase();
        if (type === 'IN')  return [__('IN'),  'green',  'type,=,IN'];
        if (type === 'OUT') return [__('OUT'), 'red',    'type,=,OUT'];
        return [__('Unknown'), 'grey', ''];
    },

    formatters: {
        type: function(value) {
            const v = (value || 'IN').toUpperCase();
            return v === 'IN'
                ? '<span class="zk-pill-in">▶ IN</span>'
                : '<span class="zk-pill-out">◀ OUT</span>';
        },
        employee: function(value) {
            if (!value) return '<span class="zk-pill-unlinked">⚠ ' + __('Not Linked') + '</span>';
            return `<strong>👤 ${frappe.utils.escape_html(value)}</strong>`;
        },
        time: function(value) {
            if (!value) return '<span style="color:#aaa">—</span>';
            return `<span style="font-size:0.88rem;color:#495057">🕐 ${frappe.datetime.str_to_user(value)}</span>`;
        },
        device: function(value) {
            if (!value) return '<span style="color:#aaa">—</span>';
            return `<span class="zk-code-chip">📟 ${frappe.utils.escape_html(value)}</span>`;
        }
    },

    onload: function(listview) {
        // Color-code rows after render
        const observer = new MutationObserver(function() {
            device_log_color_rows(listview);
        });
        observer.observe(listview.wrapper[0], { childList: true, subtree: true });
    },

    refresh: function(listview) {
        device_log_list_menu(listview);
        device_log_filter_shortcuts(listview);
        device_log_color_rows(listview);
    }
};

/* ---- Row Coloring ---- */
function device_log_color_rows(listview) {
    listview.wrapper.find('.list-row').each(function() {
        const $row = $(this);
        const typeHtml = $row.find('[data-fieldname="type"]').text();
        $row.removeClass('in-row out-row');
        if (typeHtml.includes('IN'))  $row.addClass('in-row');
        if (typeHtml.includes('OUT')) $row.addClass('out-row');
    });
}

/* ---- Smart Filter Shortcuts ---- */
function device_log_filter_shortcuts(listview) {
    const today = frappe.datetime.get_today();

    listview.page.add_menu_item(__("📅 Today's Logs"), function() {
        listview.filter_area.clear();
        listview.filter_area.add([[listview.doctype, 'date', '=', today]]);
    });

    listview.page.add_menu_item(__('🟢 IN Only'), function() {
        listview.filter_area.clear();
        listview.filter_area.add([[listview.doctype, 'type', '=', 'IN']]);
    });

    listview.page.add_menu_item(__('🔴 OUT Only'), function() {
        listview.filter_area.clear();
        listview.filter_area.add([[listview.doctype, 'type', '=', 'OUT']]);
    });

    listview.page.add_menu_item(__('⚠ Unlinked Employees'), function() {
        listview.filter_area.clear();
        listview.filter_area.add([[listview.doctype, 'employee', 'is', 'not set']]);
    });

    listview.page.add_menu_item(__('📆 This Week'), function() {
        const weekStart = frappe.datetime.week_start();
        listview.filter_area.clear();
        listview.filter_area.add([
            [listview.doctype, 'date', '>=', weekStart],
            [listview.doctype, 'date', '<=', today]
        ]);
    });
}

/* ---- Menu Actions ---- */
function device_log_list_menu(listview) {
    listview.page.add_menu_item(__('🔄 Get Logs from Devices'), function() {
        frappe.show_alert({ message: __('Fetching device logs...'), indicator: 'blue' });
        frappe.call({
            method: 'zk_integration.zk.doctype.zk_device.zk_device.get_active_device_logs',
            callback: function() {
                listview.refresh();
                frappe.show_alert({ message: __('✅ Done!'), indicator: 'green' });
            }
        });
    });

    listview.page.add_menu_item(__('👥 Sync Employees'), function() {
        frappe.call({
            method: 'zk_integration.zk.doctype.zk_device.zk_device.sync_employee',
            callback: function() {
                listview.refresh();
                frappe.show_alert({ message: __('✅ Employees synced!'), indicator: 'green' });
            }
        });
    });

    listview.page.add_menu_item(__('✅ Create Employee Checkins'), function() {
        frappe.call({
            method: 'zk_integration.zk.doctype.device_log.device_log.create_employee_checkin',
            callback: function() {
                listview.refresh();
            }
        });
    });
}
