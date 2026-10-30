# Certificate fonts

Fonts are served locally and embedded in PDFs. See the accompanying OFL licenses.

- Poppins Bold and SemiBoldItalic: https://github.com/google/fonts/tree/main/ofl/poppins
- Inter Regular: https://github.com/rsms/inter/tree/master/docs/font-files

`Inter-Regular.ttf` is a lossless conversion of the upstream static `Inter-Regular.woff2`, using FontTools (`TTFont`, set `flavor=None`, save). The complete Inter font is embedded: subsetting with the current pdf-lib/fontkit version produced incomplete glyphs during actual Poppler rendering. Poppins is subset normally. No accents are stripped or replaced.

## Approved ornate certificate

Tinos Bold and Bold Italic (OFL) reproduce the serif typography of the supplied reference. Source: https://github.com/google/fonts/tree/main/ofl/tinos ; license from https://github.com/googlefonts/tinos/blob/main/OFL.txt . Inter Bold is converted losslessly from the same official static Inter source as Regular, and embedded without subsetting. Poppins remains available for the app UI.
