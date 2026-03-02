from __future__ import unicode_literals

import frappe
from frappe import _

import tempfile , os , subprocess



@frappe.whitelist()
def print_test(frm):
	printers = subprocess.check_output('lpstat -e', shell=True).split() #could be anything here.
	for i in printers :
		with tempfile.TemporaryDirectory() as td:
			f_name = os.path.join(td, 'test.html')
			print(f_name)
			with open (f_name,'w') as f:
				f.write('heeeeeelo')
			subprocess.Popen(['lp', '-d', i.decode("utf-8"), f_name])
