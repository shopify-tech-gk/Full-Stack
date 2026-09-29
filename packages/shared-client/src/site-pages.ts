// Informational + policy page copy, taken verbatim from live youmartshop.com (2026-09-29) unless
// a line is marked FIXED (flagged to Vijesh). Inline syntax: **bold** and [label](/href).

export const BUSINESS = {
  email: 'info@youmart.in',
  phone: '+91 99445 57815',
  phoneHref: 'tel:+919944557815',
  /** Live's "Download App" / "Install App" target. */
  appStoreHref: 'https://play.google.com/store/apps/details?id=com.infinest.youmart',
  whatsappHref: 'https://wa.me/919944557815?text=Hello%20Team,%20I%20need%20assistance.',
  address: 'OLD NO.251, NEW NO. 162, THAMBU CHETTY STREET, CHENNAI-600 001',
  mapEmbedSrc:
    'https://maps.google.com/maps?q=OLD%20NO.251%2C%20NEW%20NO.%20162%2C%20THAMBU%20CHETTY%20STREET%2C%20CHENNAI-600%20001&t=m&z=14&output=embed&iwloc=near',
} as const;

// --- Inline rich text ---

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'link'; text: string; href: string };

const INLINE = /\*\*(.+?)\*\*|\[(.+?)\]\((\S+?)\)/g;

/** Splits `**bold**` and `[label](href)` markers into tokens (no nesting). */
export function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: 'text', text: source.slice(last, index) });
    if (match[1] !== undefined) tokens.push({ type: 'strong', text: match[1] });
    else tokens.push({ type: 'link', text: match[2] ?? '', href: match[3] ?? '#' });
    last = index + match[0].length;
  }
  if (last < source.length) tokens.push({ type: 'text', text: source.slice(last) });
  return tokens;
}

// --- Policy pages ---

export type PolicyBlock =
  { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: readonly string[] };

export interface PolicySection {
  heading?: string;
  blocks: readonly PolicyBlock[];
}

export interface PolicyPage {
  /** Live page title line, e.g. "Privacy Policy – Youmart". */
  title: string;
  metaTitle: string;
  /** Where the copy was taken from. */
  source: string;
  sections: readonly PolicySection[];
}

const p = (text: string): PolicyBlock => ({ type: 'p', text });
const ul = (...items: string[]): PolicyBlock => ({ type: 'ul', items });
const ol = (...items: string[]): PolicyBlock => ({ type: 'ol', items });

const CONTACT_LINES = [
  `Email: [${BUSINESS.email}](mailto:${BUSINESS.email})`,
  `Phone: [${BUSINESS.phone}](${BUSINESS.phoneHref})`,
];
const CONTACT_BLOCK = p([...CONTACT_LINES, `Address: ${BUSINESS.address}`].join('\n'));

