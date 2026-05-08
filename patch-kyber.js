const fs = require('fs');
const path = require('path');

const kyberDir = path.join(__dirname, 'node_modules', 'crystals-kyber');
const filesToPatch = ['kyber512.js', 'kyber768.js', 'kyber1024.js'];

filesToPatch.forEach(file => {
  const filePath = path.join(kyberDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Remove fs dependency for the browser build
    content = content.replace(/let fs = require\('fs'\);/g, "let fs = { readFileSync: () => '' };");
    
    // 2. Fix the webcrypto import for the browser
    content = content.replace(
      /const webcrypto = require\('crypto'\)\.webcrypto;/g, 
      "const webcrypto = (typeof window !== 'undefined' && window.crypto) ? window.crypto : require('crypto').webcrypto;"
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  }
});
