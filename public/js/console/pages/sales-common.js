/**
 * Shared building blocks for the Sales & Service screens (dashboard, leads, Customer 360, telesales inbox,
 * voice assistant, campaigns, journeys): the screen-level string catalogue (English + Vietnamese), business-name
 * mappings for data sources / fields / contact-policy reasons, and small cell renderers built from ui.js.
 */
import { h } from '../../shared/dom.js';
import { getLang, label, labelIn } from '../../shared/i18n.js';
import {
  icon, badge, plateTag, tooltip, formatDate, formatNumber, formatRelative, dropdownMenu, chip,
} from '../ui.js';

/* =========================================================================
 * Strings
 * ========================================================================= */

const EN = {
  // Dashboards
  goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
  asOf: (d) => `Business date ${d}`,
  policiesSold: 'Policies sold', gwp: 'Written premium', premiumDue90: 'Premium due · 90 days', expiring30: 'Expiring in 30 days',
  uninsured: 'Uninsured vehicles', uninsuredHint: 'Lapsed ≤ 60 days', hotLeads: 'Hot leads', warmCount: (n) => `${n} warm`,
  voiceSaving: 'Voice saving', voiceSavingHint: (n) => `vs ${n} by telesales`, gwpHint: (n) => `${n} policies`,
  premiumDueHint: (n) => `${n} vehicles`, expiringHint: 'Renewal window open',
  pipelineTitle: 'Policies and premium due by month', pipelinePolicies: 'Policies', pipelinePremium: 'Premium',
  seriesRenewal: 'Renewal (TASCO book)', seriesNewBusiness: 'New business', journeyMix: 'Journey mix', salesByChannel: 'Sales by channel',
  voicePerformance: 'Voice assistant', callsMade: 'Calls made', hotHandoffs: 'Hot handoffs', linksSent: 'Renewal links sent',
  dataRepair: 'Data repair progress', usableExpiry: 'Vehicles with a reliable expiry date', vehiclesWithIssues: 'Vehicles with open data issues',
  topIssues: 'Top open issues', openIssues: 'Open issues', resolvedIssues: 'Resolved', viewQueue: 'Open queue',
  pipelineByJourney: 'Pipeline by journey', leadsCol: 'Leads', dueToday: 'Due today', dueWeek: 'Due in 7 days', scheduledTouchpoints: 'Scheduled touchpoints',
  dueTouchpoints: 'Due touchpoints', runDueNow: 'Run due touchpoints', nothingDueToday: 'Nothing due today', nothingDueTodayHint: 'The next touchpoints are scheduled for later this week.',
  campaignPerformance: 'Campaign performance', messagesSent: 'Messages sent', messagesByChannel: 'Messages by channel',
  teamSla: 'Team handoff SLA', openHandoffs: 'Open handoffs', slaBreached: 'SLA breached', dueSoon: 'Due soon', onTrack: 'On track', winRate: 'Win rate',
  wonLost: (w, l) => `${w} won · ${l} lost`, openByAgent: 'Open by agent', openByRegion: 'Open by region', unassigned: 'Unassigned', slaWatchlist: 'SLA watchlist',
  myWorkToday: 'My work today', myOpenHandoffs: 'Handoffs to call', callbacksDue: 'Callbacks', newHotLeads: 'New in my region', myHotLeads: 'Hot leads to work',
  noHandoffs: 'No handoffs waiting', noHandoffsHint: 'New hot leads from the voice assistant will appear here.', noCallbacks: 'No callbacks scheduled',
  workQueue: 'Open inbox', allLeads: 'All leads', summary: 'Summary', vehicles: 'Vehicles in golden record', vehiclesHint: (n) => `${n} with a reliable expiry`,
  quickLinks: 'Go to',
  // Leads
  leadsSubtitle: 'Prioritised by explainable score',
  vehicle: 'Vehicle', owner: 'Owner', expiry: 'Expiry', region: 'Region', premium: 'Premium', nba: 'Next best action', score: 'Score', tier: 'Tier', journey: 'Journey',
  searchPlate: 'Search plate…', allTiers: 'All tiers', anyJourney: 'Journey', anyAction: 'Next best action', anyRegion: 'Region', clearFilters: 'Clear filters',
  inDays: (n) => (n === 0 ? 'today' : n === 1 ? 'in 1 day' : `in ${n} days`), lapsedDays: (n) => (n === 1 ? 'lapsed 1 day' : `lapsed ${n} days`), expiryUnknown: 'Unknown',
  noLeads: 'No leads match', noLeadsHint: 'Try removing a filter.', leadQueue: 'Lead queue', company: 'Company', exportAll: 'Export CSV',
  // Customer 360
  overview: 'Overview', policyQuotes: 'Policy & quotes', dataSources: 'Data & sources', journeyTab: 'Journey', contactHistory: 'Contact history', activity: 'Activity',
  sendQuote: 'Send quote', startCall: 'Start assistant call', callCustomer: 'Call customer', correctExpiry: 'Correct expiry date', simulateTopUp: 'Simulate wallet top-up',
  openInbox: 'Open in telesales inbox', insuredTasco: 'Insured with TASCO', expiresIn: (n) => (n === 0 ? 'Expires today' : `Expires in ${n} days`), lapsedFor: (n) => `Lapsed ${n} days`,
  expiresOn: (d) => `Expiry ${d}`, consentMarketing: 'Marketing consent', consentCall: 'Call consent', reachApp: 'VETC app notifications', reachZalo: 'Zalo', reachSms: 'SMS',
  given: 'given', notGiven: 'not given', available: 'available', notAvailable: 'not available', dnc: 'Do not contact', dncText: 'The customer opted out. Do not call or message.',
  whyThisCustomer: 'Why this customer', scoreOf: (a, b) => `${a} of ${b}`, guidedAction: 'Guided next action', valueToOffer: 'Value to offer', staffOnly: 'Staff only · pending legal review',
  noLead: 'No lead record for this vehicle', currentPolicies: 'Current policies', noPolicies: 'No policies issued through the platform yet', certificate: 'Certificate', period: 'Period',
  quoteBuilder: 'Build a quote', products: 'Products', compulsory: 'Compulsory', optional: 'Optional', regulated: 'Regulated price', term: 'Term', options: 'Options',
  seatCover: 'Cover per seat', vehicleValue: 'Vehicle value (sum insured)', vehicleValueHelp: 'Market value of the vehicle in VND', calculate: 'Calculate price',
  quoteSummary: 'Quote summary', net: 'Premium', vat: 'VAT', total: 'Total', bundleApplied: 'Bundle', pricedByCore: 'Priced by TASCO core', pricedByRules: 'Priced by TASCO filed rates',
  indicativeTitle: 'Indicative price', indicativeText: 'TASCO core was unavailable. Re-rate before the customer can pay.', rerate: 'Re-rate', sendToApp: 'Send to customer’s VETC app',
  quoteSent: 'Quote sent to the customer’s VETC app', noChannel: 'No channel available to reach this customer', inspection: 'Vehicle inspection', inspectionNeeded: 'Physical damage cover needs a vehicle inspection before payment.',
  recordInspection: 'Record inspection', inspectionRecorded: 'Inspection recorded', inspectionEvidence: 'Inspection evidence', inspectionEvidenceHelp: 'Assessor name and photo reference',
  inspectionPassed: 'Inspection passed', quoteSteps: ['Build', 'Inspect', 'Send to app'], quoteStepsNoInspect: ['Build', 'Send to app'], quoteEmpty: 'Choose products and calculate a price',
  quoteEmptyHint: 'The customer confirms and pays in the VETC app — never by phone.', paSeatDesc: 'Driver and passengers, per seat', pdDesc: 'Damage to the customer’s own car',
  tndsDesc: 'Third-party liability required by law',
  goldenRecord: 'Golden record', ownerName: 'Owner name', phone: 'Phone', province: 'Province', ownerType: 'Owner type', vehicleCategory: 'Vehicle category',
  policyExpiry: 'Policy expiry', insurer: 'Current insurer', sources: 'Sources', dataScore: 'Data completeness', lineage: 'Where the data comes from', field: 'Field', source: 'Source',
  confidence: 'Confidence', expiryEvidence: 'Expiry evidence', outranked: 'Outranked', used: 'Used', dqIssues: 'Data-quality issues', noDqIssues: 'No open data issues',
  resolve: 'Resolve', masked: 'Masked', otherInsurer: 'Other insurer', unknownInsurer: 'Unknown', renewedElsewhere: 'Says renewed elsewhere (unverified)',
  touchpoints: 'Touchpoints', noTouchpoints: 'No touchpoints scheduled', scheduledFor: (d) => `Scheduled for ${d}`, executed: (d) => `Executed ${d}`,
  noContact: 'No messages or calls yet', assistantCall: 'Assistant call', viewCall: 'View call', message: 'Message', channel: 'Channel', status: 'Status', when: 'When',
  noActivity: 'No activity yet', newExpiry: 'New expiry date', evidence: 'Evidence', evidenceHelp: 'e.g. certificate photo sent by the customer', saveCorrection: 'Save correction',
  corrected: 'Expiry corrected and lead re-scored', eventSent: 'Ecosystem event processed', noTrigger: 'No trigger matched', personal: 'Individual', masked2: 'Hidden for your role',
  // Inbox
  inboxSubtitle: 'Hot leads from the voice assistant and journey escalations', queue: 'Queue', onlyMine: 'Only mine', statusOpen: 'New', statusClaimed: 'In progress',
  statusCallback: 'Callback', statusWon: 'Won', statusLost: 'Lost', selectHandoff: 'Select a handoff', selectHandoffHint: 'Pick a customer from the queue to see the call brief.',
  botSummary: 'Call brief', talkingPoints: 'Talking points', customerSnapshot: 'Customer', notes: 'Notes', addNote: 'Add note', scheduleCallback: 'Schedule callback', markWon: 'Mark won',
  markLost: 'Mark lost', reassign: 'Reassign', viewCustomer: 'View Customer 360', plateVerified: 'Plate verified by the customer', plateNotVerified: 'Plate not verified',
  reason: 'Reason', age: 'Age', assignedTo: 'Assigned to', note: 'Note', callbackWhen: 'Call back on', callbackTime: 'Time', outcomeNote: 'What happened?', lostReason: 'Reason',
  lostReasons: [['price', 'Price / budget'], ['renewed_elsewhere', 'Renewed with another insurer'], ['not_interested', 'Not interested'], ['unreachable', 'Could not reach the customer'], ['other', 'Other']],
  wonHelp: 'The customer confirmed and will pay in the VETC app.', reassignTo: 'Assign to', handoffUpdated: 'Handoff updated', callStarted: 'Handoff claimed — call the customer from the official hotline',
  dialHint: 'Dial from the official TASCO/VETC hotline', priceAsked: 'Asked about price', trustConcern: 'Raised a trust concern', mine: 'Me', slaLeft: (t) => `${t} left`, slaOver: (t) => `${t} over`,
  phoneLabel: 'Phone',
  // Voice
  voiceSubtitle: 'Automated calls and rehearsals', calls: 'Calls', rehearse: 'Rehearse a call', newCampaign: 'New campaign', callType: 'Type', typeCampaign: 'Campaign', typeRehearsal: 'Rehearsal',
  verification: 'Plate check', verified: 'Verified', notVerified: 'Not verified', outcome: 'Outcome', turns: 'Exchanges', handoff: 'Handoff', callDetail: 'Call detail', transcript: 'Transcript',
  assistant: 'Assistant', customer: 'Customer', openHandoff: 'Open handoff', noCalls: 'No calls yet', noCallsHint: 'Run a campaign or rehearse a call to see it here.', allOutcomes: 'All outcomes',
  pickCustomer: 'Choose a customer to rehearse with', rehearsalTitle: 'Rehearsal call', callerId: 'VETC assistant', calling: 'In call', callEnded: 'Call ended', typeReply: 'What the customer says…',
  send: 'Send', quickReplies: 'Quick replies', endCall: 'End call', restart: 'Restart', stageIntro: 'Introduction', stageVerify: 'Plate check', stageOffer: 'Offer', stageWrap: 'Wrap-up',
  handedOff: 'Hot lead handed to telesales', translation: 'Translation', showTranslation: 'Show English translation', duration: 'Duration',
  // Campaigns
  campaignsSubtitle: 'Voice and messaging campaigns with results', campaignName: 'Campaign', reached: 'Reached', started: 'Started', by: 'By', audience: 'Audience', channelVoice: 'Voice assistant',
  channelJourney: 'Journey messages', journeyRunName: (d) => `Journey touchpoints · ${d}`, untitled: 'Voice campaign', campaignsRun: 'Campaigns run', customersReached: 'Customers reached',
  noCampaigns: 'No campaigns yet', noCampaignsHint: 'Launch a campaign to reach customers by voice or message.', name: 'Name', nameHelp: 'A short name your team will recognise',
  audienceTier: 'Lead tier', audienceJourney: 'Journey', audienceRegion: 'Region', allJourneys: 'All journeys', allRegions: 'All regions', maxCalls: 'Maximum calls', schedule: 'Calling window',
  scheduleDate: 'Date', scheduleTime: 'Start time (local)', scheduleHelp: 'Calls only go out inside the allowed contact hours', preview: 'Contact-policy preview', inAudience: 'In audience',
  eligible: 'Can be contacted', willCall: 'Will be called', heldBack: 'Held back by contact policy', routedFleet: 'Routed to fleet team', launch: 'Launch campaign', launched: 'Campaign completed',
  results: 'Results', outcomes: 'Outcomes', notContacted: 'Not contacted', touchpointsDone: 'Touchpoints sent', touchpointsSkipped: 'Skipped', byChannel: 'By channel', byJourney: 'By journey',
  messagingInfo: 'Sends every touchpoint that is due, following each journey’s cadence and the contact policy.', dueNow: 'Due now', runNow: 'Run now', campaignResults: 'Campaign results',
  previewLoading: 'Checking contact policy…', limitHelp: 'Between 1 and 200', ofCalls: (p) => `${p} of calls`,
  // Journeys
  journeysSubtitle: 'Cadences for new business and retention', simulateEvent: 'Simulate ecosystem event', inJourney: 'In journey', conversion: 'Conversion', cadence: 'Cadence',
  event: 'Event', customerPlate: 'Customer plate', plateHelp: 'e.g. 30E-949.35', sendEvent: 'Send event', eventResult: 'Result', runDate: 'Business date', runTime: 'Send time (local)',
  runDone: (d, s) => `${d} touchpoints sent, ${s} skipped`, runHelp: 'Consent, contact hours, frequency caps and copy rules apply to every message.',
  nextTouchpoints: 'Next scheduled touchpoints', due: 'Due', step: 'Step', priority: 'Priority', anchorExpiry: 'Before / after policy expiry', anchorToday: 'From enrolment', anchorTag: 'From tag activation',
  cardSold: 'Sold', cardHot: 'Hot', anchorPurchase: 'After purchase', consentReach: 'Consent & reach', noNotes: 'No notes yet', withinSla: 'Within SLA',
  slaHint: (b, s) => `${b} breached · ${s} due soon`, noCallbacksHint: 'Callbacks you schedule will appear here.', messagesCalls: 'Messages and calls', renewLink: 'renewal link',
  derived: (x) => `Derived: ${x}`, reasonHot: 'Interested during assistant call', reasonEscalation: 'No response to reminders', quoteSentEvent: 'Quote sent to the customer’s app',
  sentVia: (step, ch) => `${step} sent via ${ch}`, policyIssued: (p) => `Policy issued: ${p}`, sold: 'Sold', policiesByProduct: 'Policies by product',
};

