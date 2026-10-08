/**
 * Contextual help per page (shown in the Help drawer), in English and Vietnamese.
 * Business language only: what the page is for and how to work with it — no technical internals.
 * HELP[key] resolves to the current UI language at read time ({ title, body: string[] }).
 */
import { getLang } from '../shared/i18n.js';

const EN = {
  home: {
    title: 'Dashboard',
    body: [
      'Your key figures at a glance: customers, leads by tier, sales, data quality and channel costs.',
      'New business (uninsured, new vehicles, customers of other insurers) is shown separately from TASCO renewals.',
      'Select a tile or chart to open the matching list.',
    ],
  },
  leads: {
    title: 'Leads',
    body: [
      'Vehicles are ranked by a lead score from 0 to 100. Hot leads score 70 or more, warm leads 45 or more.',
      'Open a lead to see why it scored as it did and what to do next.',
      'The next best action already respects consent, do-not-contact requests and data quality.',
    ],
  },
  customer: {
    title: 'Customer 360',
    body: [
      'One view of the customer and vehicle, built from VETC, TASCO and partner sources.',
      'Each detail shows where it came from and how reliable it is. Personal details are masked unless your role allows them.',
      'If the expiry date is uncertain, confirm it with the customer before offering a renewal.',
    ],
  },
  voice: {
    title: 'Voice assistant',
    body: [
      'Rehearse or supervise the voice assistant that calls customers about renewals.',
      'The assistant always says it is automated, checks the licence plate first and never asks for codes or payment.',
      'Interested customers are passed to telesales with a summary and talking points.',
    ],
  },
  handoffs: {
    title: 'Telesales inbox',
    body: [
      'Work your queue from the top: call from the official hotline, prepare a quote and send it to the customer’s app.',
      'Lead with service value (roadside help, e-certificate, auto-renewal). Compulsory TNDS prices are regulated — never promise discounts.',
      'Record the outcome so reminders stop or are rescheduled.',
    ],
  },
  journeys: {
    title: 'Journeys',
    body: [
      'Journeys contact customers at the right moment: renewals, uninsured vehicles, new vehicles and cover upgrades.',
      'Messages respect contact hours, frequency limits and consent.',
      'Events in the VETC app, such as booking an inspection, can trigger a timely message.',
    ],
  },
  campaigns: {
    title: 'Campaigns',
    body: [
      'Plan and follow outbound campaigns by audience, channel and period.',
      'Results show reach, responses and sales for each campaign.',
    ],
  },
  rules: {
    title: 'Business rules',
    body: [
      'Business settings — lead scoring, next best actions, journeys, contact policy, messages, products and commissions — are managed here without IT changes.',
      'To change a setting: create a draft, edit the form, check “What changes” and run a simulation, then submit it with a short note.',
      'A different person approves the change. Restricted rule sets need a compliance officer.',
      'Every version is kept, so you can roll back to an earlier one at any time.',
      'Customer wording is checked automatically against words that are not allowed, such as discount promises.',
    ],
  },
  approvals: {
    title: 'Approvals',
    body: [
      'Rule changes submitted by colleagues wait here for a second person to review them.',
      'Open a change to see exactly what changes, the author’s note and the effect on a sample of customers.',
      'Approving activates the new version immediately. Rejecting returns it to the author with your reason.',
      'You cannot approve your own changes.',
    ],
  },
  partners: {
    title: 'Partners',
    body: [
      'Onboard banks, car showrooms, agents, fleets and inspection centres that sell TASCO insurance.',
      'Give partners secure access for quoting and selling, and download their commission statements.',
      'Commission rates stay within the limits set by regulation.',
    ],
  },
  claims: {
    title: 'Claims',
    body: [
      'Customers report accidents in the VETC app with photos and location.',
      'Acknowledge each new claim within the service level, then move it forward with the next action.',
      'Decisions such as approving, rejecting or paying ask for the required details before they are recorded.',
    ],
  },
  dq: {
    title: 'Data quality',
    body: [
      'Gaps and conflicts found in customer and vehicle data appear here, such as a missing phone or an uncertain expiry date.',
      'Resolve each issue by confirming the value, correcting it with evidence or dismissing it with a reason.',
      'Customers are also invited to correct their own details in the app.',
    ],
  },
  audit: {
    title: 'Audit trail',
    body: [
      'Every important action is recorded: who did what, to which record and when.',
      'Filter by person, activity type, dates or object, and export the result for an audit or regulator request.',
      'The integrity check confirms that no record has been changed or removed since it was written.',
    ],
  },
  users: {
    title: 'Users',
    body: [
      'Create staff accounts with only the roles each person needs, and a region where relevant.',
      'Two-step verification is required for sensitive roles.',
      'Unlock accounts or reset sign-in from the row menu.',
    ],
  },
  ops: {
    title: 'Operations',
    body: [
      'Health of the connections to TASCO core, payments and messaging, with the time of the last check.',
      'Run daily reconciliation and the data retention policy, and review the history of scheduled jobs.',
    ],
  },
};