export const PRIVACY_POLICY: PolicyPage = {
  title: 'Privacy Policy – Youmart',
  metaTitle: 'Privacy Policy',
  source: 'https://youmartshop.com/privacy-policy/',
  sections: [
    {
      blocks: [
        p(
          'At Youmart, we prioritize your privacy and are committed to safeguarding the personal information you share with us. This Privacy Policy outlines how we collect, use, and protect your data when you visit our website and make use of our services.',
        ),
      ],
    },
    {
      heading: '1. Information We Collect',
      blocks: [
        p('When you visit Youmart, we may collect the following types of information:'),
        ul(
          '**Personal Information**: Name, email address, phone number, and other details you provide when creating an account or making a purchase.',
          '**Payment Information**: Credit/debit card details or other payment methods used during the purchase process.',
          '**Usage Data**: Information about how you interact with our website, including browsing activity, IP address, and device information.',
        ),
      ],
    },
    {
      heading: '2. How We Use Your Information',
      blocks: [
        p('We use your information for the following purposes:'),
        ul(
          'To process your orders and manage your transactions.',
          'To personalize your experience on Youmart, offering recommendations based on your preferences.',
          'To communicate with you regarding updates, promotions, and new products related to categories like artificial flowers and plants, stationery, gifts, toys, crockery, wall photo frames, table mats, aquariums, festival decorations, disposable products, paper products, art and craft, and wall clocks.',
          'To improve our website and services, ensuring they meet your needs.',
        ),
      ],
    },
    {
      heading: '3. Data Sharing',
      blocks: [
        p(
          'We respect your privacy and do not sell, rent, or lease your personal information to third parties. However, we may share your data with:',
        ),
        ul(
          '**Service Providers**: Third-party partners who assist us in processing payments, shipping orders, or improving website functionality.',
          '**Legal Compliance**: If required by law, we may share your information with authorities or other parties in response to legal requests.',
        ),
      ],
    },
    {
      heading: '4. Cookies and Tracking Technologies',
      blocks: [
        p(
          'We use cookies and similar technologies to enhance your browsing experience. Cookies help us analyze web traffic, personalize content, and offer relevant ads. You can manage your cookie preferences in your browser settings.',
        ),
      ],
    },
    {
      heading: '5. Data Security',
      blocks: [
        p(
          'We implement strict security measures to protect your data from unauthorized access, alteration, or disclosure. While we strive to secure your information, please note that no method of transmission over the internet is 100% secure.',
        ),
      ],
    },
    {
      heading: '6. Your Rights',
      blocks: [
        p('You have the right to:'),
        ul(
          'Access, update, or delete your personal information by logging into your account or contacting us directly.',
          'Opt-out of marketing communications by unsubscribing or updating your preferences.',
          'Request information on how your data is used and shared.',
        ),
      ],
    },
    {
      heading: '7. Third-Party Links',
      blocks: [
        p(
          'Our website may contain links to third-party sites for products or services related to our categories. These sites have their own privacy policies, and we are not responsible for their practices.',
        ),
      ],
    },
    {
      heading: '8. Changes to this Privacy Policy',
      blocks: [
        p(
          'Youmart reserves the right to update or modify this Privacy Policy. Any changes will be posted on this page with the updated date.',
        ),
      ],
    },
    {
      heading: '9. Contact Us',
      blocks: [
        p(
          'If you have any questions about this Privacy Policy or our data practices, please contact us at:',
        ),
        CONTACT_BLOCK,
      ],
    },
  ],
};

export const TERMS_AND_CONDITIONS: PolicyPage = {
  title: 'Terms & Conditions – Youmart',
  metaTitle: 'Terms & Conditions',
  source: 'https://youmartshop.com/terms-conditions/',
  sections: [
    {
      blocks: [
        p(
          'Welcome to Youmart! By accessing or using our website, you agree to comply with the following terms and conditions. Please read them carefully before making any purchase or using our services.',
        ),
      ],
    },
    {
      heading: '1. General Use',
      blocks: [
        ul(
          'By using our website, you confirm that you are at least 18 years old or have parental/guardian consent.',
          'You agree to provide accurate, current, and complete information when creating an account or placing an order.',
        ),
      ],
    },
    {
      heading: '2. Product Information',
      blocks: [
        ul(
          'We strive to ensure the accuracy of product descriptions and images. However, slight variations in color or design may occur.',
          // FIXED: live reads "[Insert Currency]" (unfilled template) - LEGAL TO CONFIRM.
          'All prices are listed in Indian Rupees (₹) and are subject to change without prior notice.',
        ),
      ],
    },
    {
      heading: '3. Orders and Payments',
      blocks: [
        ul(
          'Orders are subject to availability and acceptance by Youmart.',
          'Payment must be completed at checkout using the available payment methods.',
          'In case of payment failure, the order will not be processed.',
        ),
      ],
    },
    {
      heading: '4. Shipping and Delivery',
      blocks: [
        ul(
          'Please refer to our [Shipping Details](/shipping) page for information on delivery timelines, charges, and policies.',
          'Delays caused by external factors, such as weather or carrier issues, are beyond our control.',
        ),
      ],
    },
    {
      heading: '5. Returns and Refunds',
      blocks: [
        ul(
          'Please review our [Refund Policy](/refund-policy) for detailed information on returns and refunds.',
          'Items marked as non-returnable or non-refundable cannot be returned or exchanged.',
        ),
      ],
    },
    {
      heading: '6. Offers and Coupons',
      blocks: [
        ul(
          'Offers and coupons are subject to specific terms and conditions, including validity periods and usage limits.',
          'Misuse of coupons or offers may result in order cancellation.',
        ),
      ],
    },
    {
      heading: '7. Intellectual Property',
      blocks: [
        ul(
          'All content on this website, including text, images, logos, and designs, is the property of Youmart and is protected by intellectual property laws.',
          'Unauthorized use, reproduction, or distribution of our content is strictly prohibited.',
        ),
      ],
    },
    {
      heading: '8. Limitation of Liability',
      blocks: [
        ul(
          'Youmart is not liable for any direct, indirect, incidental, or consequential damages arising from the use of our website or products.',
          'Our liability is limited to the value of the product purchased.',
        ),
      ],
    },
    {
      heading: '9. User Conduct',
      blocks: [
        ul(
          'Users are prohibited from engaging in unlawful, abusive, or fraudulent activities on our website.',
          'Any violation of these terms may result in account suspension or legal action.',
        ),
      ],
    },
    {
      heading: '10. Privacy Policy',
      blocks: [
        ul(
          'Your personal information is collected and used in accordance with our [Privacy Policy](/privacy-policy).',
        ),
      ],
    },
    {
      heading: '11. Changes to Terms',
      blocks: [
        ul(
          'Youmart reserves the right to update or modify these terms at any time without prior notice. Continued use of the website implies acceptance of the updated terms.',
        ),
      ],
    },
    {
      heading: '12. Governing Law',
      blocks: [
        // FIXED: live reads "[Insert Jurisdiction]" (unfilled template) - LEGAL TO CONFIRM.
        ul('These terms are governed by and construed in accordance with the laws of India.'),
      ],
    },
    {
      heading: 'Contact Us',
      blocks: [
        p('If you have any questions or concerns about our Terms & Conditions, please contact us:'),
        ul(...CONTACT_LINES),
      ],
    },
  ],
};

