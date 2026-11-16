/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-embed", "prettier-plugin-sql"],
  embeddedSqlTags: ["sql"],
  language: "postgresql",
  keywordCase: "upper",
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
};
