"""Assemble the proposal parts into one template-ready Markdown file (proposal/tpl/proposal.md).

Headings lose their typed numbers (the template numbers them), cross-references are renumbered
for the template frame (Document Control = 1, Acronyms = 2, About this proposal = 3), and
screenshots are mapped to the final screenshot set.
"""
import re, shutil, pathlib, sys
HERE = pathlib.Path(__file__).parent
OUT = HERE / 'tpl'
SHOTS = HERE.parent / 'shots'
OFFSET = 3  # body sections start at 4 in the template

CAPTIONS = {
 'console-campaign-leads': 'Lead queue ranked by score', 'console-supervisor-customer-overview': 'Customer 360: why this customer and what to offer',
 'console-campaign-voice-call': 'Voice assistant call with transcript and outcome', 'console-supervisor-inbox': 'Telesales inbox',
 'console-supervisor-customer-quote': "Sending a quote to the customer's app", 'console-exec-dashboard': 'Executive dashboard',
 'console-campaign-journeys': 'Journeys and their results', 'console-author-scoring-simulation': 'Rules studio: simulating a change',
 'console-approver-review': 'Approvals: reviewing a change before it goes live', 'console-auditor-audit': 'Audit trail in plain language',
 'console-supervisor-customer-data': 'Customer 360: data sources and confidence', 'console-steward-dq': 'Data-quality work queue',
 'console-claims-claims': 'Claims queue', 'console-partners-statement': 'Partner commission statement',
 'console-support-ops': 'Operations and integration health',
}

SHOTMAP = {
 '31-app-home-quote-waiting': 'app-customer-home-quote', '32-app-quote-confirm-pay': 'app-customer-buy-2-review',
 '32b-app-payment-success-certificate': 'app-customer-buy-6-success', '37-certificate-verification': 'verify-public-valid',
 '35-app-claims-fnol': 'app-customer-claim-3-what', '36-app-consent-centre': 'app-customer-account-consent-saved',
 '06-lead-list-scores': 'console-campaign-leads', '07-customer-360-overview': 'console-supervisor-customer-overview',
 '10-voice-bot-session': 'console-campaign-voice-call', '11-telesales-handoff-queue': 'console-supervisor-inbox',
 '09-customer-360-sell-quote': 'console-supervisor-customer-quote', '03-executive-dashboard': 'console-exec-dashboard',
 '05-campaign-journeys': 'console-campaign-journeys', '15-rules-studio-simulation': 'console-author-scoring-simulation',
 '16-approvals-maker-checker': 'console-approver-review', '20-audit-trail': 'console-auditor-audit',
 '08-customer-360-lineage': 'console-supervisor-customer-data', '17-data-quality-steward-queue': 'console-steward-dq',
 '18-claims-fnol-queue': 'console-claims-claims', '19b-partner-commission-statement': 'console-partners-statement',
 '22-admin-operations': 'console-support-ops',
}

FRONT = '''---
id: ITN-TASCO-2026-001
title: Proposal for the TASCO Motor Insurance Growth Platform
subtitle: Prepared for TASCO Insurance, in partnership with VETC
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Engagement Lead
reviewed_by: iorta TechNXT, Delivery Director
approved_by: iorta TechNXT, Managing Director
change_history: Issued to TASCO Insurance for evaluation
acronyms:
{acr}
signoff:
  - ["Core integration path (rating API or interim tariff tables) agreed", "TASCO IT and Product Owner", Open]
  - ["Regulatory positions in section {reg} confirmed", "TASCO Legal", Open]
  - ["VETC data sharing, app web view and wallet interfaces committed", "VETC", Open]
  - ["Pilot provinces, cohort size and control group agreed", "TASCO and VETC sponsors", Open]
  - ["Commercial terms and payment milestones accepted", "TASCO Procurement", Open]
---
'''

ABOUT = '''# About this proposal

| Item | Detail |
|---|---|
| Prepared for | TASCO Insurance, in partnership with VETC |
| Prepared by | iorta TechNXT |
| Reference | ITN-TASCO-2026-001 |
| Validity | 90 days from the date of issue |
| Classification | Commercial in confidence |
| TASCO contacts used in the solution | Hotline 1900 1562 · info@baohiemtasco.vn · baohiemtasco.vn |

This proposal answers TASCO's request for a platform that lifts motor insurance sales through its own channels and the VETC ecosystem, connected to TASCO's core system for products and rating. It is written for TASCO's executive sponsors, the product, distribution, IT and compliance teams, and VETC. The supporting documents listed at the end of this proposal give the detail behind each section.

'''