const VI = {
  goodMorning: 'Chào buổi sáng', goodAfternoon: 'Chào buổi chiều', goodEvening: 'Chào buổi tối',
  asOf: (d) => `Ngày nghiệp vụ ${d}`,
  policiesSold: 'Hợp đồng đã bán', gwp: 'Doanh thu phí', premiumDue90: 'Phí đến hạn · 90 ngày', expiring30: 'Hết hạn trong 30 ngày',
  uninsured: 'Xe không có bảo hiểm', uninsuredHint: 'Quá hạn ≤ 60 ngày', hotLeads: 'Khách nóng', warmCount: (n) => `${n} khách ấm`,
  voiceSaving: 'Tiết kiệm chi phí gọi', voiceSavingHint: (n) => `so với ${n} nếu gọi bằng telesales`, gwpHint: (n) => `${n} hợp đồng`,
  premiumDueHint: (n) => `${n} xe`, expiringHint: 'Đang trong thời gian tái tục',
  pipelineTitle: 'Hợp đồng và phí đến hạn theo tháng', pipelinePolicies: 'Hợp đồng', pipelinePremium: 'Phí bảo hiểm',
  seriesRenewal: 'Tái tục (khách TASCO)', seriesNewBusiness: 'Khai thác mới', journeyMix: 'Cơ cấu hành trình', salesByChannel: 'Doanh số theo kênh',
  voicePerformance: 'Trợ lý gọi tự động', callsMade: 'Cuộc gọi đã thực hiện', hotHandoffs: 'Chuyển telesales', linksSent: 'Đã gửi link gia hạn',
  dataRepair: 'Tiến độ làm sạch dữ liệu', usableExpiry: 'Xe có ngày hết hạn tin cậy', vehiclesWithIssues: 'Xe còn vấn đề dữ liệu',
  topIssues: 'Vấn đề phổ biến', openIssues: 'Đang mở', resolvedIssues: 'Đã xử lý', viewQueue: 'Mở hàng đợi',
  pipelineByJourney: 'Khách hàng theo hành trình', leadsCol: 'Khách hàng', dueToday: 'Đến hạn hôm nay', dueWeek: 'Đến hạn trong 7 ngày', scheduledTouchpoints: 'Điểm chạm đã lên lịch',
  dueTouchpoints: 'Điểm chạm đến hạn', runDueNow: 'Chạy điểm chạm đến hạn', nothingDueToday: 'Không có điểm chạm đến hạn hôm nay', nothingDueTodayHint: 'Các điểm chạm tiếp theo đã được lên lịch trong tuần.',
  campaignPerformance: 'Hiệu quả chiến dịch', messagesSent: 'Tin nhắn đã gửi', messagesByChannel: 'Tin nhắn theo kênh',
  teamSla: 'SLA xử lý của nhóm', openHandoffs: 'Việc đang mở', slaBreached: 'Quá hạn SLA', dueSoon: 'Sắp đến hạn', onTrack: 'Đúng hạn', winRate: 'Tỷ lệ thành công',
  wonLost: (w, l) => `${w} thành công · ${l} không thành công`, openByAgent: 'Việc mở theo tư vấn viên', openByRegion: 'Việc mở theo khu vực', unassigned: 'Chưa phân công', slaWatchlist: 'Theo dõi SLA',
  myWorkToday: 'Việc của tôi hôm nay', myOpenHandoffs: 'Khách cần gọi', callbacksDue: 'Hẹn gọi lại', newHotLeads: 'Mới trong khu vực', myHotLeads: 'Khách nóng cần xử lý',
  noHandoffs: 'Không có khách đang chờ', noHandoffsHint: 'Khách nóng mới từ trợ lý gọi sẽ hiển thị tại đây.', noCallbacks: 'Chưa có lịch gọi lại',
  workQueue: 'Mở hộp việc', allLeads: 'Tất cả khách hàng', summary: 'Tổng quan', vehicles: 'Xe trong hồ sơ hợp nhất', vehiclesHint: (n) => `${n} xe có ngày hết hạn tin cậy`,
  quickLinks: 'Đi tới',
  leadsSubtitle: 'Ưu tiên theo điểm có giải thích',
  vehicle: 'Xe', owner: 'Chủ xe', expiry: 'Hết hạn', region: 'Khu vực', premium: 'Phí', nba: 'Hành động đề xuất', score: 'Điểm', tier: 'Nhóm', journey: 'Hành trình',
  searchPlate: 'Tìm biển số…', allTiers: 'Tất cả nhóm', anyJourney: 'Hành trình', anyAction: 'Hành động đề xuất', anyRegion: 'Khu vực', clearFilters: 'Xóa bộ lọc',
  inDays: (n) => (n === 0 ? 'hôm nay' : `còn ${n} ngày`), lapsedDays: (n) => `quá hạn ${n} ngày`, expiryUnknown: 'Chưa rõ',
  noLeads: 'Không có khách hàng phù hợp', noLeadsHint: 'Thử bỏ bớt bộ lọc.', leadQueue: 'Danh sách khách hàng', company: 'Doanh nghiệp', exportAll: 'Xuất CSV',
  overview: 'Tổng quan', policyQuotes: 'Hợp đồng & báo giá', dataSources: 'Dữ liệu & nguồn', journeyTab: 'Hành trình', contactHistory: 'Lịch sử liên hệ', activity: 'Hoạt động',
  sendQuote: 'Gửi báo giá', startCall: 'Gọi bằng trợ lý tự động', callCustomer: 'Gọi khách hàng', correctExpiry: 'Hiệu chỉnh ngày hết hạn', simulateTopUp: 'Giả lập nạp ví',
  openInbox: 'Mở trong hộp việc telesales', insuredTasco: 'Đang có bảo hiểm TASCO', expiresIn: (n) => (n === 0 ? 'Hết hạn hôm nay' : `Còn ${n} ngày`), lapsedFor: (n) => `Quá hạn ${n} ngày`,
  expiresOn: (d) => `Hết hạn ${d}`, consentMarketing: 'Đồng ý nhận tiếp thị', consentCall: 'Đồng ý nhận cuộc gọi', reachApp: 'Thông báo ứng dụng VETC', reachZalo: 'Zalo', reachSms: 'SMS',
  given: 'có', notGiven: 'không', available: 'có', notAvailable: 'không có', dnc: 'Không liên hệ', dncText: 'Khách đã từ chối liên hệ. Không gọi hoặc nhắn tin.',
  whyThisCustomer: 'Vì sao nên liên hệ', scoreOf: (a, b) => `${a} / ${b}`, guidedAction: 'Hành động đề xuất', valueToOffer: 'Giá trị mang lại', staffOnly: 'Chỉ nội bộ · chờ pháp chế duyệt',
  noLead: 'Xe này chưa có hồ sơ khách hàng tiềm năng', currentPolicies: 'Hợp đồng hiện có', noPolicies: 'Chưa có hợp đồng phát hành qua nền tảng', certificate: 'Giấy chứng nhận', period: 'Thời hạn',
  quoteBuilder: 'Lập báo giá', products: 'Sản phẩm', compulsory: 'Bắt buộc', optional: 'Tự nguyện', regulated: 'Phí theo quy định', term: 'Thời hạn', options: 'Tùy chọn',
  seatCover: 'Số tiền bảo hiểm mỗi chỗ', vehicleValue: 'Giá trị xe (số tiền bảo hiểm)', vehicleValueHelp: 'Giá trị thị trường của xe (VND)', calculate: 'Tính phí',
  quoteSummary: 'Tóm tắt báo giá', net: 'Phí', vat: 'VAT', total: 'Tổng cộng', bundleApplied: 'Gói', pricedByCore: 'Định phí bởi hệ thống lõi TASCO', pricedByRules: 'Định phí theo biểu phí TASCO',
  indicativeTitle: 'Giá tham khảo', indicativeText: 'Hệ thống lõi TASCO tạm thời không phản hồi. Cần định phí lại trước khi khách thanh toán.', rerate: 'Định phí lại', sendToApp: 'Gửi vào ứng dụng VETC của khách',
  quoteSent: 'Đã gửi báo giá vào ứng dụng VETC của khách', noChannel: 'Không có kênh để liên hệ khách', inspection: 'Giám định xe', inspectionNeeded: 'Bảo hiểm vật chất xe cần giám định xe trước khi thanh toán.',
  recordInspection: 'Ghi nhận giám định', inspectionRecorded: 'Đã ghi nhận giám định', inspectionEvidence: 'Bằng chứng giám định', inspectionEvidenceHelp: 'Tên giám định viên và mã ảnh chụp',
  inspectionPassed: 'Đã giám định đạt', quoteSteps: ['Lập báo giá', 'Giám định', 'Gửi vào ứng dụng'], quoteStepsNoInspect: ['Lập báo giá', 'Gửi vào ứng dụng'], quoteEmpty: 'Chọn sản phẩm và tính phí',
  quoteEmptyHint: 'Khách xác nhận và thanh toán trong ứng dụng VETC — không bao giờ qua điện thoại.', paSeatDesc: 'Lái xe và người ngồi trên xe, theo chỗ', pdDesc: 'Thiệt hại vật chất của chính xe khách',
  tndsDesc: 'Trách nhiệm dân sự bắt buộc theo luật',
  goldenRecord: 'Hồ sơ hợp nhất', ownerName: 'Tên chủ xe', phone: 'Số điện thoại', province: 'Tỉnh/thành', ownerType: 'Loại chủ xe', vehicleCategory: 'Loại xe',
  policyExpiry: 'Ngày hết hạn', insurer: 'DN bảo hiểm hiện tại', sources: 'Nguồn dữ liệu', dataScore: 'Mức đầy đủ dữ liệu', lineage: 'Nguồn gốc dữ liệu', field: 'Trường', source: 'Nguồn',
  confidence: 'Độ tin cậy', expiryEvidence: 'Bằng chứng ngày hết hạn', outranked: 'Không áp dụng', used: 'Đang dùng', dqIssues: 'Vấn đề chất lượng dữ liệu', noDqIssues: 'Không có vấn đề dữ liệu',
  resolve: 'Xử lý', masked: 'Đã ẩn', otherInsurer: 'DN bảo hiểm khác', unknownInsurer: 'Chưa rõ', renewedElsewhere: 'Khách báo đã gia hạn nơi khác (chưa xác minh)',
  touchpoints: 'Điểm chạm', noTouchpoints: 'Chưa có điểm chạm nào', scheduledFor: (d) => `Lên lịch ngày ${d}`, executed: (d) => `Đã thực hiện ${d}`,
  noContact: 'Chưa có tin nhắn hoặc cuộc gọi', assistantCall: 'Cuộc gọi trợ lý', viewCall: 'Xem cuộc gọi', message: 'Nội dung', channel: 'Kênh', status: 'Trạng thái', when: 'Thời gian',
  noActivity: 'Chưa có hoạt động', newExpiry: 'Ngày hết hạn mới', evidence: 'Bằng chứng', evidenceHelp: 'VD: ảnh giấy chứng nhận khách gửi', saveCorrection: 'Lưu hiệu chỉnh',
  corrected: 'Đã hiệu chỉnh và chấm điểm lại', eventSent: 'Đã xử lý sự kiện hệ sinh thái', noTrigger: 'Không có kích hoạt phù hợp', personal: 'Cá nhân', masked2: 'Ẩn theo phân quyền',
  inboxSubtitle: 'Khách nóng từ trợ lý gọi tự động và hành trình chuyển lên', queue: 'Hàng đợi', onlyMine: 'Chỉ của tôi', statusOpen: 'Mới', statusClaimed: 'Đang xử lý',
  statusCallback: 'Hẹn gọi lại', statusWon: 'Thành công', statusLost: 'Không thành công', selectHandoff: 'Chọn một khách hàng', selectHandoffHint: 'Chọn khách trong hàng đợi để xem tóm tắt cuộc gọi.',
  botSummary: 'Tóm tắt cuộc gọi', talkingPoints: 'Gợi ý trao đổi', customerSnapshot: 'Khách hàng', notes: 'Ghi chú', addNote: 'Thêm ghi chú', scheduleCallback: 'Hẹn gọi lại', markWon: 'Đánh dấu thành công',
  markLost: 'Đánh dấu không thành công', reassign: 'Chuyển người xử lý', viewCustomer: 'Xem Khách hàng 360', plateVerified: 'Khách đã xác minh biển số', plateNotVerified: 'Chưa xác minh biển số',
  reason: 'Lý do', age: 'Thời gian chờ', assignedTo: 'Người xử lý', note: 'Ghi chú', callbackWhen: 'Ngày gọi lại', callbackTime: 'Giờ', outcomeNote: 'Kết quả trao đổi?', lostReason: 'Lý do',
  lostReasons: [['price', 'Giá / ngân sách'], ['renewed_elsewhere', 'Đã gia hạn ở DN khác'], ['not_interested', 'Không có nhu cầu'], ['unreachable', 'Không liên lạc được'], ['other', 'Khác']],
  wonHelp: 'Khách đã đồng ý và sẽ thanh toán trong ứng dụng VETC.', reassignTo: 'Chuyển cho', handoffUpdated: 'Đã cập nhật', callStarted: 'Đã nhận việc — gọi khách từ tổng đài chính thức',
  dialHint: 'Gọi từ tổng đài chính thức TASCO/VETC', priceAsked: 'Khách hỏi về phí', trustConcern: 'Khách lo ngại lừa đảo', mine: 'Tôi', slaLeft: (t) => `còn ${t}`, slaOver: (t) => `quá ${t}`,
  phoneLabel: 'Điện thoại',
  voiceSubtitle: 'Cuộc gọi tự động và luyện tập', calls: 'Cuộc gọi', rehearse: 'Luyện tập cuộc gọi', newCampaign: 'Chiến dịch mới', callType: 'Loại', typeCampaign: 'Chiến dịch', typeRehearsal: 'Luyện tập',
  verification: 'Xác minh biển số', verified: 'Đã xác minh', notVerified: 'Chưa xác minh', outcome: 'Kết quả', turns: 'Lượt trao đổi', handoff: 'Chuyển telesales', callDetail: 'Chi tiết cuộc gọi', transcript: 'Nội dung cuộc gọi',
  assistant: 'Trợ lý', customer: 'Khách hàng', openHandoff: 'Mở việc telesales', noCalls: 'Chưa có cuộc gọi', noCallsHint: 'Chạy chiến dịch hoặc luyện tập để xem cuộc gọi tại đây.', allOutcomes: 'Tất cả kết quả',
  pickCustomer: 'Chọn khách hàng để luyện tập', rehearsalTitle: 'Cuộc gọi luyện tập', callerId: 'Trợ lý VETC', calling: 'Đang gọi', callEnded: 'Đã kết thúc', typeReply: 'Khách hàng nói…',
  send: 'Gửi', quickReplies: 'Câu trả lời nhanh', endCall: 'Kết thúc', restart: 'Gọi lại', stageIntro: 'Giới thiệu', stageVerify: 'Xác minh biển số', stageOffer: 'Tư vấn', stageWrap: 'Kết thúc',
  handedOff: 'Đã chuyển khách nóng cho telesales', translation: 'Bản dịch', showTranslation: 'Hiện bản dịch tiếng Anh', duration: 'Thời lượng',
  campaignsSubtitle: 'Chiến dịch gọi tự động và nhắn tin cùng kết quả', campaignName: 'Chiến dịch', reached: 'Đã tiếp cận', started: 'Bắt đầu', by: 'Người chạy', audience: 'Tệp khách hàng', channelVoice: 'Trợ lý gọi tự động',
  channelJourney: 'Tin nhắn hành trình', journeyRunName: (d) => `Điểm chạm hành trình · ${d}`, untitled: 'Chiến dịch gọi tự động', campaignsRun: 'Chiến dịch đã chạy', customersReached: 'Khách đã tiếp cận',
  noCampaigns: 'Chưa có chiến dịch', noCampaignsHint: 'Tạo chiến dịch để tiếp cận khách hàng qua cuộc gọi hoặc tin nhắn.', name: 'Tên chiến dịch', nameHelp: 'Tên ngắn để cả nhóm dễ nhận biết',
  audienceTier: 'Nhóm khách hàng', audienceJourney: 'Hành trình', audienceRegion: 'Khu vực', allJourneys: 'Tất cả hành trình', allRegions: 'Toàn quốc', maxCalls: 'Số cuộc gọi tối đa', schedule: 'Khung giờ gọi',
  scheduleDate: 'Ngày', scheduleTime: 'Giờ bắt đầu (giờ địa phương)', scheduleHelp: 'Chỉ gọi trong khung giờ được phép liên hệ', preview: 'Xem trước theo chính sách liên lạc', inAudience: 'Trong tệp',
  eligible: 'Được phép liên hệ', willCall: 'Sẽ gọi', heldBack: 'Bị chặn bởi chính sách liên lạc', routedFleet: 'Chuyển nhóm đội xe', launch: 'Chạy chiến dịch', launched: 'Chiến dịch đã hoàn tất',
  results: 'Kết quả', outcomes: 'Kết quả cuộc gọi', notContacted: 'Không liên hệ', touchpointsDone: 'Đã gửi', touchpointsSkipped: 'Bỏ qua', byChannel: 'Theo kênh', byJourney: 'Theo hành trình',
  messagingInfo: 'Gửi mọi điểm chạm đến hạn theo nhịp của từng hành trình và chính sách liên lạc.', dueNow: 'Đến hạn', runNow: 'Chạy ngay', campaignResults: 'Kết quả chiến dịch',
  previewLoading: 'Đang kiểm tra chính sách liên lạc…', limitHelp: 'Từ 1 đến 200', ofCalls: (p) => `${p} số cuộc gọi`,
  journeysSubtitle: 'Nhịp chăm sóc cho khai thác mới và tái tục', simulateEvent: 'Giả lập sự kiện hệ sinh thái', inJourney: 'Trong hành trình', conversion: 'Chuyển đổi', cadence: 'Nhịp chăm sóc',
  event: 'Sự kiện', customerPlate: 'Biển số khách hàng', plateHelp: 'VD: 30E-949.35', sendEvent: 'Gửi sự kiện', eventResult: 'Kết quả', runDate: 'Ngày nghiệp vụ', runTime: 'Giờ gửi (địa phương)',
  runDone: (d, s) => `Đã gửi ${d} điểm chạm, bỏ qua ${s}`, runHelp: 'Mọi tin nhắn đều tuân thủ đồng ý, khung giờ, giới hạn tần suất và kiểm soát nội dung.',
  nextTouchpoints: 'Điểm chạm sắp tới', due: 'Đến hạn', step: 'Bước', priority: 'Ưu tiên', anchorExpiry: 'Trước / sau ngày hết hạn', anchorToday: 'Từ ngày tham gia', anchorTag: 'Từ ngày kích hoạt thẻ',
  cardSold: 'Đã bán', cardHot: 'Nóng', anchorPurchase: 'Sau khi mua', consentReach: 'Đồng ý & kênh liên lạc', noNotes: 'Chưa có ghi chú', withinSla: 'Trong hạn SLA',
  slaHint: (b, s) => `${b} quá hạn · ${s} sắp đến hạn`, noCallbacksHint: 'Các lịch hẹn gọi lại sẽ hiển thị tại đây.', messagesCalls: 'Tin nhắn và cuộc gọi', renewLink: 'đường dẫn gia hạn',
  derived: (x) => `Suy luận: ${x}`, reasonHot: 'Khách quan tâm qua cuộc gọi trợ lý', reasonEscalation: 'Chưa phản hồi lời nhắc', quoteSentEvent: 'Đã gửi báo giá vào ứng dụng của khách',
  sentVia: (step, ch) => `${step} qua ${ch}`, policyIssued: (p) => `Phát hành hợp đồng: ${p}`, sold: 'Đã bán', policiesByProduct: 'Hợp đồng theo sản phẩm',
};

