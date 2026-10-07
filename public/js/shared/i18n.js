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
    mfaTitle: 'Xác thực hai bước', mfaHelp: 'Nhập mã 6 số từ ứng dụng xác thực của bạn.', demoFillCode: 'Môi trường demo: điền mã tự động',
    heroLabel: 'Giới thiệu nền tảng', heroHeadline: 'Bảo vệ mọi hành trình của 6 triệu chủ xe VETC',
    heroPoint1: 'Gia hạn và mua bảo hiểm một chạm trên ứng dụng VETC và Zalo',
    heroPoint2: 'Trợ lý gọi tự động xác minh biển số trước, chuyển khách quan tâm cho tư vấn viên',
    heroPoint3: 'Cạnh tranh bằng dịch vụ: cứu hộ 24/7, giấy chứng nhận điện tử, bồi thường nhanh',
    poweredBy: 'Phát triển bởi',
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
    mfaTitle: 'Two-step verification', mfaHelp: 'Enter the 6-digit code from your authenticator app.', demoFillCode: 'Demo environment: fill code automatically',
    heroLabel: 'About the platform', heroHeadline: 'Protecting every journey of VETC’s 6 million drivers',
    heroPoint1: 'One-tap renewal and purchase in the VETC app and Zalo',
    heroPoint2: 'AI voice assistant verifies the plate first, then hands interested customers to advisors',
    heroPoint3: 'Compete on service: 24/7 roadside help, instant e-certificates, fast claims',
    poweredBy: 'Built by',
  },
};

let lang = 'vi';
try { lang = localStorage.getItem('lang') || 'vi'; } catch { /* storage unavailable */ }

export const t = (k) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('lang', l); } catch { /* ignore */ }
}
document.documentElement.lang = lang;