export const REFUND_POLICY: PolicyPage = {
  title: 'Refund Policy – Youmart',
  metaTitle: 'Refund Policy',
  source: 'https://youmartshop.com/refund-policy/',
  sections: [
    {
      blocks: [
        p(
          'At Youmart, customer satisfaction is our priority. If you are not satisfied with your purchase, we are here to help.',
        ),
      ],
    },
    {
      heading: '1. Eligibility for Returns',
      blocks: [
        p(
          'To be eligible for a return, the item must be unused, undamaged, and in its original packaging. Returns must be initiated within a specific period after receiving the product. Certain items, such as perishable goods, customized products, or items marked as non-returnable, are not eligible for returns.',
        ),
        p('Non-Returnable Categories:'),
        ul(
          'Festival decorations',
          'Use-and-throw products',
          'Opened or used items in categories such as stationery, table mats, and paper products',
        ),
      ],
    },
    {
      heading: '2. Return Process',
      blocks: [
        p('To initiate a return:'),
        // FIXED: live nests the conditions inside step 3; they are split out here, wording kept.
        ol(
          'Contact our customer support team with your order details and reason for the return.',
          'Once your request is approved, we will provide you with return shipping instructions.',
          'Pack the item securely and ship it to the address provided.',
        ),
        p('**We accept returns under the following conditions:**'),
        ul(
          '**Return Window:** Returns must be initiated within **24 hours** of receiving the product.',
          '**Proof Required:** A **video proof** of unboxing and showing the issue must be provided for the return request to be considered.',
          '**Condition:** The item must be in its original condition, unused, and with all tags and packaging intact.',
          '**Approval Process:** Once the video proof is verified, we will process the return or exchange as per our policy.',
        ),
        p(
          'Customers are responsible for the cost of return shipping unless the item received was damaged or incorrect.',
        ),
      ],
    },
    {
      heading: '3. Refund Policy',
      blocks: [
        p(
          'Refunds will be processed once the returned item is received and inspected. Approved refunds will be credited to your original method of payment.',
        ),
        p(
          'Partial refunds may be issued for items that are not in their original condition or missing parts or accessories.',
        ),
      ],
    },
    {
      heading: '4. Damaged or Defective Items',
      blocks: [
        p(
          'If you receive a damaged or defective item, contact us immediately with supporting photos or videos. We will arrange a replacement or refund based on your preference.',
        ),
      ],
    },
    {
      heading: '5. Exchanges',
      blocks: [
        p(
          'We allow exchanges for eligible items. To request an exchange, follow the return process and specify the item you wish to exchange.',
        ),
      ],
    },
    {
      heading: '6. Cancellation Policy',
      blocks: [
        p(
          'Orders can be canceled within a limited time after placement. If the order has already been shipped, cancellations may not be possible, and you will need to initiate a return after receiving the product.',
        ),
      ],
    },
    {
      // FIXED: live numbers this "6." a second time (and Contact Us "7.").
      heading: '7. Video Proof Requirement',
      blocks: [
        p(
          'To process claims for damaged, missing, incorrect, or defective products, customers must record an unboxing video from the moment the package is opened.',
        ),
        p('The video should clearly show:'),
        ul(
          'The sealed package before opening.',
          'The shipping label and order details.',
          'The complete unboxing process without cuts or edits.',
          'The condition of the product and all included items.',
        ),
      ],
    },
    {
      heading: '8. Contact Us',
      blocks: [
        p('For any questions or concerns about our Refund Policy, please reach out to us:'),
        CONTACT_BLOCK,
      ],
    },
  ],
};

