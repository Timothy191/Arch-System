const fs = require('fs');
const file = 'libs/features/hub/ui/src/HeroRotator.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { ThreeHeroRotatorDynamic as GenericHeroRotator } from '@repo/ui/ThreeHeroRotatorDynamic';",
  "import { HeroRotator as GenericHeroRotator } from '@repo/ui/HeroRotator';"
);

fs.writeFileSync(file, code);
