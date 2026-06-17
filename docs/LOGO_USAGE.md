# Plantcor Logo Usage & Implementation Guide

## File Inventory

| File                              | Purpose                                         | Dimensions   |
| :-------------------------------- | :---------------------------------------------- | :----------- |
| `assets/plantcor.svg`             | **PRIMARY UI VECTOR** (use this in production)  | Scalable     |
| `assets/plantcor.png`             | Compressed master PNG (38KB → ~8KB)             | Original     |
| `assets/plantcor-header.png`      | Light header/navbar variant                     | Height: 36px |
| `assets/plantcor-header-dark.png` | Dark header variant (for `#1e293b` backgrounds) | Height: 36px |
| `assets/plantcor-login.png`       | Login page brand mark                           | Width: 120px |

## Implementation Code Snippets

### React / Next.js (Header)

```jsx
import Logo from "@/assets/plantcor.svg";
<Link href="/dashboard">
  <img src={Logo} alt="Plantcor" className="h-9 w-auto" />
</Link>;
```

### React / Next.js (Login Page)

```jsx
import Logo from "@/assets/plantcor-login.png";
<img src={Logo} alt="Plantcor" className="w-[120px] h-auto mx-auto mb-6" />;
```

### Pure HTML/CSS (Header)

```html
<img src="/assets/plantcor-header.png" alt="Plantcor" style="height: 36px;" />
```

## Color Palette

_Fill these out by opening the logo in GIMP/Inkscape and using the color picker:_

- Primary Brand: `#__________`
- Secondary Accent: `#__________`
- Use the primary color for all `<a>` links and primary action buttons to match the brand.