const STR = { en: EN, vi: VI };
/** Screen string (English / Vietnamese by UI language). */
export const st = (k, ...args) => {
  const v = STR[getLang()]?.[k] ?? EN[k] ?? k;
  return typeof v === 'function' ? v(...args) : v;
};
const pick = (en, vi) => (getLang() === 'vi' ? vi : en);

/* =========================================================================
 * Business names
 * ========================================================================= */

const SOURCES = {
  vetc_account: ['VETC account', 'Tài khoản VETC'], tasco_core: ['TASCO core', 'Hệ thống lõi TASCO'], partner_fleet: ['Partner fleet file', 'Tệp đội xe đối tác'],
  partner_api: ['Partner API', 'API đối tác'], customer_app: ['Customer in VETC app', 'Khách cập nhật trên ứng dụng VETC'], data_steward: ['Data steward', 'Cán bộ quản lý dữ liệu'],
  voice_bot: ['Assistant call', 'Cuộc gọi trợ lý'], 'synthetic-vetc': ['VETC account import', 'Nhập dữ liệu tài khoản VETC'], vetc_tag: ['VETC tag registration', 'Đăng ký thẻ VETC'],
  inspection_registry: ['Inspection registry', 'Dữ liệu đăng kiểm'], showroom: ['Showroom partner', 'Đại lý ô tô'], bank: ['Bank partner', 'Ngân hàng đối tác'],
};
/** "vetc_account" → "VETC account"; "verified_certificate (tasco_core)" → "TASCO core: verified certificate". */
export function sourceName(code) {
  if (!code) return '—';
  const m = /^([a-z_]+) \(([a-z_-]+)\)$/.exec(code);
  if (m) return `${sourceName(m[2])}: ${label('method', m[1]).toLowerCase()}`;
  if (SOURCES[code]) return pick(...SOURCES[code]);
  if (/^[a-z_]+$/.test(code)) return label('method', code);
  return st('derived', code); // a derivation rule's basis, e.g. "toll class 1 + commercial owner"
}

