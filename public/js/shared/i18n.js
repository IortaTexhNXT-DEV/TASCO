/** UI string catalogue (Vietnamese first, English second). Data values are not translated. */
const STRINGS = {
  vi: {
    signIn: 'Đăng nhập', username: 'Tên đăng nhập', password: 'Mật khẩu', mfaCode: 'Mã xác thực 6 số', verify: 'Xác minh',
    signOut: 'Đăng xuất', help: 'Trợ giúp', theme: 'Giao diện', language: 'English', menu: 'Menu',
    home: 'Tổng quan', leads: 'Khách hàng tiềm năng', voice: 'Trợ lý gọi tự động', handoffs: 'Hộp việc telesales', journeys: 'Hành trình',
    rules: 'Quy tắc nghiệp vụ', partners: 'Đối tác', claims: 'Bồi thường', dq: 'Chất lượng dữ liệu', audit: 'Nhật ký kiểm toán', users: 'Người dùng', ops: 'Vận hành',
    groupWork: 'Công việc', groupGrowth: 'Tăng trưởng', groupGov: 'Quản trị', groupAdmin: 'Quản trị hệ thống',
    loading: 'Đang tải…', empty: 'Không có dữ liệu', save: 'Lưu', cancel: 'Hủy', close: 'Đóng', search: 'Tìm', apply: 'Áp dụng', reset: 'Đặt lại',
    score: 'Điểm', tier: 'Nhóm', journey: 'Hành trình', nba: 'Hành động đề xuất', expiry: 'Hết hạn', days: 'Ngày', region: 'Khu vực', plate: 'Biển số', premium: 'Phí',
    open: 'Mở', next: 'Tiếp', previous: 'Trước',
    welcome: 'Đăng nhập hệ thống', signInHelp: 'Dành cho cán bộ Bảo hiểm TASCO, VETC và đối tác được cấp quyền.',
    securityNote: 'Kết nối được mã hóa. Mọi truy cập đều được ghi nhật ký kiểm toán.',
    mfaTitle: 'Xác thực hai bước', mfaHelp: 'Nhập mã 6 số từ ứng dụng xác thực của bạn.', demoFillCode: 'Đăng nhập bằng mã demo (UAT)', waitForCode: 'Mã vừa được dùng — vui lòng đợi', demoMfaHint: 'Môi trường UAT: dùng ứng dụng xác thực đã cài theo file Excel, hoặc bấm nút dưới đây.',
    heroLabel: 'Giới thiệu nền tảng', heroHeadline: 'Bảo vệ mọi hành trình của 6 triệu chủ xe VETC',
    heroPoint1: 'Gia hạn và mua bảo hiểm một chạm trên ứng dụng VETC và Zalo',
    heroPoint2: 'Trợ lý gọi tự động xác minh biển số trước, chuyển khách quan tâm cho tư vấn viên',
    heroPoint3: 'Cạnh tranh bằng dịch vụ: cứu hộ 24/7, giấy chứng nhận điện tử, bồi thường nhanh',
    poweredBy: 'Phát triển bởi',
    hello: 'Xin chào', copy: 'Sao chép', copied: 'Đã sao chép',
    perSeat: (m) => `${m} triệu đồng/chỗ`, years: (n) => `${n} năm`,
  },
  en: {
    signIn: 'Sign in', username: 'Username', password: 'Password', mfaCode: '6-digit authentication code', verify: 'Verify',
    signOut: 'Sign out', help: 'Help', theme: 'Theme', language: 'Tiếng Việt', menu: 'Menu',
    home: 'Home', leads: 'Leads', voice: 'Voice bot', handoffs: 'Telesales inbox', journeys: 'Journeys',
    rules: 'Rules studio', partners: 'Partners', claims: 'Claims', dq: 'Data quality', audit: 'Audit', users: 'Users', ops: 'Operations',
    groupWork: 'Work', groupGrowth: 'Growth', groupGov: 'Governance', groupAdmin: 'Administration',
    loading: 'Loading…', empty: 'Nothing here yet', save: 'Save', cancel: 'Cancel', close: 'Close', search: 'Search', apply: 'Apply', reset: 'Reset',
    score: 'Score', tier: 'Tier', journey: 'Journey', nba: 'Next best action', expiry: 'Expiry', days: 'Days', region: 'Region', plate: 'Plate', premium: 'Premium',
    open: 'Open', next: 'Next', previous: 'Previous',
    welcome: 'Sign in', signInHelp: 'For authorised TASCO Insurance, VETC and partner staff.',
    securityNote: 'Encrypted connection. Every access is recorded in the audit trail.',
    mfaTitle: 'Two-step verification', mfaHelp: 'Enter the 6-digit code from your authenticator app.', demoFillCode: 'Sign in with demo code (UAT)', waitForCode: 'Code just used — please wait', demoMfaHint: 'UAT environment: use the authenticator app set up from the Excel sheet, or press the button below.',
    heroLabel: 'About the platform', heroHeadline: 'Protecting every journey of VETC’s 6 million drivers',
    heroPoint1: 'One-tap renewal and purchase in the VETC app and Zalo',
    heroPoint2: 'AI voice assistant verifies the plate first, then hands interested customers to advisors',
    heroPoint3: 'Compete on service: 24/7 roadside help, instant e-certificates, fast claims',
    poweredBy: 'Built by',
    hello: 'Hello', copy: 'Copy', copied: 'Copied',
    perSeat: (m) => `VND ${m} million per seat`, years: (n) => `${n} year${n === 1 ? '' : 's'}`,
  },
};