export const SHIPPING_DETAILS: PolicyPage = {
  title: 'Shipping Details – Youmart',
  metaTitle: 'Shipping Details',
  source: 'https://youmartshop.com/shipping-details/',
  sections: [
    {
      blocks: [
        p(
          'At Youmart, we are committed to delivering your orders quickly and safely. Our streamlined shipping process ensures that your products reach you in perfect condition, no matter where you are.',
        ),
      ],
    },
    {
      heading: '1. Delivery Timelines',
      blocks: [
        ul(
          'Orders are typically processed and dispatched within 1–2 business days.',
          'Delivery times vary based on your location but generally take 3–7 business days for most areas.',
          'Please note that unforeseen circumstances, such as weather conditions or high demand, may occasionally affect delivery timelines.',
        ),
      ],
    },
    {
      heading: '2. Shipping Charges',
      blocks: [
        ul(
          'Standard shipping charges apply to all orders unless stated otherwise during promotions.',
          'Free shipping is available for orders above a certain value, as mentioned on the product or checkout page.',
        ),
      ],
    },
    {
      heading: '3. Order Tracking',
      blocks: [
        ul(
          'Once your order is shipped, you will receive a tracking number via email or SMS.',
          'Use the tracking details to monitor your shipment and stay updated on its status.',
        ),
      ],
    },
    {
      heading: '4. Packaging',
      blocks: [
        ul(
          'All products are carefully packed to ensure they arrive in perfect condition.',
          'Eco-friendly packaging materials are used wherever possible.',
        ),
      ],
    },
    {
      heading: '5. Delivery Locations',
      blocks: [
        ul(
          'We deliver to most locations across the country.',
          'If your location is not serviceable, our team will contact you to discuss alternative solutions.',
        ),
      ],
    },
    {
      heading: '6. Failed Deliveries',
      blocks: [
        ul(
          'If a delivery attempt fails due to incorrect address or recipient unavailability, we will contact you to reschedule.',
          'Additional charges may apply for repeated delivery attempts.',
        ),
      ],
    },
    {
      heading: '7. International Shipping',
      blocks: [
        ul(
          'Currently, we do not offer international shipping. Stay tuned for updates as we expand our services.',
        ),
      ],
    },
    {
      heading: 'Contact Us for Shipping Queries',
      blocks: [
        p('If you have any questions or concerns about shipping, feel free to contact us:'),
        ul(...CONTACT_LINES),
      ],
    },
  ],
};