const FIELDS = {
  phone: ['Phone', 'Số điện thoại'], name: ['Owner name', 'Tên chủ xe'], 'vehicle.category': ['Vehicle category', 'Loại xe'], 'policy.expiryDate': ['Policy expiry', 'Ngày hết hạn'],
  'policy.insurer': ['Current insurer', 'DN bảo hiểm'], ownerType: ['Owner type', 'Loại chủ xe'], plate: ['Plate', 'Biển số'], province: ['Province', 'Tỉnh/thành'],
};
export const fieldName = (f) => (FIELDS[f] ? pick(...FIELDS[f]) : String(f).replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase()));

const FACTORS = {
  urgency: ['Renewal urgency', 'Mức độ cấp bách'], engagement: ['Engagement', 'Mức độ tương tác'], expiryConfidence: ['Data confidence', 'Độ tin cậy dữ liệu'],
  reachability: ['Reachability', 'Khả năng liên lạc'], affinity: ['Relationship', 'Mức độ gắn bó'], value: ['Customer value', 'Giá trị khách hàng'],
};
export const factorName = (r) => (FACTORS[r.factor] ? pick(...FACTORS[r.factor]) : r.label);

const REASONS = [
  [/outside allowed contact hours/, ['Outside contact hours', 'Ngoài khung giờ liên hệ']],
  [/no marketing consent/, ['No marketing consent', 'Chưa đồng ý nhận tiếp thị']],
  [/no call consent/, ['No call consent', 'Chưa đồng ý nhận cuộc gọi']],
  [/do-not-contact/, ['On the do-not-contact list', 'Trong danh sách không liên hệ']],
  [/daily contact cap/, ['Daily contact limit reached', 'Đã đủ số lần liên hệ trong ngày']],
  [/weekly contact cap/, ['Weekly contact limit reached', 'Đã đủ số lần liên hệ trong tuần']],
  [/weekly call cap/, ['Weekly call limit reached', 'Đã đủ số cuộc gọi trong tuần']],
  [/not reachable on/, ['No phone / channel on file', 'Không có kênh liên lạc']],
  [/copy guard/, ['Blocked by content rules', 'Bị chặn bởi kiểm soát nội dung']],
  [/already insured/, ['Already insured with TASCO', 'Đã có bảo hiểm TASCO']],
  [/journey changed/, ['Moved to another journey', 'Đã chuyển hành trình khác']],
];
/** Contact-policy / execution reason (engine text) → business sentence. */
export function reasonText(raw) {
  const s = String(raw || '');
  for (const [re, txt] of REASONS) if (re.test(s)) return pick(...txt);
  return pick('Not sent', 'Chưa gửi');
}

