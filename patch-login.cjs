const fs = require('fs');
const file = 'libs/features/auth/ui/src/LoginForm.tsx';
let code = fs.readFileSync(file, 'utf8');

const originalBlur = `onBlur={(e) => {
              if (e.target.value && e.target.validity.typeMismatch) {
                toast.error('Please enter a valid email address');
              } else if (e.target.value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e.target.value)) {
                toast.error('Please enter a valid email address');
              }
            }}`;

const fixedBlur = `onBlur={(e) => {
              if (e.target.validity.typeMismatch) {
                toast.error('Please enter a valid email address');
              } else if (e.target.value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e.target.value)) {
                toast.error('Please enter a valid email address');
              }
            }}`;

code = code.replace(originalBlur, fixedBlur);
fs.writeFileSync(file, code);
