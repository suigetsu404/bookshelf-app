async function i18nextInit() {
    const enTranslation = await fetch('locales/en.json').then(res => res.json()).then(data => data.translation);
    const plTranslation = await fetch('locales/pl.json').then(res => res.json()).then(data => data.translation);
    const preferredLang = localStorage.getItem('preferredLang') || 'en';
    await i18next.init({
        lng: preferredLang,
        fallbackLng: 'pl',
        debug: true,
        resources: {
            en: { translation: enTranslation },
            pl: { translation: plTranslation }
        }
    });
    updateContent();
}

function updateContent() {
    const username = document.body.getAttribute('data-username');
    const i18nOptions = username ? { username: username } : {};
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key.startsWith('[')){
            const attribute = key.substring(key.indexOf('[') + 1, key.indexOf(']'));
            const actualKey = key.substring(key.indexOf(']') + 1);
            element.setAttribute(attribute, i18next.t(actualKey, i18nOptions)); 
        } else {
            element.innerHTML = i18next.t(key, { ...i18nOptions, interpolation: { escapeValue: false } }); 
        }
    });
    document.documentElement.lang = i18next.language;
}

function changeLanguage(lng) {
    i18next.changeLanguage(lng, (err, t) => {
        if (err) return console.error('Error changing languagae:', err);
        localStorage.setItem('preferredLang', lng);
        updateContent();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    i18nextInit();
    const btnEn = document.getElementById('lang-en');
    const btnPl = document.getElementById('lang-pl');

    btnEn.addEventListener('click', () => changeLanguage('en'));
    btnPl.addEventListener('click', () => changeLanguage('pl'));
});