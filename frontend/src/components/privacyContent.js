// Privacy Policy content, translated into every language the app supports.
// Structure per language:
//   { badge, title, subtitle, updatedLabel, tocHeading, footer,
//     highlights: [{ title, text } x4], sections: [{ title, body[], list[] } x11] }
// Section ids and icons stay constant and are defined in PrivacyPolicyPage.jsx.

export const PRIVACY_LAST_UPDATED = 'July 15, 2026'

const en = {
  badge: 'Legal & Privacy',
  title: 'Privacy Policy',
  subtitle: 'Your privacy matters. Here is exactly what we collect, why we collect it, and the control you have over your data.',
  updatedLabel: 'Last updated',
  tocHeading: 'On this page',
  footer: 'This Privacy Policy is provided for transparency about how ToolChain AI handles your information. It does not constitute legal advice.',
  highlights: [
    { title: 'We never sell your data', text: 'Your information is never sold or rented to advertisers.' },
    { title: 'Encrypted & secure', text: 'HTTPS transport, hashed passwords, 2FA and app lock.' },
    { title: 'You stay in control', text: 'Export or permanently delete your data anytime.' },
    { title: 'Ghost Mode leaves no trace', text: 'Ephemeral sessions are never stored after you leave.' },
  ],
  sections: [
    { title: 'Introduction', body: [
      'ToolChain AI ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform to register Model Context Protocol (MCP) servers and interact with our AI agent.',
      'By accessing or using ToolChain AI, you agree to the practices described in this policy. If you do not agree, please discontinue use of the service.',
    ] },
    { title: 'Information We Collect', body: ['We collect information you provide directly and information generated through your use of the service:'], list: [
      'Account data: your name, username, email address, and securely hashed password.',
      'Authentication data: two-factor authentication settings, registered devices, and website lock preferences.',
      'Content data: chat messages, uploaded attachments, and conversation history you create.',
      'Integration data: MCP servers you register and the credentials or tokens required to connect to them.',
      'Billing data: subscription plan and payment records processed securely through our payment provider.',
      'Usage data: feature usage, message counts, and diagnostic logs used to operate and improve the service.',
    ] },
    { title: 'How We Use Your Information', body: ['We use the information we collect to:'], list: [
      'Provide, maintain, and improve the platform and its AI capabilities.',
      'Authenticate you and secure your account against unauthorized access.',
      'Route your requests to connected MCP servers and return their results.',
      'Process subscriptions, enforce plan limits, and prevent abuse.',
      'Communicate important service updates, security alerts, and support responses.',
    ] },
    { title: 'Third-Party & MCP Services', body: [
      'When you connect an MCP server or third-party service, your requests and the data required to fulfill them are shared with that service to perform the actions you request. Each connected service operates under its own privacy policy and terms.',
      'We act only as a conduit for these interactions and do not sell your personal information to third parties. AI model providers may process your prompts solely to generate responses.',
    ] },
    { title: 'Data Storage & Security', body: [
      'We implement industry-standard safeguards to protect your data, including encrypted transport (HTTPS), hashed passwords, optional two-factor authentication, and an optional website lock PIN.',
      'While we work hard to protect your information, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
    ] },
    { title: 'Cookies & Local Storage', body: [
      'We use local storage and similar technologies to keep you signed in, remember your preferences (such as theme, language, and accent color), and maintain your session. These are essential to core functionality and are not used for third-party advertising.',
    ] },
    { title: 'Data Retention', body: [
      'We retain your account and content data for as long as your account is active. You can delete individual conversations, all conversations, or your entire account at any time from Settings. Ghost Mode sessions are ephemeral and are not stored after the session ends.',
    ] },
    { title: 'Your Rights & Choices', body: ['Depending on your jurisdiction, you may have the right to:'], list: [
      'Access and export a copy of your chat data.',
      'Correct or update your account information.',
      'Delete your conversations or permanently delete your account.',
      'Withdraw consent by disconnecting integrations or closing your account.',
    ] },
    { title: "Children's Privacy", body: [
      'ToolChain AI is not directed to individuals under the age of 13 (or the minimum age required in your jurisdiction). We do not knowingly collect personal information from children. If you believe a child has provided us data, please contact us so we can remove it.',
    ] },
    { title: 'Changes to This Policy', body: [
      'We may update this Privacy Policy from time to time. When we make material changes, we will revise the "Last updated" date above and, where appropriate, notify you within the app. Your continued use of the service after changes take effect constitutes acceptance of the updated policy.',
    ] },
    { title: 'Contact Us', body: [
      'If you have questions or requests regarding this Privacy Policy or your data, please reach out to us through the in-app contact form or by email.',
    ] },
  ],
}

