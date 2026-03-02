# -*- coding: utf-8 -*-
# Copyright (c) 2021, Peter and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from zk import ZK, const
from datetime import datetime, date, timedelta
import json
import dateutil
# from zk.doctype.device_log.device_log import create_employee_checkin
# from zk_integration.zk.doctype.device_log.device_log import create_employee_checkin

DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"

class ZKDevice(Document):
    @frappe.whitelist()
    def get_device_log (self,show_progress=False):
        conn = None
        zk = ZK(self.ip, port=self.port, password=self.password,timeout=20 , force_udp=self.udp or True, ommit_ping=self.ping or True)
        # zk = ZK('192.168.1.201', port=4370, timeout=20 , ommit_ping=False)
        # if True:
        try:
            conn = zk.connect()
            # conn.disable_device()
            logs = conn.get_attendance() or []
            
            last_log_users = {}
            period = self.period or 0
            count = 1
            last = self.last_log_row
            total = len(logs)
            self.last_connection_error  = ""
            if self.last_log_row:
                self.last_log_row = dateutil.parser.parse(str(self.last_log_row))
                # self.last_log_row = datetime.strptime(str(self.last_log_row),DATETIME_FORMAT)
                if self.last_log_row > datetime.now() :
                    self.last_log_row = datetime.now()
            for log in logs:
                if show_progress :
                    frappe.publish_progress(count * 100 / total, title=_("Getting Logs..."))
                count += 1
                try :
                    log.timestamp = dateutil.parser.parse(str(log.timestamp))
                except Exception as e: 
                    self.last_connection_error  += "\n" + str(e)
                    continue
                if self.last_log_row and (log.timestamp < self.last_log_row):
                    continue
                last_timestamp = last_log_users.get(log.user_id) or None
                if period and last_timestamp:
                    diff = (log.timestamp -  last_timestamp).seconds / 3600
                    if diff < period :
                        continue

                try:
                    if log.status in [0, 4]:
                        log.status = 'IN'
                    elif log.status in [1, 5]:
                        log.status = 'OUT'
                    else:
                        log.status = 'IN'  # safe fallback

                    name = "{}-{}".format(log.user_id,log.timestamp)
                    frappe.db.sql("""
                        INSERT IGNORE INTO `tabDevice Log`
                        (name, enroll_no, time, date, type, punch, creation, modified, owner, device)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW(), %s, %s)
                    """, (
                        name,
                        log.user_id,
                        log.timestamp,
                        log.timestamp.date(),
                        log.status,
                        log.punch,
                        frappe.session.user,
                        self.name
                    ))
                    last_log_users [log.user_id] = dateutil.parser.parse(str(log.timestamp))
                except Exception as e :
                        pass 
                        # self.last_connection_error  += "\n" + str(e)
                last = log.timestamp

            self.last_log_row = last

            if self.last_log_row > datetime.now() :
                self.last_log_row = datetime.now()
            frappe.db.commit()
            conn.test_voice()
            conn.enable_device()

        except Exception as e:
            frappe.msgprint(_("Process terminate : {}".format(e)),indicator='red')
            self.last_connection_error  += "\n" + str(e) 
        # if 1 :
        finally:
            self.last_connection_time = datetime.now()
            if conn:
                conn.enable_device()

                conn.disconnect()
        self.get_after_mins = self.get_after_mins or 5
        self.excecution_time = datetime.now() + timedelta(minutes=self.get_after_mins)

        self.save()
        sync_employee()





@frappe.whitelist()
def sync_employee():
	frappe.db.sql("""
	Update `tabDevice Log` log set log.employee = (
	select name from tabEmployee where attendance_device_id = log.enroll_no limit 1
	)
	""")
	frappe.db.commit()
	if not frappe.flags.in_scheduler:
		frappe.msgprint(_("✅ Employee sync completed."))
@frappe.whitelist()
def get_active_device_logs(names = None):
	if names :
		names = json.loads(str(names))
	cur_time = datetime.now()
	devices = names or frappe.db.sql_list("""
		SELECT name FROM `tabZK Device`
		WHERE docstatus < 2
		  AND auto_attendance = 1
		  AND (excecution_time IS NULL OR excecution_time <= %s)
	""", (cur_time,))
	for device in devices:
		doc = frappe.get_doc("ZK Device",device)
		try:
			doc.get_device_log()
		except Exception as e:
			if not frappe.flags.in_scheduler:
				frappe.msgprint(_("Process terminate : {}".format(e)), indicator='red')









