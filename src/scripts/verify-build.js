import fs from 'fs';
import path from 'path';

const errors = [];
const warnings = [];

console.log('🔍 Verifying build configuration...\n');

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'netlify.toml',
  'index.html',
  'App.tsx',
  'src/main.tsx',
  '.env.example',
  '.gitignore'
];

const requiredDirs = [
  'components',
  'lib',
  'src',
  'styles',
  'public',
  'database'
];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file}`);
  } else {
    errors.push(`Missing required file: ${file}`);
    console.log(`✗ ${file} - MISSING`);
  }
});

console.log('\n📂 Checking required directories...');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✓ ${dir}/`);
  } else {
    errors.push(`Missing required directory: ${dir}`);
    console.log(`✗ ${dir}/ - MISSING`);
  }
});

console.log('\n🔧 Checking package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (!pkg.scripts.build) {
    errors.push('Missing build script in package.json');
  } else {
    console.log(`✓ Build script: ${pkg.scripts.build}`);
  }
  
  if (!pkg.dependencies.react) {
    errors.push('Missing React dependency');
  } else {
    console.log(`✓ React: ${pkg.dependencies.react}`);
  }
  
  if (!pkg.devDependencies.typescript) {
    errors.push('Missing TypeScript dependency');
  } else {
    console.log(`✓ TypeScript: ${pkg.devDependencies.typescript}`);
  }
  
  if (!pkg.devDependencies.vite) {
    errors.push('Missing Vite dependency');
  } else {
    console.log(`✓ Vite: ${pkg.devDependencies.vite}`);
  }
} catch (error) {
  errors.push('Failed to parse package.json');
}

console.log('\n⚙️  Checking netlify.toml...');
try {
  const netlifyConfig = fs.readFileSync('netlify.toml', 'utf8');
  
  if (!netlifyConfig.includes('publish = "dist"')) {
    errors.push('Netlify publish directory not set to dist');
  } else {
    console.log('✓ Publish directory: dist');
  }
  
  if (!netlifyConfig.includes('command = "npm run build"')) {
    warnings.push('Build command might not be standard');
  } else {
    console.log('✓ Build command: npm run build');
  }
} catch (error) {
  errors.push('Failed to read netlify.toml');
}

console.log('\n📝 Checking TypeScript config...');
try {
  const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  
  if (!tsconfig.compilerOptions.jsx) {
    errors.push('Missing jsx compiler option');
  } else {
    console.log(`✓ JSX: ${tsconfig.compilerOptions.jsx}`);
  }
  
  if (!tsconfig.include) {
    warnings.push('No include array in tsconfig.json');
  } else {
    console.log(`✓ Include: ${tsconfig.include.join(', ')}`);
  }
} catch (error) {
  errors.push('Failed to parse tsconfig.json');
}

console.log('\n🔐 Checking .gitignore...');
try {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  const required = ['node_modules', 'dist', '.env'];
  
  required.forEach(item => {
    if (gitignore.includes(item)) {
      console.log(`✓ Ignoring: ${item}`);
    } else {
      warnings.push(`.gitignore missing: ${item}`);
    }
  });
} catch (error) {
  warnings.push('No .gitignore file found');
}

console.log('\n🎨 Checking for images...');
const componentFiles = fs.readdirSync('components');
const portfolioFile = componentFiles.find(f => f === 'Portfolio.tsx');
if (portfolioFile) {
  const content = fs.readFileSync(path.join('components', portfolioFile), 'utf8');
  if (content.includes('figma:asset')) {
    console.log('✓ Portfolio uses figma:asset imports');
  } else {
    warnings.push('Portfolio may not have proper image imports');
  }
}

console.log('\n📊 Counting components...');
const components = componentFiles.filter(f => f.endsWith('.tsx'));
console.log(`✓ Found ${components.length} components`);

if (components.length < 15) {
  warnings.push(`Only ${components.length} components found (expected ~17)`);
}

console.log('\n📋 Summary:\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Your project is ready for deployment.\n');
  console.log('Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. Run: npm run preview');
  console.log('3. Deploy to Netlify\n');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} error(s) found:\n`);
    errors.forEach(err => console.log(`   - ${err}`));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s):\n`);
    warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('Please fix the errors before deploying.\n');
    process.exit(1);
  } else {
    console.log('Warnings can be ignored, but should be reviewed.\n');
    process.exit(0);
  }
}