const TALKING = [
  [/^Call from the official VETC hotline/, 'Gọi từ tổng đài chính thức của VETC và nhắc lại cuộc gọi của trợ lý.'],
  [/^Customer raised a trust concern/, 'Khách lo ngại lừa đảo: hoàn tất mọi bước trong ứng dụng VETC; không bao giờ nhận thanh toán qua điện thoại.'],
  [/^Customer asked about price/, 'Khách hỏi về phí: phí TNDS do Nhà nước quy định, giống nhau ở mọi DN — hãy nhấn mạnh giá trị dịch vụ.'],
  [/^Close by sending the one-tap link/, 'Kết thúc bằng việc gửi link gia hạn một chạm vào ứng dụng VETC / Zalo OA ngay trong cuộc gọi.'],
  [/^Customer has not responded to digital reminders/, 'Khách chưa phản hồi các lời nhắc qua kênh số.'],
];
/*
 * Vietnamese rendering of the explanations generated by the scoring / NBA / benefit rule sets (their templates are
 * authored in English). Fixed phrases are mapped one-to-one; parametrised ones by pattern. Unknown text is kept.
 */
const VI_PATTERNS = [
  [/^expires in (\d+) days$/, (m) => `hết hạn sau ${m[1]} ngày`],
  [/^cover lapsed (\d+) days ago — driving uninsured$/, (m) => `đã hết hạn ${m[1]} ngày — xe đang không có bảo hiểm`],
  [/^cover lapsed (\d+) days ago$/, (m) => `đã hết hạn ${m[1]} ngày`],
  [/^lapsed (\d+) days \(likely renewed elsewhere\)$/, (m) => `đã hết hạn ${m[1]} ngày (có thể đã gia hạn nơi khác)`],
  [/^expiry from (.+) \((\d+)%\)$/, (m) => `ngày hết hạn từ ${m[1].toLowerCase()} (${m[2]}%)`],
  [/^(\d+) app sessions, (\d+) toll trips in 30 days$/, (m) => `${m[1]} lượt dùng ứng dụng, ${m[2]} lượt qua trạm trong 30 ngày`],
  [/^drives (\d+) km on highways per quarter$/, (m) => `đi ${m[1]} km trên cao tốc mỗi quý`],
  [/^renewal window opens in (\d+) days$/, (m) => `thời gian tái tục mở sau ${m[1]} ngày`],
  [/^new ETC tag (\d+) days ago — likely new vehicle$/, (m) => `thẻ ETC mới kích hoạt ${m[1]} ngày trước — có thể là xe mới`],
];
const VI_PHRASES = {
  'expiry unknown': 'chưa rõ ngày hết hạn', 'app push': 'thông báo ứng dụng', Zalo: 'Zalo', 'phone (call consent)': 'điện thoại (đồng ý nhận cuộc gọi)',
  'SMS only (no call consent)': 'chỉ SMS (chưa đồng ý nhận cuộc gọi)', 'no reachable channel on file': 'chưa có kênh liên lạc',
  'bought in VETC app before': 'đã từng mua trên ứng dụng VETC', 'current TASCO customer': 'khách hàng TASCO hiện tại', 'wallet covers premium (one-tap pay)': 'số dư ví đủ thanh toán (một chạm)',
  'wallet auto top-up on': 'đã bật tự động nạp ví', 'recent complaint(s)': 'có khiếu nại gần đây', 'no prior relationship with TASCO or VETC insurance': 'chưa từng mua bảo hiểm TASCO/VETC',
  'peace of mind on every trip': 'an tâm trên mọi hành trình', 'proof of cover always on your phone': 'luôn có giấy chứng nhận trên điện thoại', 'already uses wallet auto top-up': 'đã dùng tự động nạp ví',
  'one less thing to remember': 'không lo quên gia hạn', 'avoid queues and failed inspections': 'tránh xếp hàng và trượt đăng kiểm', 'help when it matters most': 'hỗ trợ khi cần nhất',
  'active VETC app user': 'đang dùng ứng dụng VETC thường xuyên', 'same regulated price per year, fewer renewals': 'phí theo quy định không đổi, ít lần gia hạn hơn',
  'family-size vehicle — passengers are not covered by TNDS': 'xe gia đình — người ngồi trên xe không được TNDS bảo vệ', 'TNDS does not cover you or your passengers': 'TNDS không bảo vệ bạn và người ngồi trên xe',
  'newer vehicle — repair costs are high': 'xe còn mới — chi phí sửa chữa cao', 'protect your own vehicle': 'bảo vệ chính chiếc xe của bạn', 'company-owned vehicle': 'xe thuộc sở hữu doanh nghiệp',
  'customer opted out': 'khách đã từ chối liên hệ', 'expiry date not reliable — fix data before selling': 'ngày hết hạn chưa tin cậy — cần làm sạch dữ liệu trước khi bán',
  'high intent and call consent on file': 'nhu cầu cao và đã đồng ý nhận cuộc gọi', 'reachable digitally': 'liên lạc được qua kênh số', 'phone only': 'chỉ liên lạc qua điện thoại',
  'no usable contact data': 'không có thông tin liên lạc dùng được', 'active TASCO policy': 'đang có hợp đồng TASCO',
};
const METHOD_VI = { 'verified certificate': 'giấy chứng nhận đã xác minh', 'partner policy record': 'hồ sơ đối tác', 'customer declaration': 'khách hàng khai báo', 'inspection cycle': 'chu kỳ đăng kiểm', 'tag anniversary': 'ngày kích hoạt thẻ', 'voice bot call': 'cuộc gọi trợ lý', 'no evidence': 'chưa có bằng chứng', 'steward correction': 'hiệu chỉnh dữ liệu' };
function viOne(part) {
  const p = part.trim();
  if (!p) return '';
  if (VI_PHRASES[p]) return VI_PHRASES[p];
  for (const [re, fn] of VI_PATTERNS) {
    const m = re.exec(p);
    if (m) { const out = fn(m); return out.replace(/từ (.+?) \(/, (x, meth) => `từ ${METHOD_VI[meth] || meth} (`); }
  }
  return p;
}
/** Group thousands in free numbers of rule-generated text ("2585 km" → "2,585 km" / "2.585 km"). */
const groupNums = (str) => String(str).replace(/(^|[\s(])(\d{4,})(?=$|[\s),.;%])/g, (m, pre, n) => `${pre}${formatNumber(Number(n))}`);
/** Rule-generated explanation in the UI language. */
export function explain(text) {
  if (!text) return text;
  if (getLang() !== 'vi') return groupNums(String(text).replace(/\bvoice bot\b/gi, 'voice assistant'));
  return groupNums(String(text).split(';').map(viOne).filter(Boolean).join('; '));
}

const BENEFIT_IDS = ['roadside_24_7', 'e_certificate', 'auto_renew', 'inspection_assist', 'claims_fast_lane', 'loyalty_points', 'multi_year', 'upsell_pa_seat', 'upsell_motor_pd', 'fleet_dashboard'];
const BENEFIT_EN_TITLES = { inspection_assist: 'Inspection (đăng kiểm) reminder & booking' };

/** Talking point in the UI language ("Benefit: X — why"). */
export function talkingPoint(text) {
  const str = String(text);
  const ben = /^Benefit: (.+?) — (.+)$/.exec(str);
  if (getLang() !== 'vi') return groupNums(ben ? `${ben[1]} — ${ben[2]}` : str);
  for (const [re, vi] of TALKING) if (re.test(str)) return vi;
  if (ben) {
    const id = BENEFIT_IDS.find((b) => ben[1].startsWith(labelIn('en', 'benefit', b)) || ben[1] === BENEFIT_EN_TITLES[b]);
    return `${id ? labelIn('vi', 'benefit', id) : ben[1]} — ${explain(ben[2])}`;
  }
  return groupNums(str);
}

export const CHANNEL_ICON = { app_push: 'bell', zalo_zns: 'message-square', sms: 'send', voice_bot: 'mic', telesales: 'headset', vetc_app: 'monitor', zalo: 'message-square', email: 'send', partner_api: 'handshake' };
export const channelIcon = (ch) => CHANNEL_ICON[ch] || 'circle-dot';

const OUTCOME_TONE = { hot_handoff: 'ok', link_sent: 'ok', callback_later: 'warn', unverified: 'warn', plate_mismatch: 'warn', wrong_person: 'warn', already_renewed: 'neutral', no_answer: 'neutral', opted_out: 'danger', scam_concern: 'danger', journey_escalation: 'info' };
const EXTRA_OUTCOME = { journey_escalation: ['Journey escalation', 'Hành trình chuyển lên'] };
export const outcomeLabel = (o) => (EXTRA_OUTCOME[o] ? pick(...EXTRA_OUTCOME[o]) : label('outcome', o ?? null));
export const outcomeChip = (o) => badge(outcomeLabel(o), o ? OUTCOME_TONE[o] || 'neutral' : 'info', { dot: true });

/** Why a handoff is in the inbox, in a short business phrase. */
export const handoffReason = (o) => (o === 'hot_handoff' ? st('reasonHot') : o === 'journey_escalation' ? st('reasonEscalation') : outcomeLabel(o));
/** Message text with links shown as a short "renewal link" marker (the URL stays out of business views). */
export const messageText = (text) => String(text || '').replace(/https?:\/\/\S+/g, `[${st('renewLink')}]`);

/** Handoff status → inbox wording (New / In progress / Callback / Won / Lost). */
const HO_STATUS = { open: ['statusOpen', 'info'], claimed: ['statusClaimed', 'brand'], callback: ['statusCallback', 'warn'], won: ['statusWon', 'ok'], lost: ['statusLost', 'danger'] };
export const handoffStatusChip = (s) => badge(st(HO_STATUS[s]?.[0] || 'statusOpen'), HO_STATUS[s]?.[1] || 'neutral', { dot: true });

/* =========================================================================
 * Cells & small widgets
 * ========================================================================= */

/** "in 22 days" / "lapsed 25 days" / "today". */
export function daysText(days) {
  if (days === null || days === undefined) return st('expiryUnknown');
  return days < 0 ? st('lapsedDays', formatNumber(-days)) : st('inDays', days);
}
const isoPlusDays = (today, days) => new Date(new Date(`${today}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/** Expiry cell: dd/MM/yyyy + relative line (danger when lapsed, warning within 30 days). */
export function expiryCell(date, days, today) {
  const d = date || (days !== null && days !== undefined && today ? isoPlusDays(today, days) : null);
  const tone = days === null || days === undefined ? '' : days < 0 ? 'danger' : days <= 30 ? 'warn' : '';
  return h('span', { class: 'cell-stack' }, h('span', { class: 'nowrap' }, d ? formatDate(d) : '—'), h('span', { class: `cell-sub nowrap ${tone ? `tone-${tone}` : ''}`.trim() }, daysText(days)));
}

/** Vehicle cell: plate tag + owner (masked by the API when the role has no PII permission). */
export function vehicleCell(plate, owner, { company } = {}) {
  return h('span', { class: 'cell-stack' }, plateTag(plate), h('span', { class: 'cell-sub trunc-1' }, owner || (company ? st('company') : '—')));
}

/** Compact score: bar + number (table use). */
export function scoreBar(score, tier) {
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  return h('span', { class: `score-bar ${tier || ''}`.trim(), role: 'img', 'aria-label': `${st('score')} ${v}` },
    h('span', { class: 'score-bar-track', 'aria-hidden': 'true' }, h('span', { class: 'score-bar-fill', style: `width:${v}%` })),
    h('span', { class: 'score-bar-value', 'aria-hidden': 'true' }, formatNumber(v)));
}

/** Channel icon + label. */
export function channelTag(ch) {
  return h('span', { class: 'channel-tag' }, icon(channelIcon(ch), { size: 15 }), label('channel', ch));
}

/** SLA chip for an open handoff: On track / Due soon (≤ 30 min) / Breached, with time left or over. */
export function slaChip(slaDueAt, status, now = Date.now()) {
  if (!slaDueAt || !['open', 'callback'].includes(status)) return null;
  const left = new Date(slaDueAt).getTime() - now;
  const mins = Math.round(Math.abs(left) / 60000);
  const span = mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
  if (left < 0) return tooltip(badge(st('slaBreached'), 'danger', { icon: 'alert-circle' }), st('slaOver', span));
  if (left <= 30 * 60000) return tooltip(badge(st('dueSoon'), 'warn', { icon: 'clock' }), st('slaLeft', span));
  return tooltip(badge(st('onTrack'), 'ok', { icon: 'clock' }), st('slaLeft', span));
}
export const slaState = (slaDueAt, status, now = Date.now()) => {
  if (!slaDueAt || !['open', 'callback'].includes(status)) return null;
  const left = new Date(slaDueAt).getTime() - now;
  return left < 0 ? 'breached' : left <= 30 * 60000 ? 'due_soon' : 'on_track';
};

/**
 * Filter chip with a dropdown of options (single select): "Journey ▾" → "Journey: Renewal ✕".
 * options: [[value, label]]; value '' = all.
 */
export function filterChip({ label: lab, options, value, onChange }) {
  const current = options.find(([v]) => String(v) === String(value ?? ''));
  const active = value !== '' && value !== null && value !== undefined;
  const c = chip({ label: active && current ? `${lab}: ${current[1]}` : lab, selected: active });
  c.append(icon('chevron-down', { size: 14 }));
  c.classList.add('filter-chip');
  dropdownMenu(c, () => [
    { label: pick('All', 'Tất cả'), checked: !active, onClick: () => onChange('') },
    { separator: true },
    ...options.map(([v, l]) => ({ label: l, checked: String(v) === String(value), onClick: () => onChange(v) })),
  ], { align: 'start', label: lab });
  return c;
}

/** Greeting by local time. */
export function greeting(name) {
  const hr = new Date().getHours();
  return `${st(hr < 12 ? 'goodMorning' : hr < 18 ? 'goodAfternoon' : 'goodEvening')}, ${name}`;
}

/** Relative time element with exact time in the tooltip. */
export function relTime(iso) {
  if (!iso) return '—';
  return h('time', { datetime: iso, title: new Date(iso).toLocaleString() }, formatRelative(iso));
}

/** Policy status for a profile+lead: insured with TASCO / expiring / lapsed / unknown. */
export function policyState(profile, lead, policies, today) {
  const active = (policies || []).some((p) => p.status === 'active' && p.product?.startsWith('TNDS') && p.endDate > today);
  const days = lead?.daysToExpiry ?? null;
  if (active) return { tone: 'ok', text: st('insuredTasco'), icon: 'shield-check' };
  if (days === null) return { tone: 'neutral', text: st('expiryUnknown'), icon: 'help-circle' };
  if (days < 0) return { tone: 'danger', text: st('lapsedFor', formatNumber(-days)), icon: 'alert-triangle' };
  return { tone: days <= 30 ? 'warn' : 'info', text: st('expiresIn', days), icon: 'calendar' };
}
