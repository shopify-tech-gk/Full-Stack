'use client';

// Page translation, as live youmartshop.com does it (GTranslate = Google's website translator,
// same languages). The translator script is loaded only once a shopper picks a non-English
// language - English visitors load nothing extra - and the choice persists through Google's
// `googtrans` cookie, which the script reads on every page.

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'kn', label: 'Kannada', native: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1' },
  { code: 'ml', label: 'Malayalam', native: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02' },
  { code: 'ta', label: 'Tamil', native: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd' },
  { code: 'te', label: 'Telugu', native: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const COOKIE = 'googtrans';
const SCRIPT = 'https://translate.google.com/translate_a/element.js?cb=ymTranslateInit';

interface TranslateWindow extends Window {
  ymTranslateInit?: () => void;
  google?: {
    translate: {
      TranslateElement: new (
        options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
        elementId: string,
      ) => unknown;
    };
  };
}

export function currentLanguage(): LanguageCode {
  const code = /(?:^|;\s*)googtrans=\/en\/([a-z-]+)/.exec(document.cookie)?.[1];
  return LANGUAGES.find((language) => language.code === code)?.code ?? 'en';
}

function writeCookie(value: string | null): void {
  const expires = value ? '' : '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${COOKIE}=${value ?? ''}; path=/; SameSite=Lax${expires}`;
  // Google may also have written it on the parent domain; clear that copy too.
  const host = window.location.hostname;
  if (!value && host.includes('.')) {
    document.cookie = `${COOKIE}=; path=/; domain=.${host}${expires}`;
  }
}

// Google wraps translated text in <font> nodes, so React's later removeChild/insertBefore can
// target nodes that moved; tolerate that instead of crashing (facebook/react#11538).
function tolerateTranslatedDom(): void {
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    return child.parentNode === this ? (remove.call(this, child) as T) : child;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    ref: Node | null,
  ): T {
    return ref && ref.parentNode !== this ? node : (insert.call(this, node, ref) as T);
  };
}

let loading: Promise<void> | null = null;

function loadTranslator(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    tolerateTranslatedDom();
    const w = window as TranslateWindow;
    const mount = document.createElement('div');
    mount.id = 'ym-translate';
    mount.hidden = true;
    document.body.appendChild(mount);
    w.ymTranslateInit = () => {
      new w.google!.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: LANGUAGES.filter((l) => l.code !== 'en')
            .map((l) => l.code)
            .join(','),
          autoDisplay: false,
        },
        mount.id,
      );
      resolve();
    };
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('The translator could not be loaded'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

async function translatorSelect(): Promise<HTMLSelectElement | null> {
  for (let i = 0; i < 50; i++) {
    const select = document.querySelector<HTMLSelectElement>('select.goog-te-combo');
    if (select) return select;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

/** Switches the page language (English restores the original page). */
export async function setLanguage(code: LanguageCode): Promise<void> {
  if (code === 'en') {
    writeCookie(null);
    window.location.reload();
    return;
  }
  writeCookie(`/en/${code}`);
  await loadTranslator();
  const select = await translatorSelect();
  if (select) {
    select.value = code;
    select.dispatchEvent(new Event('change'));
  }
}

/** On load: keeps a language chosen on an earlier page. */
export function restoreLanguage(): LanguageCode {
  const code = currentLanguage();
  if (code !== 'en') loadTranslator().catch(() => undefined);
  return code;
}
