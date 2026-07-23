export enum Language {
  English = 'en',
  Russian = 'ru',
}

export const LanguageNativeNames = [
  { name: 'English', locale: Language.English },
  { name: 'Русский', locale: Language.Russian },
];

export const locales = LanguageNativeNames.map((item) => item.locale);
