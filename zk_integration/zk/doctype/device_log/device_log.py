# -*- coding: utf-8 -*-
# Copyright (c) 2021, Peter and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document

class DeviceLog(Document):
	pass

@frappe.whitelist()
def create_employee_checkin(names=None):
	from zk_integration.zk.doctype.zk_device.zk_device import sync_employee
	sync_employee()
	logs = frappe.db.sql("""
		SELECT dl.name, dl.employee, dl.time, dl.type AS log_type, dl.device
		FROM `tabDevice Log` dl
		WHERE dl.employee IS NOT NULL
		  AND dl.name NOT IN (
		      SELECT ec.device_log FROM `tabEmployee Checkin` ec
		      WHERE ec.device_log IS NOT NULL
		  )
		ORDER BY dl.time ASC
	""", as_dict=True)

	count = 0
	for log in logs:
		try:
			doc = frappe.get_doc({
				"doctype": "Employee Checkin",
				"employee": log.employee,
				"time": log.time,
				"log_type": log.log_type,
				"device_id": log.device,
				"device_log": log.name,
			})
			doc.insert(ignore_permissions=True)
			count += 1
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"ZK Checkin Error: {log.name}")

	frappe.db.commit()
	if not frappe.flags.in_scheduler:
		frappe.msgprint(_(f"✅ {count} Employee Checkin records created successfully."))

def execute(names=None):
	from zk_integration.zk.doctype.zk_device.zk_device import get_active_device_logs, sync_employee
	try:
		get_active_device_logs()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "ZK: get_active_device_logs failed")
	try:
		sync_employee()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "ZK: sync_employee failed")
	try:
		create_employee_checkin()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "ZK: create_employee_checkin failed")
