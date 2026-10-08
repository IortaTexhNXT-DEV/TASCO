/**
 * Business labels shared by the claims, data-quality, partners, users and operations screens
 * (registered into the i18n catalogue; codes never reach the screen).
 */
import { addLabels, addStrings, label, t as tShared } from '../../shared/i18n.js';

addLabels({
  vi: {
    productShort: { TNDS_CAR: 'TNDS ô tô', TNDS_MOTORBIKE: 'TNDS xe máy', MOTOR_PD: 'Vật chất xe', PA_SEAT: 'Tai nạn người ngồi', SAFE_DRIVE: 'Gói An Tâm Lái', FULL_MOTOR: 'Gói Toàn Diện' },
    dataSource: {
      'synthetic-vetc': 'Nhập tài khoản VETC', vetc_account: 'Nhập tài khoản VETC', vetc_app_purchase: 'Giao dịch trên ứng dụng VETC', tasco_core: 'Hệ thống lõi TASCO',
      customer_declared: 'Khách hàng khai báo', partner_inspection_center: 'Tệp trung tâm đăng kiểm', partner_bank: 'Tệp ngân hàng đối tác', partner_showroom: 'Tệp đại lý ô tô',
      partner_fleet: 'Tệp đội xe đối tác', partner_agent: 'Tệp đại lý bảo hiểm', telesales_csv: 'Tệp telesales', voice_bot: 'Cuộc gọi trợ lý tự động', partner_api: 'API đối tác',
      data_steward: 'Hiệu chỉnh của cán bộ dữ liệu', verified_certificate: 'TASCO — giấy chứng nhận đã xác minh', unknown: 'Nguồn chưa xác định',
    },
    integration: {
      'tasco-core-rating': 'Định phí lõi TASCO', 'tasco-core-catalogue': 'Danh mục sản phẩm TASCO', 'tasco-core': 'Phát hành hợp đồng', 'vetc-wallet': 'Ví VETC',
      'voice-ai': 'Trợ lý gọi tự động', 'app-push': 'Thông báo ứng dụng', 'zalo-zns': 'Zalo ZNS', sms: 'SMS thương hiệu',
    },
    job: { reconciliation: 'Đối soát đơn hàng', retention: 'Lưu trữ dữ liệu', relay: 'Chuyển tiếp sự kiện', 'catalogue-sync': 'Đồng bộ danh mục', catalogue_sync: 'Đồng bộ danh mục', voice_campaign: 'Chiến dịch gọi tự động', journey_run: 'Chạy hành trình' },
    scope: { quote: 'Báo giá', purchase: 'Mua bảo hiểm (tạo đơn)', 'policies:read': 'Xem hợp đồng & bảng kê hoa hồng' },
    circuit: { closed: 'Hoạt động', half_open: 'Đang phục hồi', open: 'Gián đoạn' },
    rateSource: { core: 'Lõi TASCO (bắt buộc)', core_with_fallback: 'Lõi TASCO, dự phòng nội bộ', rules: 'Biểu phí nội bộ' },
    method: { tasco_issued: 'Hợp đồng do TASCO phát hành', data_steward: 'Hiệu chỉnh của cán bộ dữ liệu' },
  },
  en: {
    productShort: { TNDS_CAR: 'TNDS car', TNDS_MOTORBIKE: 'TNDS motorbike', MOTOR_PD: 'Physical damage', PA_SEAT: 'Passenger accident', SAFE_DRIVE: 'Safe Drive', FULL_MOTOR: 'Full Motor' },
    dataSource: {
      'synthetic-vetc': 'VETC account import', vetc_account: 'VETC account import', vetc_app_purchase: 'VETC app purchase', tasco_core: 'TASCO core',
      customer_declared: 'Customer declaration', partner_inspection_center: 'Inspection centre file', partner_bank: 'Partner bank file', partner_showroom: 'Car showroom file',
      partner_fleet: 'Partner fleet file', partner_agent: 'Agency file', telesales_csv: 'Telesales file', voice_bot: 'Voice assistant call', partner_api: 'Partner API',
      data_steward: 'Data steward correction', verified_certificate: 'TASCO — verified certificate', unknown: 'Unknown source',
    },
    integration: {
      'tasco-core-rating': 'TASCO core rating', 'tasco-core-catalogue': 'TASCO product catalogue', 'tasco-core': 'Policy issuance', 'vetc-wallet': 'VETC wallet',
      'voice-ai': 'Voice assistant', 'app-push': 'App push', 'zalo-zns': 'Zalo ZNS', sms: 'SMS brandname',
    },
    job: { reconciliation: 'Order reconciliation', retention: 'Data retention', relay: 'Event relay', 'catalogue-sync': 'Catalogue sync', catalogue_sync: 'Catalogue sync', voice_campaign: 'Voice campaign', journey_run: 'Journey run' },
    scope: { quote: 'Quote', purchase: 'Purchase (create orders)', 'policies:read': 'Read policies & statement' },
    circuit: { closed: 'Operational', half_open: 'Recovering', open: 'Outage' },
    rateSource: { core: 'TASCO core (required)', core_with_fallback: 'TASCO core with local fallback', rules: 'Local tariff rules' },
    method: { tasco_issued: 'TASCO-issued policy', data_steward: 'Data steward correction' },
  },
});

/** Business name of a data source code (falls back to a humanised label, never a raw id). */
export const sourceName = (code) => label('dataSource', code || 'unknown');

/** Product label for tables (short) — full name goes in the tooltip. */
export const productShort = (code) => label('productShort', code);

/**
 * Register a page's strings under its own namespace (so generic keys like "newTitle" never collide across pages)
 * and return a page translator that falls back to the shared catalogue (cancel, close, exportCsv…).
 * @param {string} ns  e.g. 'claims' @param {{vi: object, en: object}} dict
 * @returns {(key: string, ...args) => any}
 */
export function pageStrings(ns, dict) {
  const prefixed = Object.fromEntries(Object.entries(dict).map(([l, d]) => [l, Object.fromEntries(Object.entries(d).map(([k, v]) => [`${ns}.${k}`, v]))]));
  addStrings(prefixed);
  return (k, ...args) => {
    const key = `${ns}.${k}`;
    const v = tShared(key, ...args);
    return v === key ? tShared(k, ...args) : v;
  };
}