const VI = {
  home: {
    title: 'Tổng quan',
    body: [
      'Các chỉ số chính: khách hàng, khách hàng tiềm năng theo nhóm, doanh số, chất lượng dữ liệu và chi phí kênh.',
      'Khai thác mới (xe chưa có bảo hiểm, xe mới, khách của công ty khác) được tách riêng với tái tục khách TASCO.',
      'Chọn một ô chỉ số hoặc biểu đồ để mở danh sách tương ứng.',
    ],
  },
  leads: {
    title: 'Khách hàng tiềm năng',
    body: [
      'Xe được xếp hạng theo điểm tiềm năng từ 0 đến 100. Nhóm Nóng từ 70 điểm, nhóm Ấm từ 45 điểm.',
      'Mở từng khách hàng để xem lý do chấm điểm và việc cần làm tiếp theo.',
      'Hành động đề xuất đã tính đến sự đồng ý liên hệ, yêu cầu không liên hệ và chất lượng dữ liệu.',
    ],
  },
  customer: {
    title: 'Khách hàng 360',
    body: [
      'Toàn cảnh về khách hàng và phương tiện, tổng hợp từ VETC, TASCO và đối tác.',
      'Mỗi thông tin đều ghi rõ nguồn và độ tin cậy. Thông tin cá nhân được che nếu vai trò của bạn không được phép xem.',
      'Nếu ngày hết hạn chưa chắc chắn, hãy xác nhận với khách hàng trước khi mời tái tục.',
    ],
  },
  voice: {
    title: 'Trợ lý gọi tự động',
    body: [
      'Thử nghiệm hoặc giám sát trợ lý gọi tự động nhắc khách hàng tái tục.',
      'Trợ lý luôn thông báo là cuộc gọi tự động, xác minh biển số trước và không bao giờ hỏi mã OTP hay yêu cầu thanh toán.',
      'Khách hàng quan tâm được chuyển cho telesales kèm tóm tắt và gợi ý tư vấn.',
    ],
  },
  handoffs: {
    title: 'Hộp việc telesales',
    body: [
      'Xử lý lần lượt từ trên xuống: gọi từ tổng đài chính thức, lập báo giá và gửi vào ứng dụng của khách hàng.',
      'Nhấn mạnh giá trị dịch vụ (cứu hộ, giấy chứng nhận điện tử, tự động gia hạn). Phí TNDS bắt buộc theo quy định — không hứa giảm giá.',
      'Ghi nhận kết quả để hệ thống dừng hoặc dời lịch nhắc.',
    ],
  },
  journeys: {
    title: 'Hành trình',
    body: [
      'Hành trình liên hệ khách hàng đúng thời điểm: tái tục, xe chưa có bảo hiểm, xe mới và nâng cấp bảo hiểm.',
      'Tin nhắn tuân thủ khung giờ, giới hạn tần suất và sự đồng ý của khách hàng.',
      'Sự kiện trên ứng dụng VETC, như đặt lịch đăng kiểm, có thể kích hoạt tin nhắn kịp thời.',
    ],
  },
  campaigns: {
    title: 'Chiến dịch',
    body: [
      'Lập kế hoạch và theo dõi chiến dịch theo đối tượng, kênh và thời gian.',
      'Kết quả thể hiện số khách hàng tiếp cận, phản hồi và doanh số của từng chiến dịch.',
    ],
  },
  rules: {
    title: 'Quy tắc nghiệp vụ',
    body: [
      'Các thiết lập nghiệp vụ — chấm điểm, hành động đề xuất, hành trình, chính sách liên hệ, nội dung tin nhắn, sản phẩm và hoa hồng — được quản lý tại đây mà không cần IT.',
      'Để thay đổi: tạo bản nháp, sửa trên biểu mẫu, xem phần “Thay đổi” và chạy mô phỏng, rồi gửi phê duyệt kèm ghi chú ngắn.',
      'Một người khác sẽ phê duyệt. Bộ quy tắc hạn chế cần cán bộ tuân thủ phê duyệt.',
      'Mọi phiên bản đều được lưu lại, có thể khôi phục phiên bản trước bất cứ lúc nào.',
      'Nội dung gửi khách hàng được tự động kiểm tra các từ ngữ không được phép, như hứa hẹn giảm giá.',
    ],
  },
  approvals: {
    title: 'Phê duyệt',
    body: [
      'Các thay đổi quy tắc do đồng nghiệp đề xuất được chờ người thứ hai xem xét tại đây.',
      'Mở từng đề xuất để xem chính xác nội dung thay đổi, ghi chú của tác giả và tác động trên nhóm khách hàng mẫu.',
      'Phê duyệt sẽ áp dụng phiên bản mới ngay. Từ chối sẽ trả lại cho tác giả kèm lý do.',
      'Bạn không thể tự phê duyệt thay đổi của mình.',
    ],
  },
  partners: {
    title: 'Đối tác',
    body: [
      'Quản lý ngân hàng, đại lý ô tô, đại lý bảo hiểm, đội xe và trung tâm đăng kiểm bán bảo hiểm TASCO.',
      'Cấp quyền truy cập an toàn để đối tác báo giá, bán hàng và tải bảng kê hoa hồng.',
      'Tỷ lệ hoa hồng luôn trong giới hạn theo quy định.',
    ],
  },
  claims: {
    title: 'Bồi thường',
    body: [
      'Khách hàng báo tai nạn trên ứng dụng VETC kèm hình ảnh và vị trí.',
      'Tiếp nhận hồ sơ mới trong thời hạn cam kết, sau đó xử lý theo bước tiếp theo.',
      'Các quyết định như duyệt, từ chối hay chi trả đều yêu cầu nhập thông tin cần thiết trước khi ghi nhận.',
    ],
  },
  dq: {
    title: 'Chất lượng dữ liệu',
    body: [
      'Các thiếu sót và mâu thuẫn trong dữ liệu khách hàng, phương tiện được liệt kê tại đây, như thiếu số điện thoại hay ngày hết hạn chưa chắc chắn.',
      'Xử lý bằng cách xác nhận giá trị, điều chỉnh kèm bằng chứng hoặc bỏ qua kèm lý do.',
      'Khách hàng cũng được mời tự cập nhật thông tin trên ứng dụng.',
    ],
  },
  audit: {
    title: 'Nhật ký kiểm toán',
    body: [
      'Mọi thao tác quan trọng đều được ghi lại: ai đã làm gì, với hồ sơ nào và khi nào.',
      'Lọc theo người thực hiện, loại hoạt động, thời gian hoặc đối tượng, và xuất kết quả phục vụ kiểm toán hay yêu cầu của cơ quan quản lý.',
      'Kiểm tra toàn vẹn xác nhận không bản ghi nào bị sửa hay xóa kể từ khi ghi nhận.',
    ],
  },
  users: {
    title: 'Người dùng',
    body: [
      'Tạo tài khoản cán bộ chỉ với các vai trò cần thiết và khu vực phụ trách.',
      'Xác thực hai bước là bắt buộc với các vai trò nhạy cảm.',
      'Mở khóa tài khoản hoặc đặt lại đăng nhập từ menu của từng dòng.',
    ],
  },
  ops: {
    title: 'Vận hành',
    body: [
      'Tình trạng kết nối với TASCO core, thanh toán và nhắn tin, kèm thời điểm kiểm tra gần nhất.',
      'Chạy đối soát hằng ngày, chính sách lưu trữ dữ liệu và xem lịch sử các tác vụ định kỳ.',
    ],
  },
};

/** Help entries in the current UI language (English fallback). */
export const HELP = new Proxy({}, {
  get: (_t, key) => (getLang() === 'vi' ? VI[key] || EN[key] : EN[key]),
  has: (_t, key) => key in EN,
  ownKeys: () => Object.keys(EN),
  getOwnPropertyDescriptor: (_t, key) => (key in EN ? { enumerable: true, configurable: true, value: getLang() === 'vi' ? VI[key] || EN[key] : EN[key] } : undefined),
});