export const OFFERS_AND_COUPONS: PolicyPage = {
  title: 'Offers and Coupons – Youmart',
  metaTitle: 'Offers and Coupons',
  source: 'https://youmartshop.com/offers-and-coupons/',
  sections: [
    {
      blocks: [
        p(
          'At Youmart, we believe in rewarding our customers with exciting offers and value-packed coupons to enhance your shopping experience. Whether you’re shopping for home essentials, festive decorations, or unique gifts, our offers and coupons are designed to give you the best deals on a wide range of products.',
        ),
      ],
    },
    {
      heading: 'What You Can Expect:',
      blocks: [
        ul(
          '**Exclusive Discounts**: Look out for our seasonal sales and festive promotions to save more on your favorite items.',
          '**Special Coupons**: Redeem our carefully curated coupons for additional savings on select categories.',
          '**Limited-Time Offers**: Don’t miss out on time-sensitive deals that bring you unmatched value.',
        ),
      ],
    },
    {
      heading: 'How to Stay Updated:',
      blocks: [
        ul(
          'Subscribe to our newsletter for the latest updates on offers and promotions.',
          'Follow us on social media to be the first to know about our exclusive deals and flash sales.',
        ),
      ],
    },
    {
      heading: 'Easy to Use:',
      blocks: [
        p(
          'Applying offers and coupons at checkout is simple and hassle-free. Just enter the coupon code in the designated field, and your discount will be applied instantly.',
        ),
        p(
          'Take advantage of these exciting offers and coupons to enjoy great savings on your shopping journey at Youmart. Happy Shopping!',
        ),
      ],
    },
    {
      heading: 'Contact Us',
      blocks: [
        p(
          'For any questions or concerns about our Offers and Coupons Policy, please reach out to us:',
        ),
        CONTACT_BLOCK,
      ],
    },
  ],
};

// --- About ---

export const ABOUT_PAGE = {
  hero: { eyebrow: 'Welcome To You Mart', title: 'About Us' },
  intro: {
    eyebrow: 'A Marketplace for Everyone',
    title: 'Your Trusted Online Shopping Partner',
    subtitle: 'Discover Convenience with You Mart',
    paragraphs: [
      'Welcome to **You Mart**, your one-stop online shopping destination for everything you need! Inspired by the convenience and variety offered by leading e-commerce platforms, You Mart brings you a seamless shopping experience with a vast collection of products across categories like  artificial flowers, stationery, gifts, toys, crockery, and more.',
      'Discover the joy of shopping with easy navigation, exciting deals, and quick delivery services. Join the You Mart family today and experience the future of online shopping!',
    ],
  },
  missionVision: {
    eyebrow: 'More',
    title: 'Mission & Vision',
    items: [
      {
        title: 'Mission',
        text: 'Our mission at **You Mart** is to revolutionize the online shopping experience by providing a wide range of quality products at affordable prices. We aim to empower customers with convenience, reliability, and innovation, ensuring a seamless and enjoyable shopping journey from start to finish.',
      },
      {
        title: 'Vision',
        text: 'Our vision is to become a leading e-commerce platform that connects people with products they love, fostering trust and satisfaction. We aspire to create a global community where shopping is easy, accessible, and personalized, contributing to a more connected and convenient digital marketplace.',
      },
    ],
  },
  // FIXED: live's button dials +91 96290 30079 (not the published number); it links to /contact.
  cta: {
    title: 'Talk to us',
    text: 'Ready to Upgrade Your Shopping Experience? Start Now!',
    button: 'Get In Touch',
    href: '/contact',
  },
} as const;

// --- Contact ---

export const CONTACT_PAGE = {
  hero: {
    title: 'Contact Us',
    text: 'We’re here to help! Whether you have a question, need assistance, or want to share feedback, feel free to reach out to us.',
  },
  card: {
    title: 'Get In Touch',
    items: [
      { id: 'meet', title: 'Meet Us', text: BUSINESS.address, href: null },
      { id: 'call', title: 'Call Us', text: BUSINESS.phone, href: BUSINESS.phoneHref },
      { id: 'email', title: 'Email Us', text: BUSINESS.email, href: `mailto:${BUSINESS.email}` },
    ],
  },
  cta: {
    title: 'Shop Now and Experience the Difference!',
    text: 'Ready to elevate your shopping experience? At **You Mart**, we bring you an extensive range of products, unbeatable prices.',
    // FIXED: live's button label is Elementor's default "Call to Action".
    button: 'Call Us',
    href: BUSINESS.phoneHref,
  },
} as const;

// --- Customer care ---

