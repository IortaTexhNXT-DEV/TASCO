#!/usr/bin/python3
"""LibreOffice (UNO) helper for build_docx.py.

Opens a .docx in a private headless LibreOffice, updates every index and
field, and then (any combination):
  --toc-json FILE   writes the refreshed table of contents as JSON
                    [{"text": "...", "page": 7}, ...] plus heading pages
  --pdf FILE        exports a PDF (preview only)
  --save FILE       stores the updated document as .docx (round trip)

Must run with a Python that can `import uno` (the system python3 here).
"""
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time

import uno  # noqa: E402
from com.sun.star.beans import PropertyValue  # noqa: E402


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def start_office():
    profile = tempfile.mkdtemp(prefix='lo_profile_')
    port = free_port()
    proc = subprocess.Popen(
        ['soffice', '--headless', '--invisible', '--nologo', '--norestore', '--nodefault',
         f'-env:UserInstallation=file://{profile}',
         f'--accept=socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    ctx = None
    for _ in range(120):
        try:
            ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext')
            break
        except Exception:
            time.sleep(0.5)
    if ctx is None:
        proc.kill()
        raise SystemExit('LibreOffice did not start')
    desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
    return proc, desktop, profile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('docx')
    ap.add_argument('--toc-json')
    ap.add_argument('--pdf')
    ap.add_argument('--save')
    a = ap.parse_args()

    proc, desktop, profile = start_office()
    try:
        url = uno.systemPathToFileUrl(os.path.abspath(a.docx))
        doc = desktop.loadComponentFromURL(url, '_blank', 0, (prop('Hidden', True),))
        # Update twice: the first pass can change pagination of the TOC itself.
        for _ in range(2):
            idx = doc.getDocumentIndexes()
            for i in range(idx.getCount()):
                idx.getByIndex(i).update()
            doc.getTextFields().refresh()
            doc.refresh()
        result = {'toc': [], 'headings': []}
        idx = doc.getDocumentIndexes()
        for i in range(idx.getCount()):
            ix = idx.getByIndex(i)
            if ix.supportsService('com.sun.star.text.ContentIndex'):
                for line in ix.getAnchor().getString().split('\n'):
                    line = line.strip('\r')
                    if not line.strip():
                        continue
                    parts = line.rsplit('\t', 1)
                    page = None
                    if len(parts) == 2 and parts[1].strip().isdigit():
                        page = int(parts[1].strip())
                        text = parts[0]
                    else:
                        text = line
                    result['toc'].append({'text': text, 'page': page})
                break
        # Heading pages straight from the layout, as a cross-check.
        try:
            ctrl = doc.getCurrentController()
            vc = ctrl.getViewCursor()
            enum = doc.getText().createEnumeration()
            while enum.hasMoreElements():
                par = enum.nextElement()
                if not par.supportsService('com.sun.star.text.Paragraph'):
                    continue
                lvl = par.getPropertyValue('OutlineLevel')
                if 1 <= lvl <= 3:
                    vc.gotoRange(par.getStart(), False)
                    result['headings'].append({'text': par.getString(), 'level': lvl, 'page': vc.getPage()})
        except Exception as e:  # layout not available in some modes
            result['headings_error'] = str(e)
        if a.toc_json:
            with open(a.toc_json, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=1)
        if a.save:
            doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(a.save)),
                           (prop('FilterName', 'MS Word 2007 XML'),))
        if a.pdf:
            doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(a.pdf)),
                           (prop('FilterName', 'writer_pdf_Export'),))
        doc.close(True)
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        try:
            proc.wait(timeout=20)
        except Exception:
            proc.kill()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