const ur = {
  badge: 'قانونی و رازداری',
  title: 'رازداری کی پالیسی',
  subtitle: 'آپ کی رازداری اہم ہے۔ یہاں واضح طور پر بتایا گیا ہے کہ ہم کیا جمع کرتے ہیں، کیوں کرتے ہیں، اور آپ کے ڈیٹا پر آپ کا کیا اختیار ہے۔',
  updatedLabel: 'آخری تازہ کاری',
  tocHeading: 'اس صفحے پر',
  footer: 'یہ رازداری پالیسی شفافیت کے لیے ہے کہ ToolChain AI آپ کی معلومات کو کیسے سنبھالتا ہے۔ یہ قانونی مشورہ نہیں ہے۔',
  highlights: [
    { title: 'ہم آپ کا ڈیٹا کبھی نہیں بیچتے', text: 'آپ کی معلومات کبھی مشتہرین کو فروخت یا کرائے پر نہیں دی جاتیں۔' },
    { title: 'انکرپٹڈ اور محفوظ', text: 'HTTPS، ہیشڈ پاسورڈ، ٹو فیکٹر تصدیق اور ایپ لاک۔' },
    { title: 'اختیار آپ کے پاس رہتا ہے', text: 'اپنا ڈیٹا کسی بھی وقت ایکسپورٹ یا مستقل طور پر حذف کریں۔' },
    { title: 'گھوسٹ موڈ کوئی نشان نہیں چھوڑتا', text: 'عارضی سیشنز آپ کے جانے کے بعد محفوظ نہیں رہتے۔' },
  ],
  sections: [
    { title: 'تعارف', body: [
      'ToolChain AI ("ہم" یا "ہمارا") آپ کی رازداری کے تحفظ کے لیے پرعزم ہے۔ یہ پالیسی وضاحت کرتی ہے کہ جب آپ MCP سرورز رجسٹر کرنے اور ہمارے AI ایجنٹ سے بات چیت کے لیے پلیٹ فارم استعمال کرتے ہیں تو ہم آپ کی معلومات کیسے جمع، استعمال، ظاہر اور محفوظ کرتے ہیں۔',
      'ToolChain AI استعمال کرکے آپ اس پالیسی میں بیان کردہ طریقوں سے اتفاق کرتے ہیں۔ اگر آپ متفق نہیں تو براہ کرم سروس کا استعمال بند کر دیں۔',
    ] },
    { title: 'ہم کون سی معلومات جمع کرتے ہیں', body: ['ہم وہ معلومات جمع کرتے ہیں جو آپ براہ راست فراہم کرتے ہیں اور جو آپ کے استعمال سے پیدا ہوتی ہیں:'], list: [
      'اکاؤنٹ ڈیٹا: آپ کا نام، صارف نام، ای میل، اور محفوظ ہیشڈ پاسورڈ۔',
      'تصدیقی ڈیٹا: ٹو فیکٹر تصدیق کی ترتیبات، رجسٹرڈ ڈیوائسز، اور ویب سائٹ لاک ترجیحات۔',
      'مواد کا ڈیٹا: چیٹ پیغامات، اپ لوڈ کردہ منسلکات، اور آپ کی گفتگو کی ہسٹری۔',
      'انٹیگریشن ڈیٹا: آپ کے رجسٹرڈ MCP سرورز اور ان سے جڑنے کے لیے درکار اسناد یا ٹوکنز۔',
      'بلنگ ڈیٹا: سبسکرپشن پلان اور ادائیگی کے ریکارڈ جو ہمارے پیمنٹ فراہم کنندہ کے ذریعے محفوظ طریقے سے پروسیس ہوتے ہیں۔',
      'استعمال کا ڈیٹا: فیچر کا استعمال، پیغامات کی تعداد، اور تشخیصی لاگز۔',
    ] },
    { title: 'ہم آپ کی معلومات کیسے استعمال کرتے ہیں', body: ['ہم جمع کردہ معلومات کو اس لیے استعمال کرتے ہیں:'], list: [
      'پلیٹ فارم اور اس کی AI صلاحیتوں کو فراہم، برقرار اور بہتر بنانے کے لیے۔',
      'آپ کی تصدیق اور آپ کے اکاؤنٹ کو غیر مجاز رسائی سے محفوظ رکھنے کے لیے۔',
      'آپ کی درخواستیں جڑے ہوئے MCP سرورز تک پہنچانے اور نتائج واپس دینے کے لیے۔',
      'سبسکرپشنز پروسیس کرنے، پلان کی حدود نافذ کرنے اور بدسلوکی روکنے کے لیے۔',
      'اہم سروس اپ ڈیٹس، سیکیورٹی الرٹس اور سپورٹ جوابات بھیجنے کے لیے۔',
    ] },
    { title: 'فریق ثالث اور MCP سروسز', body: [
      'جب آپ کوئی MCP سرور یا فریق ثالث سروس جوڑتے ہیں تو آپ کی درخواستیں اور ان کے لیے درکار ڈیٹا اُس سروس کے ساتھ شیئر کیا جاتا ہے تاکہ آپ کی مطلوبہ کارروائی مکمل ہو سکے۔ ہر جڑی ہوئی سروس اپنی رازداری پالیسی کے تحت کام کرتی ہے۔',
      'ہم صرف ان تعاملات کے لیے ذریعہ کا کردار ادا کرتے ہیں اور آپ کی ذاتی معلومات فریق ثالث کو فروخت نہیں کرتے۔ AI ماڈل فراہم کنندگان آپ کے پرامپٹس صرف جواب تیار کرنے کے لیے پروسیس کر سکتے ہیں۔',
    ] },
    { title: 'ڈیٹا اسٹوریج اور سیکیورٹی', body: [
      'ہم آپ کے ڈیٹا کے تحفظ کے لیے صنعتی معیار کے حفاظتی اقدامات استعمال کرتے ہیں، بشمول انکرپٹڈ ٹرانسپورٹ (HTTPS)، ہیشڈ پاسورڈ، اختیاری ٹو فیکٹر تصدیق، اور اختیاری ویب سائٹ لاک پن۔',
      'اگرچہ ہم آپ کی معلومات کے تحفظ کے لیے سخت محنت کرتے ہیں، لیکن ترسیل یا اسٹوریج کا کوئی طریقہ مکمل طور پر محفوظ نہیں، اور ہم مطلق سلامتی کی ضمانت نہیں دے سکتے۔',
    ] },
    { title: 'کوکیز اور لوکل اسٹوریج', body: [
      'ہم آپ کو سائن اِن رکھنے، آپ کی ترجیحات (جیسے تھیم، زبان اور ایکسنٹ رنگ) یاد رکھنے اور آپ کا سیشن برقرار رکھنے کے لیے لوکل اسٹوریج اور اسی طرح کی ٹیکنالوجیز استعمال کرتے ہیں۔ یہ بنیادی فعالیت کے لیے ضروری ہیں اور فریق ثالث اشتہارات کے لیے استعمال نہیں ہوتیں۔',
    ] },
    { title: 'ڈیٹا کی برقراری', body: [
      'ہم آپ کے اکاؤنٹ اور مواد کا ڈیٹا اُس وقت تک رکھتے ہیں جب تک آپ کا اکاؤنٹ فعال ہے۔ آپ ترتیبات سے کسی بھی وقت انفرادی گفتگو، تمام گفتگو، یا اپنا پورا اکاؤنٹ حذف کر سکتے ہیں۔ گھوسٹ موڈ سیشنز عارضی ہوتے ہیں اور ختم ہونے کے بعد محفوظ نہیں رہتے۔',
    ] },
    { title: 'آپ کے حقوق اور اختیارات', body: ['آپ کے دائرہ اختیار کے مطابق، آپ کو یہ حق حاصل ہو سکتا ہے:'], list: [
      'اپنے چیٹ ڈیٹا کی کاپی تک رسائی اور ایکسپورٹ۔',
      'اپنی اکاؤنٹ معلومات درست یا اپ ڈیٹ کرنا۔',
      'اپنی گفتگو حذف کرنا یا اپنا اکاؤنٹ مستقل طور پر حذف کرنا۔',
      'انٹیگریشنز منقطع کرکے یا اکاؤنٹ بند کرکے رضامندی واپس لینا۔',
    ] },
    { title: 'بچوں کی رازداری', body: [
      'ToolChain AI 13 سال (یا آپ کے دائرہ اختیار میں مطلوبہ کم از کم عمر) سے کم افراد کے لیے نہیں ہے۔ ہم جان بوجھ کر بچوں سے ذاتی معلومات جمع نہیں کرتے۔ اگر آپ کو لگے کہ کسی بچے نے ہمیں ڈیٹا دیا ہے تو براہ کرم ہم سے رابطہ کریں۔',
    ] },
    { title: 'اس پالیسی میں تبدیلیاں', body: [
      'ہم وقتاً فوقتاً اس پالیسی کو اپ ڈیٹ کر سکتے ہیں۔ اہم تبدیلیوں پر ہم اوپر دی گئی "آخری تازہ کاری" کی تاریخ تبدیل کریں گے اور مناسب صورت میں ایپ میں مطلع کریں گے۔ تبدیلیوں کے نافذ ہونے کے بعد سروس کا مسلسل استعمال اپ ڈیٹڈ پالیسی کی قبولیت سمجھا جائے گا۔',
    ] },
    { title: 'ہم سے رابطہ کریں', body: [
      'اگر اس رازداری پالیسی یا آپ کے ڈیٹا کے بارے میں کوئی سوال یا درخواست ہو تو براہ کرم ایپ کے رابطہ فارم یا ای میل کے ذریعے ہم سے رجوع کریں۔',
    ] },
  ],
}