def renum(m):
    word, num = m.group(1), m.group(2)
    parts = num.split('.')
    parts[0] = str(int(parts[0]) + OFFSET)
    return f'{word} {".".join(parts)}'

def main():
    OUT.mkdir(exist_ok=True)
    (OUT / 'shots').mkdir(exist_ok=True)
    text = '\n'.join((HERE / f'part{i}.md').read_text() for i in range(1, 6))
    # drop H1 title and the metadata table that follows it
    text = re.sub(r'\A# [^\n]*\n\n(?:\|[^\n]*\n)+\n', '', text)
    # cross references (before headings are touched)
    text = re.sub(r'\b(section|sections) (\d+(?:\.\d+)?)', renum, text)
    text = text.replace('(document 01, section 15)', '(TGP-BUS-01, Business case)')
    text = re.sub(r'\(document 01, section \d+\)', '(TGP-BUS-01, Business case)', text)
    # headings: "## 12. Title" -> "# Title", "### 12.1 Title" -> "## Title", appendices keep their letter
    text = re.sub(r'^## Appendix [A-Z]\. ', '# ', text, flags=re.M)
    text = re.sub(r'^## \d+\. ', '# ', text, flags=re.M)
    text = re.sub(r'^### \d+\.\d+ ', '## ', text, flags=re.M)
    text = re.sub(r'^#### \d+\.\d+\.\d+ ', '### ', text, flags=re.M)
    # screenshots
    def shot(m):
        old = m.group(1)
        new = SHOTMAP.get(old) or (old if (SHOTS / f'{old}.png').exists() else None)
        if not new:
            sys.exit(f'no mapping for screenshot {old}')
        src = SHOTS / f'{new}.png'
        if not src.exists():
            sys.exit(f'missing screenshot {src}')
        shutil.copy(src, OUT / 'shots' / f'{new}.png')
        return f'![{CAPTIONS.get(new, "")}](shots/{new}.png)'
    text = re.sub(r'!\[\]\(shots/([^)]+?)\.(?:jpg|png)\)', shot, text)
    text = text.replace('{width=16.5cm}', '{width=16cm}')
    # rows of phone screenshots become one composite picture, so every Word viewer lays them out the same way
    from PIL import Image
    rows = 0
    def row(m):
        nonlocal rows
        names = re.findall(r'!\[[^\]]*\]\(shots/([^)]+)\.png\)', m.group(0))
        ims = [Image.open(OUT / 'shots' / f'{n}.png').convert('RGB') for n in names]
        H = 1400
        ims = [im.resize((round(im.width * H / im.height), H)) for im in ims]
        gap = 60
        canvas = Image.new('RGB', (sum(i.width for i in ims) + gap * (len(ims) - 1), H), 'white')
        x = 0
        for im in ims:
            canvas.paste(im, (x, 0)); x += im.width + gap
        rows += 1
        name = f'phones-{rows}'
        canvas.save(OUT / 'shots' / f'{name}.png', optimize=True)
        caps = ['Renewal in the customer app', 'Paying, getting help and verifying a certificate']
        cap = caps[rows - 1] if rows <= len(caps) else ''
        return f'![{cap}](shots/{name}.png){{width=15cm}}'
    text = re.sub(r'^(?:!\[[^\]]*\]\(shots/[^)]+\.png\)\{\.phone[^}]*\}\s*){2,}$', row, text, flags=re.M)
    left = re.findall(r'^#+ \d', text, flags=re.M)
    if left:
        sys.exit(f'numbered headings remain: {left[:5]}')
    acr = (HERE / 'acronyms.txt').read_text().rstrip()
    reg = str(2 + OFFSET) + '.4'
    (OUT / 'proposal.md').write_text(FRONT.format(acr=acr, reg=reg) + '\n' + ABOUT + text)
    print('ok', len(text))

main()
