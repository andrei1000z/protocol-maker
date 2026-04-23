// Server-safe boot script export — separated from lib/i18n/index.ts so
// the layout (a server component) can import it without dragging in the
// `useState`/`useEffect` hooks the client picker uses.

export const I18N_BOOT_SCRIPT = `
(function(){try{var v=localStorage.getItem('protocol:locale');if(v==='ro'||v==='en'){document.documentElement.setAttribute('lang',v);}}catch(e){}})();
`.trim();