const hi = {
  badge: 'कानूनी और गोपनीयता',
  title: 'गोपनीयता नीति',
  subtitle: 'आपकी गोपनीयता मायने रखती है। यहाँ स्पष्ट रूप से बताया गया है कि हम क्या एकत्र करते हैं, क्यों करते हैं, और आपके डेटा पर आपका क्या नियंत्रण है।',
  updatedLabel: 'अंतिम अपडेट',
  tocHeading: 'इस पृष्ठ पर',
  footer: 'यह गोपनीयता नीति पारदर्शिता के लिए है कि ToolChain AI आपकी जानकारी को कैसे संभालता है। यह कानूनी सलाह नहीं है।',
  highlights: [
    { title: 'हम आपका डेटा कभी नहीं बेचते', text: 'आपकी जानकारी कभी विज्ञापनदाताओं को नहीं बेची या किराए पर दी जाती।' },
    { title: 'एन्क्रिप्टेड और सुरक्षित', text: 'HTTPS, हैश किए पासवर्ड, टू-फैक्टर और ऐप लॉक।' },
    { title: 'नियंत्रण आपके पास रहता है', text: 'अपना डेटा कभी भी एक्सपोर्ट या स्थायी रूप से हटाएँ।' },
    { title: 'घोस्ट मोड कोई निशान नहीं छोड़ता', text: 'अस्थायी सत्र आपके जाने के बाद संग्रहीत नहीं होते।' },
  ],
  sections: [
    { title: 'परिचय', body: [
      'ToolChain AI ("हम" या "हमारा") आपकी गोपनीयता की रक्षा के लिए प्रतिबद्ध है। यह नीति बताती है कि जब आप MCP सर्वर पंजीकृत करने और हमारे AI एजेंट से बातचीत के लिए प्लेटफ़ॉर्म का उपयोग करते हैं तो हम आपकी जानकारी कैसे एकत्र, उपयोग, प्रकट और सुरक्षित करते हैं।',
      'ToolChain AI का उपयोग करके आप इस नीति में वर्णित प्रथाओं से सहमत होते हैं। यदि आप सहमत नहीं हैं, तो कृपया सेवा का उपयोग बंद करें।',
    ] },
    { title: 'हम कौन-सी जानकारी एकत्र करते हैं', body: ['हम वह जानकारी एकत्र करते हैं जो आप सीधे देते हैं और जो आपके उपयोग से उत्पन्न होती है:'], list: [
      'खाता डेटा: आपका नाम, उपयोगकर्ता नाम, ईमेल और सुरक्षित हैश किया पासवर्ड।',
      'प्रमाणीकरण डेटा: टू-फैक्टर सेटिंग्स, पंजीकृत डिवाइस और वेबसाइट लॉक प्राथमिकताएँ।',
      'सामग्री डेटा: चैट संदेश, अपलोड किए अटैचमेंट और आपकी बातचीत का इतिहास।',
      'इंटीग्रेशन डेटा: आपके पंजीकृत MCP सर्वर और उनसे जुड़ने के लिए आवश्यक क्रेडेंशियल या टोकन।',
      'बिलिंग डेटा: सदस्यता योजना और भुगतान रिकॉर्ड जो हमारे भुगतान प्रदाता के माध्यम से सुरक्षित रूप से संसाधित होते हैं।',
      'उपयोग डेटा: सुविधा उपयोग, संदेश गणना और नैदानिक लॉग।',
    ] },
    { title: 'हम आपकी जानकारी का उपयोग कैसे करते हैं', body: ['हम एकत्रित जानकारी का उपयोग इसके लिए करते हैं:'], list: [
      'प्लेटफ़ॉर्म और उसकी AI क्षमताओं को प्रदान, बनाए रखने और सुधारने के लिए।',
      'आपको प्रमाणित करने और आपके खाते को अनधिकृत पहुँच से सुरक्षित रखने के लिए।',
      'आपके अनुरोधों को जुड़े MCP सर्वरों तक भेजने और परिणाम लौटाने के लिए।',
      'सदस्यताएँ संसाधित करने, योजना सीमाएँ लागू करने और दुरुपयोग रोकने के लिए।',
      'महत्वपूर्ण सेवा अपडेट, सुरक्षा अलर्ट और समर्थन प्रतिक्रियाएँ भेजने के लिए।',
    ] },
    { title: 'तृतीय-पक्ष और MCP सेवाएँ', body: [
      'जब आप कोई MCP सर्वर या तृतीय-पक्ष सेवा जोड़ते हैं, तो आपके अनुरोध और उन्हें पूरा करने के लिए आवश्यक डेटा उस सेवा के साथ साझा किया जाता है। प्रत्येक जुड़ी सेवा अपनी गोपनीयता नीति के तहत कार्य करती है।',
      'हम केवल इन अंतःक्रियाओं के लिए माध्यम के रूप में कार्य करते हैं और आपकी व्यक्तिगत जानकारी तृतीय पक्षों को नहीं बेचते। AI मॉडल प्रदाता केवल प्रतिक्रिया उत्पन्न करने के लिए आपके प्रॉम्प्ट संसाधित कर सकते हैं।',
    ] },
    { title: 'डेटा भंडारण और सुरक्षा', body: [
      'हम आपके डेटा की रक्षा के लिए उद्योग-मानक सुरक्षा उपाय लागू करते हैं, जिनमें एन्क्रिप्टेड ट्रांसपोर्ट (HTTPS), हैश किए पासवर्ड, वैकल्पिक टू-फैक्टर प्रमाणीकरण और वैकल्पिक वेबसाइट लॉक पिन शामिल हैं।',
      'हालाँकि हम आपकी जानकारी की रक्षा के लिए कड़ी मेहनत करते हैं, कोई भी संचरण या भंडारण विधि पूरी तरह सुरक्षित नहीं है, और हम पूर्ण सुरक्षा की गारंटी नहीं दे सकते।',
    ] },
    { title: 'कुकीज़ और लोकल स्टोरेज', body: [
      'हम आपको साइन-इन रखने, आपकी प्राथमिकताएँ (जैसे थीम, भाषा और एक्सेंट रंग) याद रखने और आपका सत्र बनाए रखने के लिए लोकल स्टोरेज और समान तकनीकों का उपयोग करते हैं। ये मुख्य कार्यक्षमता के लिए आवश्यक हैं और तृतीय-पक्ष विज्ञापन के लिए उपयोग नहीं होतीं।',
    ] },
    { title: 'डेटा प्रतिधारण', body: [
      'जब तक आपका खाता सक्रिय है, हम आपका खाता और सामग्री डेटा रखते हैं। आप सेटिंग्स से कभी भी अलग-अलग बातचीत, सभी बातचीत, या अपना पूरा खाता हटा सकते हैं। घोस्ट मोड सत्र अस्थायी होते हैं और समाप्त होने के बाद संग्रहीत नहीं होते।',
    ] },
    { title: 'आपके अधिकार और विकल्प', body: ['आपके क्षेत्राधिकार के अनुसार, आपके पास ये अधिकार हो सकते हैं:'], list: [
      'अपने चैट डेटा की प्रति तक पहुँच और एक्सपोर्ट।',
      'अपनी खाता जानकारी सुधारना या अपडेट करना।',
      'अपनी बातचीत हटाना या अपना खाता स्थायी रूप से हटाना।',
      'इंटीग्रेशन डिस्कनेक्ट करके या खाता बंद करके सहमति वापस लेना।',
    ] },
    { title: 'बच्चों की गोपनीयता', body: [
      'ToolChain AI 13 वर्ष (या आपके क्षेत्राधिकार में आवश्यक न्यूनतम आयु) से कम व्यक्तियों के लिए नहीं है। हम जानबूझकर बच्चों से व्यक्तिगत जानकारी एकत्र नहीं करते। यदि आपको लगता है कि किसी बच्चे ने हमें डेटा दिया है, तो कृपया हमसे संपर्क करें।',
    ] },
    { title: 'इस नीति में परिवर्तन', body: [
      'हम समय-समय पर इस नीति को अपडेट कर सकते हैं। महत्वपूर्ण परिवर्तनों पर हम ऊपर दी "अंतिम अपडेट" तिथि बदलेंगे और उचित होने पर ऐप में सूचित करेंगे। परिवर्तनों के प्रभावी होने के बाद सेवा का निरंतर उपयोग अपडेटेड नीति की स्वीकृति है।',
    ] },
    { title: 'हमसे संपर्क करें', body: [
      'यदि इस गोपनीयता नीति या आपके डेटा के बारे में कोई प्रश्न या अनुरोध है, तो कृपया ऐप के संपर्क फ़ॉर्म या ईमेल के माध्यम से हमसे संपर्क करें।',
    ] },
  ],
}

export const PRIVACY_CONTENT = { en, ur, hi }

// Only languages present in PRIVACY_CONTENT appear in the page's language
// selector. Others gracefully fall back to English.
export function getPrivacyContent(lang) {
  return PRIVACY_CONTENT[lang] || PRIVACY_CONTENT.en
}
