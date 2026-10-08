#!/usr/bin/env python3
"""Build every Markdown document under a docs folder into the corporate Word template.

Usage:
    build_all.py <docsrc/docs dir> <out dir> [--jobs N] [--img-dir DIR] [--preview] [--only PATTERN]

* Every *.md with YAML front matter (id + title) is built with build_docx.py.
* Files without front matter are skipped with a warning.
* Output mirrors the source folder structure; files are named "<ID> <Title>.docx".
* A summary is printed and written to <out dir>/build_report.txt and build_report.json.
"""
import argparse
import concurrent.futures as cf
import fnmatch
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_docx import split_front_matter  # noqa: E402

BAD_CHARS = re.compile(r'[\\/:*?"<>|]+')


def out_name(meta):
    name = '%s %s' % (str(meta.get('id', '')).strip(), str(meta.get('title', '')).strip())
    return BAD_CHARS.sub('-', name).strip() + '.docx'


def build_one(job):
    t0 = time.time()
    cmd = [sys.executable, os.path.join(HERE, 'build_docx.py'), job['src'], job['out'], '--json', '--quiet']
    if job.get('img_dir'):
        cmd += ['--img-dir', job['img_dir']]
    if job.get('preview'):
        cmd += ['--preview', os.path.join(os.path.dirname(job['out']), '_preview', os.path.splitext(os.path.basename(job['out']))[0])]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    rep = {'source': job['rel'], 'output': job['out_rel'], 'seconds': round(time.time() - t0, 1)}
    try:
        data = json.loads(res.stdout[res.stdout.index('{'):])
        rep.update({k: data.get(k) for k in ('headings', 'toc_entries_lo', 'figures', 'sections', 'problems', 'warnings')})
        rep['status'] = 'ok' if res.returncode == 0 else 'problems'
    except Exception:
        rep['status'] = 'failed'
        rep['error'] = (res.stderr or res.stdout).strip()[-600:]
    return rep


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('docs')
    ap.add_argument('out')
    ap.add_argument('--jobs', type=int, default=3)
    ap.add_argument('--img-dir')
    ap.add_argument('--preview', action='store_true', help='also write PDF/PNG previews to <out>/<folder>/_preview')
    ap.add_argument('--only', help='glob on the relative path, e.g. "architecture/*"')
    a = ap.parse_args()

    docs = os.path.abspath(a.docs)
    out = os.path.abspath(a.out)
    jobs, skipped = [], []
    ids = {}
    for root, dirs, files in os.walk(docs):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
        for f in sorted(files):
            if not f.lower().endswith('.md'):
                continue
            src = os.path.join(root, f)
            rel = os.path.relpath(src, docs)
            if a.only and not fnmatch.fnmatch(rel, a.only):
                continue
            with open(src, encoding='utf-8') as fh:
                try:
                    fm, _ = split_front_matter(fh.read())
                except Exception as e:  # malformed YAML
                    fm = None
                    skipped.append((rel, 'invalid front matter: %s' % str(e).splitlines()[0]))
                    print('WARNING: skipping %s (invalid front matter)' % rel, file=sys.stderr)
                    continue
            if not fm or not fm.get('id') or not fm.get('title'):
                skipped.append((rel, 'no front matter (id/title)'))
                print('WARNING: skipping %s (no front matter)' % rel, file=sys.stderr)
                continue
            if fm['id'] in ids:
                print('WARNING: duplicate id %s in %s and %s' % (fm['id'], ids[fm['id']], rel), file=sys.stderr)
            ids[fm['id']] = rel
            od = os.path.join(out, os.path.dirname(rel))
            os.makedirs(od, exist_ok=True)
            dst = os.path.join(od, out_name(fm))
            jobs.append({'src': src, 'rel': rel, 'out': dst, 'out_rel': os.path.relpath(dst, out),
                         'img_dir': a.img_dir, 'preview': a.preview})

    print('Building %d documents (%d skipped) with %d parallel jobs...' % (len(jobs), len(skipped), a.jobs))
    results = []
    with cf.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as ex:
        for rep in ex.map(build_one, jobs):
            results.append(rep)
            print('  [%s] %-60s %5.1fs  headings %s, figures %s, warnings %d' % (
                rep['status'], rep['output'], rep['seconds'], rep.get('headings'), rep.get('figures'),
                len(rep.get('warnings') or [])))

    lines = ['Build report  %s' % time.strftime('%Y-%m-%d %H:%M'), 'Source: %s' % docs, 'Output: %s' % out, '']
    ok = [r for r in results if r['status'] == 'ok']
    lines.append('Built: %d   With problems: %d   Failed: %d   Skipped: %d' % (
        len(ok), sum(r['status'] == 'problems' for r in results), sum(r['status'] == 'failed' for r in results),
        len(skipped)))
    lines.append('')
    lines.append('%-8s %-70s %8s %7s %8s %8s' % ('Status', 'Document', 'Headings', 'Figures', 'Sections', 'Warnings'))
    for r in results:
        lines.append('%-8s %-70s %8s %7s %8s %8s' % (r['status'], r['output'], r.get('headings'), r.get('figures'),
                                                  r.get('sections'), len(r.get('warnings') or [])))
    if skipped:
        lines += ['', 'Skipped:'] + ['  %s - %s' % s for s in skipped]
    det = [r for r in results if r.get('warnings') or r.get('problems') or r.get('error')]
    if det:
        lines += ['', 'Details:']
        for r in det:
            lines.append('  %s' % r['source'])
            for p in r.get('problems') or []:
                lines.append('    PROBLEM: %s' % p)
            for wmsg in r.get('warnings') or []:
                lines.append('    warning: %s' % wmsg)
            if r.get('error'):
                lines.append('    ERROR: %s' % r['error'])
    text = '\n'.join(lines) + '\n'
    with open(os.path.join(out, 'build_report.txt'), 'w', encoding='utf-8') as f:
        f.write(text)
    with open(os.path.join(out, 'build_report.json'), 'w', encoding='utf-8') as f:
        json.dump({'results': results, 'skipped': skipped}, f, indent=1, ensure_ascii=False)
    print()
    print(text)
    return 0 if all(r['status'] == 'ok' for r in results) else 1


if __name__ == '__main__':
    sys.exit(main())