let lang = 'vi';
try { lang = localStorage.getItem('lang') || 'vi'; } catch { /* storage unavailable */ }

export const t = (k, ...args) => {
  const v = STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
  return typeof v === 'function' ? v(...args) : v;
};
export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
}
// Note: the staff console sets <html lang> itself; the customer app and verify page stay Vietnamese.

/**
 * Business-code label dictionary (vi + en). Internal codes (NBA actions,
 * journeys, products, statuses…) are never shown raw: render label(group, code)
 * and keep the code in a title tooltip where it helps support staff.
 */
const LABELS = {
  vi: {
    nba: {
      suppress: 'Không liên hệ', route_b2b: 'Chuyển nhóm khách hàng doanh nghiệp / đội xe', verify_expiry: 'Mời khách xác nhận ngày hết hạn',
      welcome_new_vehicle: 'Chào mừng xe mới', nurture: 'Lên lịch nhắc', urgent_recovery: 'Khẩn: xe chưa có bảo hiểm', voice_bot: 'Gọi trợ lý tự động → telesales',
      digital_reminder: 'Gửi link gia hạn qua app / Zalo', sms_reminder: 'Nhắc qua SMS', enrich: 'Tìm kênh liên lạc',
    },
    journey: {
      renewal: 'Tái tục (khách TASCO)', conquest: 'Chuyển đổi (DN bảo hiểm khác)', new_vehicle: 'Xe mới', lapsed_uninsured: 'Xe đang không có bảo hiểm',
      cross_sell: 'Bán chéo', null: 'Chưa có hành trình', '': 'Chưa có hành trình',
    },
    step: {
      first_reminder: 'Nhắc lần đầu', value_reminder: 'Nhắc quyền lợi', urgent_reminder: 'Nhắc khẩn', expiry_day: 'Ngày hết hạn', lapsed_notice: 'Thông báo hết hạn',
      telesales: 'Telesales gọi', verify_expiry: 'Xác nhận ngày hết hạn', voice_bot: 'Trợ lý gọi tự động', welcome: 'Chào mừng',
    },
    tier: { hot: 'Nóng', warm: 'Ấm', nurture: 'Nuôi dưỡng' },
    ownerType: { individual: 'Cá nhân', company: 'Doanh nghiệp' },
    category: {
      car_under6: 'Xe dưới 6 chỗ (không kinh doanh)', car_6_11: 'Xe 6–11 chỗ (không kinh doanh)', car_12_24: 'Xe 12–24 chỗ (không kinh doanh)', car_over24: 'Xe trên 24 chỗ (không kinh doanh)',
      pickup_van: 'Xe bán tải / minivan', commercial_under6: 'Xe kinh doanh dưới 6 chỗ', commercial_6_8: 'Xe kinh doanh 6–8 chỗ',
      truck_under3t: 'Xe tải dưới 3 tấn', truck_3_8t: 'Xe tải 3–8 tấn', truck_8_15t: 'Xe tải 8–15 tấn', truck_over15t: 'Xe tải trên 15 tấn',
    },
    product: {
      TNDS_CAR: 'Bảo hiểm TNDS bắt buộc ô tô', TNDS_MOTORBIKE: 'Bảo hiểm TNDS bắt buộc xe máy', MOTOR_PD: 'Bảo hiểm vật chất xe ô tô',
      PA_SEAT: 'Bảo hiểm tai nạn lái, phụ xe và người ngồi trên xe', SAFE_DRIVE: 'Gói An Tâm Lái', FULL_MOTOR: 'Gói Toàn Diện',
    },
    benefit: {
      roadside_24_7: 'Cứu hộ giao thông 24/7', e_certificate: 'Giấy chứng nhận điện tử + mã QR', auto_renew: 'Tự động gia hạn', inspection_assist: 'Nhắc và đặt lịch đăng kiểm',
      claims_fast_lane: 'Báo tai nạn nhanh trên ứng dụng', loyalty_points: 'Tích điểm VETC', multi_year: 'Bảo hiểm nhiều năm', upsell_pa_seat: 'Bảo vệ người ngồi trên xe',
      upsell_motor_pd: 'Bảo hiểm vật chất xe', fleet_dashboard: 'Quản lý gia hạn đội xe',
    },
    status: {
      active: 'Hiệu lực', completed: 'Hoàn tất', done: 'Đã thực hiện', sent: 'Đã gửi', won: 'Thành công', resolved: 'Đã xử lý', approved: 'Đã duyệt', paid: 'Đã chi trả',
      open: 'Đang mở', scheduled: 'Đã lên lịch', claimed: 'Đã nhận', submitted: 'Đã gửi yêu cầu', pending_approval: 'Chờ duyệt', draft: 'Bản nháp', callback: 'Hẹn gọi lại',
      acknowledged: 'Đã tiếp nhận', assessor_assigned: 'Đã phân công giám định', under_assessment: 'Đang giám định', skipped: 'Bỏ qua', cancelled: 'Đã hủy', blocked: 'Bị chặn',
      failed: 'Thất bại', lost: 'Không thành công', rejected: 'Từ chối', retired: 'Ngừng áp dụng', dead_letter: 'Lỗi không gửi được', disabled: 'Đã khóa', suspended: 'Tạm ngưng',
      pending: 'Đang chờ', converted: 'Đã chuyển thành đơn', paying: 'Đang thanh toán', pending_payment: 'Chờ thanh toán', payment_failed: 'Thanh toán lỗi', expired: 'Hết hạn',
      revoked: 'Đã thu hồi', running: 'Đang chạy', succeeded: 'Thành công', published: 'Đã phát hành', processing: 'Đang xử lý', in_force: 'Đang hiệu lực', ended: 'Kết thúc',
      not_yet_in_force: 'Chưa đến ngày hiệu lực', refunded: 'Đã hoàn tiền', insured: 'Đã có bảo hiểm', prospect: 'Chưa mua',
    },
    outcome: {
      null: 'Đang diễn ra', hot_handoff: 'Chuyển telesales (khách nóng)', link_sent: 'Đã gửi link', opted_out: 'Từ chối liên hệ', already_renewed: 'Đã gia hạn nơi khác', wrong_person: 'Sai người',
      plate_mismatch: 'Biển số không khớp', unverified: 'Chưa xác minh', callback_later: 'Hẹn gọi lại', no_answer: 'Không nghe máy', scam_concern: 'Lo ngại lừa đảo',
    },
    voiceState: { intro: 'Giới thiệu', verify_plate: 'Xác minh biển số', confirm_expiry: 'Xác nhận hạn', offer: 'Chào sản phẩm', capture_competitor: 'Ghi nhận DN khác', ended: 'Kết thúc' },
    channel: { app_push: 'Thông báo app', zalo_zns: 'Zalo ZNS', sms: 'SMS', voice_bot: 'Trợ lý gọi', telesales: 'Telesales', vetc_app: 'Ứng dụng VETC', zalo: 'Zalo', partner_api: 'API đối tác', email: 'Email' },
    dq: {
      phone: 'Thiếu số điện thoại', name: 'Thiếu tên', reliable_expiry: 'Ngày hết hạn chưa tin cậy', vehicle_category: 'Chưa rõ loại xe', current_insurer: 'Chưa rõ DN bảo hiểm',
      conflicting_phone: 'Số điện thoại mâu thuẫn', invalid_plate: 'Biển số không hợp lệ', wrong_person: 'Sai người (cuộc gọi)', plate_mismatch: 'Biển số không khớp (cuộc gọi)',
      unverified_renewal_claim: 'Khách báo đã gia hạn — chưa xác minh',
    },
    method: {
      verified_certificate: 'Giấy chứng nhận đã xác minh', partner_policy_record: 'Hồ sơ đối tác', customer_declared: 'Khách hàng khai báo', inspection_cycle: 'Chu kỳ đăng kiểm',
      tag_anniversary: 'Ngày kích hoạt thẻ', voice_bot: 'Cuộc gọi trợ lý', unknown: 'Chưa có bằng chứng', steward_correction: 'Hiệu chỉnh dữ liệu',
    },
    role: {
      admin: 'Quản trị hệ thống', executive: 'Lãnh đạo', campaign_manager: 'Quản lý chiến dịch', telesales_agent: 'Tư vấn viên telesales', telesales_supervisor: 'Giám sát telesales',
      rule_author: 'Soạn quy tắc', rule_approver: 'Phê duyệt quy tắc', compliance_officer: 'Tuân thủ', data_steward: 'Quản lý dữ liệu', claims_handler: 'Bồi thường viên',
      partner_manager: 'Quản lý đối tác', auditor: 'Kiểm toán nội bộ', support_engineer: 'Hỗ trợ vận hành',
    },
    objective: { new_business: 'Khai thác mới', retention: 'Giữ chân khách hàng', cross_sell: 'Bán chéo' },
    ruleKind: {
      scoring: 'Chấm điểm khách hàng', nba: 'Hành động đề xuất', journeys: 'Hành trình', benefits: 'Quyền lợi', products: 'Danh mục sản phẩm', enrichment: 'Làm giàu dữ liệu',
      contact_policy: 'Chính sách liên lạc', copy_guard: 'Kiểm soát nội dung', 'content.messages': 'Nội dung tin nhắn', 'content.voicebot': 'Kịch bản trợ lý gọi', commission: 'Hoa hồng',
      costs: 'Chi phí kênh', abac: 'Phân quyền thuộc tính', referral: 'Giới thiệu', retention: 'Lưu trữ dữ liệu', service_levels: 'Mức dịch vụ', triggers: 'Sự kiện kích hoạt',
      'tariff.tnds_car': 'Biểu phí TNDS ô tô', 'tariff.tnds_motorbike': 'Biểu phí TNDS xe máy', 'rating.motor_pd': 'Định phí vật chất xe', 'rating.pa_seat': 'Định phí tai nạn người ngồi',
    },
    partnerType: { bank: 'Ngân hàng', showroom: 'Đại lý ô tô', agent: 'Đại lý bảo hiểm', fleet: 'Đội xe', inspection_center: 'Trung tâm đăng kiểm' },
  },
  en: {
    nba: {
      suppress: 'Do not contact', route_b2b: 'Route to fleet / B2B team', verify_expiry: 'Ask customer to confirm expiry', welcome_new_vehicle: 'Welcome new vehicle',
      nurture: 'Schedule reminders', urgent_recovery: 'Urgent: vehicle uninsured', voice_bot: 'AI voice bot → telesales', digital_reminder: 'One-tap renew link (app / Zalo)',
      sms_reminder: 'SMS reminder', enrich: 'Find a contact channel',
    },
    journey: {
      renewal: 'Renewal (TASCO book)', conquest: 'Conquest (other insurer)', new_vehicle: 'New vehicle', lapsed_uninsured: 'Uninsured recovery', cross_sell: 'Cross-sell',
      null: 'No journey', '': 'No journey',
    },
    step: {
      first_reminder: 'First reminder', value_reminder: 'Value reminder', urgent_reminder: 'Urgent reminder', expiry_day: 'Expiry day', lapsed_notice: 'Lapsed notice',
      telesales: 'Telesales call', verify_expiry: 'Verify expiry', voice_bot: 'Voice bot call', welcome: 'Welcome',
    },
    tier: { hot: 'Hot', warm: 'Warm', nurture: 'Nurture' },
    ownerType: { individual: 'Individual', company: 'Company' },
    category: {
      car_under6: 'Car < 6 seats (non-commercial)', car_6_11: 'Car 6–11 seats (non-commercial)', car_12_24: 'Car 12–24 seats (non-commercial)', car_over24: 'Car > 24 seats (non-commercial)',
      pickup_van: 'Pickup / minivan', commercial_under6: 'Commercial car < 6 seats', commercial_6_8: 'Commercial car 6–8 seats',
      truck_under3t: 'Truck < 3 tonnes', truck_3_8t: 'Truck 3–8 tonnes', truck_8_15t: 'Truck 8–15 tonnes', truck_over15t: 'Truck > 15 tonnes',
    },
    product: {
      TNDS_CAR: 'Compulsory third-party liability (car)', TNDS_MOTORBIKE: 'Compulsory third-party liability (motorbike)', MOTOR_PD: 'Motor physical damage',
      PA_SEAT: 'Driver & passenger accident', SAFE_DRIVE: 'Safe Drive bundle', FULL_MOTOR: 'Full Motor bundle',
    },
    benefit: {
      roadside_24_7: '24/7 roadside assistance', e_certificate: 'Instant e-certificate + QR check', auto_renew: 'Never-lapse auto renewal', inspection_assist: 'Inspection reminder & booking',
      claims_fast_lane: 'Claims fast-lane in the app', loyalty_points: 'VETC loyalty points', multi_year: 'Multi-year cover', upsell_pa_seat: 'Protect your passengers',
      upsell_motor_pd: 'Cover damage to your own car', fleet_dashboard: 'Fleet renewal dashboard',
    },
    status: {
      active: 'Active', completed: 'Completed', done: 'Done', sent: 'Sent', won: 'Won', resolved: 'Resolved', approved: 'Approved', paid: 'Paid',
      open: 'Open', scheduled: 'Scheduled', claimed: 'Claimed', submitted: 'Submitted', pending_approval: 'Pending approval', draft: 'Draft', callback: 'Callback',
      acknowledged: 'Acknowledged', assessor_assigned: 'Assessor assigned', under_assessment: 'Under assessment', skipped: 'Skipped', cancelled: 'Cancelled', blocked: 'Blocked',
      failed: 'Failed', lost: 'Lost', rejected: 'Rejected', retired: 'Retired', dead_letter: 'Dead letter', disabled: 'Disabled', suspended: 'Suspended',
      pending: 'Pending', converted: 'Converted to order', paying: 'Paying', pending_payment: 'Awaiting payment', payment_failed: 'Payment failed', expired: 'Expired',
      revoked: 'Revoked', running: 'Running', succeeded: 'Succeeded', published: 'Published', processing: 'Processing', in_force: 'In force', ended: 'Ended',
      not_yet_in_force: 'Not yet in force', refunded: 'Refunded', insured: 'Insured', prospect: 'Prospect',
    },
    outcome: {
      null: 'In progress', hot_handoff: 'Hot handoff to telesales', link_sent: 'Link sent', opted_out: 'Opted out', already_renewed: 'Already renewed elsewhere', wrong_person: 'Wrong person',
      plate_mismatch: 'Plate mismatch', unverified: 'Not verified', callback_later: 'Call back later', no_answer: 'No answer', scam_concern: 'Scam concern',
    },
    voiceState: { intro: 'Introduction', verify_plate: 'Verifying plate', confirm_expiry: 'Confirming expiry', offer: 'Offer', capture_competitor: 'Capturing competitor', ended: 'Ended' },
    channel: { app_push: 'App push', zalo_zns: 'Zalo ZNS', sms: 'SMS', voice_bot: 'Voice bot', telesales: 'Telesales', vetc_app: 'VETC app', zalo: 'Zalo', partner_api: 'Partner API', email: 'Email' },
    dq: {
      phone: 'Missing phone', name: 'Missing name', reliable_expiry: 'Unreliable expiry date', vehicle_category: 'Uncertain vehicle category', current_insurer: 'Unknown insurer',
      conflicting_phone: 'Conflicting phone numbers', invalid_plate: 'Invalid plate', wrong_person: 'Wrong person (call)', plate_mismatch: 'Plate mismatch (call)',
      unverified_renewal_claim: 'Customer says renewed — unverified',
    },
    method: {
      verified_certificate: 'Verified certificate', partner_policy_record: 'Partner policy record', customer_declared: 'Customer declaration', inspection_cycle: 'Inspection cycle',
      tag_anniversary: 'Tag anniversary', voice_bot: 'Voice bot call', unknown: 'No evidence', steward_correction: 'Steward correction',
    },
    role: {
      admin: 'Admin', executive: 'Executive', campaign_manager: 'Campaign manager', telesales_agent: 'Telesales agent', telesales_supervisor: 'Telesales supervisor',
      rule_author: 'Rule author', rule_approver: 'Rule approver', compliance_officer: 'Compliance officer', data_steward: 'Data steward', claims_handler: 'Claims handler',
      partner_manager: 'Partner manager', auditor: 'Auditor', support_engineer: 'Support engineer',
    },
    objective: { new_business: 'New business', retention: 'Retention', cross_sell: 'Cross-sell' },
    ruleKind: {
      scoring: 'Lead scoring', nba: 'Next best action', journeys: 'Journeys', benefits: 'Benefits', products: 'Product catalogue', enrichment: 'Data enrichment',
      contact_policy: 'Contact policy', copy_guard: 'Copy guard', 'content.messages': 'Message content', 'content.voicebot': 'Voice bot script', commission: 'Commission',
      costs: 'Channel costs', abac: 'Attribute access policies', referral: 'Referral', retention: 'Data retention', service_levels: 'Service levels', triggers: 'Ecosystem triggers',
      'tariff.tnds_car': 'TNDS car tariff', 'tariff.tnds_motorbike': 'TNDS motorbike tariff', 'rating.motor_pd': 'Physical damage rating', 'rating.pa_seat': 'Seat accident rating',
    },
    partnerType: { bank: 'Bank', showroom: 'Car showroom', agent: 'Agent', fleet: 'Fleet', inspection_center: 'Inspection centre' },
  },
};

/** Humanise an unknown code as a last resort (never show snake_case). */
const humanise = (code) => {
  const s = String(code).replace(/[_.]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Label for a business code in a given language (defaults to the UI language). */
export function labelIn(l, group, code) {
  if (code === undefined) return '—';
  const key = code === null ? 'null' : String(code);
  return LABELS[l]?.[group]?.[key] ?? LABELS.en[group]?.[key] ?? (code === null || code === '' ? '—' : humanise(code));
}
export const label = (group, code) => labelIn(lang, group, code);
export const hasLabel = (group, code) => code !== null && code !== undefined && !!(LABELS[lang]?.[group]?.[code] ?? LABELS.en[group]?.[code]);
