export const backendLanguageFunctionRegister: Record<string, string> = {
  java: [
    'Use Maven with Spring Boot for the backend.',
    'Keep Controller, Service, Repository/Mapper, DTO, validation, and centralized error handling separated.',
    'Provide Application.java and YAML configuration without hardcoded secrets.',
  ].join(' '),
  node: 'Use Node.js with a typed API layer, request validation, centralized error handling, and environment-based configuration.',
  typescript: 'Use TypeScript with a typed API layer, request validation, centralized error handling, and environment-based configuration.',
  python: 'Use Python with explicit schemas, request validation, centralized error handling, and environment-based configuration.',
};
