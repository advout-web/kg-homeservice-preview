/*!
 * ReserveKit v1.2.0 — どんなサイトにも埋め込める予約ウィジェット
 * (c) 2026 Biz Studio — MIT License
 *
 * 使い方（最小）:
 *   <div id="reserve"></div>
 *   <script src="reserve-kit.js"></script>
 *   <script>ReserveKit.mount('#reserve', { template: 'salon' });</script>
 */
(function (global) {
  'use strict';

  const VERSION = '1.3.1';

  /* =========================================================
   * utils
   * ======================================================= */
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  // 'YYYY-MM-DDTHH:MM'（タイムゾーンなしの壁時計）を分単位の数値に
  const stamp = (s) => {
    const [d, t = '00:00'] = String(s).split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return Date.UTC(y, mo - 1, da, h || 0, mi || 0) / 60000;
  };
  const fromStamp = (n) => {
    const d = new Date(n * 60000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };
  const daysBetween = (a, b) => Math.round((stamp(b) - stamp(a)) / 1440);
  const weekdayOf = (s) => parseYmd(s).getDay();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fmt = (s, vars) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  function merge(target, ...sources) {
    for (const src of sources) {
      if (!isObj(src)) continue;
      for (const k of Object.keys(src)) {
        const v = src[k];
        if (v === undefined) continue;
        if (isObj(v) && typeof v !== 'function') target[k] = merge(isObj(target[k]) ? target[k] : {}, v);
        else target[k] = Array.isArray(v) ? v.slice() : v;
      }
    }
    return target;
  }

  function nowIn(tz) {
    try {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      const p = {};
      f.formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
      return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
    } catch (e) {
      const d = new Date();
      return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  function bookingNumber() {
    const d = new Date();
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `R${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${r}`;
  }

  /* =========================================================
   * i18n
   * ======================================================= */
  const I18N = {
    ja: {
      steps: { service: 'メニュー', staff: '担当者', quantity: '人数', datetime: '日時', dates: '日程', form: 'お客様情報', confirm: '確認' },
      next: '次へ', back: '戻る', submit: '予約を確定する', submitting: '送信しています…',
      anyStaff: '指名なし', anyStaffDesc: '空いている担当者がご案内します',
      selectDate: '日付を選択してください', noSlots: 'この日は空きがありません', loading: '空き状況を確認しています…',
      remaining: '残り{n}', full: '満席', closed: '休',
      minutes: '{n}分', nights: '{n}泊', checkIn: 'チェックイン', checkOut: 'チェックアウト',
      selectCheckIn: 'チェックイン日を選んでください', selectCheckOut: 'チェックアウト日を選んでください',
      required: '必須', optional: '任意',
      errRequired: '入力してください', errSelect: '選択してください', errEmail: 'メールアドレスの形式が正しくありません', errTel: '電話番号の形式が正しくありません', errAgree: '同意が必要です',
      summary: 'ご予約内容', total: '合計', free: '無料',
      doneTitle: 'ご予約を受け付けました', doneText: 'ご入力のメールアドレスに確認メールをお送りしました。\n当日お会いできるのを楽しみにしております。',
      bookingNumber: '予約番号', addGoogle: 'Googleカレンダーに追加', addIcs: 'カレンダーに保存（.ics）', again: '続けて予約する',
      agree: '上記の内容に同意する', policyTitle: 'ご予約にあたって',
      privacyLink: 'プライバシーポリシー', privacyText: 'ご入力いただいた個人情報の取り扱いについては、{link}をご確認ください。', privacyAgree: 'プライバシーポリシーに同意する', errPrivacy: 'プライバシーポリシーへの同意が必要です',
      demoNotice: 'デモ表示中：この予約はお使いのブラウザにだけ保存され、お店には届きません',
      errorSubmit: '送信できませんでした。時間をおいてもう一度お試しください。',
      slotTaken: '選んだ枠がちょうど埋まりました。別の日時をお選びください。',
      weekdays: ['日', '月', '火', '水', '木', '金', '土'], monthFmt: '{y}年{m}月', dateFmt: '{m}月{d}日（{w}）', fullDateFmt: '{y}年{m}月{d}日（{w}）',
      open: '予約する', close: '閉じる', selectFirst: '先にメニューを選択してください', prev: '前へ', next7: '次へ',
      perPerson: '/名', perNight: '/泊', perPersonNight: '/名・泊',
      legend: '◎ 余裕あり　○ 空きあり　△ 残りわずか　× 満席',
      staffLabel: '担当', duration: '所要時間', dateLabel: '日時', stayLabel: '日程', choose: '選択', selected: '選択中',
      unitDefault: '名', incomplete: '未選択の項目があります：{items}',
      emptyServices: 'メニューがまだありません。', emptyStaff: '担当者がまだいません。', emptyFields: '入力していただく項目はありません。', noHours: '受付できる日がまだ設定されていません。',
      candidate: '第{n}希望', candidatesHint: 'ご希望の日時を第{n}希望まで選べます。', candidatesRequired: '{r}つ以上選んでください。', candidateFull: '第{n}希望まで選び終わりました。変える場合は、選んだ日時を取り消してください。',
      remove: '取り消す', notSelected: '未選択', submitRequest: '予約をリクエストする',
      doneTitlePending: '仮予約を受け付けました', doneTextPending: 'ご希望の日時を確認し、確定のご連絡をメールでお送りします。\n確定のご連絡まで、しばらくお待ちください。',
      pendingNote: 'このご予約は仮予約です。お店が日程を確認してから確定し、メールでお知らせします。', requestNumber: '受付番号',
      meeting: 'オンライン会議', meetingJoin: '会議に参加する', meetingLater: '会議の URL は確定メールでお送りします', meetingLaterNow: '会議の URL は確認メールでお送りします', online: 'オンライン', passcode: 'パスコード',
      providers: { zoom: 'Zoom', meet: 'Google Meet', teams: 'Microsoft Teams', fixed: 'オンライン会議' }
    },
    en: {
      steps: { service: 'Service', staff: 'Staff', quantity: 'Guests', datetime: 'Date & time', dates: 'Dates', form: 'Your details', confirm: 'Confirm' },
      next: 'Next', back: 'Back', submit: 'Confirm booking', submitting: 'Sending…',
      anyStaff: 'No preference', anyStaffDesc: 'Any available staff member',
      selectDate: 'Select a date', noSlots: 'No availability on this day', loading: 'Checking availability…',
      remaining: '{n} left', full: 'Full', closed: '—',
      minutes: '{n} min', nights: '{n} night(s)', checkIn: 'Check-in', checkOut: 'Check-out',
      selectCheckIn: 'Select check-in date', selectCheckOut: 'Select check-out date',
      required: 'Required', optional: 'Optional',
      errRequired: 'This field is required', errSelect: 'Please choose one', errEmail: 'Invalid email address', errTel: 'Invalid phone number', errAgree: 'Please agree to continue',
      summary: 'Booking summary', total: 'Total', free: 'Free',
      doneTitle: 'Your booking is confirmed', doneText: 'A confirmation email has been sent to you.',
      bookingNumber: 'Booking no.', addGoogle: 'Add to Google Calendar', addIcs: 'Download .ics', again: 'Make another booking',
      agree: 'I agree to the terms above', policyTitle: 'Before you book',
      privacyLink: 'Privacy Policy', privacyText: 'Please read our {link} to learn how we handle your personal information.', privacyAgree: 'I agree to the Privacy Policy', errPrivacy: 'Please agree to the Privacy Policy',
      demoNotice: 'Demo mode: this booking is only stored in your browser and is not sent to the business',
      errorSubmit: 'Could not send. Please try again later.',
      slotTaken: 'That slot was just taken. Please choose another time.',
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], monthFmt: '{mn} {y}', dateFmt: '{w}, {mn} {d}', fullDateFmt: '{w}, {mn} {d}, {y}',
      open: 'Book now', close: 'Close', selectFirst: 'Please choose a service first', prev: 'Previous', next7: 'Next',
      perPerson: '/person', perNight: '/night', perPersonNight: '/person/night',
      legend: '◎ Plenty  ○ Available  △ Few left  × Full',
      staffLabel: 'Staff', duration: 'Duration', dateLabel: 'Date & time', stayLabel: 'Stay', choose: 'Choose', selected: 'Selected',
      unitDefault: '', incomplete: 'Please complete: {items}',
      emptyServices: 'No services yet.', emptyStaff: 'No staff yet.', emptyFields: 'No details needed.', noHours: 'No bookable days are set yet.',
      candidate: 'Choice {n}', candidatesHint: 'You can pick up to {n} preferred times.', candidatesRequired: 'Please pick at least {r}.', candidateFull: 'You have picked {n} times. Remove one to change.',
      remove: 'Remove', notSelected: 'Not selected', submitRequest: 'Send request',
      doneTitlePending: 'Request received', doneTextPending: 'We will check your preferred times and confirm by email.',
      pendingNote: 'This is a request. Your booking is confirmed once we approve it.', requestNumber: 'Request no.',
      meeting: 'Online meeting', meetingJoin: 'Join meeting', meetingLater: 'The meeting link will be sent with the confirmation email', meetingLaterNow: 'The meeting link will be sent by email', online: 'Online', passcode: 'Passcode',
      providers: { zoom: 'Zoom', meet: 'Google Meet', teams: 'Microsoft Teams', fixed: 'Online meeting' }
    }
  };
  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* =========================================================
   * defaults
   * ======================================================= */
  const DEFAULT_FIELDS = [
    { name: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 太郎', autocomplete: 'name' },
    { name: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@mail.com', autocomplete: 'email', half: true },
    { name: 'tel', label: '電話番号', type: 'tel', required: true, placeholder: '090-1234-5678', autocomplete: 'tel', half: true },
    { name: 'note', label: 'ご要望・備考', type: 'textarea', required: false }
  ];

  const DEFAULTS = {
    template: null,
    locale: 'ja',
    mode: 'inline',            // inline | modal
    layout: 'wizard',          // wizard（ステップ形式） | onepage（1ページ形式）
    calendarStyle: 'month',    // month | week
    slotStyle: 'chips',        // chips | list
    serviceStyle: 'grid',      // grid | list
    cardStyle: 'bordered',     // bordered | elevated | flat
    showMarks: true,           // ◎○△× の表示
    showRemaining: false,      // 時間枠の残り数を表示
    hideFullSlots: false,
    autoAdvance: true,         // 選んだら自動で次のステップへ
    showProgress: true,
    showSummary: true,
    weekStart: 0,              // 0=日曜始まり 1=月曜始まり
    bookingType: 'slot',       // slot（時間枠） | range（宿泊などの期間）
    steps: null,               // 例: ['service','staff','datetime','form','confirm']
    stepLabels: {},
    title: 'ご予約',
    subtitle: '',
    logo: '',
    launcher: { label: '', position: 'bottom-right', show: true },
    trigger: null,             // ポップアップを開くボタンのセレクター（例: '.open-reserve'）
    theme: {
      primary: '#2346d6', onPrimary: '#ffffff', accent: '',
      background: '#ffffff', surface: '#ffffff', text: '#1d2433', muted: '#6b7385', border: '#e3e6ee',
      danger: '#d23c3c', success: '#1f9d6a',
      radius: 10, fontSize: 15,
      font: 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
      headingFont: '', fontUrl: '', headingFontUrl: '',
      density: 'comfortable',  // compact | comfortable | spacious
      scheme: 'light',         // light | dark | auto
      maxWidth: 780,
      shadow: true,
      transparent: false       // true で背景を透過（サイトの背景になじませる）
    },
    themeDark: { background: '#13151b', surface: '#1c1f28', text: '#eef0f5', muted: '#9aa1b2', border: '#2c313e' },
    business: {
      name: '', location: '', timezone: 'Asia/Tokyo',
      hours: { 0: null, 1: ['10:00', '19:00'], 2: ['10:00', '19:00'], 3: ['10:00', '19:00'], 4: ['10:00', '19:00'], 5: ['10:00', '19:00'], 6: ['10:00', '17:00'] },
      specialHours: {},        // { '2026-12-31': [['10:00','15:00']] }
      closedDates: [],         // ['2026-12-31', ...]
      slotInterval: 30,
      defaultDuration: 60,
      bufferMinutes: 0,
      leadTimeMinutes: 60,     // 何分後から予約可能か
      maxDaysAhead: 60,        // 何日先まで予約可能か
      capacity: 1,             // 1枠あたりの受付数
      capacityScope: 'global'  // global | service | staff
    },
    serviceSelect: 'single',   // single | multiple
    approval: { enabled: false, candidates: 1, required: 1 }, // 承認制（仮予約）・第n希望まで
    meeting: { provider: 'meet' }, // services[].meeting: true のときに使う会議ツール（zoom | meet | teams | fixed）
    services: [],
    staff: [],
    quantity: { label: '人数', unit: '名', min: 1, max: 10, default: 1, consumesCapacity: false },
    stay: { minNights: 1, maxNights: 14, checkInTime: '15:00', checkOutTime: '10:00' },
    pricing: { currency: 'JPY', taxLabel: '税込', unit: 'fixed', show: true },
    fields: DEFAULT_FIELDS,
    policy: { title: '', text: '', requireAgree: false, label: '', privacyUrl: '', privacyLabel: '', requirePrivacy: true }, // privacyUrl を入れるとプライバシーポリシーへのリンクと同意チェックを出す
    demoNotice: true,          // 本番のサイトでデモ保存（backend.type: 'local'）を使っているときに警告を出す
    texts: {},
    done: { title: '', message: '', showCalendarLinks: true },
    backend: { type: 'local', url: '', headers: {}, formId: 'default', storeKey: '' },
    customCSS: '',
    onSubmit: null, onComplete: null, onError: null, onChange: null
  };

  /* =========================================================
   * templates
   * ======================================================= */
  const nameKana = [
    { name: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 花子', autocomplete: 'name', half: true },
    { name: 'kana', label: 'フリガナ', type: 'text', required: true, placeholder: 'ヤマダ ハナコ', half: true }
  ];
  const contact = [
    { name: 'tel', label: '電話番号', type: 'tel', required: true, placeholder: '090-1234-5678', autocomplete: 'tel', half: true },
    { name: 'email', label: 'メールアドレス', type: 'email', required: true, placeholder: 'example@mail.com', autocomplete: 'email', half: true }
  ];

  const TEMPLATES = {
    salon: {
      label: '美容室・サロン',
      title: 'ご予約', subtitle: 'メニュー・スタイリスト・日時をお選びください',
      serviceSelect: 'multiple', serviceStyle: 'list', cardStyle: 'flat', calendarStyle: 'week', slotStyle: 'chips', showMarks: true,
      autoAdvance: false,
      theme: {
        primary: '#2a2522', onPrimary: '#ffffff', accent: '#a8825e',
        background: '#f7f3ee', surface: '#fffdf9', text: '#2a2522', muted: '#8b8178', border: '#e6ddd2',
        radius: 2, font: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600&display=swap'
      },
      business: {
        name: 'Hair Salon LUMIÈRE',
        hours: { 0: ['10:00', '18:00'], 1: ['10:00', '20:00'], 2: null, 3: ['10:00', '20:00'], 4: ['10:00', '20:00'], 5: ['10:00', '20:00'], 6: ['10:00', '19:00'] },
        slotInterval: 30, capacity: 1, capacityScope: 'staff', leadTimeMinutes: 120
      },
      services: [
        { id: 'cut', name: 'カット', duration: 60, price: 5500, description: 'シャンプー・ブロー込み', category: 'カット' },
        { id: 'color', name: 'フルカラー', duration: 90, price: 7700, description: '透明感カラー・白髪染めも対応', category: 'カラー', tag: '人気' },
        { id: 'perm', name: 'デジタルパーマ', duration: 120, price: 12100, description: 'カット別', category: 'パーマ' },
        { id: 'treatment', name: '髪質改善トリートメント', duration: 60, price: 8800, description: '酸熱トリートメントでツヤ髪に', category: 'ケア', tag: 'おすすめ' },
        { id: 'headspa', name: 'ヘッドスパ', duration: 30, price: 3300, description: '炭酸泉で頭皮すっきり', category: 'ケア' }
      ],
      staff: [
        { id: 'sato', name: '佐藤 美咲', role: 'トップスタイリスト', description: 'ナチュラルなショートが得意' },
        { id: 'takahashi', name: '高橋 蓮', role: 'スタイリスト', description: 'メンズカット・パーマ', days: [0, 1, 3, 5, 6] },
        { id: 'nakamura', name: '中村 葵', role: 'カラーリスト', description: 'ハイトーン・透明感カラー', days: [0, 4, 5, 6] }
      ],
      fields: [
        ...nameKana, ...contact,
        { name: 'visit', label: 'ご来店', type: 'radio', required: true, options: ['はじめて', '2回目以降'] },
        { name: 'note', label: 'ご要望', type: 'textarea', placeholder: '髪のお悩みや仕上がりのイメージなど' }
      ],
      policy: { text: '当日のキャンセルは施術料金の50%を頂戴します。\n遅れる場合はお電話でご連絡ください。', requireAgree: false }
    },

    restaurant: {
      label: '飲食店・レストラン',
      title: '席のご予約', subtitle: '人数・コース・日時をお選びください',
      steps: ['quantity', 'service', 'datetime', 'form', 'confirm'],
      serviceStyle: 'list', cardStyle: 'bordered', calendarStyle: 'month', slotStyle: 'chips', showMarks: true,
      theme: {
        primary: '#9c3b22', onPrimary: '#ffffff', accent: '#c9a35b',
        background: '#fbf6ef', surface: '#fffdf8', text: '#2b211c', muted: '#86766a', border: '#ecdfcf',
        radius: 12, font: '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap'
      },
      business: {
        name: '旬菜ダイニング 灯（あかり）',
        hours: {
          0: [['11:30', '14:30'], ['17:00', '21:30']], 1: null,
          2: [['11:30', '14:30'], ['17:30', '22:00']], 3: [['11:30', '14:30'], ['17:30', '22:00']],
          4: [['11:30', '14:30'], ['17:30', '22:00']], 5: [['11:30', '14:30'], ['17:30', '23:00']],
          6: [['11:30', '15:00'], ['17:00', '23:00']]
        },
        slotInterval: 30, defaultDuration: 120, capacity: 24, capacityScope: 'global', leadTimeMinutes: 180, maxDaysAhead: 90
      },
      quantity: { label: 'ご来店人数', unit: '名', min: 1, max: 12, default: 2, consumesCapacity: true },
      pricing: { unit: 'perPerson' },
      services: [
        { id: 'seat', name: '席のみのご予約', duration: 120, price: null, description: 'お料理は当日ご注文ください' },
        { id: 'omakase', name: '旬のおまかせコース（全8品）', duration: 120, price: 6600, description: '季節の食材を使ったおまかせコース', tag: '人気' },
        { id: 'kaiseki', name: '特選会席コース（全10品）', duration: 150, price: 9900, description: '接待・お顔合わせにも' },
        { id: 'anniversary', name: '記念日プラン', duration: 150, price: 8800, description: 'ホールケーキ・乾杯ドリンク付き', tag: '記念日' }
      ],
      fields: [
        { name: 'name', label: '代表者のお名前', type: 'text', required: true, placeholder: '山田 太郎', autocomplete: 'name' },
        ...contact,
        { name: 'scene', label: 'ご利用シーン', type: 'select', options: ['お食事', '記念日・誕生日', '接待・会食', 'お顔合わせ', 'その他'] },
        { name: 'allergy', label: 'アレルギー・苦手な食材', type: 'textarea', placeholder: '例）えび・かに' },
        { name: 'note', label: 'ご要望', type: 'textarea', placeholder: '個室希望・ベビーカーでの来店など' }
      ],
      policy: { text: 'ご予約時間を30分過ぎてもご連絡がない場合は、キャンセル扱いとさせていただく場合がございます。\nコースのキャンセルは前日までにご連絡ください。', requireAgree: true }
    },

    clinic: {
      label: 'クリニック・整骨院',
      title: 'Web予約', subtitle: '診療メニューとご希望の日時をお選びください',
      serviceStyle: 'grid', cardStyle: 'bordered', calendarStyle: 'month', slotStyle: 'chips', showMarks: true,
      theme: {
        primary: '#127a7a', onPrimary: '#ffffff', accent: '#5cb8b2',
        background: '#f3f8f8', surface: '#ffffff', text: '#173033', muted: '#5f7476', border: '#d8e6e6',
        radius: 10, font: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap'
      },
      business: {
        name: 'みどり台クリニック',
        hours: {
          0: null, 1: [['09:00', '12:30'], ['15:00', '18:30']], 2: [['09:00', '12:30'], ['15:00', '18:30']],
          3: [['09:00', '12:30'], ['15:00', '18:30']], 4: [['09:00', '12:30']], 5: [['09:00', '12:30'], ['15:00', '18:30']],
          6: [['09:00', '13:00']]
        },
        slotInterval: 15, capacity: 2, capacityScope: 'global', leadTimeMinutes: 60, maxDaysAhead: 30
      },
      services: [
        { id: 'first', name: '初診', duration: 30, price: null, description: '問診・診察（保険診療）' },
        { id: 'general', name: '再診・一般診療', duration: 15, price: null, description: 'かぜ・生活習慣病など' },
        { id: 'vaccine', name: '予防接種', duration: 15, price: 4400, description: 'インフルエンザなど', tag: '受付中' },
        { id: 'checkup', name: '健康診断', duration: 45, price: 8800, description: '企業健診・特定健診' }
      ],
      fields: [
        ...nameKana,
        { name: 'birthday', label: '生年月日', type: 'date', required: true, half: true },
        { name: 'insurance', label: '保険証', type: 'select', required: true, options: ['持参する', '持参しない（自費）'], half: true },
        ...contact,
        { name: 'symptom', label: '症状・ご相談内容', type: 'textarea', required: true, placeholder: 'いつから・どのような症状か', sensitive: true } // 要配慮個人情報：初期設定ではメールに載せない
      ],
      policy: { text: '発熱のある方は、ご来院前にお電話でご連絡ください。\n予約時間の10分前までに受付をお済ませください。', requireAgree: true, label: '確認しました' }
    },

    hotel: {
      label: '宿泊施設・旅館',
      bookingType: 'range',
      title: 'ご宿泊のご予約', subtitle: 'お部屋・日程・人数をお選びください',
      steps: ['service', 'dates', 'quantity', 'form', 'confirm'],
      serviceStyle: 'list', cardStyle: 'elevated', calendarStyle: 'month', showMarks: true,
      theme: {
        primary: '#1f3a30', onPrimary: '#ffffff', accent: '#b89a5e',
        background: '#f6f4ee', surface: '#ffffff', text: '#1f2a25', muted: '#6f7a72', border: '#e2ddd0',
        radius: 0, font: '"Shippori Mincho", "Hiragino Mincho ProN", serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600&display=swap'
      },
      business: {
        name: '湯宿 山のは',
        hours: { 0: ['15:00', '23:00'], 1: ['15:00', '23:00'], 2: ['15:00', '23:00'], 3: ['15:00', '23:00'], 4: ['15:00', '23:00'], 5: ['15:00', '23:00'], 6: ['15:00', '23:00'] },
        capacity: 1, capacityScope: 'service', leadTimeMinutes: 0, maxDaysAhead: 180
      },
      stay: { minNights: 1, maxNights: 7, checkInTime: '15:00', checkOutTime: '11:00' },
      quantity: { label: 'ご宿泊人数', unit: '名', min: 1, max: 4, default: 2 },
      pricing: { unit: 'perNight' },
      services: [
        { id: 'standard', name: '和室 10畳', price: 22000, capacity: 3, maxQuantity: 4, description: '山を望む、落ち着いた和室', tag: '1泊2食付き' },
        { id: 'deluxe', name: '和洋室 ツインベッド', price: 32000, capacity: 2, maxQuantity: 3, description: 'ベッドでゆったり過ごせる和洋室' },
        { id: 'suite', name: '露天風呂付き特別室', price: 58000, capacity: 1, maxQuantity: 2, description: '客室で源泉かけ流しの露天風呂を', tag: '1日1室限定' }
      ],
      fields: [
        ...nameKana, ...contact,
        { name: 'arrival', label: 'ご到着予定時刻', type: 'select', required: true, options: ['15:00〜16:00', '16:00〜17:00', '17:00〜18:00', '18:00以降'], half: true },
        { name: 'car', label: 'お車でお越しですか', type: 'radio', options: ['はい', 'いいえ'], half: true },
        { name: 'note', label: 'ご要望', type: 'textarea', placeholder: '記念日・食事のアレルギーなど' }
      ],
      policy: { text: 'キャンセル料：前日 30%／当日 50%／不泊 100%', requireAgree: true }
    },

    lesson: {
      label: 'スクール・体験レッスン',
      title: '体験レッスンのご予約', subtitle: 'クラスと日時を選んでください',
      steps: ['service', 'quantity', 'datetime', 'form', 'confirm'],
      serviceStyle: 'grid', cardStyle: 'elevated', calendarStyle: 'month', slotStyle: 'list', showMarks: true, showRemaining: true,
      theme: {
        primary: '#ff5b3a', onPrimary: '#ffffff', accent: '#ffb627',
        background: '#fff7f2', surface: '#ffffff', text: '#2a1b16', muted: '#8a7369', border: '#f2e2d8',
        radius: 18, font: '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap'
      },
      business: {
        name: 'STUDIO HALE',
        hours: { 0: ['09:00', '18:00'], 1: ['07:00', '21:00'], 2: ['07:00', '21:00'], 3: ['07:00', '21:00'], 4: ['07:00', '21:00'], 5: ['07:00', '21:00'], 6: ['09:00', '18:00'] },
        capacityScope: 'service', leadTimeMinutes: 60, maxDaysAhead: 45
      },
      quantity: { label: '参加人数', unit: '名', min: 1, max: 3, default: 1, consumesCapacity: true },
      pricing: { unit: 'perPerson' },
      services: [
        { id: 'yoga', name: '朝ヨガ（はじめての方）', duration: 60, price: 1000, capacity: 8, days: [1, 3, 5], times: ['07:30', '10:00'], description: 'ゆったり呼吸を整えるやさしいクラス', tag: '初心者向け' },
        { id: 'pilates', name: 'マットピラティス', duration: 50, price: 1500, capacity: 6, days: [2, 4, 6], times: ['10:00', '19:30'], description: '体幹を整えて姿勢美人に' },
        { id: 'stretch', name: 'リラックスストレッチ', duration: 45, price: 1000, capacity: 10, days: [0, 6], times: ['11:00', '15:00'], description: '肩こり・腰の張りをほぐします' }
      ],
      fields: [
        { name: 'name', label: 'お名前', type: 'text', required: true, placeholder: '山田 花子', autocomplete: 'name' },
        ...contact,
        { name: 'experience', label: '経験', type: 'radio', required: true, options: ['はじめて', '少しある', '経験者'] },
        { name: 'mat', label: 'レンタルマット', type: 'radio', options: ['必要（無料）', '持参する'] },
        { name: 'note', label: '気になること', type: 'textarea', placeholder: 'ケガや体の不安など' }
      ],
      policy: { text: '動きやすい服装でお越しください。\n体験レッスンはお一人さま1回限りです。', requireAgree: false }
    },

    consultation: {
      label: '無料相談・商談',
      title: '無料相談のご予約', subtitle: 'オンライン（Google Meet）または来社でのご相談を承ります',
      serviceStyle: 'list', cardStyle: 'bordered', calendarStyle: 'month', slotStyle: 'chips', showMarks: false,
      theme: {
        primary: '#1f3fd1', onPrimary: '#ffffff', accent: '#14b8a6',
        background: '#ffffff', surface: '#ffffff', text: '#121826', muted: '#5d6475', border: '#e4e7ef',
        radius: 8, font: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap'
      },
      business: {
        name: '株式会社サンプル',
        hours: {
          0: null, 1: [['10:00', '12:00'], ['13:00', '18:00']], 2: [['10:00', '12:00'], ['13:00', '18:00']], 3: [['10:00', '12:00'], ['13:00', '18:00']],
          4: [['10:00', '12:00'], ['13:00', '18:00']], 5: [['10:00', '12:00'], ['13:00', '18:00']], 6: null
        },
        slotInterval: 30, capacity: 1, capacityScope: 'global', leadTimeMinutes: 1440, maxDaysAhead: 30, bufferMinutes: 15
      },
      services: [
        { id: 'online', name: 'オンライン相談', duration: 30, price: 0, description: 'Google Meet で実施します。会議の URL は自動で発行され、確認メールでお送りします。', tag: 'おすすめ', meeting: 'meet' },
        { id: 'office', name: '来社でのご相談', duration: 60, price: 0, description: '資料をお持ちいただければ、その場でお見積りします。' },
        { id: 'estimate', name: 'お見積りのご相談', duration: 45, price: 0, description: 'ご予算・スケジュールに合わせてご提案します。' }
      ],
      fields: [
        { name: 'company', label: '会社名', type: 'text', placeholder: '株式会社〇〇', autocomplete: 'organization', half: true },
        { name: 'name', label: 'ご担当者名', type: 'text', required: true, placeholder: '山田 太郎', autocomplete: 'name', half: true },
        ...contact,
        { name: 'topic', label: 'ご相談内容', type: 'checkboxes', required: true, options: ['Webサイト制作', '会社紹介資料', '名刺・印刷物', 'SNS運用', 'その他'] },
        { name: 'detail', label: '詳細', type: 'textarea', placeholder: '現在のお困りごと・ご予算・ご希望の時期など' }
      ],
      policy: { text: 'ご入力いただいた個人情報は、ご相談への対応のみに使用します。', requireAgree: true, label: 'プライバシーポリシーに同意する' }
    },

    interview: {
      label: 'オンライン面談（承認制）',
      title: '面談のご予約', subtitle: 'ご都合のよい日時を第3希望までお選びください。担当者が確認して確定のご連絡をします。',
      approval: { enabled: true, candidates: 3, required: 2 },
      serviceStyle: 'list', cardStyle: 'bordered', calendarStyle: 'month', slotStyle: 'chips', showMarks: false, autoAdvance: true,
      theme: {
        primary: '#0f766e', onPrimary: '#ffffff', accent: '#6366f1',
        background: '#f6f8f8', surface: '#ffffff', text: '#0f1f1d', muted: '#5b6b69', border: '#dfe7e6',
        radius: 12, font: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap'
      },
      business: {
        name: '株式会社サンプル 採用担当',
        hours: {
          0: null, 1: [['10:00', '12:00'], ['13:00', '18:00']], 2: [['10:00', '12:00'], ['13:00', '18:00']], 3: [['10:00', '12:00'], ['13:00', '18:00']],
          4: [['10:00', '12:00'], ['13:00', '18:00']], 5: [['10:00', '12:00'], ['13:00', '17:00']], 6: null
        },
        slotInterval: 30, capacity: 1, capacityScope: 'global', leadTimeMinutes: 2880, maxDaysAhead: 30, bufferMinutes: 15
      },
      services: [
        { id: 'meet', name: 'オンライン面談（Google Meet）', duration: 45, description: '会議の URL は、日程の確定後に自動で発行してお送りします。', meeting: 'meet', tag: 'オンライン' },
        { id: 'zoom', name: 'オンライン面談（Zoom）', duration: 45, description: 'Zoom アプリまたはブラウザから参加できます。', meeting: 'zoom', tag: 'オンライン' },
        { id: 'office', name: '来社での面談', duration: 60, description: '本社（東京都〇〇区）にお越しください。' }
      ],
      fields: [
        ...nameKana, ...contact,
        { name: 'position', label: '希望職種', type: 'select', required: true, options: ['営業', 'エンジニア', 'デザイナー', 'その他'], half: true },
        { name: 'current', label: '現在のご状況', type: 'select', options: ['在職中', '離職中', '学生'], half: true },
        { name: 'note', label: 'ご質問・ご要望', type: 'textarea', placeholder: '面談で聞きたいことなど' }
      ],
      policy: { text: 'ご入力いただいた個人情報は、採用選考のみに使用します。', requireAgree: true, label: '個人情報の取り扱いに同意する' }
    },

    // 白紙：メニュー・担当者・入力項目・営業時間・色の指定をすべて空にした出発点
    blank: {
      label: '白紙から作る',
      blank: true,
      title: '', subtitle: '',
      steps: ['service', 'datetime', 'form', 'confirm'],
      serviceStyle: 'list', cardStyle: 'bordered', calendarStyle: 'month', slotStyle: 'chips', showMarks: false,
      theme: {
        primary: '#111827', onPrimary: '#ffffff', accent: '#6b7280',
        background: '#ffffff', surface: '#ffffff', text: '#111827', muted: '#6b7280', border: '#e5e7eb',
        radius: 8, font: 'inherit', fontUrl: '', headingFont: ''
      },
      business: {
        name: '',
        hours: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
        slotInterval: 30, capacity: 1, capacityScope: 'global', leadTimeMinutes: 60, maxDaysAhead: 60
      },
      services: [],
      staff: [],
      fields: [],
      policy: { text: '', requireAgree: false }
    }
  };

  /* =========================================================
   * styles
   * ======================================================= */
  const STYLES = `
:host{all:initial;display:block;color:var(--rk-text);font-family:var(--rk-font);font-size:var(--rk-fs);line-height:1.65;-webkit-font-smoothing:antialiased;text-align:left}
:host([hidden]){display:none}
*,*::before,*::after{box-sizing:border-box}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0;padding:0}
button:disabled{cursor:not-allowed}
:focus-visible{outline:2px solid var(--rk-primary);outline-offset:2px}
.rk{container-type:inline-size;background:var(--rk-bg);border-radius:calc(var(--rk-radius) * 1.6);padding:calc(var(--rk-gap) * 2);max-width:var(--rk-max);margin:0 auto;position:relative}
.rk[data-transparent="1"]{background:transparent;padding:0}
.rk-head{display:flex;align-items:center;gap:var(--rk-gap);margin-bottom:calc(var(--rk-gap) * 1.4)}
.rk-logo{height:36px;width:auto}
.rk-title{font-family:var(--rk-hfont);font-size:1.45em;font-weight:600;letter-spacing:.02em;margin:0;line-height:1.35}
.rk-sub{margin:.2em 0 0;color:var(--rk-muted);font-size:.9em}
.rk-progress{display:flex;list-style:none;margin:0 0 calc(var(--rk-gap) * 1.6);padding:0;gap:4px;counter-reset:s}
.rk-progress li{flex:1;min-width:0}
.rk-progress button{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:6px;font-size:.78em;color:var(--rk-muted);text-align:left}
.rk-progress button::before{content:"";display:block;width:100%;height:3px;border-radius:3px;background:var(--rk-border);transition:background .25s}
.rk-progress li[data-st="done"] button::before,.rk-progress li[data-st="current"] button::before{background:var(--rk-primary)}
.rk-progress li[data-st="current"] button{color:var(--rk-text);font-weight:600}
.rk-progress span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.rk-progress span::before{counter-increment:s;content:counter(s) ". "}
.rk-section{animation:rk-in .28s ease both}
@keyframes rk-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rk-section{animation:none}}
.rk-h{font-family:var(--rk-hfont);font-size:1.08em;font-weight:600;margin:0 0 calc(var(--rk-gap) * .9);display:flex;align-items:center;gap:.6em}
.rk-h .rk-n{display:inline-grid;place-items:center;width:1.7em;height:1.7em;border-radius:50%;background:var(--rk-primary);color:var(--rk-on-primary);font-size:.75em}
.rk-onepage .rk-section + .rk-section{margin-top:calc(var(--rk-gap) * 2.4);padding-top:calc(var(--rk-gap) * 2);border-top:1px solid var(--rk-border)}
.rk-hint{color:var(--rk-muted);font-size:.9em;margin:0}
.rk-flash{border-radius:var(--rk-radius);padding:.8em 1em;margin-bottom:var(--rk-gap);font-size:.9em;background:color-mix(in srgb,var(--rk-danger) 10%,var(--rk-surface));color:var(--rk-danger);border:1px solid color-mix(in srgb,var(--rk-danger) 30%,transparent)}
.rk-cat{font-size:.78em;letter-spacing:.08em;color:var(--rk-muted);margin:calc(var(--rk-gap) * 1.2) 0 .5em;text-transform:uppercase}
.rk-cat:first-child{margin-top:0}
/* cards */
.rk-cards{display:grid;gap:var(--rk-gap);grid-template-columns:1fr}
@container (min-width:520px){.rk-cards[data-style="grid"]{grid-template-columns:repeat(2,1fr)}}
@container (min-width:760px){.rk-cards[data-style="grid"]{grid-template-columns:repeat(3,1fr)}}
.rk-card{position:relative;display:flex;gap:var(--rk-gap);align-items:flex-start;width:100%;text-align:left;padding:calc(var(--rk-gap) * 1.1);background:var(--rk-surface);border:1px solid var(--rk-border);border-radius:var(--rk-radius);transition:border-color .2s,box-shadow .2s,transform .2s,background .2s}
.rk[data-card="elevated"] .rk-card{border-color:transparent;box-shadow:0 1px 2px rgb(0 0 0 / .05),0 6px 20px -8px rgb(0 0 0 / .14)}
.rk[data-card="flat"] .rk-card{background:transparent;border-width:0 0 1px;border-radius:0;padding-left:0;padding-right:0}
.rk[data-card="flat"] .rk-cards{gap:0}
.rk-card:not(:disabled):hover{border-color:color-mix(in srgb,var(--rk-primary) 45%,var(--rk-border))}
.rk[data-card="elevated"] .rk-card:not(:disabled):hover{transform:translateY(-2px)}
.rk-card[aria-pressed="true"]{border-color:var(--rk-primary);background:var(--rk-soft);box-shadow:inset 0 0 0 1px var(--rk-primary)}
.rk[data-card="flat"] .rk-card[aria-pressed="true"]{box-shadow:none;background:var(--rk-soft);padding-left:.8em;padding-right:.8em}
.rk-card:disabled{opacity:.45}
.rk-card[data-style="grid"]{flex-direction:column}
.rk-card-img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:calc(var(--rk-radius) * .7);display:block}
.rk-cards[data-style="list"] .rk-card-img{width:92px;aspect-ratio:1;flex:none}
.rk-card-body{flex:1;min-width:0}
.rk-card-name{font-weight:600;display:flex;flex-wrap:wrap;align-items:center;gap:.5em;line-height:1.45}
.rk-card-desc{color:var(--rk-muted);font-size:.86em;margin:.25em 0 0}
.rk-card-meta{display:flex;flex-wrap:wrap;gap:.3em 1em;margin-top:.5em;font-size:.88em;color:var(--rk-muted)}
.rk-price{color:var(--rk-text);font-weight:600}
.rk-tag{font-size:.7em;font-weight:600;padding:.15em .6em;border-radius:99px;background:var(--rk-accent-soft);color:var(--rk-accent-ink);letter-spacing:.03em}
.rk-check{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--rk-border);display:grid;place-items:center;transition:all .2s;margin-top:2px}
.rk-check[data-multi="1"]{border-radius:calc(var(--rk-radius) * .4 + 2px)}
[aria-pressed="true"] > .rk-check{background:var(--rk-primary);border-color:var(--rk-primary)}
.rk-check svg{width:12px;height:12px;stroke:var(--rk-on-primary);opacity:0}
[aria-pressed="true"] > .rk-check svg{opacity:1}
.rk-card[data-style="grid"] .rk-check{position:absolute;top:calc(var(--rk-gap) * .9);right:calc(var(--rk-gap) * .9)}
.rk-avatar{flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--rk-soft);color:var(--rk-primary);font-weight:600;overflow:hidden}
.rk-avatar img{width:100%;height:100%;object-fit:cover}
/* quantity */
.rk-qty{display:flex;align-items:center;gap:calc(var(--rk-gap) * 1.2);padding:calc(var(--rk-gap) * 1.2);background:var(--rk-surface);border:1px solid var(--rk-border);border-radius:var(--rk-radius);flex-wrap:wrap}
.rk-qty-label{flex:1;font-weight:600;min-width:8em}
.rk-stepper{display:flex;align-items:center;gap:.4em}
.rk-stepper button{width:44px;height:44px;border-radius:50%;border:1px solid var(--rk-border);font-size:1.3em;line-height:1;background:var(--rk-bg);display:grid;place-items:center}
.rk-stepper button:not(:disabled):hover{border-color:var(--rk-primary);color:var(--rk-primary)}
.rk-stepper button:disabled{opacity:.35}
.rk-stepper output{min-width:4.2em;text-align:center;font-size:1.25em;font-weight:600}
.rk-stepper output small{font-size:.65em;font-weight:400;margin-left:.15em;color:var(--rk-muted)}
.rk-qty-quick{display:flex;flex-wrap:wrap;gap:6px;width:100%}
.rk-qty-quick button{padding:.3em .85em;border-radius:99px;border:1px solid var(--rk-border);font-size:.85em;background:var(--rk-bg)}
.rk-qty-quick button[aria-pressed="true"]{background:var(--rk-primary);color:var(--rk-on-primary);border-color:var(--rk-primary)}
/* calendar */
.rk-dt{display:grid;gap:calc(var(--rk-gap) * 1.4)}
@container (min-width:640px){.rk-dt[data-cal="month"]{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:start}}
.rk-cal{background:var(--rk-surface);border:1px solid var(--rk-border);border-radius:var(--rk-radius);padding:calc(var(--rk-gap) * 1)}
.rk[data-card="flat"] .rk-cal{background:transparent}
.rk-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.6em}
.rk-cal-title{font-weight:600;font-family:var(--rk-hfont)}
.rk-nav-btn{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid transparent}
.rk-nav-btn:not(:disabled):hover{border-color:var(--rk-border);background:var(--rk-bg)}
.rk-nav-btn:disabled{opacity:.25}
.rk-nav-btn svg{width:16px;height:16px;stroke:currentColor}
.rk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}
.rk-wd{font-size:.72em;color:var(--rk-muted);padding:.3em 0}
.rk-wd[data-w="0"]{color:#d14b4b}.rk-wd[data-w="6"]{color:#3b6fd6}
.rk-day{aspect-ratio:1/1.02;max-height:60px;min-height:42px;border-radius:calc(var(--rk-radius) * .6 + 2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:.92em;position:relative;transition:background .15s}
.rk-day:not(:disabled):hover{background:var(--rk-soft)}
.rk-day:disabled{color:color-mix(in srgb,var(--rk-muted) 55%,transparent)}
.rk-day .rk-mark{font-size:.66em;line-height:1;color:var(--rk-primary)}
.rk-day:disabled .rk-mark{color:inherit}
.rk-day[data-today="1"] .rk-dn{text-decoration:underline;text-underline-offset:3px}
.rk-day[aria-pressed="true"],.rk-day[data-range="edge"]{background:var(--rk-primary)!important;color:var(--rk-on-primary)}
.rk-day[aria-pressed="true"] .rk-mark,.rk-day[data-range="edge"] .rk-mark{color:var(--rk-on-primary)}
.rk-day[data-range="in"]{background:var(--rk-soft);border-radius:0}
.rk-legend{font-size:.72em;color:var(--rk-muted);margin:.6em 0 0;text-align:center}
.rk-week{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px;margin-bottom:var(--rk-gap)}
.rk-week-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.rk-wday{display:flex;flex-direction:column;align-items:center;gap:2px;padding:.55em 0;border-radius:var(--rk-radius);border:1px solid var(--rk-border);background:var(--rk-surface);font-size:.85em;transition:all .15s}
.rk-wday small{font-size:.75em;color:var(--rk-muted)}
.rk-wday b{font-size:1.15em;font-weight:600}
.rk-wday .rk-mark{font-size:.75em;color:var(--rk-primary);line-height:1}
.rk-wday:disabled{opacity:.4}
.rk-wday:not(:disabled):hover{border-color:var(--rk-primary)}
.rk-wday[aria-pressed="true"]{background:var(--rk-primary);border-color:var(--rk-primary);color:var(--rk-on-primary)}
.rk-wday[aria-pressed="true"] small,.rk-wday[aria-pressed="true"] .rk-mark{color:var(--rk-on-primary)}
.rk-week-label{text-align:center;font-weight:600;font-size:.9em;grid-column:1/-1;margin-bottom:.2em}
/* slots */
.rk-slots-head{font-weight:600;margin:0 0 .7em;font-family:var(--rk-hfont)}
.rk-slots{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(84px,1fr))}
.rk-slots[data-style="list"]{grid-template-columns:1fr}
.rk-slot{padding:.6em .4em;border-radius:var(--rk-radius);border:1px solid var(--rk-border);background:var(--rk-surface);font-variant-numeric:tabular-nums;font-weight:500;transition:all .15s;display:flex;flex-direction:column;align-items:center;line-height:1.3}
.rk-slot small{font-size:.72em;color:var(--rk-muted);font-weight:400}
.rk-slots[data-style="list"] .rk-slot{flex-direction:row;justify-content:space-between;padding:.8em 1em}
.rk-slot:not(:disabled):hover{border-color:var(--rk-primary);color:var(--rk-primary)}
.rk-slot:disabled{opacity:.4;text-decoration:line-through}
.rk-slot[aria-pressed="true"]{background:var(--rk-primary);border-color:var(--rk-primary);color:var(--rk-on-primary)}
.rk-slot[aria-pressed="true"] small{color:var(--rk-on-primary)}
.rk-slot-group{font-size:.78em;color:var(--rk-muted);margin:.9em 0 .4em;grid-column:1/-1}
.rk-slot-group:first-child{margin-top:0}
.rk-loading{display:flex;align-items:center;gap:.6em;color:var(--rk-muted);font-size:.9em}
.rk-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--rk-border);border-top-color:var(--rk-primary);animation:rk-spin .8s linear infinite}
@keyframes rk-spin{to{transform:rotate(360deg)}}
.rk-stay{display:flex;gap:var(--rk-gap);margin-bottom:var(--rk-gap)}
.rk-stay > div{flex:1;padding:.7em 1em;border-radius:var(--rk-radius);border:1px solid var(--rk-border);background:var(--rk-surface)}
.rk-stay > div[data-active="1"]{border-color:var(--rk-primary);box-shadow:inset 0 0 0 1px var(--rk-primary)}
.rk-stay small{display:block;font-size:.75em;color:var(--rk-muted)}
.rk-stay b{font-weight:600}
/* form */
.rk-form{display:grid;gap:calc(var(--rk-gap) * 1.1) var(--rk-gap);grid-template-columns:1fr}
@container (min-width:560px){.rk-form{grid-template-columns:1fr 1fr}.rk-field{grid-column:1/-1}.rk-field[data-half="1"]{grid-column:auto}}
.rk-label{display:flex;align-items:center;gap:.5em;font-weight:600;font-size:.9em;margin-bottom:.4em}
.rk-badge{font-size:.68em;font-weight:600;padding:.1em .5em;border-radius:4px;background:var(--rk-primary);color:var(--rk-on-primary)}
.rk-badge[data-opt="1"]{background:var(--rk-border);color:var(--rk-muted)}
.rk-input{width:100%;padding:.72em .9em;border:1px solid var(--rk-border);border-radius:calc(var(--rk-radius) * .7 + 2px);background:var(--rk-surface);transition:border-color .15s,box-shadow .15s;font-size:max(16px,1em)}
.rk-input:focus{outline:none;border-color:var(--rk-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--rk-primary) 18%,transparent)}
textarea.rk-input{min-height:6.5em;resize:vertical}
select.rk-input{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--rk-muted) 50%),linear-gradient(135deg,var(--rk-muted) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat;padding-right:2.4em}
.rk-field[data-err="1"] .rk-input{border-color:var(--rk-danger)}
.rk-err{color:var(--rk-danger);font-size:.8em;margin:.35em 0 0;display:none}
.rk-field[data-err="1"] .rk-err{display:block}
.rk-help{color:var(--rk-muted);font-size:.8em;margin:.35em 0 0}
.rk-choices{display:flex;flex-wrap:wrap;gap:6px}
.rk-choice{position:relative}
.rk-choice input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.rk-choice span{display:inline-block;padding:.5em 1em;border:1px solid var(--rk-border);border-radius:99px;font-size:.9em;background:var(--rk-surface);transition:all .15s}
.rk-choice input:checked + span{background:var(--rk-primary);border-color:var(--rk-primary);color:var(--rk-on-primary)}
.rk-choice input:focus-visible + span{outline:2px solid var(--rk-primary);outline-offset:2px}
.rk-agree{display:flex;gap:.6em;align-items:flex-start;font-size:.92em;cursor:pointer}
.rk-agree input{width:18px;height:18px;margin:.2em 0 0;accent-color:var(--rk-primary);flex:none}
.rk-privacy{margin:0 0 .8em;color:var(--rk-muted)}
.rk-privacy a{color:var(--rk-primary);text-decoration:underline}
.rk-policy .rk-agree + .rk-agree{margin-top:.6em}
.rk-demo{position:fixed;left:12px;bottom:12px;z-index:2147483001;max-width:min(340px,calc(100vw - 24px));padding:.6em .9em;border-radius:8px;background:#b42318;color:#fff;font:600 12px/1.5 system-ui,-apple-system,"Hiragino Sans",sans-serif;box-shadow:0 8px 24px -8px rgb(0 0 0 / .45);pointer-events:none}
.rk-demo[data-side=right]{left:auto;right:12px}
.rk-cands{display:grid;gap:6px;margin:0 0 calc(var(--rk-gap) * 1.2);grid-template-columns:1fr}
@container (min-width:560px){.rk-cands{grid-template-columns:repeat(var(--rk-cn),minmax(0,1fr))}}
.rk-cand{display:flex;align-items:center;gap:.6em;padding:.55em .7em .55em .9em;border-radius:var(--rk-radius);border:1px dashed var(--rk-border);background:var(--rk-surface);font-size:.86em;min-height:50px;line-height:1.35}
.rk-cand[data-filled="1"]{border-style:solid;border-color:var(--rk-primary);background:var(--rk-soft)}
.rk-cand b{font-size:.82em;color:var(--rk-primary);white-space:nowrap}
.rk-cand[data-filled="0"] b{color:var(--rk-muted)}
.rk-cand span{flex:1;min-width:0;color:var(--rk-muted)}
.rk-cand[data-filled="1"] span{color:var(--rk-text);font-weight:500}
.rk-cand button{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:var(--rk-muted);flex:none}
.rk-cand button:hover{background:var(--rk-bg);color:var(--rk-text)}
.rk-cand button svg{width:13px;height:13px;stroke:currentColor}
.rk-rank{font-size:.68em;font-weight:600;line-height:1.2}
.rk-note{font-size:.84em;color:var(--rk-muted);margin:0 0 calc(var(--rk-gap) * .8)}
.rk-pending{display:flex;gap:.6em;align-items:flex-start;margin-top:calc(var(--rk-gap) * 1.1);padding:.8em 1em;border-radius:var(--rk-radius);background:color-mix(in srgb,var(--rk-accent) 12%,var(--rk-surface));font-size:.86em}
.rk-meet{display:flex;flex-direction:column;align-items:center;gap:.4em;padding:calc(var(--rk-gap) * 1.1);margin:0 auto calc(var(--rk-gap) * 1.4);max-width:520px;border-radius:var(--rk-radius);border:1px solid var(--rk-border);background:var(--rk-surface)}
.rk-meet small{color:var(--rk-muted);font-size:.78em}
.rk-meet a.rk-meet-url{word-break:break-all;color:var(--rk-primary);font-size:.86em}
.rk-done-icon[data-pending="1"]{background:var(--rk-accent);color:var(--rk-on-primary)}
.rk-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}
/* summary / confirm */
.rk-sum{background:var(--rk-surface);border:1px solid var(--rk-border);border-radius:var(--rk-radius);padding:calc(var(--rk-gap) * .4) calc(var(--rk-gap) * 1.2)}
.rk-sum dl{margin:0;display:grid;grid-template-columns:minmax(6em,auto) 1fr}
.rk-sum dt,.rk-sum dd{padding:.7em 0;border-bottom:1px solid var(--rk-border);margin:0}
.rk-sum dt{color:var(--rk-muted);font-size:.88em;padding-right:1em}
.rk-sum dd{word-break:break-word}
.rk-sum dl > :nth-last-child(-n+2){border-bottom:0}
.rk-total{display:flex;justify-content:space-between;align-items:baseline;padding:.9em 0 .6em;border-top:2px solid var(--rk-text);margin-top:-1px;font-weight:600}
.rk-total b{font-size:1.35em}
.rk-total small{font-weight:400;color:var(--rk-muted);font-size:.75em;margin-left:.3em}
.rk-policy{margin-top:calc(var(--rk-gap) * 1.2);padding:calc(var(--rk-gap) * 1.1);border-radius:var(--rk-radius);background:var(--rk-soft);font-size:.88em}
.rk-policy h4{margin:0 0 .4em;font-size:1em}
.rk-policy p{margin:0 0 .8em;color:var(--rk-muted)}
/* footer nav */
.rk-foot{display:flex;align-items:center;gap:var(--rk-gap);margin-top:calc(var(--rk-gap) * 1.8);padding-top:calc(var(--rk-gap) * 1.2);border-top:1px solid var(--rk-border)}
.rk-mini{flex:1;min-width:0;font-size:.82em;color:var(--rk-muted);line-height:1.45}
.rk-mini b{color:var(--rk-text);font-weight:600}
.rk-mini div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;padding:.85em 1.6em;border-radius:var(--rk-btn-radius);font-weight:600;transition:all .2s;min-height:48px;text-decoration:none;white-space:nowrap}
.rk-btn-primary{background:var(--rk-primary);color:var(--rk-on-primary)}
.rk-btn-primary:not(:disabled):hover{filter:brightness(1.1);box-shadow:0 6px 18px -6px color-mix(in srgb,var(--rk-primary) 70%,transparent)}
.rk-btn-primary:disabled{opacity:.4}
.rk-btn-ghost{color:var(--rk-muted);padding-left:.6em;padding-right:.6em}
.rk-btn-ghost:hover{color:var(--rk-text)}
.rk-btn-outline{border:1px solid var(--rk-border);background:var(--rk-surface);color:var(--rk-text)}
.rk-btn-outline:hover{border-color:var(--rk-primary);color:var(--rk-primary)}
.rk-btn-block{width:100%}
.rk-onepage .rk-foot{border-top:0;padding-top:0}
/* done */
.rk-done{text-align:center;padding:calc(var(--rk-gap) * 1.5) 0}
.rk-done-icon{width:64px;height:64px;border-radius:50%;margin:0 auto var(--rk-gap);display:grid;place-items:center;background:var(--rk-primary);color:var(--rk-on-primary);animation:rk-pop .5s cubic-bezier(.2,1.4,.4,1) both}
.rk-done-icon svg{width:30px;height:30px;stroke:currentColor}
@keyframes rk-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
.rk-done h3{font-family:var(--rk-hfont);font-size:1.3em;margin:0 0 .4em}
.rk-done p{color:var(--rk-muted);margin:0 0 calc(var(--rk-gap) * 1.4)}
.rk-number{display:inline-block;padding:.5em 1.2em;border-radius:var(--rk-radius);background:var(--rk-soft);margin-bottom:calc(var(--rk-gap) * 1.4)}
.rk-number small{display:block;font-size:.75em;color:var(--rk-muted)}
.rk-number b{font-size:1.3em;letter-spacing:.08em;font-variant-numeric:tabular-nums}
.rk-done .rk-sum{text-align:left;margin-bottom:calc(var(--rk-gap) * 1.4)}
.rk-done-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
/* modal */
.rk-launcher{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:.55em;padding:.95em 1.5em;border-radius:99px;background:var(--rk-primary);color:var(--rk-on-primary);font-weight:600;box-shadow:0 10px 30px -8px rgb(0 0 0 / .35);transition:transform .2s}
.rk-launcher:hover{transform:translateY(-2px)}
.rk-launcher svg{width:18px;height:18px;stroke:currentColor}
.rk-launcher[data-pos="bottom-right"]{right:20px;bottom:20px}
.rk-launcher[data-pos="bottom-left"]{left:20px;bottom:20px}
.rk-launcher[data-pos="bottom-center"]{left:50%;bottom:20px;transform:translateX(-50%)}
.rk-overlay{position:fixed;inset:0;z-index:2147483001;background:rgb(10 12 18 / .55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;animation:rk-fade .2s ease both}
.rk-overlay[hidden]{display:none}
@keyframes rk-fade{from{opacity:0}}
.rk-dialog{position:relative;width:100%;max-width:var(--rk-max);max-height:calc(100dvh - 32px);overflow:auto;border-radius:calc(var(--rk-radius) * 1.6);background:var(--rk-bg);box-shadow:0 30px 80px -20px rgb(0 0 0 / .5);animation:rk-up .28s cubic-bezier(.2,.9,.3,1) both;overscroll-behavior:contain}
@keyframes rk-up{from{transform:translateY(24px);opacity:0}}
.rk-close{position:absolute;top:12px;right:12px;z-index:2;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--rk-surface);border:1px solid var(--rk-border)}
.rk-close svg{width:16px;height:16px;stroke:currentColor}
.rk-dialog .rk-head{padding-right:44px}
@media (max-width:560px){.rk-overlay{padding:0;align-items:flex-end}.rk-dialog{max-height:94dvh;border-radius:calc(var(--rk-radius) * 1.6) calc(var(--rk-radius) * 1.6) 0 0}}
@container (max-width:420px){.rk{padding:calc(var(--rk-gap) * 1.3)}.rk-foot .rk-btn-primary{padding-left:1.1em;padding-right:1.1em}}
`;

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>'
  };

  function themeVars(t) {
    const gap = { compact: 10, comfortable: 14, spacious: 18 }[t.density] || 14;
    const r = Number(t.radius) || 0;
    return [
      `--rk-primary:${t.primary}`, `--rk-on-primary:${t.onPrimary}`,
      `--rk-accent:${t.accent || t.primary}`,
      `--rk-bg:${t.background}`, `--rk-surface:${t.surface}`, `--rk-text:${t.text}`, `--rk-muted:${t.muted}`, `--rk-border:${t.border}`,
      `--rk-danger:${t.danger}`, `--rk-success:${t.success}`,
      `--rk-radius:${r}px`, `--rk-btn-radius:${t.buttonRadius != null ? t.buttonRadius + 'px' : (r >= 16 ? '999px' : r + 'px')}`,
      `--rk-fs:${Number(t.fontSize) || 15}px`, `--rk-gap:${gap}px`, `--rk-max:${Number(t.maxWidth) ? t.maxWidth + 'px' : t.maxWidth}`,
      `--rk-font:${t.font === 'inherit' ? 'inherit' : t.font}`, `--rk-hfont:${t.headingFont || 'var(--rk-font)'}`,
      '--rk-soft:color-mix(in srgb,var(--rk-primary) 8%,var(--rk-surface))',
      '--rk-accent-soft:color-mix(in srgb,var(--rk-accent) 16%,var(--rk-surface))',
      '--rk-accent-ink:color-mix(in srgb,var(--rk-accent) 70%,var(--rk-text))'
    ].join(';');
  }

  function darkVars(d) {
    const map = { background: 'bg', surface: 'surface', text: 'text', muted: 'muted', border: 'border', primary: 'primary', onPrimary: 'on-primary' };
    return Object.keys(d || {}).filter((k) => map[k]).map((k) => `--rk-${map[k]}:${d[k]}`).join(';');
  }

  /* =========================================================
   * backends
   * ======================================================= */
  async function http(url, opts) {
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* noop */ }
    if (!res.ok) {
      // サーバー内部のエラー文（英語・HTML）はお客様に見せない
      const safe = res.status < 500 && data && data.code && data.message && !/[<>]/.test(data.message);
      throw Object.assign(new Error(safe ? data.message : `HTTP ${res.status}`), safe ? data : { status: res.status });
    }
    return data;
  }
  const qs = (o) => Object.keys(o).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(o[k])}`).join('&');

  const Backends = {
    local: {
      key: (cfg) => `reservekit:${cfg.backend.storeKey || cfg.backend.formId || cfg.template || 'default'}`,
      read(cfg) { try { return JSON.parse(localStorage.getItem(this.key(cfg)) || '[]'); } catch (e) { return []; } },
      async availability(cfg) { return { bookings: this.read(cfg).filter((x) => x.status !== 'pending'), blocks: [] }; },
      async submit(cfg, p) {
        const list = this.read(cfg);
        const num = bookingNumber();
        list.push({ start: p.occupyStart || p.start, end: p.occupyEnd || p.end, count: p.count, serviceIds: p.serviceIds, staffId: p.staffId, number: num, status: p.approval ? 'pending' : 'confirmed', candidates: p.candidates });
        try { localStorage.setItem(this.key(cfg), JSON.stringify(list)); } catch (e) { /* noop */ }
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true, bookingNumber: num, status: p.approval ? 'pending' : 'confirmed', demo: true };
      }
    },
    rest: {
      base: (cfg) => String(cfg.backend.url || '').replace(/\/$/, ''),
      async availability(cfg, from, to) {
        return http(`${this.base(cfg)}/availability?${qs({ form: cfg.backend.formId, from, to })}`, { headers: cfg.backend.headers || {} });
      },
      async submit(cfg, p) {
        return http(`${this.base(cfg)}/bookings`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.backend.headers || {}), body: JSON.stringify(p) });
      }
    },
    gas: {
      async availability(cfg, from, to) {
        return http(`${cfg.backend.url}?${qs({ action: 'availability', form: cfg.backend.formId, from, to })}`);
      },
      async submit(cfg, p) {
        // text/plain にするとプリフライト（CORS）が発生しない
        return http(cfg.backend.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) });
      }
    },
    webhook: {
      async availability() { return { bookings: [], blocks: [] }; },
      async submit(cfg, p) {
        const num = bookingNumber();
        await fetch(cfg.backend.url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.backend.headers || {}), body: JSON.stringify(Object.assign({ bookingNumber: num }, p)) });
        return { ok: true, bookingNumber: num };
      }
    }
  };
  Backends.wordpress = {
    availability(cfg, f, t) { return Backends.rest.availability(withUrl(cfg, '/wp-json/reserve-kit/v1'), f, t); },
    submit(cfg, p) { return Backends.rest.submit(withUrl(cfg, '/wp-json/reserve-kit/v1'), p); }
  };
  function withUrl(cfg, fallback) { return cfg.backend.url ? cfg : merge({}, cfg, { backend: { url: fallback } }); }

  /* =========================================================
   * config
   * ======================================================= */
  function resolveConfig(user) {
    user = user || {};
    const tpl = user.template && TEMPLATES[user.template] ? clone(TEMPLATES[user.template]) : {};
    const fns = {};
    ['onSubmit', 'onComplete', 'onError', 'onChange'].forEach((k) => { if (typeof user[k] === 'function') fns[k] = user[k]; });
    const backendFns = {};
    if (user.backend) ['availability', 'submit'].forEach((k) => { if (typeof user.backend[k] === 'function') backendFns[k] = user.backend[k]; });
    const cfg = merge({}, clone(DEFAULTS), tpl, clone(user));
    Object.assign(cfg, fns);
    Object.assign(cfg.backend, backendFns);
    if (user.backend && typeof user.backend.availability === 'function') cfg.backend.type = 'custom';
    cfg.locale = I18N[cfg.locale] ? cfg.locale : 'ja';
    cfg.t = merge({}, I18N[cfg.locale], cfg.texts || {});
    if (!cfg.steps) {
      cfg.steps = cfg.bookingType === 'range'
        ? ['service', 'dates', 'quantity', 'form', 'confirm']
        : ['service', cfg.staff && cfg.staff.length ? 'staff' : null, 'datetime', 'form', 'confirm'].filter(Boolean);
    }
    if (!cfg.steps.includes('confirm')) cfg.steps.push('confirm');
    cfg.services = (cfg.services || []).map((s, i) => Object.assign({ id: s.id || `s${i + 1}` }, s));
    cfg.staff = (cfg.staff || []).map((s, i) => Object.assign({ id: s.id || `p${i + 1}` }, s));
    cfg.weekStart = Number(cfg.weekStart) === 1 ? 1 : 0;
    const ap = cfg.approval || {};
    ap.candidates = Math.max(1, Math.min(5, Number(ap.candidates) || 1));
    if (cfg.bookingType === 'range') ap.candidates = 1;
    if (ap.candidates > 1) ap.enabled = true;
    ap.required = Math.max(1, Math.min(ap.candidates, Number(ap.required) || 1));
    ap.enabled = !!ap.enabled;
    cfg.approval = ap;
    return cfg;
  }

  /* =========================================================
   * widget
   * ======================================================= */
  let demoBadgeOwner = null; // デモ保存の警告を出しているウィジェット
  class Widget {
    constructor(host, config) {
      this.host = host;
      this.root = host.shadowRoot || host.attachShadow({ mode: 'open' });
      this._onClick = (e) => this.handleClick(e);
      this._onInput = (e) => this.handleInput(e);
      this._onKey = (e) => { if (e.key === 'Escape' && this.state.open) this.close(); };
      this._onTrigger = (e) => { e.preventDefault(); this.open(); };
      this.root.addEventListener('click', this._onClick);
      this.root.addEventListener('input', this._onInput);
      this.root.addEventListener('change', this._onInput);
      document.addEventListener('keydown', this._onKey);
      this.setConfig(config);
    }

    /* ---------- lifecycle ---------- */
    setConfig(config) {
      this.userConfig = config || {};
      this.cfg = resolveConfig(this.userConfig);
      this.t = this.cfg.t;
      this.loadFont();
      this.bindTriggers();
      if (this.isDemoInProduction() && !this._demoWarned) {
        this._demoWarned = true;
        console.warn('[ReserveKit] 保存先がデモ用（backend.type: \'local\'）のままです。予約はお客様のブラウザにだけ保存され、お店には届きません。本番では backend を wordpress / gas / rest などにしてください。');
      }
      this.reset(true);
    }
    update(config) { this.setConfig(merge({}, this.userConfig, config)); return this; }

    reset(silent) {
      const c = this.cfg;
      const today = nowIn(c.business.timezone).slice(0, 10);
      const wasOpen = this.state ? this.state.open : false;
      this.state = {
        stepIndex: 0, view: 'steps',
        services: [], staffId: c.allowAnyStaff === false ? null : (c.staff.length ? 'any' : null),
        qty: Math.max(c.quantity.min || 1, c.quantity.default || 1),
        date: null, slot: null, cands: [], checkIn: null, checkOut: null,
        form: {}, errors: {}, agree: false, privacyAgree: false, hp: '',
        calMonth: today.slice(0, 7) + '-01', weekFrom: today,
        bookings: [], blocks: [], loaded: false, loading: false,
        submitting: false, result: null, flash: '', open: wasOpen
      };
      c.fields.forEach((f) => { if (f.default != null) this.state.form[f.name] = f.default; });
      if (c.services.length === 1) this.state.services = [c.services[0].id];
      this.buildShell();
      this.loadAvailability();
      if (!silent) this.emit('reset');
    }

    destroy() {
      this.root.removeEventListener('click', this._onClick);
      this.root.removeEventListener('input', this._onInput);
      this.root.removeEventListener('change', this._onInput);
      document.removeEventListener('keydown', this._onKey);
      this.unbindTriggers();
      this.root.innerHTML = '';
      if (demoBadgeOwner === this) demoBadgeOwner = null;
      document.documentElement.style.removeProperty('overflow');
      delete this.host.__reserveKit;
    }

    loadFont() {
      // 本文の書体と見出しの書体（headingFontUrl）の両方を読み込む
      [this.cfg.theme.fontUrl, this.cfg.theme.headingFontUrl].forEach((url) => {
        if (!url || document.querySelector(`link[data-rk-font="${window.CSS && window.CSS.escape ? window.CSS.escape(url) : url}"]`)) return;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = url; l.setAttribute('data-rk-font', url);
        document.head.appendChild(l);
      });
    }

    bindTriggers() {
      this.unbindTriggers();
      if (!this.cfg.trigger) return;
      this._triggers = Array.from(document.querySelectorAll(this.cfg.trigger));
      this._triggers.forEach((el) => el.addEventListener('click', this._onTrigger));
    }
    unbindTriggers() { (this._triggers || []).forEach((el) => el.removeEventListener('click', this._onTrigger)); this._triggers = []; }

    emit(name, detail) {
      this.host.dispatchEvent(new CustomEvent(`reservekit:${name}`, { detail, bubbles: true, composed: true }));
    }

    open() {
      if (this.cfg.mode !== 'modal') { this.host.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      this.state.open = true;
      this.overlay.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      this.render();
      setTimeout(() => { const b = this.root.querySelector('.rk-close'); if (b) b.focus(); }, 30);
      this.emit('open');
    }
    close() {
      if (this.cfg.mode !== 'modal') return;
      this.state.open = false;
      this.overlay.hidden = true;
      document.documentElement.style.removeProperty('overflow');
      if (this.state.view === 'done') this.reset(true);
      this.emit('close');
    }

    buildShell() {
      const c = this.cfg; const th = c.theme;
      let vars = `:host{${themeVars(th)}}`;
      const dark = darkVars(c.themeDark);
      if (th.scheme === 'dark') vars += `:host{${dark}}`;
      else if (th.scheme === 'auto') vars += `@media (prefers-color-scheme:dark){:host{${dark}}}`;
      const style = `<style>${STYLES}${vars}${c.customCSS || ''}</style>`;
      if (c.mode === 'modal') {
        const label = c.launcher.label || c.t.open;
        this.root.innerHTML = `${style}
          ${c.launcher.show !== false ? `<button type="button" class="rk-launcher" part="launcher" data-act="open" data-pos="${esc(c.launcher.position)}">${ICON.cal}<span>${esc(label)}</span></button>` : ''}
          <div class="rk-overlay" part="overlay" data-act="overlay" ${this.state.open ? '' : 'hidden'}>
            <div class="rk-dialog" part="dialog" role="dialog" aria-modal="true" aria-label="${esc(c.title)}">
              <button type="button" class="rk-close" part="close" data-act="close" aria-label="${esc(c.t.close)}">${ICON.close}</button>
              <div class="rk-app"></div>
            </div>
          </div>`;
        this.overlay = this.root.querySelector('.rk-overlay');
      } else {
        this.root.innerHTML = `${style}<div class="rk-app"></div>`;
        this.overlay = null;
      }
      this.app = this.root.querySelector('.rk-app');
      // 画面の隅の警告は、1ページに1つだけ出す
      if (this.isDemoInProduction() && (!demoBadgeOwner || demoBadgeOwner === this || !demoBadgeOwner.host.isConnected)) {
        demoBadgeOwner = this;
        const b = document.createElement('div');
        b.className = 'rk-demo'; b.setAttribute('part', 'demo-notice'); b.setAttribute('role', 'note');
        if (c.mode === 'modal' && c.launcher.position === 'bottom-left') b.setAttribute('data-side', 'right');
        b.textContent = c.t.demoNotice;
        this.root.appendChild(b);
      }
      this.render();
    }

    /* ---------- availability ---------- */
    async loadAvailability() {
      const c = this.cfg; const s = this.state;
      const backend = c.backend.type === 'custom' ? c.backend : Backends[c.backend.type] || Backends.local;
      const from = nowIn(c.business.timezone).slice(0, 10);
      const to = addDays(from, (c.business.maxDaysAhead || 60) + 1);
      s.loading = true;
      const token = (this._loadToken = {});
      try {
        const data = await backend.availability.call(backend, c, from, to);
        if (token !== this._loadToken) return;
        s.bookings = (data && data.bookings) || [];
        s.blocks = (data && data.blocks) || [];
      } catch (e) {
        console.warn('[ReserveKit] 空き状況を取得できませんでした', e);
        if (typeof c.onError === 'function') c.onError(e, this);
      }
      if (token !== this._loadToken) return;
      s.loading = false; s.loaded = true;
      this.render();
    }

    /* ---------- engine ---------- */
    selectedServices() { return this.state.services.map((id) => this.cfg.services.find((x) => x.id === id)).filter(Boolean); }
    primaryService() { return this.selectedServices()[0] || null; }
    hasOpenDays() {
      const b = this.cfg.business;
      return [0, 1, 2, 3, 4, 5, 6].some((d) => { const h = b.hours && b.hours[d]; return h && h.length; }) || Object.keys(b.specialHours || {}).some((k) => (b.specialHours[k] || []).length);
    }
    multi() { return this.cfg.approval.candidates > 1 && this.cfg.bookingType !== 'range'; }
    candObj(start) { return start ? (this.slotsFor(start.slice(0, 10)).find((x) => x.start === start) || null) : null; }
    meetingProvider() {
      const sv = this.selectedServices().find((x) => x.meeting);
      if (!sv) return null;
      return sv.meeting === true ? (this.cfg.meeting.provider || 'meet') : String(sv.meeting);
    }
    providerName(pv) { return (this.t.providers && this.t.providers[pv]) || pv; }
    duration() {
      const ss = this.selectedServices();
      if (!ss.length) return this.cfg.business.defaultDuration || 60;
      return ss.reduce((a, s) => a + (Number(s.duration) || this.cfg.business.defaultDuration || 60), 0);
    }
    staffById(id) { return this.cfg.staff.find((p) => p.id === id) || null; }
    capacity() {
      const b = this.cfg.business; const sv = this.primaryService();
      if (b.capacityScope === 'service' && sv && sv.capacity != null) return Number(sv.capacity);
      return Number(b.capacity) || 1;
    }
    consumed() { return this.cfg.quantity.consumesCapacity && this.cfg.steps.includes('quantity') ? this.state.qty : 1; }

    rangesFor(date) {
      const b = this.cfg.business;
      if ((b.closedDates || []).includes(date)) return [];
      let r = b.specialHours && Object.prototype.hasOwnProperty.call(b.specialHours, date) ? b.specialHours[date] : b.hours[weekdayOf(date)];
      if (!r || !r.length) return [];
      if (typeof r[0] === 'string') r = [r];
      return r.map(([a, z]) => [toMin(a), toMin(z)]);
    }

    // 指定スタッフ（または全体）で、[start,end) に残りいくつ入れるか
    remaining(start, end, staffId) {
      const c = this.cfg; const scope = c.business.capacityScope; const sv = this.primaryService();
      const s0 = stamp(start); const e0 = stamp(end) + (Number(c.business.bufferMinutes) || 0);
      const over = (x) => stamp(x.start) < e0 && (stamp(x.end) + (Number(c.business.bufferMinutes) || 0)) > s0;
      for (const bl of this.state.blocks) {
        if (over(bl) && (!bl.staffId || bl.staffId === staffId) && (!bl.serviceId || (sv && bl.serviceId === sv.id))) return 0;
      }
      let used = 0;
      for (const bk of this.state.bookings) {
        if (!over(bk)) continue;
        if (scope === 'staff' && staffId && bk.staffId !== staffId) continue;
        if (scope === 'service' && sv && !(bk.serviceIds || []).includes(sv.id)) continue;
        used += Number(bk.count) || 1;
      }
      return this.capacity() - used;
    }

    slotsFor(date) {
      const c = this.cfg; const b = c.business; const s = this.state;
      const now = stamp(nowIn(b.timezone)) + (Number(b.leadTimeMinutes) || 0);
      const today = nowIn(b.timezone).slice(0, 10);
      if (daysBetween(today, date) > (b.maxDaysAhead || 60)) return [];
      const ss = this.selectedServices();
      const wd = weekdayOf(date);
      if (ss.some((x) => Array.isArray(x.days) && !x.days.includes(wd))) return [];
      const ranges = this.rangesFor(date);
      if (!ranges.length) return [];
      const dur = this.duration();
      const need = this.consumed();
      const fixed = ss.find((x) => Array.isArray(x.times) && x.times.length);
      let starts = [];
      if (fixed) starts = fixed.times.map(toMin);
      else ranges.forEach(([o, z]) => { for (let t = o; t + dur <= z; t += Number(b.slotInterval) || 30) starts.push(t); });

      // スタッフ候補
      let staffIds = [null];
      if (c.steps.includes('staff') && c.staff.length) {
        const pool = c.staff.filter((p) => !Array.isArray(p.days) || p.days.includes(wd))
          .filter((p) => !Array.isArray(p.services) || ss.every((x) => p.services.includes(x.id)));
        staffIds = s.staffId && s.staffId !== 'any' ? pool.filter((p) => p.id === s.staffId).map((p) => p.id) : pool.map((p) => p.id);
        if (!staffIds.length) return [];
      }
      const cap = this.capacity();
      return starts.map((t) => {
        const start = `${date}T${fromMin(t)}`;
        const end = fromStamp(stamp(start) + dur);
        let best = -Infinity; let bestStaff = null;
        if (stamp(start) >= now) {
          for (const sid of staffIds) {
            const r = this.remaining(start, end, c.business.capacityScope === 'staff' ? sid : sid);
            if (r > best) { best = r; bestStaff = sid; }
          }
        }
        const rem = best === -Infinity ? 0 : best;
        return { time: fromMin(t), start, end, remaining: rem, capacity: cap, available: rem >= need, staffId: bestStaff, past: stamp(start) < now };
      }).filter((x) => !x.past);
    }

    nightRemaining(date) {
      const st = `${date}T00:00`; const en = `${addDays(date, 1)}T00:00`;
      return this.remaining(st, en, null);
    }
    nightOpen(date) {
      const b = this.cfg.business;
      const today = nowIn(b.timezone).slice(0, 10);
      if (date < today || daysBetween(today, date) > (b.maxDaysAhead || 60)) return false;
      if (!this.rangesFor(date).length) return false;
      const sv = this.primaryService();
      if (sv && Array.isArray(sv.days) && !sv.days.includes(weekdayOf(date))) return false;
      return this.nightRemaining(date) >= 1;
    }

    dayInfo(date) {
      const b = this.cfg.business;
      const today = nowIn(b.timezone).slice(0, 10);
      if (date < today) return { status: 'past' };
      if (daysBetween(today, date) > (b.maxDaysAhead || 60)) return { status: 'out' };
      if (this.cfg.bookingType === 'range') {
        if (!this.rangesFor(date).length) return { status: 'closed' };
        const rem = this.nightRemaining(date); const cap = this.capacity();
        return rem >= 1 ? { status: 'open', ratio: rem / cap } : { status: 'full' };
      }
      if (!this.rangesFor(date).length) return { status: 'closed' };
      const slots = this.slotsFor(date);
      if (!slots.length) {
        const off = this.selectedServices().some((x) => Array.isArray(x.days) && !x.days.includes(weekdayOf(date)));
        return { status: off ? 'closed' : 'full' };
      }
      const ok = slots.filter((x) => x.available);
      if (!ok.length) return { status: 'full' };
      const ratio = slots.reduce((a, x) => a + Math.max(0, x.remaining), 0) / (slots.length * Math.max(1, slots[0].capacity));
      return { status: 'open', ratio: Math.max(ratio, ok.length / slots.length * 0.999) };
    }
    mark(info) {
      if (!this.cfg.showMarks) return '';
      if (info.status === 'closed') return this.t.closed;
      if (info.status === 'full') return '×';
      if (info.status !== 'open') return '';
      return info.ratio >= 0.6 ? '◎' : info.ratio > 0.25 ? '○' : '△';
    }

    nights() { const s = this.state; return s.checkIn && s.checkOut ? daysBetween(s.checkIn, s.checkOut) : 0; }
    priceOf(sv) {
      const unit = sv.priceUnit || this.cfg.pricing.unit;
      const p = Number(sv.price) || 0; const q = this.cfg.steps.includes('quantity') ? this.state.qty : 1; const n = Math.max(1, this.nights());
      if (unit === 'perPerson') return p * q;
      if (unit === 'perNight') return p * (this.cfg.bookingType === 'range' ? n : 1);
      if (unit === 'perPersonNight') return p * q * n;
      return p;
    }
    total() { return this.selectedServices().reduce((a, sv) => a + this.priceOf(sv), 0); }
    hasPrice() { return this.cfg.pricing.show !== false && this.selectedServices().some((s) => s.price != null && Number(s.price) > 0); }
    money(n) {
      try { return new Intl.NumberFormat(this.cfg.locale === 'en' ? 'en-US' : 'ja-JP', { style: 'currency', currency: this.cfg.pricing.currency || 'JPY', maximumFractionDigits: 0 }).format(n); }
      catch (e) { return `¥${Number(n).toLocaleString()}`; }
    }
    priceLabel(sv) {
      if (sv.priceLabel) return sv.priceLabel;
      if (sv.price == null || this.cfg.pricing.show === false) return '';
      if (Number(sv.price) === 0) return this.t.free;
      const unit = sv.priceUnit || this.cfg.pricing.unit;
      const suf = { perPerson: this.t.perPerson, perNight: this.t.perNight, perPersonNight: this.t.perPersonNight }[unit] || '';
      return `${this.money(sv.price)}${suf}${this.cfg.pricing.taxLabel ? `<small>（${esc(this.cfg.pricing.taxLabel)}）</small>` : ''}`;
    }
    dateText(date, full) {
      const d = parseYmd(date);
      return fmt(full ? this.t.fullDateFmt : this.t.dateFmt, { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), w: this.t.weekdays[d.getDay()], mn: MONTHS_EN[d.getMonth()] });
    }
    slotObj() {
      const s = this.state;
      if (!s.slot) return null;
      return this.slotsFor(s.slot.slice(0, 10)).find((x) => x.start === s.slot) || null;
    }

    /* ---------- steps ---------- */
    stepDone(step) {
      const s = this.state; const c = this.cfg;
      switch (step) {
        case 'service': return s.services.length > 0;
        case 'staff': return !!s.staffId;
        case 'quantity': return s.qty >= (c.quantity.min || 1);
        case 'datetime': return this.multi() ? s.cands.length >= c.approval.required : !!s.slot;
        case 'dates': return !!(s.checkIn && s.checkOut);
        case 'form': return this.validate(false);
        default: return true;
      }
    }
    get step() { return this.cfg.steps[this.state.stepIndex]; }

    goNext() {
      const step = this.step;
      if (step === 'form' && !this.validate(true)) { this.render(); this.focusError(); return; }
      if (!this.stepDone(step)) return;
      if (this.state.stepIndex < this.cfg.steps.length - 1) { this.state.stepIndex++; this.state.flash = ''; this.render(true); }
    }
    goBack() { if (this.state.stepIndex > 0) { this.state.stepIndex--; this.state.flash = ''; this.render(true); } }
    goto(i) { if (i < this.state.stepIndex || this.cfg.steps.slice(0, i).every((st) => this.stepDone(st))) { this.state.stepIndex = i; this.render(true); } }
    autoNext() { if (this.cfg.autoAdvance && this.cfg.layout === 'wizard') setTimeout(() => this.goNext(), 160); }

    validate(show) {
      const errs = {}; const t = this.t;
      for (const f of this.cfg.fields) {
        if (f.type === 'hidden') continue;
        let v = this.state.form[f.name];
        const empty = v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
        if (f.required && empty) { errs[f.name] = f.errorText || (['select', 'radio', 'checkboxes'].includes(f.type) ? t.errSelect : t.errRequired); continue; }
        if (empty) continue;
        v = String(v).trim();
        if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[f.name] = t.errEmail;
        else if (f.type === 'tel' && !/^[0-9０-９+\-‐－() ]{9,}$/.test(v)) errs[f.name] = t.errTel;
        else if (f.pattern && !new RegExp(f.pattern).test(v)) errs[f.name] = f.errorText || t.errRequired;
      }
      if (show) this.state.errors = errs;
      return !Object.keys(errs).length;
    }
    focusError() {
      setTimeout(() => {
        const el = this.root.querySelector('.rk-field[data-err="1"] input, .rk-field[data-err="1"] select, .rk-field[data-err="1"] textarea');
        if (el) el.focus();
      }, 20);
    }

    /* ---------- events ---------- */
    handleClick(e) {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const act = el.getAttribute('data-act'); const s = this.state; const c = this.cfg;
      const v = el.getAttribute('data-v');
      switch (act) {
        case 'open': this.open(); break;
        case 'close': this.close(); break;
        case 'overlay': if (e.target === el) this.close(); break;
        case 'svc': {
          if (c.serviceSelect === 'multiple') s.services = s.services.includes(v) ? s.services.filter((x) => x !== v) : s.services.concat(v);
          else s.services = [v];
          const sv = c.services.find((x) => x.id === v);
          if (sv && sv.maxQuantity && s.qty > sv.maxQuantity) s.qty = sv.maxQuantity;
          this.invalidate(); this.render();
          if (c.serviceSelect !== 'multiple') this.autoNext();
          break;
        }
        case 'staff': s.staffId = v; this.invalidate(); this.render(); this.autoNext(); break;
        case 'qty': s.qty = this.clampQty(s.qty + Number(v)); this.invalidate(); this.render(); break;
        case 'qtyset': s.qty = this.clampQty(Number(v)); this.invalidate(); this.render(); break;
        case 'month': {
          const d = parseYmd(s.calMonth); d.setMonth(d.getMonth() + Number(v)); s.calMonth = ymd(d); this.render(); break;
        }
        case 'week': {
          const today = nowIn(c.business.timezone).slice(0, 10);
          const next = addDays(s.weekFrom, Number(v) * 7);
          s.weekFrom = next < today ? today : next; this.render(); break;
        }
        case 'day':
          if (c.bookingType === 'range') this.pickRange(v);
          else { s.date = v; if (s.slot && s.slot.slice(0, 10) !== v) s.slot = null; }
          this.render();
          if (c.bookingType === 'range' && s.checkIn && s.checkOut) this.autoNext();
          break;
        case 'slot':
          if (this.multi()) {
            if (s.cands.includes(v)) s.cands = s.cands.filter((x) => x !== v);
            else if (s.cands.length < c.approval.candidates) s.cands = s.cands.concat(v);
            else { s.flash = fmt(c.t.candidateFull, { n: c.approval.candidates }); this.render(); break; }
            s.flash = '';
            this.render(); this.emitChange();
            if (s.cands.length === c.approval.candidates) this.autoNext();
          } else { s.slot = v; this.render(); this.autoNext(); this.emitChange(); }
          break;
        case 'cand-rm': s.cands = s.cands.filter((x) => x !== v); s.flash = ''; this.render(); this.emitChange(); break;
        case 'next': this.goNext(); break;
        case 'back': this.goBack(); break;
        case 'goto': this.goto(Number(v)); break;
        case 'submit': this.submit(); break;
        case 'again': this.reset(); break;
        case 'ics': this.downloadIcs(); break;
        default: break;
      }
    }

    handleInput(e) {
      const el = e.target;
      if (el.matches('[data-agree]')) { this.state.agree = el.checked; this.refreshFoot(); return; }
      if (el.matches('[data-privacy]')) { this.state.privacyAgree = el.checked; this.refreshFoot(); return; }
      if (el.matches('[data-hp]')) { this.state.hp = el.value; return; }
      const name = el.getAttribute('data-field');
      if (!name) return;
      const f = this.cfg.fields.find((x) => x.name === name);
      let val;
      if (f.type === 'checkboxes') val = Array.from(this.root.querySelectorAll(`[data-field="${name}"]:checked`)).map((x) => x.value);
      else if (f.type === 'checkbox') val = el.checked;
      else val = el.value;
      this.state.form[name] = val;
      if (this.state.errors[name]) {
        delete this.state.errors[name];
        const box = el.closest('.rk-field'); if (box) box.removeAttribute('data-err');
      }
      this.refreshFoot();
    }

    refreshFoot() {
      // 入力中は全体を再描画せず、ボタンの状態だけ更新する
      const btn = this.root.querySelector('[data-act="next"],[data-act="submit"]');
      if (!btn) return;
      if (btn.getAttribute('data-act') === 'submit' && this.cfg.layout === 'wizard') btn.disabled = !this.canSubmit();
    }

    clampQty(n) {
      const q = this.cfg.quantity; const sv = this.primaryService();
      const max = Math.min(q.max || 99, sv && sv.maxQuantity ? sv.maxQuantity : Infinity);
      return Math.max(q.min || 1, Math.min(max, n));
    }
    invalidate() {
      const s = this.state;
      if (s.slot) { const o = this.slotObj(); if (!o || !o.available) s.slot = null; }
      if (s.cands.length) s.cands = s.cands.filter((x) => { const o = this.candObj(x); return o && o.available; });
      if (this.cfg.bookingType === 'range' && s.checkIn && s.checkOut) {
        for (let d = s.checkIn; d < s.checkOut; d = addDays(d, 1)) if (!this.nightOpen(d)) { s.checkIn = null; s.checkOut = null; break; }
      }
      this.emitChange();
    }
    emitChange() { if (typeof this.cfg.onChange === 'function') this.cfg.onChange(this.publicState(), this); this.emit('change', this.publicState()); }

    pickRange(date) {
      const s = this.state; const st = this.cfg.stay;
      if (!s.checkIn || s.checkOut || date <= s.checkIn) { s.checkIn = date; s.checkOut = null; return; }
      const n = daysBetween(s.checkIn, date);
      if (n < (st.minNights || 1) || n > (st.maxNights || 30)) { s.checkIn = date; s.checkOut = null; return; }
      for (let d = s.checkIn; d < date; d = addDays(d, 1)) if (!this.nightOpen(d)) { s.checkIn = date; s.checkOut = null; return; }
      s.checkOut = date;
    }
    canCheckout(date) {
      const s = this.state; const st = this.cfg.stay;
      if (!s.checkIn || s.checkOut || date <= s.checkIn) return false;
      const n = daysBetween(s.checkIn, date);
      if (n < (st.minNights || 1) || n > (st.maxNights || 30)) return false;
      for (let d = s.checkIn; d < date; d = addDays(d, 1)) if (!this.nightOpen(d)) return false;
      return true;
    }

    canSubmit() {
      const c = this.cfg; const s = this.state;
      if (s.submitting) return false;
      if (c.policy && c.policy.requireAgree && c.policy.text && !s.agree) return false;
      if (this.needsPrivacy() && !s.privacyAgree) return false;
      return c.steps.filter((x) => x !== 'confirm').every((x) => this.stepDone(x));
    }

    needsPrivacy() { const p = this.cfg.policy || {}; return !!p.privacyUrl && p.requirePrivacy !== false; }

    /** 本番のサイトでデモ保存を使っているか（localhost・file:・*.test などの開発環境は除く） */
    isDemoInProduction() {
      const c = this.cfg;
      if (c.backend.type !== 'local' || c.demoNotice === false || typeof location === 'undefined') return false;
      const h = String(location.hostname || '').toLowerCase();
      if (location.protocol === 'file:' || !h || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return false;
      return !/\.(localhost|test|local|example)$/.test(h);
    }

    publicState() {
      const s = this.state;
      return { services: this.selectedServices(), staffId: s.staffId, quantity: s.qty, slot: s.slot, candidates: s.cands.slice(), checkIn: s.checkIn, checkOut: s.checkOut, form: Object.assign({}, s.form), total: this.total() };
    }

    /* ---------- submit ---------- */
    buildPayload() {
      const c = this.cfg; const s = this.state; const ss = this.selectedServices();
      const multi = this.multi();
      const slot = multi ? this.candObj(s.cands[0]) : this.slotObj();
      const firstStart = multi ? s.cands[0] : s.slot;
      let staffId = c.steps.includes('staff') ? s.staffId : null;
      if (staffId === 'any') staffId = slot && slot.staffId ? slot.staffId : null;
      const staff = staffId ? this.staffById(staffId) : null;
      const isRange = c.bookingType === 'range';
      const start = isRange ? `${s.checkIn}T${c.stay.checkInTime || '15:00'}` : firstStart;
      const end = isRange ? `${s.checkOut}T${c.stay.checkOutTime || '10:00'}` : (slot ? slot.end : fromStamp(stamp(firstStart) + this.duration()));
      const cands = multi ? s.cands.map((x) => { const o = this.candObj(x); const sid = c.steps.includes('staff') ? (s.staffId === 'any' ? (o && o.staffId) || null : s.staffId) : null; return { start: x, end: o ? o.end : fromStamp(stamp(x) + this.duration()), staffId: sid, staffName: sid ? (this.staffById(sid) || {}).name || '' : '' }; }) : [{ start, end, staffId, staffName: staff ? staff.name : '' }];
      const meeting = this.meetingProvider();
      return {
        formId: c.backend.formId || 'default',
        template: c.template || null,
        bookingType: c.bookingType,
        bookingNumber: null,
        business: c.business.name || '',
        location: c.business.location || '',
        timezone: c.business.timezone,
        locale: c.locale,
        services: ss.map((x) => ({ id: x.id, name: x.name, duration: x.duration || null, price: x.price == null ? null : Number(x.price) })),
        serviceIds: ss.map((x) => x.id),
        serviceName: ss.map((x) => x.name).join('、'),
        staffId: staffId,
        staffName: staff ? staff.name : (c.steps.includes('staff') ? c.t.anyStaff : ''),
        staffRequested: s.staffId && s.staffId !== 'any',
        start, end,
        approval: c.approval.enabled,
        candidates: cands,
        meeting: meeting,
        duration: this.duration(),
        // 空き計算用の占有範囲（宿泊は日単位）
        occupyStart: isRange ? `${s.checkIn}T00:00` : start,
        occupyEnd: isRange ? `${s.checkOut}T00:00` : end,
        checkIn: isRange ? s.checkIn : null,
        checkOut: isRange ? s.checkOut : null,
        nights: isRange ? this.nights() : null,
        quantity: c.steps.includes('quantity') ? s.qty : 1,
        quantityLabel: c.quantity.label,
        quantityUnit: c.quantity.unit,
        count: this.consumed(),
        capacity: this.capacity(),
        capacityScope: c.business.capacityScope,
        bufferMinutes: Number(c.business.bufferMinutes) || 0,
        total: this.hasPrice() ? this.total() : null,
        currency: c.pricing.currency,
        customer: { name: s.form.name || '', email: s.form.email || '', tel: s.form.tel || '' },
        fields: c.fields.filter((f) => f.type !== 'hidden' || s.form[f.name] != null).map((f) => Object.assign({ name: f.name, label: f.label, value: Array.isArray(s.form[f.name]) ? s.form[f.name].join('、') : (f.type === 'checkbox' ? (s.form[f.name] ? 'はい' : '') : (s.form[f.name] == null ? '' : String(s.form[f.name]))) }, f.sensitive ? { sensitive: true } : {})),
        // 同意の記録（日時はサーバー側でも記録します）
        consent: {
          privacy: this.needsPrivacy() ? !!s.privacyAgree : null,
          privacyUrl: (c.policy && c.policy.privacyUrl) || '',
          terms: c.policy && c.policy.requireAgree && c.policy.text ? !!s.agree : null,
          agreedAt: new Date().toISOString()
        },
        page: typeof location !== 'undefined' ? location.href : '',
        hp: s.hp
      };
    }

    async submit() {
      const c = this.cfg; const s = this.state;
      if (c.layout === 'onepage' && !this.validate(true)) { s.flash = ''; this.render(); this.focusError(); return; }
      if (!this.canSubmit()) {
        if (c.layout === 'onepage' && !s.submitting) {
          const miss = c.steps.filter((x) => x !== 'confirm' && !this.stepDone(x)).map((x) => this.stepLabel(x));
          s.flash = miss.length ? fmt(c.t.incomplete, { items: miss.join('、') }) : (this.needsPrivacy() && !s.privacyAgree ? c.t.errPrivacy : c.t.errAgree);
          this.render(true);
        }
        return;
      }
      let payload = this.buildPayload();
      if (typeof c.onSubmit === 'function') {
        const r = await c.onSubmit(payload, this);
        if (r === false) return;
        if (isObj(r)) payload = r;
      }
      const backend = c.backend.type === 'custom' ? c.backend : Backends[c.backend.type] || Backends.local;
      s.submitting = true; s.flash = ''; this.render();
      try {
        const res = await backend.submit.call(backend, c, payload);
        if (!res || res.ok === false) throw Object.assign(new Error((res && res.message) || 'error'), res || {});
        payload.bookingNumber = res.bookingNumber || res.id || bookingNumber();
        s.result = Object.assign({}, res, { payload });
        s.view = 'done';
        this.emit('complete', s.result);
        if (typeof c.onComplete === 'function') c.onComplete(s.result, this);
        this.loadAvailability();
      } catch (e) {
        if (e && e.code === 'slot_taken') {
          s.flash = c.t.slotTaken;
          s.slot = null; s.cands = []; s.checkIn = null; s.checkOut = null;
          const i = c.steps.findIndex((x) => x === 'datetime' || x === 'dates');
          if (i >= 0 && c.layout === 'wizard') s.stepIndex = i;
          this.loadAvailability();
        } else {
          s.flash = (e && e.code && e.message) ? e.message : c.t.errorSubmit;
        }
        this.emit('error', e);
        if (typeof c.onError === 'function') c.onError(e, this);
      }
      s.submitting = false;
      this.render(true);
    }

    /* ---------- calendar export ---------- */
    calTimes(p) {
      const z = (x) => x.replace(/[-:]/g, '');
      if (p.bookingType === 'range') return { allDay: true, s: z(p.checkIn), e: z(p.checkOut) };
      return { allDay: false, s: `${z(p.start)}00`, e: `${z(p.end)}00` };
    }
    calText(p) {
      const lines = [`${this.t.bookingNumber}: ${p.bookingNumber}`, p.serviceName];
      if (p.staffName) lines.push(`${this.t.staffLabel}: ${p.staffName}`);
      if (p.quantity && this.cfg.steps.includes('quantity')) lines.push(`${p.quantityLabel}: ${p.quantity}${p.quantityUnit || ''}`);
      return lines.filter(Boolean).join('\n');
    }
    googleUrl(p) {
      const tm = this.calTimes(p);
      const q = { action: 'TEMPLATE', text: `${p.business ? p.business + '：' : ''}${p.serviceName || this.cfg.title}`, dates: `${tm.s}/${tm.e}`, details: this.calText(p), location: p.location || '' };
      if (!tm.allDay) q.ctz = p.timezone;
      return `https://calendar.google.com/calendar/render?${qs(q)}`;
    }
    downloadIcs() {
      const p = this.state.result && this.state.result.payload; if (!p) return;
      const tm = this.calTimes(p);
      const e = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
      const dt = (k, v) => (tm.allDay ? `${k};VALUE=DATE:${v}` : `${k};TZID=${p.timezone}:${v}`);
      const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ReserveKit//JA', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        `UID:${p.bookingNumber}@reservekit`, `DTSTAMP:${now}`, dt('DTSTART', tm.s), dt('DTEND', tm.e),
        `SUMMARY:${e((p.business ? p.business + '：' : '') + p.serviceName)}`, `DESCRIPTION:${e(this.calText(p))}`,
        p.location ? `LOCATION:${e(p.location)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = `reservation-${p.bookingNumber}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /* =======================================================
     * render
     * ===================================================== */
    render(scroll) {
      if (!this.app) return;
      const c = this.cfg; const s = this.state;
      const th = c.theme;
      let html = `<div class="rk rk-${esc(c.layout)}" part="root" data-card="${esc(c.cardStyle)}" data-transparent="${th.transparent ? 1 : 0}" data-template="${esc(c.template || 'custom')}">`;
      html += this.rHead();
      if (s.view === 'done') html += this.rDone();
      else if (c.layout === 'onepage') html += this.rOnepage();
      else html += this.rWizard();
      html += '</div>';
      this.app.innerHTML = html;
      if (scroll) {
        const box = this.overlay ? this.root.querySelector('.rk-dialog') : null;
        if (box) box.scrollTop = 0;
        else { const r = this.host.getBoundingClientRect(); if (r.top < 0) this.host.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    }

    rHead() {
      const c = this.cfg;
      if (!c.title && !c.subtitle && !c.logo) return '';
      return `<header class="rk-head" part="header">${c.logo ? `<img class="rk-logo" src="${esc(c.logo)}" alt="">` : ''}<div>${c.title ? `<h2 class="rk-title" part="title">${esc(c.title)}</h2>` : ''}${c.subtitle ? `<p class="rk-sub" part="subtitle">${esc(c.subtitle)}</p>` : ''}</div></header>`;
    }

    stepLabel(st) { return (this.cfg.stepLabels && this.cfg.stepLabels[st]) || (st === 'quantity' ? this.cfg.quantity.label : this.t.steps[st]) || st; }

    rWizard() {
      const c = this.cfg; const s = this.state; const st = this.step;
      let h = '';
      if (c.showProgress) {
        h += `<ol class="rk-progress" part="progress">${c.steps.map((x, i) => `<li data-st="${i < s.stepIndex ? 'done' : i === s.stepIndex ? 'current' : 'todo'}"><button type="button" data-act="goto" data-v="${i}" ${i === s.stepIndex ? 'aria-current="step"' : ''}><span>${esc(this.stepLabel(x))}</span></button></li>`).join('')}</ol>`;
      }
      if (s.flash) h += `<div class="rk-flash" role="alert">${esc(s.flash)}</div>`;
      h += `<section class="rk-section" part="step step-${st}" data-step="${st}"><h3 class="rk-h">${esc(this.stepLabel(st))}</h3>${this.rStep(st)}</section>`;
      const last = s.stepIndex === c.steps.length - 1;
      h += `<footer class="rk-foot" part="footer">
        ${s.stepIndex > 0 ? `<button type="button" class="rk-btn rk-btn-ghost" part="button-back" data-act="back">${ICON.left.replace('<svg', '<svg width="16" height="16" stroke="currentColor"')}${esc(c.t.back)}</button>` : ''}
        <div class="rk-mini" aria-live="polite">${c.showSummary ? this.rMini() : ''}</div>
        ${last
          ? `<button type="button" class="rk-btn rk-btn-primary" part="button button-submit" data-act="submit" ${this.canSubmit() ? '' : 'disabled'}>${esc(s.submitting ? c.t.submitting : this.submitLabel())}</button>`
          : `<button type="button" class="rk-btn rk-btn-primary" part="button button-next" data-act="next" ${st === 'form' || this.stepDone(st) ? '' : 'disabled'}>${esc(c.t.next)}</button>`}
      </footer>`;
      return h;
    }

    rOnepage() {
      const c = this.cfg; const s = this.state;
      let h = s.flash ? `<div class="rk-flash" role="alert">${esc(s.flash)}</div>` : '';
      c.steps.filter((x) => x !== 'confirm').forEach((st, i) => {
        h += `<section class="rk-section" part="step step-${st}" data-step="${st}"><h3 class="rk-h"><span class="rk-n">${i + 1}</span>${esc(this.stepLabel(st))}</h3>${this.rStep(st)}</section>`;
      });
      h += `<section class="rk-section" part="step step-confirm" data-step="confirm"><h3 class="rk-h"><span class="rk-n">${c.steps.length}</span>${esc(this.stepLabel('confirm'))}</h3>${this.rConfirm(true)}</section>`;
      h += `<footer class="rk-foot" part="footer"><button type="button" class="rk-btn rk-btn-primary rk-btn-block" part="button button-submit" data-act="submit" ${s.submitting ? 'disabled' : ''}>${esc(s.submitting ? c.t.submitting : this.submitLabel())}</button></footer>`;
      return h;
    }

    rStep(st) {
      switch (st) {
        case 'service': return this.rServices();
        case 'staff': return this.rStaff();
        case 'quantity': return this.rQuantity();
        case 'datetime': return this.rDatetime();
        case 'dates': return this.rDates();
        case 'form': return this.rForm();
        case 'confirm': return this.rConfirm(false);
        default: return '';
      }
    }

    submitLabel() { const c = this.cfg; return c.approval.enabled && !(c.texts && c.texts.submit) ? c.t.submitRequest : c.t.submit; }

    rMini() {
      const c = this.cfg; const s = this.state; const parts = [];
      const ss = this.selectedServices();
      if (ss.length) parts.push(`<b>${esc(ss.map((x) => x.name).join('、'))}</b>`);
      if (this.multi()) { if (s.cands.length) parts.push(esc(`${fmt(c.t.candidate, { n: 1 })} ${this.dateText(s.cands[0].slice(0, 10))} ${s.cands[0].slice(11)}${s.cands.length > 1 ? ` ほか${s.cands.length - 1}件` : ''}`)); }
      else if (s.slot) parts.push(esc(`${this.dateText(s.slot.slice(0, 10))} ${s.slot.slice(11)}`));
      if (s.checkIn && s.checkOut) parts.push(esc(`${this.dateText(s.checkIn)} → ${this.dateText(s.checkOut)}（${fmt(c.t.nights, { n: this.nights() })}）`));
      const top = parts.length ? `<div>${parts.join('　')}</div>` : '';
      const price = this.hasPrice() ? `<div>${esc(c.t.total)} <b>${this.money(this.total())}</b></div>` : '';
      return top + price;
    }

    rCheck(multi) { return `<span class="rk-check" data-multi="${multi ? 1 : 0}" aria-hidden="true">${ICON.check}</span>`; }

    rServices() {
      const c = this.cfg; const s = this.state; const style = c.serviceStyle;
      if (!c.services.length) return `<p class="rk-hint" part="empty">${esc(c.t.emptyServices)}</p>`;
      const multi = c.serviceSelect === 'multiple';
      const cats = [];
      c.services.forEach((sv) => { const k = sv.category || ''; let g = cats.find((x) => x.k === k); if (!g) cats.push(g = { k, items: [] }); g.items.push(sv); });
      const showCats = cats.length > 1 && cats.some((g) => g.k);
      return cats.map((g) => `${showCats && g.k ? `<p class="rk-cat">${esc(g.k)}</p>` : ''}<div class="rk-cards" data-style="${esc(style)}">${g.items.map((sv) => {
        const on = s.services.includes(sv.id);
        const meta = [];
        if (sv.duration && c.bookingType !== 'range') meta.push(`<span>${esc(fmt(c.t.minutes, { n: sv.duration }))}</span>`);
        if (sv.maxQuantity) meta.push(`<span>〜${esc(sv.maxQuantity)}${esc(c.quantity.unit)}</span>`);
        if (sv.meeting && !sv.tag) meta.push(`<span>${esc(c.t.online)}（${esc(this.providerName(sv.meeting === true ? c.meeting.provider : sv.meeting))}）</span>`);
        const pl = this.priceLabel(sv);
        if (pl) meta.push(`<span class="rk-price">${pl}</span>`);
        return `<button type="button" class="rk-card" part="card service-card" data-style="${esc(style)}" data-act="svc" data-v="${esc(sv.id)}" aria-pressed="${on}">
          ${sv.image ? `<img class="rk-card-img" src="${esc(sv.image)}" alt="" loading="lazy">` : ''}
          <span class="rk-card-body"><span class="rk-card-name">${esc(sv.name)}${sv.tag ? `<span class="rk-tag" part="tag">${esc(sv.tag)}</span>` : ''}</span>
          ${sv.description ? `<span class="rk-card-desc" style="display:block">${esc(sv.description)}</span>` : ''}
          ${meta.length ? `<span class="rk-card-meta">${meta.join('')}</span>` : ''}</span>
          ${this.rCheck(multi)}
        </button>`;
      }).join('')}</div>`).join('');
    }

    rStaff() {
      const c = this.cfg; const s = this.state;
      if (!c.staff.length && c.allowAnyStaff === false) return `<p class="rk-hint" part="empty">${esc(c.t.emptyStaff)}</p>`;
      const wdOk = (p) => !Array.isArray(p.services) || this.selectedServices().every((x) => p.services.includes(x.id));
      const items = [];
      if (c.allowAnyStaff !== false) items.push({ id: 'any', name: c.t.anyStaff, role: c.t.anyStaffDesc, any: true });
      c.staff.forEach((p) => items.push(p));
      return `<div class="rk-cards" data-style="grid">${items.map((p) => {
        const dis = !p.any && !wdOk(p);
        const initial = p.any ? '✓' : esc(String(p.name).trim().charAt(0));
        return `<button type="button" class="rk-card" part="card staff-card" data-act="staff" data-v="${esc(p.id)}" aria-pressed="${s.staffId === p.id}" ${dis ? 'disabled' : ''}>
          <span class="rk-avatar">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : initial}</span>
          <span class="rk-card-body"><span class="rk-card-name">${esc(p.name)}</span>${p.role ? `<span class="rk-card-desc" style="display:block">${esc(p.role)}</span>` : ''}${p.description ? `<span class="rk-card-desc" style="display:block">${esc(p.description)}</span>` : ''}</span>
          ${this.rCheck(false)}
        </button>`;
      }).join('')}</div>`;
    }

    rQuantity() {
      const c = this.cfg; const q = c.quantity; const s = this.state;
      const sv = this.primaryService();
      const max = Math.min(q.max || 99, sv && sv.maxQuantity ? sv.maxQuantity : Infinity);
      const quick = [];
      for (let i = q.min || 1; i <= Math.min(max, (q.min || 1) + 7); i++) quick.push(i);
      return `<div class="rk-qty" part="quantity">
        <span class="rk-qty-label">${esc(q.label)}</span>
        <div class="rk-stepper">
          <button type="button" data-act="qty" data-v="-1" aria-label="-" ${s.qty <= (q.min || 1) ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${s.qty}<small>${esc(q.unit || '')}</small></output>
          <button type="button" data-act="qty" data-v="1" aria-label="+" ${s.qty >= max ? 'disabled' : ''}>+</button>
        </div>
        ${quick.length > 2 ? `<div class="rk-qty-quick">${quick.map((n) => `<button type="button" data-act="qtyset" data-v="${n}" aria-pressed="${s.qty === n}">${n}${esc(q.unit || '')}</button>`).join('')}</div>` : ''}
      </div>${q.help ? `<p class="rk-help">${esc(q.help)}</p>` : ''}`;
    }

    rDatetime() {
      const c = this.cfg; const s = this.state;
      if (c.steps.includes('service') && !s.services.length) return `<p class="rk-hint">${esc(c.t.selectFirst)}</p>`;
      if (!s.loaded) return `<div class="rk-loading"><span class="rk-spin"></span>${esc(c.t.loading)}</div>`;
      if (!this.hasOpenDays()) return `<p class="rk-hint" part="empty">${esc(c.t.noHours)}</p>`;
      const cal = c.calendarStyle === 'week' ? this.rWeek() : this.rMonth(false);
      return `${this.multi() ? this.rCands() : ''}<div class="rk-dt" data-cal="${esc(c.calendarStyle)}">${cal}<div class="rk-slotbox" part="slots">${this.rSlots()}</div></div>`;
    }

    rCands() {
      const c = this.cfg; const s = this.state; const n = c.approval.candidates;
      let h = `<p class="rk-note">${esc(fmt(c.t.candidatesHint, { n }))}${c.approval.required > 1 ? esc(fmt(c.t.candidatesRequired, { r: c.approval.required })) : ''}</p><div class="rk-cands" part="candidates" style="--rk-cn:${n}">`;
      for (let i = 0; i < n; i++) {
        const v = s.cands[i];
        h += `<div class="rk-cand" data-filled="${v ? 1 : 0}"><b>${esc(fmt(c.t.candidate, { n: i + 1 }))}${i < c.approval.required ? ' *' : ''}</b><span>${v ? esc(`${this.dateText(v.slice(0, 10))} ${v.slice(11)}`) : esc(c.t.notSelected)}</span>${v ? `<button type="button" data-act="cand-rm" data-v="${v}" aria-label="${esc(c.t.remove)}">${ICON.close}</button>` : ''}</div>`;
      }
      return h + '</div>';
    }

    rDates() {
      const c = this.cfg; const s = this.state;
      if (c.steps.includes('service') && !s.services.length) return `<p class="rk-hint">${esc(c.t.selectFirst)}</p>`;
      if (!s.loaded) return `<div class="rk-loading"><span class="rk-spin"></span>${esc(c.t.loading)}</div>`;
      if (!this.hasOpenDays()) return `<p class="rk-hint" part="empty">${esc(c.t.noHours)}</p>`;
      const n = this.nights();
      return `<div class="rk-stay">
        <div data-active="${!s.checkIn || s.checkOut ? 1 : 0}"><small>${esc(c.t.checkIn)}${c.stay.checkInTime ? ` ${esc(c.stay.checkInTime)}〜` : ''}</small><b>${s.checkIn ? esc(this.dateText(s.checkIn)) : '—'}</b></div>
        <div data-active="${s.checkIn && !s.checkOut ? 1 : 0}"><small>${esc(c.t.checkOut)}${c.stay.checkOutTime ? ` 〜${esc(c.stay.checkOutTime)}` : ''}</small><b>${s.checkOut ? esc(this.dateText(s.checkOut)) + `（${esc(fmt(c.t.nights, { n }))}）` : '—'}</b></div>
      </div>
      <p class="rk-hint" style="margin-bottom:.6em">${esc(!s.checkIn || s.checkOut ? c.t.selectCheckIn : c.t.selectCheckOut)}</p>
      ${this.rMonth(true)}`;
    }

    rMonth(range) {
      const c = this.cfg; const s = this.state; const t = this.t;
      const first = parseYmd(s.calMonth);
      const y = first.getFullYear(); const m = first.getMonth();
      const today = nowIn(c.business.timezone).slice(0, 10);
      const maxDate = addDays(today, c.business.maxDaysAhead || 60);
      const canPrev = s.calMonth > today.slice(0, 7) + '-01';
      const canNext = ymd(new Date(y, m + 1, 1)) <= maxDate;
      const offset = (first.getDay() - c.weekStart + 7) % 7;
      const dim = new Date(y, m + 1, 0).getDate();
      const wds = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + c.weekStart) % 7);
      let cells = wds.map((w) => `<div class="rk-wd" data-w="${w}">${esc(t.weekdays[w])}</div>`).join('');
      for (let i = 0; i < offset; i++) cells += '<span></span>';
      for (let d = 1; d <= dim; d++) {
        const date = `${y}-${pad(m + 1)}-${pad(d)}`;
        const info = this.dayInfo(date);
        let enabled = info.status === 'open';
        let attrs = '';
        if (range) {
          const isEdge = date === s.checkIn || date === s.checkOut;
          const inR = s.checkIn && s.checkOut && date > s.checkIn && date < s.checkOut;
          if (this.canCheckout(date)) enabled = true;
          if (isEdge) { attrs = ' data-range="edge"'; enabled = true; } else if (inR) attrs = ' data-range="in"';
        } else attrs = ` aria-pressed="${s.date === date}"`;
        const mk = (range && s.checkIn && !s.checkOut && this.canCheckout(date)) ? '' : this.mark(info);
        cells += `<button type="button" class="rk-day" part="day" data-act="day" data-v="${date}"${attrs} data-today="${date === today ? 1 : 0}" ${enabled ? '' : 'disabled'} aria-label="${esc(this.dateText(date, true))}"><span class="rk-dn">${d}</span>${mk ? `<span class="rk-mark">${esc(mk)}</span>` : ''}</button>`;
      }
      return `<div class="rk-cal" part="calendar">
        <div class="rk-cal-head">
          <button type="button" class="rk-nav-btn" data-act="month" data-v="-1" ${canPrev ? '' : 'disabled'} aria-label="${esc(t.prev)}">${ICON.left}</button>
          <span class="rk-cal-title">${esc(fmt(t.monthFmt, { y, m: m + 1, mn: MONTHS_EN[m] }))}</span>
          <button type="button" class="rk-nav-btn" data-act="month" data-v="1" ${canNext ? '' : 'disabled'} aria-label="${esc(t.next7)}">${ICON.right}</button>
        </div>
        <div class="rk-grid">${cells}</div>
        ${c.showMarks ? `<p class="rk-legend">${esc(t.legend)}</p>` : ''}
      </div>`;
    }

    rWeek() {
      const c = this.cfg; const s = this.state; const t = this.t;
      const today = nowIn(c.business.timezone).slice(0, 10);
      const maxDate = addDays(today, c.business.maxDaysAhead || 60);
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s.weekFrom, i));
      if (!s.date) { const f = days.find((d) => this.dayInfo(d).status === 'open'); if (f) s.date = f; }
      const d0 = parseYmd(days[0]); const d6 = parseYmd(days[6]);
      const label = this.cfg.locale === 'en' ? `${MONTHS_EN[d0.getMonth()]} ${d0.getDate()} – ${MONTHS_EN[d6.getMonth()]} ${d6.getDate()}` : `${d0.getMonth() + 1}月${d0.getDate()}日 〜 ${d6.getMonth() + 1}月${d6.getDate()}日`;
      return `<div class="rk-week" part="calendar">
        <span class="rk-week-label">${esc(label)}</span>
        <button type="button" class="rk-nav-btn" data-act="week" data-v="-1" ${s.weekFrom <= today ? 'disabled' : ''} aria-label="${esc(t.prev)}">${ICON.left}</button>
        <div class="rk-week-days">${days.map((d) => {
          const info = this.dayInfo(d); const dt = parseYmd(d); const mk = this.mark(info);
          return `<button type="button" class="rk-wday" part="day" data-act="day" data-v="${d}" aria-pressed="${s.date === d}" ${info.status === 'open' ? '' : 'disabled'} aria-label="${esc(this.dateText(d, true))}"><small>${esc(t.weekdays[dt.getDay()])}</small><b>${dt.getDate()}</b>${mk ? `<span class="rk-mark">${esc(mk)}</span>` : ''}</button>`;
        }).join('')}</div>
        <button type="button" class="rk-nav-btn" data-act="week" data-v="1" ${addDays(s.weekFrom, 7) > maxDate ? 'disabled' : ''} aria-label="${esc(t.next7)}">${ICON.right}</button>
      </div>`;
    }

    rSlots() {
      const c = this.cfg; const s = this.state; const t = this.t;
      if (!s.date) return `<p class="rk-hint">${esc(t.selectDate)}</p>`;
      let slots = this.slotsFor(s.date);
      if (c.hideFullSlots) slots = slots.filter((x) => x.available);
      const head = `<p class="rk-slots-head">${esc(this.dateText(s.date))}</p>`;
      if (!slots.some((x) => x.available)) return `${head}<p class="rk-hint">${esc(t.noSlots)}</p>`;
      const ranges = this.rangesFor(s.date);
      const groupBy = ranges.length > 1 && !this.selectedServices().some((x) => x.times);
      let html = ''; let gi = -1;
      slots.forEach((sl) => {
        if (groupBy) {
          const m = toMin(sl.time); const idx = ranges.findIndex(([o, z]) => m >= o && m < z);
          if (idx !== gi) { gi = idx; html += `<p class="rk-slot-group">${esc(fromMin(ranges[idx][0]))} – ${esc(fromMin(ranges[idx][1]))}</p>`; }
        }
        const rem = Math.max(0, sl.remaining);
        let sub = '';
        if (!sl.available) sub = t.full;
        else if (c.showRemaining || c.slotStyle === 'list') sub = fmt(t.remaining, { n: c.quantity.consumesCapacity ? `${rem}${c.quantity.unit || ''}` : rem });
        const endTxt = c.slotStyle === 'list' ? `<span>${esc(sl.time)} – ${esc(sl.end.slice(11))}</span>` : esc(sl.time);
        html += `<button type="button" class="rk-slot" part="slot" data-act="slot" data-v="${sl.start}" aria-pressed="${this.multi() ? s.cands.includes(sl.start) : s.slot === sl.start}" ${sl.available ? '' : 'disabled'}>${endTxt}${this.multi() && s.cands.includes(sl.start) ? `<small class="rk-rank">${esc(fmt(c.t.candidate, { n: s.cands.indexOf(sl.start) + 1 }))}</small>` : (sub ? `<small>${esc(sub)}</small>` : '')}</button>`;
      });
      return `${head}<div class="rk-slots" data-style="${esc(c.slotStyle)}">${html}</div>`;
    }

    rForm() {
      const c = this.cfg;
      if (!c.fields.filter((f) => f.type !== 'hidden').length) return `<p class="rk-hint" part="empty">${esc(c.t.emptyFields)}</p>`;
      return `<div class="rk-form" part="form">${c.fields.map((f) => this.rField(f)).join('')}
        <div class="rk-hp" aria-hidden="true"><label>URL<input type="text" tabindex="-1" autocomplete="off" data-hp value="${esc(this.state.hp)}"></label></div></div>`;
    }

    rField(f) {
      const s = this.state; const t = this.t;
      const id = `rk-${f.name}`;
      const v = s.form[f.name] == null ? '' : s.form[f.name];
      const err = s.errors[f.name];
      const opts = (f.options || []).map((o) => (isObj(o) ? o : { value: o, label: o }));
      if (f.type === 'hidden') return `<input type="hidden" data-field="${esc(f.name)}" value="${esc(v)}">`;
      const badge = f.required ? `<span class="rk-badge">${esc(t.required)}</span>` : (this.cfg.showOptionalBadge ? `<span class="rk-badge" data-opt="1">${esc(t.optional)}</span>` : '');
      const common = `id="${id}" data-field="${esc(f.name)}" class="rk-input" part="input" ${f.required ? 'required aria-required="true"' : ''} ${f.autocomplete ? `autocomplete="${esc(f.autocomplete)}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} aria-invalid="${err ? 'true' : 'false'}" aria-describedby="${id}-err"`;
      let input = '';
      let labelFor = `for="${id}"`;
      switch (f.type) {
        case 'textarea': input = `<textarea ${common} rows="${f.rows || 4}">${esc(v)}</textarea>`; break;
        case 'select': input = `<select ${common}><option value="">${esc(f.placeholder || '選択してください')}</option>${opts.map((o) => `<option value="${esc(o.value)}" ${String(v) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
        case 'radio':
        case 'checkboxes': {
          labelFor = '';
          const type = f.type === 'radio' ? 'radio' : 'checkbox';
          const arr = Array.isArray(v) ? v : [v];
          input = `<div class="rk-choices" role="${type === 'radio' ? 'radiogroup' : 'group'}" aria-labelledby="${id}-l">${opts.map((o) => `<label class="rk-choice"><input type="${type}" name="${id}" value="${esc(o.value)}" data-field="${esc(f.name)}" ${arr.includes(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`;
          break;
        }
        case 'checkbox':
          labelFor = '';
          input = `<label class="rk-agree"><input type="checkbox" data-field="${esc(f.name)}" ${v ? 'checked' : ''}><span>${esc(f.checkboxLabel || f.label)}</span></label>`;
          break;
        default:
          input = `<input type="${esc(['email', 'tel', 'number', 'date', 'url'].includes(f.type) ? f.type : 'text')}" ${common} value="${esc(v)}" ${f.type === 'tel' ? 'inputmode="tel"' : ''} ${f.min != null ? `min="${esc(f.min)}"` : ''} ${f.max != null ? `max="${esc(f.max)}"` : ''}>`;
      }
      return `<div class="rk-field" part="field" data-half="${f.half ? 1 : 0}" data-err="${err ? 1 : 0}">
        <label class="rk-label" id="${id}-l" ${labelFor}>${esc(f.label)}${badge}</label>${input}
        ${f.help ? `<p class="rk-help">${esc(f.help)}</p>` : ''}<p class="rk-err" id="${id}-err">${esc(err || '')}</p></div>`;
    }

    summaryRows(p) {
      const c = this.cfg; const t = this.t; const rows = [];
      const ss = this.selectedServices();
      if (ss.length) rows.push([this.stepLabel('service'), ss.map((x) => esc(x.name)).join('<br>')]);
      if (c.steps.includes('staff')) {
        const sid = this.state.staffId;
        rows.push([t.staffLabel, esc(sid === 'any' ? t.anyStaff : (this.staffById(sid) || {}).name || '')]);
      }
      if (c.bookingType === 'range' && this.state.checkIn) {
        rows.push([t.stayLabel, esc(`${this.dateText(this.state.checkIn, true)} 〜 ${this.dateText(this.state.checkOut || this.state.checkIn, true)}`) + `<br><small>${esc(fmt(t.nights, { n: this.nights() }))}</small>`]);
      } else if (this.multi()) {
        this.state.cands.forEach((x, i) => { const o = this.candObj(x); rows.push([fmt(t.candidate, { n: i + 1 }), esc(`${this.dateText(x.slice(0, 10), true)} ${x.slice(11)}${o ? ' – ' + o.end.slice(11) : ''}`)]); });
      } else if (this.state.slot) {
        const so = this.slotObj();
        rows.push([t.dateLabel, esc(`${this.dateText(this.state.slot.slice(0, 10), true)} ${this.state.slot.slice(11)}${so ? ' – ' + so.end.slice(11) : ''}`)]);
      }
      if (c.steps.includes('quantity')) rows.push([c.quantity.label, esc(`${this.state.qty}${c.quantity.unit || ''}`)]);
      const pv = this.meetingProvider();
      if (pv) rows.push([t.meeting, esc(this.providerName(pv))]);
      if (p !== false) {
        c.fields.forEach((f) => {
          if (f.type === 'hidden') return;
          let v = this.state.form[f.name];
          if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
          if (Array.isArray(v)) v = v.join('、');
          if (f.type === 'checkbox') v = v ? '✓' : '';
          rows.push([f.label, nl2br(v)]);
        });
      }
      return rows;
    }

    rSummary(withFields) {
      const c = this.cfg;
      const rows = this.summaryRows(withFields);
      const total = this.hasPrice() ? `<div class="rk-total"><span>${esc(c.t.total)}</span><span><b>${this.money(this.total())}</b>${c.pricing.taxLabel ? `<small>（${esc(c.pricing.taxLabel)}）</small>` : ''}</span></div>` : '';
      return `<div class="rk-sum" part="summary"><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>${total}</div>`;
    }

    rConfirm(onepage) {
      const c = this.cfg; const s = this.state; const p = c.policy || {};
      let h = this.rSummary(!onepage);
      if (c.approval.enabled) h += `<div class="rk-pending" part="pending-note">${esc(c.t.pendingNote)}</div>`;
      if (p.text || p.privacyUrl) {
        const link = p.privacyUrl ? `<a href="${esc(p.privacyUrl)}" target="_blank" rel="noopener" part="privacy-link">${esc(p.privacyLabel || c.t.privacyLink)}</a>` : '';
        h += `<div class="rk-policy" part="policy"><h4>${esc(p.title || c.t.policyTitle)}</h4>${p.text ? `<p>${nl2br(p.text)}</p>` : ''}`
          + (link ? `<p class="rk-privacy">${esc(c.t.privacyText).replace('{link}', link)}</p>` : '')
          + (p.text && p.requireAgree ? `<label class="rk-agree"><input type="checkbox" data-agree ${s.agree ? 'checked' : ''}><span>${esc(p.label || c.t.agree)}</span></label>` : '')
          + (this.needsPrivacy() ? `<label class="rk-agree"><input type="checkbox" data-privacy ${s.privacyAgree ? 'checked' : ''}><span>${esc(c.t.privacyAgree)}</span></label>` : '')
          + '</div>';
      }
      return h;
    }

    rDone() {
      const c = this.cfg; const r = this.state.result || {}; const p = r.payload || {};
      const d = c.done || {};
      const pending = r.status ? r.status === 'pending' : c.approval.enabled;
      const title = pending ? (d.pendingTitle || c.t.doneTitlePending) : (d.title || c.t.doneTitle);
      const msg = pending ? (d.pendingMessage || c.t.doneTextPending) : (d.message || c.t.doneText);
      let meet = '';
      if (r.meetingUrl) meet = `<div class="rk-meet" part="meeting"><small>${esc(c.t.meeting)}（${esc(this.providerName(p.meeting || 'fixed'))}）</small><a class="rk-btn rk-btn-primary" href="${esc(r.meetingUrl)}" target="_blank" rel="noopener">${esc(c.t.meetingJoin)}</a><a class="rk-meet-url" href="${esc(r.meetingUrl)}" target="_blank" rel="noopener">${esc(r.meetingUrl)}</a>${r.meetingPassword ? `<small>${esc(c.t.passcode)}：${esc(r.meetingPassword)}</small>` : ''}</div>`;
      else if (p.meeting) meet = `<div class="rk-meet" part="meeting"><small>${esc(c.t.meeting)}（${esc(this.providerName(p.meeting))}）</small><span>${esc(pending ? c.t.meetingLater : c.t.meetingLaterNow)}</span></div>`;
      return `<div class="rk-done rk-section" part="done">
        <div class="rk-done-icon" data-pending="${pending ? 1 : 0}">${pending ? ICON.cal : ICON.check}</div>
        <h3>${esc(title)}</h3>
        <p>${nl2br(msg)}</p>
        ${p.bookingNumber ? `<div class="rk-number"><small>${esc(pending ? c.t.requestNumber : c.t.bookingNumber)}</small><b>${esc(p.bookingNumber)}</b></div>` : ''}
        ${meet}
        ${this.rSummary(false)}
        <div class="rk-done-actions">
          ${!pending && d.showCalendarLinks !== false && p.start ? `<a class="rk-btn rk-btn-outline" part="button-calendar" href="${esc(this.googleUrl(p))}" target="_blank" rel="noopener">${esc(c.t.addGoogle)}</a><button type="button" class="rk-btn rk-btn-outline" part="button-ics" data-act="ics">${esc(c.t.addIcs)}</button>` : ''}
          <button type="button" class="rk-btn rk-btn-ghost" data-act="again">${esc(c.t.again)}</button>
        </div>
      </div>`;
    }
  }

  /* =========================================================
   * public API
   * ======================================================= */
  function mount(target, config) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) { console.error('[ReserveKit] 埋め込み先が見つかりません:', target); return null; }
    if (el.__reserveKit) el.__reserveKit.destroy();
    const w = new Widget(el, config);
    el.__reserveKit = w;
    return w;
  }

  function autoMount() {
    document.querySelectorAll('[data-reserve-kit]:not([data-rk-mounted])').forEach((el) => {
      el.setAttribute('data-rk-mounted', '1');
      let cfg = {};
      const raw = el.getAttribute('data-config');
      const src = el.getAttribute('data-config-var');
      try {
        if (raw) cfg = JSON.parse(raw);
        else if (src && global[src]) cfg = global[src];
      } catch (e) { console.error('[ReserveKit] data-config の JSON が読めません', e); }
      ['template', 'mode', 'layout'].forEach((k) => { const v = el.getAttribute(`data-${k}`); if (v) cfg[k] = v; });
      mount(el, cfg);
    });
  }

  const ReserveKit = {
    version: VERSION,
    mount,
    autoMount,
    templates: TEMPLATES,
    defaults: DEFAULTS,
    backends: Backends,
    registerTemplate(name, cfg) { TEMPLATES[name] = cfg; },
    registerBackend(name, impl) { Backends[name] = impl; },
    resolveConfig
  };
  global.ReserveKit = ReserveKit;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
    else autoMount();
  }
})(typeof window !== 'undefined' ? window : this);
