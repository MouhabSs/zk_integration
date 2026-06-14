# -*- coding: utf-8 -*-
# Copyright (c) 2021, Peter and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from datetime import timedelta
from frappe.utils import now_datetime
import json
import dateutil

DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"

class ZKDevice(Document):
    @frappe.whitelist()
    def get_device_log(self, show_progress=False):
        from zk import ZK, const  # Import here to avoid load-time failure during app install
        conn = None
        zk = ZK(
            self.ip,
            port=self.port,
            password=self.password,
            timeout=20,
            force_udp=bool(self.udp),
            ommit_ping=not bool(self.ping)
        )
        try:
            conn = zk.connect()
            logs = conn.get_attendance() or []

            last_log_users = {}
            period = self.period or 0
            count = 1
            last = self.last_log_row
            total = len(logs)
            self.last_connection_error = ""

            if self.last_log_row:
                self.last_log_row = dateutil.parser.parse(str(self.last_log_row))
                if self.last_log_row > now_datetime():
                    self.last_log_row = now_datetime()

            for log in logs:
                if show_progress:
                    frappe.publish_progress(count * 100 / total, title=_("Getting Logs..."))
                count += 1

                try:
                    log.timestamp = dateutil.parser.parse(str(log.timestamp))
                except Exception as e:
                    self.last_connection_error += "\n" + str(e)
                    continue

                if self.last_log_row and (log.timestamp < self.last_log_row):
                    continue

                last_timestamp = last_log_users.get(log.user_id) or None
                if period and last_timestamp:
                    diff = (log.timestamp - last_timestamp).total_seconds() / 60
                    if diff < period:
                        continue

                try:
                    # Use punch field as primary IN/OUT indicator (more reliable than status)
                    if log.punch == 0:
                        log.status = 'IN'
                    elif log.punch == 1:
                        log.status = 'OUT'
                    else:
                        # Fallback to status code
                        if log.status in [0, 4]:
                            log.status = 'IN'
                        elif log.status in [1, 5]:
                            log.status = 'OUT'
                        else:
                            log.status = 'IN'

                    name = "{}-{}".format(log.user_id, log.timestamp)
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
                    last_log_users[log.user_id] = dateutil.parser.parse(str(log.timestamp))
                except Exception as e:
                    frappe.log_error(str(e), "ZK Device Log Insert Error")

                last = log.timestamp

            self.last_log_row = last

            if self.last_log_row and self.last_log_row > now_datetime():
                self.last_log_row = now_datetime()

            frappe.db.commit()
            conn.test_voice()
            conn.enable_device()

        except Exception as e:
            frappe.msgprint(_("Process terminate : {}".format(e)), indicator='red')
            self.last_connection_error += "\n" + str(e)

        finally:
            self.last_connection_time = now_datetime()
            if conn:
                conn.enable_device()
                conn.disconnect()

        self.get_after_mins = self.get_after_mins or 5
        self.excecution_time = now_datetime() + timedelta(minutes=self.get_after_mins)
        self.save()
        sync_employee()


@frappe.whitelist()
def sync_employee():
    frappe.db.sql("""
        UPDATE `tabDevice Log` log SET log.employee = (
            SELECT name FROM tabEmployee
            WHERE attendance_device_id = log.enroll_no
            LIMIT 1
        )
    """)
    frappe.db.commit()
    if not frappe.flags.in_scheduler:
        frappe.msgprint(_("✅ Employee sync completed."))


@frappe.whitelist()
def get_active_device_logs(names=None, force=False):
    if names:
        names = json.loads(str(names))
    cur_time = now_datetime()

    if names:
        # Manual trigger — ignore excecution_time, run all named devices
        devices = names
    else:
        devices = frappe.db.sql_list("""
            SELECT name FROM `tabZK Device`
            WHERE docstatus < 2
              AND auto_attendance = 1
              AND (excecution_time IS NULL OR excecution_time <= %s)
        """, (cur_time,))

    for device in devices:
        doc = frappe.get_doc("ZK Device", device)
        try:
            doc.get_device_log()
        except Exception as e:
            if not frappe.flags.in_scheduler:
                frappe.msgprint(_("Process terminate : {}".format(e)), indicator='red')