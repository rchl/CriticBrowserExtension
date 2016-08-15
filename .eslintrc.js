module.exports = {
  "env": {
    "browser": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "rules": {
    // Possible Errors
    "no-constant-condition": [
      "error",
      {
        "checkLoops": false,
      },
    ],

    // Best practices
    "curly": "error",
    "eqeqeq": "error",
    "no-console": [
      "error",
      {
        "allow": ["assert", "error", "warn"],
      },
    ],
    "no-else-return": "error",
    "no-extra-boolean-cast": "off",  // expressiveness beats it
    "no-fallthrough": [
      "error",
      {
        "commentPattern": "falls?(\\s|\\-)?through",
      },
    ],
    "no-invalid-this": "error",
    "no-multi-spaces": "error",
    "no-undef": "off",
    "no-unused-vars": [
      "error",
      {
        "vars": "local",
        "args": "none",
      },
    ],

    // Stylistic
    "array-bracket-spacing": "error",
    "block-spacing": "error",
    "brace-style": [
      "error",
      "1tbs",
      {
        "allowSingleLine": true,
      },
    ],
    // "camelcase": "error",  // triggers on opt_foo
    // "comma-dangle": ["error", "always-multiline"],  // investigate
    "comma-spacing": "error",
    "comma-style": "error",
    "computed-property-spacing": "error",
    "eol-last": "error",
    "key-spacing": "error",
    "keyword-spacing": "error",
    "linebreak-style": "error",
    "max-len": "error",
    "new-cap": [
      "error",
      {
        "capIsNew": false,
      },
    ],
    "new-parens": "error",
    "no-multiple-empty-lines": [
      "error",
      {
        "max": 1,
      },
    ],
    "no-spaced-func": "error",
    "no-trailing-spaces": "error",
    "no-unneeded-ternary": "error",
    "no-whitespace-before-property": "error",
    "object-curly-spacing": "error",
    "object-property-newline": [
      "error",
      {
        "allowMultiplePropertiesPerLine": true,
      },
    ],
    "one-var-declaration-per-line": "error",
    "operator-linebreak": ["error", "after"],
    "quotes": ["error", "single"],
    "semi-spacing": "error",
    "space-before-blocks": "error",
    "space-before-function-paren": ["error", "never"],
    "space-in-parens": "error",
    "space-infix-ops": "error",
    "space-unary-ops": "error",
    // "spaced-comment": "error",  // triggers on fn(/*foo=*/false)

    // Ecmascript 6
    "arrow-body-style": ["error", "as-needed"],
    "arrow-parens": ["error", "as-needed"],
    "arrow-spacing": "error",
    "generator-star-spacing": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-var": "error",
    "prefer-arrow-callback": "error",
    "prefer-template": "error",
    "rest-spread-spacing": "error",
    "template-curly-spacing": "error",
    "yield-star-spacing": "error",
  },
};
