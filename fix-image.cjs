const fs = require('fs');
const file = 'apps/portal/components/RouteBackground.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import Image from 'next/image';")) {
  code = code.replace(
    "import { useEffect, useRef, useState } from 'react';",
    "import { useEffect, useRef, useState } from 'react';\nimport Image from 'next/image';"
  );
}

const target = `<img
          id="route-bg-light-image"
          src="/background/global-background-poster.webp"
          alt=""
          className="route-bg-image object-cover object-center w-full h-full filter brightness-105"
        />`;

const replacement = `<Image
          id="route-bg-light-image"
          src="/background/global-background-poster.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="route-bg-image object-cover object-center filter brightness-105"
        />`;

code = code.replace(target, replacement);

fs.writeFileSync(file, code);
