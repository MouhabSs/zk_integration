frappe.listview_settings["Device Log"] = {
  get_indicator: function(doc) {
    if (doc.type === 'IN') {
      return [__('IN'), 'green', 'type,=,IN'];
    } else {
      return [__('OUT'), 'red', 'type,=,OUT'];
    }
  },
  refresh: function (listview) {
    listview.page.add_menu_item(__("Create Employee Checkin"), function () {
      create_employee_checkin(listview);
    });
    listview.page.add_menu_item(__("Get Logs"), function () {
      get_active_device_logs(listview);
    });
    listview.page.add_menu_item(__("Sync Employee"), function () {
      sync_employee(listview);
    });
  },
};
var get_active_device_logs = function (listview) {
  const method =
    "zk_integration.zk.doctype.zk_device.zk_device.get_active_device_logs";
  frappe.call({
    method: method,
    callback: function (r) {
      listview.refresh();
    },
  });
};
var sync_employee = function (listview) {
  const method = "zk_integration.zk.doctype.zk_device.zk_device.sync_employee";
  frappe.call({
    method: method,
    callback: function (r) {
      listview.refresh();
    },
  });
};
var create_employee_checkin = function (listview) {
  const method =
    "zk_integration.zk.doctype.device_log.device_log.create_employee_checkin";
  frappe.call({
    method: method,
    callback: function (r) {
      listview.refresh();
    },
  });
};
