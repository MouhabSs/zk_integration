// Copyright (c) 2021, Peter and contributors
// For license information, please see license.txt

frappe.ui.form.on('Device Log', {
	refresh: function(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__('Create Employee Checkin'), function() {
				frappe.call({
					method: 'zk_integration.zk.doctype.device_log.device_log.create_employee_checkin',
					callback: function(r) {
						frm.refresh();
						frappe.show_alert({ message: __('Done'), indicator: 'green' });
					}
				});
			});
		}
	}
});