export const CUSTOMER_CARE_PAGE = {
  title: 'We’re Always Here For You',
  text: 'Your satisfaction, trust, and happiness are at the heart of everything we do. Reach out to us anytime, and we’ll do our best to provide a quick, friendly, and reliable solution.',
  cards: [
    {
      id: 'whatsapp',
      title: 'Chat With Us on WhatsApp',
      href: BUSINESS.whatsappHref,
      text: "Need instant assistance? Connect with our friendly support team on WhatsApp and get quick answers to your questions. We're just a message away and always happy to help.",
    },
    {
      id: 'call',
      title: 'Call Our Support Team',
      href: BUSINESS.phoneHref,
      text: 'Prefer speaking directly with us? Our customer support team is available to listen, guide, and resolve your concerns with care and attention.',
    },
  ],
} as const;

// --- FAQ ---

export interface FaqItem {
  question: string;
  /** Paragraphs; a paragraph array is rendered as a bullet list. */
  answer: readonly (string | readonly string[])[];
}

export const FAQ_PAGE: { title: string; subtitle: string; heading: string; items: FaqItem[] } = {
  title: 'FAQ',
  subtitle: 'Frequently Asked Questions (FAQ)',
  heading: 'Frequently Asked Questions',
  items: [
    {
      question: 'What is You Mart?',
      answer: [
        'Youmart is your one-stop destination for a wide range of products, including artificial flowers, stationery, gifts, toys, crockery, and more. We aim to provide high-quality products at affordable prices.',
      ],
    },
    {
      question: 'How do I create an account on You Mart?',
      answer: [
        'Creating an account is simple! Click on the “Sign Up” button on the top right corner of the homepage, fill in your details, and get started.',
      ],
    },
    {
      question: 'How do I track my order?',
      // FIXED: live ends with a bare "Link"; the page name is linked instead.
      answer: [
        'Once your order is shipped, you’ll receive a tracking number via email or SMS. Use this number to track your order on the “[Track Order](/order-track)” page on our website.',
      ],
    },
    {
      question: 'What is the return policy?',
      answer: [
        'We have a hassle-free return policy. If you’re not satisfied with your purchase, you can return it within 7-10 days of delivery. Please refer to our [Return Policy](/refund-policy) page for more details.',
      ],
    },
    {
      question: 'Are there any shipping charges?',
      answer: [
        'Shipping charges vary depending on the product, location, and order value. Free shipping is available on select orders. Check your cart for applicable charges.',
      ],
    },
    {
      question: 'How do I place an order?',
      answer: [
        'Simply browse products, add your desired items to the cart, proceed to checkout, enter your delivery details, choose your preferred payment method, and confirm your order.',
      ],
    },
    {
      question: 'What payment methods do you accept?',
      answer: [
        'We accept:',
        [
          'UPI',
          'Credit Cards',
          'Debit Cards',
          'Net Banking',
          'Digital Wallets',
          'EMI (on eligible products)',
        ],
      ],
    },
    {
      question: 'Is Cash on Delivery (COD) available?',
      answer: [
        'Yes. COD is available for eligible products and serviceable PIN codes. Availability will be shown during checkout.',
      ],
    },
    {
      question: 'How long does delivery take?',
      answer: [
        'Delivery usually takes between **2–7 business days**, depending on your location and product availability. Remote locations may require additional time.',
      ],
    },
    {
      question: 'Can I cancel my order?',
      answer: [
        'Yes. Orders can be cancelled before they are shipped. Once shipped, cancellation may not be possible. Visit “[Orders Cancel](/order-cancel)” to check cancellation eligibility.',
      ],
    },
    {
      question: 'When will I receive my refund?',
      answer: [
        'Refunds are generally processed within **5–7 business days** after the returned product has been received and successfully inspected.',
      ],
    },
    {
      question: 'What should I do if I receive a damaged or incorrect product?',
      answer: [
        'Please contact our customer support within **12 hours** of delivery with photos of the product and packaging. We’ll arrange a replacement or refund after verification.',
      ],
    },
    {
      question: 'Is my payment information secure?',
      answer: [
        'Yes. We use secure payment gateways and encryption technologies to protect your payment information. Your financial details are never stored on our servers.',
      ],
    },
  ],
};

// --- 404 (live copy) ---

export const NOT_FOUND_PAGE = {
  title: 'This page doesn’t seem to exist.',
  text: 'It looks like the link pointing here was faulty. Maybe try searching?',
} as const;
